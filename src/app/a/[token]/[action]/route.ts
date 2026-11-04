import { get } from '@/lib/db';
import { getProduct, baseUrl } from '@/lib/settings';
import { track, addNote, resolveToken, isBot } from '@/lib/tracking';
import { shell, html } from '@/lib/render/page';
import { esc } from '@/lib/render/common';

export const dynamic = 'force-dynamic';
const ACTIONS = ['interested', 'book', 'more', 'notnow', 'showcase', 'poll', 'share'];

const COPY: Record<string, (name: string, product: string) => [string, string]> = {
  interested: (n, p) => [`Got it${n ? `, ${n}` : ''}.`, `Someone from the ${p} team will reach out within one business day. Anything specific you’d like us to cover?`],
  showcase: (n, p) => [`Thanks${n ? `, ${n}` : ''}.`, `We’ll show you how this works in a short call. The ${p} team will reach out within one business day. Anything you’d like us to cover?`],
  book: (n, p) => [`Thanks${n ? `, ${n}` : ''}.`, `We’ll message you to find a 15-minute slot that suits you. Anything you’d like the ${p} team to prepare?`],
  more: () => ['Noted.', 'We’ll send you more on this topic. Nothing else changes.'],
  notnow: () => ['No problem.', 'We’ll write less often from now on. You can unsubscribe in one click at any time.'],
  poll: () => ['Thanks for voting.', 'Your answer is counted.'],
};

const noteForm = (evId: string, back: string) => `<form method="post"><input type="hidden" name="ev" value="${esc(evId)}"><label for="note" class="muted" style="display:block">Optional note for the team</label><textarea id="note" name="note" rows="3" maxlength="1000" placeholder="e.g. We’re launching in Pune in March"></textarea><div class="row"><button type="submit">Send note</button><a class="btn alt" href="${back}">Back to the edition</a></div></form>`;

async function handle(req: Request, params: Promise<{ token: string; action: string }>, note?: string, eventId?: string) {
  const { token: rawToken, action } = await params;
  const u = new URL(req.url);
  const base = baseUrl(u.origin);
  if (!ACTIONS.includes(action)) return new Response('Unknown action', { status: 404 });
  const editionId = u.searchParams.get('e');
  const r = resolveToken(rawToken, editionId);
  if (!r.editionId || !r.productId) return new Response('This link has expired.', { status: 404 });
  const token = r.delivery ? rawToken : '_'; // unknown tokens behave like the shared link
  const p = getProduct(r.productId)!;
  const ed = get('SELECT slug, status, content FROM editions WHERE id = ?', r.editionId);
  const back = `${base}/e/${p.slug}/${ed?.slug || ''}${token !== '_' ? `?r=${token}` : ''}`;
  const isTest = r.delivery?.channel === 'test' || (ed && ed.status !== 'sent' && ed.status !== 'sending' && !r.delivery);
  if (note !== undefined) {
    const saved = token !== '_' && eventId ? await addNote(eventId, token, note) : false;
    return html(shell(p, 'Thank you', saved
      ? `<h1>Thank you.</h1><p>We’ve passed your note to the team.</p><div class="row"><a class="btn alt" href="${back}">Back to the edition</a></div>`
      : `<h1>Sorry, that didn’t go through.</h1><p>Your note couldn’t be saved from this link. Just reply to the email or WhatsApp message instead and we’ll pick it up.</p><div class="row"><a class="btn alt" href="${back}">Back to the edition</a></div>`, base));
  }
  // Link scanners and HEAD requests see the page but never count as a reader action.
  const bot = req.method === 'HEAD' || isBot(req.headers.get('user-agent'));
  let ev: any = null;
  if (!isTest && !bot) {
    const value = action === 'poll' ? u.searchParams.get('v') : action === 'showcase' ? u.searchParams.get('k') : null;
    ev = await track({ token: token === '_' ? null : token, editionId: r.editionId, type: action, value, meta: action === 'poll' ? { block: u.searchParams.get('b') } : { via: 'link' } });
  }
  if (action === 'share') {
    let title = '';
    try { title = JSON.parse(ed?.content || '{}').title || ''; } catch { /* ignore */ }
    return Response.redirect(`https://wa.me/?text=${encodeURIComponent(`${title} — ${base}/e/${p.slug}/${ed?.slug || ''}`)}`, 302);
  }
  if (action === 'book' && p.brand.bookingUrl && /^https?:\/\//i.test(p.brand.bookingUrl)) {
    const b = new URL(p.brand.bookingUrl);
    const c = r.contact;
    if (c) { if (c.first_name) b.searchParams.set('name', `${c.first_name} ${c.last_name || ''}`.trim()); if (c.email) b.searchParams.set('email', c.email); }
    return Response.redirect(b.toString(), 302);
  }
  const [h, t] = (COPY[action] || COPY.interested)(r.contact?.first_name || '', p.name);
  const canNote = ['interested', 'showcase', 'book'].includes(action) && ev?.id && token !== '_';
  const body = `<h1>${esc(h)}</h1>${t ? `<p>${esc(t)}</p>` : ''}${isTest ? '<p class="muted">(Test or preview: nothing was recorded.)</p>' : ''}${canNote ? noteForm(ev.id, back) : `<div class="row"><a class="btn alt" href="${back}">Back to the edition</a></div>`}`;
  return html(shell(p, 'Thanks', body, base));
}

export async function GET(req: Request, ctx: { params: Promise<{ token: string; action: string }> }) {
  return handle(req, ctx.params);
}
export async function HEAD(req: Request, ctx: { params: Promise<{ token: string; action: string }> }) {
  const res = await handle(req, ctx.params);
  return new Response(null, { status: res.status, headers: res.headers });
}
export async function POST(req: Request, ctx: { params: Promise<{ token: string; action: string }> }) {
  const fd = await req.formData();
  return handle(req, ctx.params, String(fd.get('note') || ''), String(fd.get('ev') || ''));
}
