import { Suspense } from 'react';
import { requireUser } from '@/lib/auth';
import { activeProduct } from '@/lib/context';
import { listProducts, getSetting } from '@/lib/settings';
import { all, get, parse } from '@/lib/db';
import { seedProducts } from '@/lib/seed';
import { Nav, ProductSwitch, Flash, MobileToggle, CloseOnNav, MenuClose, ScrollEdge, SegmentInView } from '@/components/ui';
import { CommandPalette, PaletteButton, type PaletteItem } from '@/components/shell/CommandPalette';
import { Icon } from '@/components/shell/icons';
import { Avatar } from '@/components/bits';
import { switchProduct, logout } from './actions';

export const dynamic = 'force-dynamic';

const ED_STATUS: Record<string, string> = { draft: 'Draft', review: 'In review', approved: 'Approved', scheduled: 'Scheduled', sending: 'Sending', sent: 'Sent' };

/** What ⌘K can find in the active product: recent people, every edition, and the stories still in play. */
function paletteIndex(productId: string): PaletteItem[] {
  const people = all("SELECT id, first_name, last_name, email, company FROM contacts WHERE product_id = ? ORDER BY COALESCE(last_engaged_at, created_at) DESC LIMIT 200", productId)
    .map((c): PaletteItem => {
      const name = `${c.first_name || ''} ${c.last_name || ''}`.trim();
      return { k: 'c', id: c.id, label: name || String(c.email || 'Unnamed contact'), hint: c.company || (name ? c.email : undefined) || undefined, href: `/app/contacts/${c.id}` };
    });
  const editions = all('SELECT id, number, status, content FROM editions WHERE product_id = ? ORDER BY number DESC LIMIT 100', productId)
    .map((e): PaletteItem => ({ k: 'e', id: e.id, label: `#${e.number} ${parse<{ title?: string }>(e.content, {}).title || 'Untitled edition'}`, hint: ED_STATUS[e.status] || e.status, href: `/app/editions/${e.id}` }));
  const stories = all("SELECT id, title, publisher FROM stories WHERE product_id = ? AND status IN ('new','shortlisted') ORDER BY score DESC, created_at DESC LIMIT 50", productId)
    .map((s): PaletteItem => ({ k: 's', id: s.id, label: String(s.title), hint: String(s.publisher || '').replace(/^Google News:\s*/i, '') || undefined, href: `/app/stories?q=${encodeURIComponent(String(s.title).slice(0, 80))}` }));
  return [...people, ...editions, ...stories];
}

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
      {/* Every item is icon + text in its own span, with an accessible name on the control itself,
          so the editor can collapse this into an icon-only rail (`.ed-route .side`) without losing labels. */}
      <aside className="side" id="sidebar" aria-label="Sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden title={g.appName}><Icon name="editions" size={16} strokeWidth={2} /></span>
          <span className="brand-name">{g.appName}</span>
          <MenuClose />
        </div>
        <PaletteButton />
        {p && <ProductSwitch products={plist} current={p.id} action={switchProduct} />}
        <Nav counts={counts} />
        <div className="side-foot">
          <span title={`${user.name} · ${user.email}`}><Avatar name={user.name || user.email} size={30} /></span>
          <span className="who"><span className="sr">Signed in as </span><b>{user.name}</b><small>{user.email}</small></span>
          <form action={logout}><button type="submit" className="signout" title="Sign out" aria-label="Sign out"><Icon name="signout" size={17} /></button></form>
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
      <CommandPalette products={plist} current={p?.id} switchAction={switchProduct} logoutAction={logout} items={p ? paletteIndex(p.id) : []} />
      <Suspense><Flash /><CloseOnNav /><ScrollEdge /><SegmentInView /></Suspense>
    </div>
  );
}
