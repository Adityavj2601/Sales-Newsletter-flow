import { Suspense } from 'react';
import { requireUser } from '@/lib/auth';
import { activeProduct } from '@/lib/context';
import { listProducts, getSetting } from '@/lib/settings';
import { get } from '@/lib/db';
import { seedProducts } from '@/lib/seed';
import { Nav, ProductSwitch, Flash, MobileToggle, CloseOnNav } from '@/components/ui';
import { switchProduct, logout } from './actions';

export const dynamic = 'force-dynamic';

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (!listProducts().length) seedProducts();
  const p = await activeProduct();
  const products = listProducts();
  const n = (sql: string, ...a: any[]) => Number(get(sql, ...a)?.n || 0);
  const counts: Record<string, number> = p ? {
    notif: n('SELECT COUNT(*) AS n FROM notifications WHERE read_at IS NULL AND (product_id = ? OR product_id IS NULL)', p.id),
    stories: n("SELECT COUNT(*) AS n FROM stories WHERE product_id = ? AND status = 'new' AND score >= 60", p.id),
    editions: n("SELECT COUNT(*) AS n FROM editions WHERE product_id = ? AND status IN ('review')", p.id),
    leads: n("SELECT COUNT(*) AS n FROM contacts WHERE product_id = ? AND last_intent_at >= ? AND stage IN ('new','warm')", p.id, new Date(Date.now() - 14 * 86400_000).toISOString()),
    kb: n('SELECT COUNT(*) AS n FROM kb_items WHERE product_id = ? AND active = 0', p.id),
    outbox: n('SELECT COUNT(*) AS n FROM outbox'),
  } : {};
  const g = getSetting('general');
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand"><span className="brand-mark">B</span>{g.appName}</div>
        {p && <ProductSwitch products={products} current={p.id} action={switchProduct} />}
        <Nav counts={counts} />
        <div className="side-foot">
          <span>Signed in as {user.name}</span>
          <form action={logout}><button type="submit">Sign out</button></form>
        </div>
      </aside>
      <div style={{ minWidth: 0 }}>
        <div className="mobile-top"><MobileToggle /><b>{p?.name}</b></div>
        <main className="main">{children}</main>
      </div>
      <Suspense><Flash /><CloseOnNav /></Suspense>
    </div>
  );
}
