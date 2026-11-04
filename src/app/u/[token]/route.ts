import { get, update, now } from '@/lib/db';
import { getProduct, baseUrl } from '@/lib/settings';
import { track, resolveToken } from '@/lib/tracking';
import { shell, html, badge } from '@/lib/render/page';
import { esc } from '@/lib/render/common';

export const dynamic = 'force-dynamic';

const TICK = '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

function page(req: Request, token: string, msg = '', confirmUnsub = false) {
  const u = new URL(req.url);
  const base = baseUrl(u.origin);
  const r = resolveToken(token);
  if (!r.contact || !r.productId) {
    const p = r.productId ? getProduct(r.productId) : getProduct(u.searchParams.get('p') || '');
    const reply = p?.brand.replyTo || p?.brand.senderEmail;
    const body = `<div class="done">${badge('info')}<h1>Unsubscribe</h1><p class="lead">This copy wasn’t sent with a personal link, so we can’t tell who you are from it.</p><p class="lead">${reply ? `Email <b>${esc(reply)}</b> with the word “unsubscribe”` : 'Reply to the email with the word “unsubscribe”'} and we’ll remove you straight away.</p></div>`;
    return p ? html(shell(p, 'Unsubscribe', body, base)) : new Response('Link expired', { status: 404 });
  }
  const p = getProduct(r.productId)!;
  const c = get('SELECT * FROM contacts WHERE id = ?', r.contact.id)!;
  const active = c.status === 'active';
  if (active && confirmUnsub) {
    return html(shell(p, 'Unsubscribe', `<div class="done">${badge('info')}<h1>Unsubscribe from ${esc(p.newsletter_name)}?</h1><p class="muted">${esc(c.email || c.phone || '')}</p></div>
      <form method="post"><input type="hidden" name="do" value="unsubscribe"><div class="row"><button type="submit" class="solid-danger">Yes, unsubscribe me</button><a class="btn alt" href="${base}/u/${esc(token)}">Fewer emails instead</a></div></form>`, base));
  }
  const body = `${msg ? `<div class="flash" role="status">${TICK}<span>${msg}</span></div>` : ''}${active ? `<h1>Your preferences</h1>
    <p class="muted">${esc(p.newsletter_name)} from ${esc(p.name)}</p>
    <form method="post"><input type="hidden" name="do" value="prefs">
    <div class="gh" id="g-freq">How often</div>
    <div class="group" role="radiogroup" aria-labelledby="g-freq">
    <label class="cell"><span class="t">Every week</span><input type="radio" name="frequency" value="weekly" ${c.frequency !== 'less' ? 'checked' : ''}></label>
    <label class="cell"><span class="t">Less often<small>Every other edition</small></span><input type="radio" name="frequency" value="less" ${c.frequency === 'less' ? 'checked' : ''}></label>
    </div>
    ${c.email || c.phone ? `<div class="gh">Send it to me</div><div class="group">
    ${c.email ? `<label class="cell"><span class="t">By email<small>${esc(c.email)}</small></span><input type="checkbox" role="switch" name="email" ${c.email_consent ? 'checked' : ''}></label>` : ''}
    ${c.phone ? `<label class="cell"><span class="t">On WhatsApp<small>${esc(c.phone)}</small></span><input type="checkbox" role="switch" name="wa" ${c.wa_consent ? 'checked' : ''}></label>` : ''}
    </div>` : ''}
    <div class="row"><button type="submit">Save</button></div></form>
    <form method="post" class="row"><input type="hidden" name="do" value="unsubscribe"><button class="destr" type="submit">Unsubscribe from everything</button></form>`
    : `<div class="done">${badge('info')}<h1>You’re unsubscribed</h1><p class="lead">You won’t receive ${esc(p.newsletter_name)} any more. Changed your mind?</p></div><form method="post"><input type="hidden" name="do" value="resubscribe"><div class="row"><button type="submit">Resubscribe</button></div></form>`}`;
  return html(shell(p, 'Preferences', body, base));
}

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // Footer links ask for a click first: mail scanners pre-fetch links and must not unsubscribe anyone.
  return page(req, token, '', new URL(req.url).searchParams.get('unsubscribe') === '1');
}
export async function HEAD(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const res = await GET(req, ctx);
  return new Response(null, { status: res.status, headers: res.headers });
}

/** Handles the preference form and RFC 8058 one-click unsubscribe (List-Unsubscribe-Post). */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = resolveToken(token);
  const ct = req.headers.get('content-type') || '';
  const fd = ct.includes('form') ? await req.formData() : new FormData();
  const action = String(fd.get('do') || (fd.get('List-Unsubscribe') ? 'unsubscribe' : new URL(req.url).searchParams.get('unsubscribe') === '1' ? 'unsubscribe' : ''));
  if (!r.contact) return page(req, token);
  if (action === 'unsubscribe' || fd.get('List-Unsubscribe') === 'One-Click') {
    if (r.contact.status === 'active') await track({ token, type: 'unsubscribe', meta: { via: 'one-click' } });
    return page(req, token, 'Done. You won’t hear from us again.');
  }
  if (action === 'resubscribe') {
    update('contacts', r.contact.id, { status: 'active', email_consent: r.contact.email ? 1 : 0, consent_source: 'Resubscribed via preferences page', consent_at: now() });
    await track({ token, type: 'resubscribe' });
    return page(req, token, 'Welcome back.');
  }
  if (action === 'prefs') {
    update('contacts', r.contact.id, { frequency: fd.get('frequency') === 'less' ? 'less' : 'weekly', email_consent: fd.get('email') ? 1 : 0, wa_consent: fd.get('wa') ? 1 : 0, consent_at: now() });
    return page(req, token, 'Saved.');
  }
  return page(req, token);
}
