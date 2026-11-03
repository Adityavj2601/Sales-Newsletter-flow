import { get, update, now } from '@/lib/db';
import { getProduct, baseUrl } from '@/lib/settings';
import { track, resolveToken } from '@/lib/tracking';
import { shell, html } from '@/lib/render/page';

export const dynamic = 'force-dynamic';

function page(req: Request, token: string, msg = '') {
  const base = baseUrl(new URL(req.url).origin);
  const r = resolveToken(token);
  if (!r.contact || !r.productId) {
    const p = r.productId ? getProduct(r.productId) : null;
    const body = '<h1>Preferences</h1><p>This is a test or shared link, so there’s nothing to change here.</p>';
    return p ? html(shell(p, 'Preferences', body, base)) : new Response('Link expired', { status: 404 });
  }
  const p = getProduct(r.productId)!;
  const c = get('SELECT * FROM contacts WHERE id = ?', r.contact.id)!;
  const active = c.status === 'active';
  const body = `${msg ? `<p><b>${msg}</b></p>` : ''}<h1>${active ? 'Your preferences' : 'You’re unsubscribed'}</h1>
  ${active ? `<form method="post"><input type="hidden" name="do" value="prefs">
    <p class="muted">${p.newsletter_name} from ${p.name}</p>
    <label><input type="radio" name="frequency" value="weekly" ${c.frequency !== 'less' ? 'checked' : ''}> Every week</label>
    <label><input type="radio" name="frequency" value="less" ${c.frequency === 'less' ? 'checked' : ''}> Less often (every other edition)</label>
    ${c.email ? `<label><input type="checkbox" name="email" ${c.email_consent ? 'checked' : ''}> By email (${c.email})</label>` : ''}
    ${c.phone ? `<label><input type="checkbox" name="wa" ${c.wa_consent ? 'checked' : ''}> On WhatsApp (${c.phone})</label>` : ''}
    <div class="row"><button type="submit">Save</button></div></form>
    <form method="post" class="row"><input type="hidden" name="do" value="unsubscribe"><button class="btn alt" type="submit">Unsubscribe from everything</button></form>`
    : `<p>You won’t receive ${p.newsletter_name} any more. Changed your mind?</p><form method="post"><input type="hidden" name="do" value="resubscribe"><button type="submit">Resubscribe</button></form>`}`;
  return html(shell(p, 'Preferences', body, base));
}

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const u = new URL(req.url);
  if (u.searchParams.get('unsubscribe') === '1') {
    const r = resolveToken(token);
    if (r.contact && r.contact.status === 'active') await track({ token, type: 'unsubscribe', meta: { via: 'link' } });
  }
  return page(req, token);
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
