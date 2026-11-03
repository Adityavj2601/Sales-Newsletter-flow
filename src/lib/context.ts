import { cookies } from 'next/headers';
import { listProducts, type Product } from './settings';
import { requireUser } from './auth';
import { seedProducts } from './seed';

export const PRODUCT_COOKIE = 'snf_product';

export async function activeProduct(): Promise<Product | null> {
  const list = listProducts();
  if (!list.length) return null;
  const id = (await cookies()).get(PRODUCT_COOKIE)?.value;
  return list.find((p) => p.id === id) || list[0];
}

/** Signed-in user + the product selected in the sidebar. Pages call this first. */
export async function requireProduct(): Promise<Product> {
  await requireUser();
  if (!listProducts().length) seedProducts();
  const p = await activeProduct();
  if (!p) throw new Error('No product yet. Add one in Settings → Products.');
  return p;
}
