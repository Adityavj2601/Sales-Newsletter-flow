import { api } from '@/lib/api';
import { getEdition } from '@/lib/editions';
import { getProduct, baseUrl } from '@/lib/settings';
import { renderEmail } from '@/lib/render/email';

export const GET = api<{ id: string }>(async ({ params }) => {
  const e = getEdition(params.id);
  if (!e) throw new Error('Edition not found');
  const p = getProduct(e.product_id)!;
  const html = renderEmail(e, p, null, { base: baseUrl() });
  return new Response(html, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
});
