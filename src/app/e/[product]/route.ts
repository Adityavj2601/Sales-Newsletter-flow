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
  const list = eds.map((e) => { const c = parse<any>(e.content, {}); return `<a href="${base}/e/${p.slug}/${e.slug}"><span class="muted">#${e.number} · ${esc(fmtDate(e.sent_at))}</span><br><b>${esc(c.title)}</b><br><span class="muted">${esc(c.dek || '')}</span></a>`; }).join('');
  return html(shell(p, 'Past editions', `<h1>${esc(p.newsletter_name)}</h1><p class="muted">A weekly briefing from ${esc(p.name)}${p.brand.tagline ? `: ${esc(p.brand.tagline)}` : ''}.</p><div class="list">${list || '<p>The first edition is on its way.</p>'}</div>`, base));
}
