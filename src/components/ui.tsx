'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';

export function Flash() {
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const msg = sp.get('msg');
  const [shown, setShown] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    setShown(msg);
    const q = new URLSearchParams(sp.toString());
    q.delete('msg');
    router.replace(`${path}${q.toString() ? `?${q}` : ''}`, { scroll: false });
    const t = setTimeout(() => setShown(null), 5000);
    return () => clearTimeout(t);
  }, [msg]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!shown) return null;
  return <div className="flash" role="status" onClick={() => setShown(null)}>{shown}</div>;
}

export function Submit({ children, className = 'btn primary', pending = 'Working…', ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { pending?: string }) {
  const { pending: p } = useFormStatus();
  return <button type="submit" className={className} disabled={p || rest.disabled} {...rest}>{p ? pending : children}</button>;
}

export function Copy({ text, label = 'Copy', className = 'btn sm' }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className={className} onClick={async () => {
      try { await navigator.clipboard.writeText(text); } catch {
        const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
      }
      setDone(true); setTimeout(() => setDone(false), 1600);
    }}>{done ? 'Copied ✓' : label}</button>
  );
}

/** Two-step confirm inside the page (browsers' confirm() dialogs are avoided). */
export function Confirm({ action, label, confirmLabel = 'Yes, do it', className = 'btn sm danger' }: { action: () => Promise<void>; label: string; confirmLabel?: string; className?: string }) {
  const [ask, setAsk] = useState(false);
  if (!ask) return <button type="button" className={className} onClick={() => setAsk(true)}>{label}</button>;
  return (
    <form action={action} className="row" style={{ display: 'inline-flex' }}>
      <Submit className="btn sm danger" pending="…">{confirmLabel}</Submit>
      <button type="button" className="btn sm ghost" onClick={() => setAsk(false)}>Cancel</button>
    </form>
  );
}

const NAV: { grp?: string; href?: string; label?: string; key?: string }[] = [
  { grp: 'Weekly flow' },
  { href: '/app', label: 'Home' },
  { href: '/app/stories', label: 'Story pool', key: 'stories' },
  { href: '/app/editions', label: 'Editions', key: 'editions' },
  { href: '/app/leads', label: 'Leads', key: 'leads' },
  { grp: 'Inputs' },
  { href: '/app/knowledge', label: 'Our work (knowledge)', key: 'kb' },
  { href: '/app/contacts', label: 'Contacts' },
  { href: '/app/sources', label: 'News sources' },
  { grp: 'System' },
  { href: '/app/automations', label: 'Automations' },
  { href: '/app/notifications', label: 'Notifications', key: 'notif' },
  { href: '/app/outbox', label: 'Email outbox', key: 'outbox' },
  { href: '/app/settings', label: 'Settings' },
  { href: '/app/guide', label: 'How it works' },
];

export function Nav({ counts }: { counts: Record<string, number> }) {
  const path = usePathname();
  return (
    <nav className="nav" aria-label="Main">
      {NAV.map((n, i) => n.grp ? <div className="grp" key={i}>{n.grp}</div> : (
        <Link key={n.href} href={n.href!} aria-current={(n.href === '/app' ? path === '/app' : path.startsWith(n.href!)) ? 'page' : undefined}>
          <span>{n.label}</span>{n.key && counts[n.key] ? <span className="count">{counts[n.key]}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

export function ProductSwitch({ products, current, action }: { products: { id: string; name: string; newsletter_name: string }[]; current: string; action: (fd: FormData) => Promise<void> }) {
  const path = usePathname();
  return (
    <form action={action} className="switch" onSubmit={(e) => { const t = e.currentTarget.elements.namedItem('to') as HTMLInputElement; t.value = window.location.pathname + window.location.search; }}>
      <label htmlFor="product-switch">Product</label>
      <input type="hidden" name="to" defaultValue={path} />
      <select key={current} id="product-switch" name="product" defaultValue={current} onChange={(e) => e.currentTarget.form?.requestSubmit()}>
        {products.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.newsletter_name}</option>)}
      </select>
    </form>
  );
}

const setMenu = (open: boolean) => {
  document.querySelector('.side')?.classList.toggle('open', open);
  document.querySelector('.backdrop')?.classList.toggle('on', open);
  document.querySelectorAll('[data-menu-toggle]').forEach((b) => b.setAttribute('aria-expanded', String(open)));
  if (open) (document.querySelector('.side a, .side select') as HTMLElement | null)?.focus();
};
export function MobileToggle() {
  return <button type="button" data-menu-toggle aria-controls="sidebar" aria-expanded="false" onClick={() => setMenu(!document.querySelector('.side')?.classList.contains('open'))}>☰ Menu</button>;
}
export function MenuClose() {
  return <button type="button" className="side-close" aria-label="Close menu" onClick={() => setMenu(false)}>✕</button>;
}
export function CloseOnNav() {
  const path = usePathname();
  useEffect(() => { setMenu(false); }, [path]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  return <div className="backdrop" onClick={() => setMenu(false)} aria-hidden="true" />;
}
