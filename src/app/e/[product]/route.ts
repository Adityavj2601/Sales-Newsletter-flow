import { all, parse } from '@/lib/db';
import { getProduct, baseUrl } from '@/lib/settings';
import { shell, html } from '@/lib/render/page';
import { esc } from '@/lib/render/common';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';
export async function GET(req: Request, { params }: { params: Promise<{ product: string }> }) {
  const p = getProduct((await params).product);
  if (!p) return new Response('Not found', { status: 404 });
  const base = baseUrl(new URL(req.url).origin);
  const eds = all("SELECT number, slug, content, sent_at FROM editions WHERE product_id = ? AND status = 'sent' ORDER BY number DESC", p.id);
  const chev = '<svg class="i chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
  const list = eds.map((e, i) => { const c = parse<any>(e.content, {}); return `<a class="ed${i === 0 ? ' latest' : ''}" href="${base}/e/${p.slug}/${e.slug}"><span class="no" aria-hidden="true">${e.number}</span><span class="tx">${i === 0 ? '<span class="pill">Latest</span>' : ''}<span class="meta">Edition ${e.number} · ${esc(fmtDate(e.sent_at))}</span><b>${esc(c.title)}</b>${c.dek ? `<span class="dek">${esc(c.dek)}</span>` : ''}</span>${chev}</a>`; }).join('');
  return html(shell(p, 'Past editions', `<h1>${esc(p.newsletter_name)}</h1><p class="lead">A weekly briefing from ${esc(p.name)}${p.brand.tagline ? `: ${esc(p.brand.tagline)}` : ''}.</p><div class="list">${list || '<p class="empty">The first edition is on its way.</p>'}</div>`, base));
}
