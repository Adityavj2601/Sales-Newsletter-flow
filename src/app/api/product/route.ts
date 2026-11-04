import { cookies } from 'next/headers';
import { api } from '@/lib/api';
import { getProduct } from '@/lib/settings';
import { PRODUCT_COOKIE } from '@/lib/context';

/** Switch the active product (used when opening another product's edition or contact). */
export const POST = api(async ({ body }) => {
  const p = getProduct(String(body.id || ''));
  if (!p) throw new Error('Product not found');
  (await cookies()).set(PRODUCT_COOKIE, p.id, { path: '/', maxAge: 365 * 86400, sameSite: 'lax', httpOnly: true });
  return { ok: true, name: p.name };
});
