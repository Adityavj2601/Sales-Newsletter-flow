import { get, update, now } from '@/lib/db';
import { getProduct, baseUrl } from '@/lib/settings';
import { track, resolveToken } from '@/lib/tracking';
import { shell, html } from '@/lib/render/page';
import { esc } from '@/lib/render/common';

export const dynamic = 'force-dynamic';

function page(req: Request, token: string, msg = '', confirmUnsub = false) {
  const u = new URL(req.url);
  const base = baseUrl(u.origin);
  const r = resolveToken(token);
  if (!r.contact || !r.productId) {
    const p = r.productId ? getProduct(r.productId) : getProduct(u.searchParams.get('p') || '');
    const reply = p?.brand.replyTo || p?.brand.senderEmail;
    const body = `<h1>Unsubscribe</h1><p>This copy wasn’t sent with a personal link, so we can’t tell who you are from it.</p><p>${reply ? `Email <b>${esc(reply)}</b> with the word “unsubscribe”` : 'Reply to the email with the word “unsubscribe”'} and we’ll remove you straight away.</p>`;
    return p ? html(shell(p, 'Unsubscribe', body, base)) : new Response('Link expired', { status: 404 });
  }
  const p = getProduct(r.productId)!;
  const c = get('SELECT * FROM contacts WHERE id = ?', r.contact.id)!;
  const active = c.status === 'active';
  if (active && confirmUnsub) {
    return html(shell(p, 'Unsubscribe', `<h1>Unsubscribe from ${esc(p.newsletter_name)}?</h1><p class="muted">${esc(c.email || c.phone || '')}</p>
      <form method="post"><input type="hidden" name="do" value="unsubscribe"><div class="row"><button type="submit">Yes, unsubscribe me</button><a class="btn alt" href="${base}/u/${esc(token)}">Fewer emails instead</a></div></form>`, base));
  }
  const body = `${msg ? `<p><b>${msg}</b></p>` : ''}<h1>${active ? 'Your preferences' : 'You’re unsubscribed'}</h1>
  ${active ? `<form method="post"><input type="hidden" name="do" value="prefs">
    <p class="muted">${esc(p.newsletter_name)} from ${esc(p.name)}</p>
    <label><input type="radio" name="frequency" value="weekly" ${c.frequency !== 'less' ? 'checked' : ''}> Every week</label>
    <label><input type="radio" name="frequency" value="less" ${c.frequency === 'less' ? 'checked' : ''}> Less often (every other edition)</label>
    ${c.email ? `<label><input type="checkbox" name="email" ${c.email_consent ? 'checked' : ''}> By email (${esc(c.email)})</label>` : ''}
    ${c.phone ? `<label><input type="checkbox" name="wa" ${c.wa_consent ? 'checked' : ''}> On WhatsApp (${esc(c.phone)})</label>` : ''}
    <div class="row"><button type="submit">Save</button></div></form>
    <form method="post" class="row"><input type="hidden" name="do" value="unsubscribe"><button class="btn alt" type="submit">Unsubscribe from everything</button></form>`
    : `<p>You won’t receive ${esc(p.newsletter_name)} any more. Changed your mind?</p><form method="post"><input type="hidden" name="do" value="resubscribe"><button type="submit">Resubscribe</button></form>`}`;
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
