import { get } from '@/lib/db';
import { getProduct, baseUrl, getSetting } from '@/lib/settings';
import { toEdition } from '@/lib/editions';
import { renderWeb } from '@/lib/render/web';
import { currentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export async function GET(req: Request, { params }: { params: Promise<{ product: string; slug: string }> }) {
  const { product, slug } = await params;
  const p = getProduct(product);
  if (!p) return new Response('Not found', { status: 404 });
  const row = get('SELECT * FROM editions WHERE product_id = ? AND slug = ?', p.id, slug);
  if (!row) return new Response('This edition does not exist.', { status: 404 });
  const e = toEdition(row as any);
  const u = new URL(req.url);
  const tok = u.searchParams.get('r');
  const d = tok ? get('SELECT d.*, c.first_name FROM deliveries d LEFT JOIN contacts c ON c.id = d.contact_id WHERE d.token = ? AND d.edition_id = ?', tok, e.id) : null;
  const published = e.status === 'sent' || e.status === 'sending';
  const wantsPreview = u.searchParams.has('preview');
  const user = !published || wantsPreview ? await currentUser() : null;
  if (!published && !d && !user) return new Response('This edition is not published yet.', { status: 404 });
  const preview = (wantsPreview && !!user) || (!published && !d) || d?.channel === 'test';
  const body = renderWeb(e, p, { base: baseUrl(u.origin), token: preview ? null : d?.token || null, firstName: d?.first_name || undefined, preview, tz: getSetting('general').timezone });
  return new Response(body, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'private, no-store', 'x-robots-tag': d ? 'noindex' : 'index' } });
}
