import { all, get, insert, update, uid, now, token, run, parse } from './db';
import { getEdition, type Edition } from './editions';
import { getProduct, getSetting, baseUrl, waReady, waToken, type Product } from './settings';
import { renderEmail, renderEmailText, renderWhatsApp } from './render/email';
import { sendMail } from './mailer';
import { personalize } from './format';
import { notify } from './alerts';
import { blockingFailures } from './checks';

export type Audience = { tags?: string[]; city?: string; stage?: string; onlyIds?: string[] };
export type SendConfig = { channels: ('email' | 'whatsapp')[]; audience: Audience };

export function canSend(e: Edition) {
  if (e.status !== 'approved' && e.status !== 'scheduled' && e.status !== 'sending' && e.status !== 'sent') return 'Approve the edition first.';
  const fails = blockingFailures(e.checks, e.overrides);
  if (fails.length) return `Fix or override ${fails.length} failing check${fails.length > 1 ? 's' : ''} first.`;
  return null;
}

/** Contacts eligible for a channel, honouring consent, unsubscribes and "less often". */
export function audienceFor(e: Edition, channel: 'email' | 'whatsapp' | 'wa_manual', a: Audience = {}) {
  const consent = channel === 'email' ? 'email_consent = 1 AND email IS NOT NULL AND email <> \'\'' : 'wa_consent = 1 AND phone IS NOT NULL AND phone <> \'\'';
  let rows = all(`SELECT * FROM contacts WHERE product_id = ? AND status = 'active' AND ${consent} ORDER BY score DESC, first_name`, e.product_id);
  if (a.onlyIds?.length) rows = rows.filter((r) => a.onlyIds!.includes(r.id));
  if (a.tags?.length) rows = rows.filter((r) => a.tags!.some((t) => String(r.tags || '').split(',').map((x: string) => x.trim().toLowerCase()).includes(t.toLowerCase())));
  if (a.city) rows = rows.filter((r) => (r.city || '').toLowerCase() === a.city!.toLowerCase());
  if (a.stage) rows = rows.filter((r) => r.stage === a.stage);
  // "Less often": skip if they received the previous edition.
  const prev = get("SELECT id FROM editions WHERE product_id = ? AND number < ? AND status = 'sent' ORDER BY number DESC LIMIT 1", e.product_id, e.number);
  if (prev) {
    const gotPrev = new Set(all('SELECT contact_id FROM deliveries WHERE edition_id = ? AND status <> \'failed\'', prev.id).map((r) => r.contact_id));
    rows = rows.filter((r) => r.frequency !== 'less' || !gotPrev.has(r.id));
  }
  return rows;
}

function existingDelivery(editionId: string, contactId: string, channel: string) {
  return get('SELECT * FROM deliveries WHERE edition_id = ? AND contact_id = ? AND channel = ?', editionId, contactId, channel);
}
function newDelivery(editionId: string, contactId: string | null, channel: string, status = 'queued', sendAfter: string | null = null) {
  const d = { id: uid('d_'), edition_id: editionId, contact_id: contactId, channel, token: token(10), status, error: null, provider_id: null, send_after: sendAfter, sent_at: null, created_at: now() };
  insert('deliveries', d);
  return d;
}

/** Queue email (and WhatsApp API) deliveries; the every-minute worker sends them at the configured pace. */
export function queueEdition(editionId: string, cfg: SendConfig) {
  const e = getEdition(editionId);
  if (!e) throw new Error('Edition not found');
  const why = canSend(e);
  if (why) throw new Error(why);
  let queued = 0;
  for (const ch of cfg.channels) {
    if (ch === 'whatsapp' && !waReady()) continue;
    for (const c of audienceFor(e, ch, cfg.audience)) {
      if (existingDelivery(e.id, c.id, ch)) continue;
      newDelivery(e.id, c.id, ch, 'queued', now());
      queued++;
    }
  }
  update('editions', e.id, { status: 'sending', send_config: JSON.stringify(cfg), scheduled_at: e.scheduled_at || now() });
  notify(e.product_id, 'send', `Sending edition #${e.number}`, `${queued} messages queued. They go out at the pace set in Settings.`, `/app/editions/${e.id}/distribute`);
  return queued;
}

export function scheduleEdition(editionId: string, at: string, cfg: SendConfig) {
  const e = getEdition(editionId);
  if (!e) throw new Error('Edition not found');
  const why = canSend(e);
  if (why) throw new Error(why);
  if (+new Date(at) < Date.now() - 60_000) throw new Error('That time is in the past.');
  update('editions', e.id, { status: 'scheduled', scheduled_at: at, send_config: JSON.stringify(cfg) });
}
export function unscheduleEdition(editionId: string) {
  update('editions', editionId, { status: 'approved', scheduled_at: null });
}

/** Called every minute: start due scheduled editions. */
export function startDueEditions(log: (s: string) => void) {
  for (const e of all("SELECT id, send_config FROM editions WHERE status = 'scheduled' AND scheduled_at <= ?", now())) {
    try {
      const n = queueEdition(e.id, parse(e.send_config, { channels: ['email'], audience: {} }));
      log(`Started scheduled edition ${e.id}: ${n} queued`);
    } catch (err: any) {
      update('editions', e.id, { status: 'approved', scheduled_at: null });
      const ed = getEdition(e.id);
      notify(ed?.product_id || null, 'error', `Scheduled send did not start for #${ed?.number}`, String(err?.message || err), `/app/editions/${e.id}/distribute`);
      log(`✕ ${e.id}: ${err?.message || err}`);
    }
  }
}

function emailHeaders(p: Product, d: any, base: string) {
  const unsub = `${base}/u/${d.token}?unsubscribe=1`;
  return {
    'List-Unsubscribe': `<${unsub}>${p.brand.replyTo || p.brand.senderEmail ? `, <mailto:${p.brand.replyTo || p.brand.senderEmail}?subject=unsubscribe>` : ''}`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    'X-Edition': d.edition_id,
  };
}
function fromFor(p: Product) {
  const smtp = getSetting('smtp');
  const addr = p.brand.senderEmail || (smtp.from.match(/<([^>]+)>/)?.[1] ?? smtp.from);
  return p.brand.senderName ? `"${p.brand.senderName.replace(/"/g, '')}" <${addr}>` : smtp.from || addr;
}

export async function sendOneEmail(d: any) {
  const e = getEdition(d.edition_id)!;
  const p = getProduct(e.product_id)!;
  const c = get('SELECT * FROM contacts WHERE id = ?', d.contact_id);
  if (!c || c.status !== 'active' || !c.email_consent) {
    update('deliveries', d.id, { status: 'failed', error: 'Contact unsubscribed or lost consent before sending' });
    return;
  }
  const base = baseUrl();
  const ctx = { token: d.token, firstName: c.first_name };
  try {
    const res = await sendMail({
      to: c.email, kind: 'edition', from: fromFor(p), replyTo: p.brand.replyTo || undefined,
      subject: personalize(e.content.subject, { first_name: c.first_name || '' }),
      html: renderEmail(e, p, ctx, { base, tz: getSetting('general').timezone }), text: renderEmailText(e, p, ctx, base), headers: emailHeaders(p, d, base),
    });
    update('deliveries', d.id, { status: 'sent', sent_at: now(), provider_id: res.id, error: res.outbox ? 'Stored in Outbox (SMTP not configured)' : null });
  } catch (err: any) {
    update('deliveries', d.id, { status: 'failed', error: String(err?.message || err).slice(0, 300) });
  }
}

export async function sendTestEmail(editionId: string, to: string) {
  const e = getEdition(editionId);
  if (!e) throw new Error('Edition not found');
  const p = getProduct(e.product_id)!;
  const d = newDelivery(e.id, null, 'test', 'sent');
  const base = baseUrl();
  const res = await sendMail({ to, kind: 'test', from: fromFor(p), subject: `[TEST] ${personalize(e.content.subject, { first_name: 'Test' })}`, html: renderEmail(e, p, { token: d.token, firstName: 'Test' }, { base }), text: renderEmailText(e, p, { token: d.token }, base), headers: emailHeaders(p, d, base) });
  update('deliveries', d.id, { sent_at: now(), provider_id: res.id });
  return res;
}

/* ---------- WhatsApp ---------- */

export function personalLink(e: Edition, p: Product, tok: string) {
  return `${baseUrl()}/e/${p.slug}/${e.slug}?r=${tok}`;
}

/** Manual click-to-chat: one delivery per contact, message pre-filled; you press send in WhatsApp. */
export function manualWhatsApp(editionId: string, contactId: string) {
  const e = getEdition(editionId)!;
  const p = getProduct(e.product_id)!;
  const c = get('SELECT * FROM contacts WHERE id = ?', contactId);
  if (!c?.phone) throw new Error('This contact has no phone number.');
  const d = existingDelivery(e.id, c.id, 'wa_manual') || newDelivery(e.id, c.id, 'wa_manual', 'queued');
  const text = renderWhatsApp(e, p, personalLink(e, p, d.token), c.first_name);
  return { delivery: d, text, url: `https://wa.me/${String(c.phone).replace(/\D/g, '')}?text=${encodeURIComponent(text)}` };
}
export function markManualSent(deliveryId: string) {
  run("UPDATE deliveries SET status = CASE WHEN status IN ('queued','failed') THEN 'sent' ELSE status END, sent_at = COALESCE(sent_at, ?) WHERE id = ?", now(), deliveryId);
}

async function waApi(path: string, body: any) {
  const w = getSetting('whatsapp');
  const res = await fetch(`https://graph.facebook.com/${w.apiVersion || 'v21.0'}/${path}`, { method: 'POST', headers: { authorization: `Bearer ${waToken()}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j?.error?.message || `HTTP ${res.status}`);
  return j;
}

export async function sendOneWhatsApp(d: any) {
  const e = getEdition(d.edition_id)!;
  const p = getProduct(e.product_id)!;
  const c = get('SELECT * FROM contacts WHERE id = ?', d.contact_id);
  if (!c || c.status !== 'active' || !c.wa_consent) { update('deliveries', d.id, { status: 'failed', error: 'No WhatsApp consent' }); return; }
  const w = getSetting('whatsapp');
  const base = baseUrl();
  const vars: Record<string, string> = { first_name: c.first_name || 'there', title: e.content.title, dek: e.content.dek, link: personalLink(e, p, d.token), newsletter: p.newsletter_name };
  const components: any[] = [];
  if (w.headerImage) components.push({ type: 'header', parameters: [{ type: 'image', image: { link: `${base}/og/${e.id}.png` } }] });
  const params = w.bodyParams.split(',').map((s) => s.trim()).filter(Boolean);
  if (params.length) components.push({ type: 'body', parameters: params.map((k) => ({ type: 'text', text: (vars[k] ?? k).slice(0, 900) })) });
  if (w.button === 'url') components.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: `${p.slug}/${e.slug}?r=${d.token}` }] });
  if (w.button === 'quick_reply') {
    components.push({ type: 'button', sub_type: 'quick_reply', index: '0', parameters: [{ type: 'payload', payload: `interested:${d.token}` }] });
    components.push({ type: 'button', sub_type: 'quick_reply', index: '1', parameters: [{ type: 'payload', payload: `notnow:${d.token}` }] });
  }
  try {
    const j = await waApi(`${w.phoneNumberId}/messages`, { messaging_product: 'whatsapp', to: String(c.phone).replace(/\D/g, ''), type: 'template', template: { name: w.templateName, language: { code: w.templateLang || 'en' }, components } });
    update('deliveries', d.id, { status: 'sent', sent_at: now(), provider_id: j?.messages?.[0]?.id || null });
  } catch (err: any) {
    update('deliveries', d.id, { status: 'failed', error: String(err?.message || err).slice(0, 300) });
  }
}

export async function testWhatsApp(to: string) {
  const w = getSetting('whatsapp');
  if (!waReady()) throw new Error('Fill in phone number ID, access token and template name first.');
  // hello_world is Meta's default sample template; it works on new accounts without approval.
  await waApi(`${w.phoneNumberId}/messages`, { messaging_product: 'whatsapp', to: to.replace(/\D/g, ''), type: 'template', template: { name: 'hello_world', language: { code: 'en_US' } } });
  return 'Sent Meta’s "hello_world" test template. Check the phone.';
}

/** Worker: send queued deliveries at the configured pace, then close finished editions. */
export async function processQueue(log: (s: string) => void) {
  const perMin = Math.max(1, getSetting('general').emailsPerMinute || 30);
  const batch = all("SELECT * FROM deliveries WHERE status = 'queued' AND channel IN ('email','whatsapp') AND (send_after IS NULL OR send_after <= ?) ORDER BY created_at LIMIT ?", now(), perMin);
  for (const d of batch) {
    if (d.channel === 'email') await sendOneEmail(d);
    else await sendOneWhatsApp(d);
  }
  if (batch.length) log(`Sent ${batch.length} queued message(s)`);
  for (const e of all("SELECT id, product_id, number FROM editions WHERE status = 'sending'")) {
    const left = get("SELECT COUNT(*) AS n FROM deliveries WHERE edition_id = ? AND status = 'queued' AND channel IN ('email','whatsapp')", e.id)?.n || 0;
    if (!left) {
      update('editions', e.id, { status: 'sent', sent_at: now() });
      markFeatured(e.id);
      const s = get("SELECT SUM(status <> 'failed') AS ok, SUM(status = 'failed') AS bad FROM deliveries WHERE edition_id = ? AND channel IN ('email','whatsapp')", e.id);
      notify(e.product_id, 'send', `Edition #${e.number} sent`, `${s?.ok || 0} delivered${s?.bad ? `, ${s.bad} failed` : ''}.`, `/app/editions/${e.id}/analytics`);
      log(`Edition ${e.id} finished`);
    }
  }
}

/** Mark an edition as sent without the email queue (e.g. WhatsApp-only, copied link). */
export function markSent(editionId: string) {
  update('editions', editionId, { status: 'sent', sent_at: now() });
  markFeatured(editionId);
}

/** Rotation bookkeeping: count how often each "Our work" item has been featured. */
export function markFeatured(editionId: string) {
  const e = getEdition(editionId);
  if (!e) return;
  for (const b of e.content.blocks) if (b.type === 'showcase' && b.kbId) run('UPDATE kb_items SET times_featured = times_featured + 1, last_featured_at = ? WHERE id = ?', now(), b.kbId);
}
