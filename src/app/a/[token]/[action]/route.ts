import { get } from '@/lib/db';
import { getProduct, baseUrl } from '@/lib/settings';
import { track, addNote, resolveToken } from '@/lib/tracking';
import { shell, html } from '@/lib/render/page';
import { esc } from '@/lib/render/common';

export const dynamic = 'force-dynamic';
const ACTIONS = ['interested', 'book', 'more', 'notnow', 'showcase', 'poll', 'share'];

const COPY: Record<string, (name: string, product: string) => [string, string]> = {
  interested: (n, p) => [`Got it${n ? `, ${n}` : ''}.`, `Someone from the ${p} team will reach out within one business day. Anything specific you’d like us to cover?`],
  showcase: (n, p) => [`Thanks${n ? `, ${n}` : ''}.`, `We’ll show you how this works in a short call. The ${p} team will reach out within one business day. Anything you’d like us to cover?`],
  more: () => ['Noted.', 'We’ll send you more on this topic. Nothing else changes.'],
  notnow: () => ['No problem.', 'We’ll write less often from now on. You can unsubscribe in one click at any time.'],
  poll: () => ['Thanks for voting.', 'Your answer is counted. Results appear in a coming edition.'],
  share: () => ['Thanks for sharing.', ''],
};

async function handle(req: Request, params: Promise<{ token: string; action: string }>, note?: string, eventId?: string) {
  const { token, action } = await params;
  const u = new URL(req.url);
  const base = baseUrl(u.origin);
  if (!ACTIONS.includes(action)) return new Response('Unknown action', { status: 404 });
  const editionId = u.searchParams.get('e');
  const r = resolveToken(token, editionId);
  if (!r.editionId || !r.productId) return new Response('This link has expired.', { status: 404 });
  const p = getProduct(r.productId)!;
  const ed = get('SELECT slug, status FROM editions WHERE id = ?', r.editionId);
  const isTest = r.delivery?.channel === 'test' || (ed && ed.status !== 'sent' && ed.status !== 'sending' && !r.delivery);
  if (note && eventId && token !== '_') {
    addNote(eventId, token, note);
    return html(shell(p, 'Thank you', `<h1>Thank you.</h1><p>We’ve passed your note to the team.</p><div class="row"><a class="btn alt" href="${base}/e/${p.slug}/${ed?.slug || ''}${token !== '_' ? `?r=${token}` : ''}">Back to the edition</a></div>`, base));
  }
  let ev: any = null;
  if (!isTest) {
    const value = action === 'poll' ? u.searchParams.get('v') : action === 'showcase' ? u.searchParams.get('k') : null;
    ev = await track({ token: token === '_' ? null : token, editionId, type: action, value, meta: action === 'poll' ? { block: u.searchParams.get('b') } : null });
  }
  if (action === 'book') {
    const c = r.contact;
    if (p.brand.bookingUrl) {
      const b = new URL(p.brand.bookingUrl);
      if (c) { if (c.first_name) b.searchParams.set('name', `${c.first_name} ${c.last_name || ''}`.trim()); if (c.email) b.searchParams.set('email', c.email); }
      return Response.redirect(b.toString(), 302);
    }
    const [h] = COPY.interested(r.contact?.first_name || '', p.name);
    return html(shell(p, 'Thanks', `<h1>${esc(h)}</h1><p>We’ll message you to find a 15-minute slot that suits you.</p>`, base));
  }
  const [h, t] = (COPY[action] || COPY.interested)(r.contact?.first_name || '', p.name);
  const back = `${base}/e/${p.slug}/${ed?.slug || ''}${token !== '_' ? `?r=${token}` : ''}`;
  const form = (action === 'interested' || action === 'showcase') && ev?.id && token !== '_'
    ? `<form method="post"><input type="hidden" name="ev" value="${esc(ev.id)}"><textarea name="note" rows="3" placeholder="Optional: e.g. we’re launching in Pune in March"></textarea><div class="row"><button type="submit">Send note</button><a class="btn alt" href="${back}">Back to the edition</a></div></form>`
    : `<div class="row"><a class="btn alt" href="${back}">Back to the edition</a></div>`;
  return html(shell(p, 'Thanks', `<h1>${esc(h)}</h1>${t ? `<p>${esc(t)}</p>` : ''}${isTest ? '<p class="muted">(Test or preview: nothing was recorded.)</p>' : ''}${form}`, base));
}

export async function GET(req: Request, ctx: { params: Promise<{ token: string; action: string }> }) {
  return handle(req, ctx.params);
}
export async function POST(req: Request, ctx: { params: Promise<{ token: string; action: string }> }) {
  const fd = await req.formData();
  return handle(req, ctx.params, String(fd.get('note') || '').slice(0, 1000), String(fd.get('ev') || ''));
}
