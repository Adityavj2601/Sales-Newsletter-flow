import { Suspense } from 'react';
import { requireUser } from '@/lib/auth';
import { activeProduct } from '@/lib/context';
import { listProducts, getSetting } from '@/lib/settings';
import { get } from '@/lib/db';
import { seedProducts } from '@/lib/seed';
import { Nav, ProductSwitch, Flash, MobileToggle, CloseOnNav, MenuClose } from '@/components/ui';
import { CommandPalette, PaletteButton } from '@/components/shell/CommandPalette';
import { Icon } from '@/components/shell/icons';
import { Avatar } from '@/components/bits';
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
  const plist = products.map((x) => ({ id: x.id, name: x.name, newsletter_name: x.newsletter_name }));
  return (
    <div className="shell">
      <a className="skip-link" href="#main">Skip to content</a>
      <aside className="side" id="sidebar" aria-label="Sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden><Icon name="editions" size={16} strokeWidth={2} /></span>
          <span className="brand-name">{g.appName}</span>
          <MenuClose />
        </div>
        <PaletteButton />
        {p && <ProductSwitch products={plist} current={p.id} action={switchProduct} />}
        <Nav counts={counts} />
        <div className="side-foot">
          <Avatar name={user.name || user.email} size={30} />
          <span className="who"><span className="sr">Signed in as </span><b>{user.name}</b><small>{user.email}</small></span>
          <form action={logout}><button type="submit" className="signout" title="Sign out"><Icon name="signout" size={17} /><span className="sr">Sign out</span></button></form>
        </div>
      </aside>
      <div className="stage">
        <header className="mobile-top">
          <MobileToggle />
          <div className="mt-title"><b>{p?.name || g.appName}</b>{p && <small>{p.newsletter_name}</small>}</div>
          <PaletteButton variant="icon" />
        </header>
        <main className="main" id="main">{children}</main>
      </div>
      <CommandPalette products={plist} current={p?.id} switchAction={switchProduct} logoutAction={logout} />
      <Suspense><Flash /><CloseOnNav /></Suspense>
    </div>
  );
}
