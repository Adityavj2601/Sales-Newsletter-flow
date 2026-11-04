'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useFormStatus, createPortal } from 'react-dom';
import Link from 'next/link';
import { Icon } from './shell/icons';
import { NAV, isActive } from './shell/nav';
import { guardedNav } from './shell/navGuard';

/** Toast: reads ?msg= set by server actions, shows a glass toast that slides in and fades out. */
export function Flash() {
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const msg = sp.get('msg');
  const [shown, setShown] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (!msg) return;
    setShown(msg);
    setLeaving(false);
    const q = new URLSearchParams(sp.toString());
    q.delete('msg');
    router.replace(`${path}${q.toString() ? `?${q}` : ''}`, { scroll: false });
    const t1 = setTimeout(() => setLeaving(true), 4200);
    const t2 = setTimeout(() => setShown(null), 4450);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [msg]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!shown) return null;
  const bad = /^(fail|could|can’t|can't|not |only |that |a valid|“|too |unknown|enter|add an|pick|type|give)/i.test(shown);
  return (
    <div className="toast-host" role="status" aria-live="polite">
      <div className={`toast ${leaving ? 'out' : ''}`} onClick={() => setLeaving(true)}>
        <span aria-hidden style={{ width: 20, height: 20, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, flex: 'none', background: bad ? 'var(--bad-bg)' : 'var(--ok-bg)', color: bad ? 'var(--bad)' : 'var(--ok)' }}>{bad ? '!' : '✓'}</span>
        <span>{shown}</span>
      </div>
    </div>
  );
}

export function Spinner({ size = 16 }: { size?: number }) {
  return <span className="spin" style={{ width: size, height: size }} aria-hidden />;
}

/** Modal sheet: slides up with a spring, closes on backdrop click or Escape. */
export function Sheet({ open, onClose, title, children, width }: { open: boolean; onClose: () => void; title?: string; children: React.ReactNode; width?: number }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = prev; };
  }, [open, onClose]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!open || !mounted) return null;
  // Portal to <body>: animated ancestors (page transitions) would otherwise trap position:fixed.
  return createPortal(
    <div className="sheet-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} style={width ? { width: `min(${width}px, 100%)` } : undefined}>
        {title && <div className="row" style={{ marginBottom: 12 }}><h2 style={{ margin: 0 }}>{title}</h2><span className="spacer" /><button type="button" className="btn sm" onClick={onClose} aria-label="Close">✕</button></div>}
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function Submit({ children, className = 'btn primary', pending = 'Working…', ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { pending?: string }) {
  const { pending: p } = useFormStatus();
  return <button type="submit" className={className} disabled={p || rest.disabled} aria-busy={p} {...rest}>{p ? <><Spinner size={14} />{pending}</> : children}</button>;
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

/* ---------- Shell: sidebar navigation, product switcher, mobile drawer ---------- */

/** True while the editor has collapsed the sidebar into an icon rail (it puts `ed-route` on <body>). */
function useRail() {
  const [rail, setRail] = useState(false);
  useEffect(() => {
    const b = document.body;
    const sync = () => setRail(b.classList.contains('ed-route'));
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(b, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, []);
  return rail;
}

export function Nav({ counts }: { counts: Record<string, number> }) {
  const path = usePathname();
  const rail = useRail();
  const ref = useRef<HTMLElement>(null);
  const [ind, setInd] = useState<{ y: number; h: number; ready: boolean } | null>(null);
  // One highlight that glides between items (macOS source-list feel) instead of each link fading on its own.
  useLayoutEffect(() => {
    const nav = ref.current;
    const a = nav?.querySelector<HTMLElement>('a[aria-current="page"]');
    if (!nav || !a) { setInd(null); return; }
    setInd((prev) => ({ y: a.offsetTop, h: a.offsetHeight, ready: !!prev }));
  }, [path, rail]);
  return (
    <nav className="nav" aria-label="Main" ref={ref}>
      {ind && <span className={`nav-ind${ind.ready ? ' ready' : ''}`} style={{ transform: `translateY(${ind.y}px)`, height: ind.h }} aria-hidden />}
      {NAV.map((g) => (
        <div className="nav-grp" key={g.grp}>
          <div className="grp" aria-hidden>{g.grp}</div>
          {g.items.map((n) => {
            const c = n.key ? counts[n.key] : 0;
            const name = `${n.label}${c ? `, ${c > 99 ? '99+' : c} new` : ''}`;
            return (
              <Link key={n.href} href={n.href} aria-current={isActive(n.href, path) ? 'page' : undefined} title={rail ? name : undefined} aria-label={rail ? name : undefined} data-label={n.label}>
                <Icon name={n.icon} />
                <span className="lbl">{n.label}</span>
                {c ? <span className={`count${n.key === 'notif' ? ' hot' : ''}`}><span className="sr">, </span>{c > 99 ? '99+' : c}<span className="sr"> new</span></span> : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

const monoHue = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

export function ProductSwitch({ products, current, action }: { products: { id: string; name: string; newsletter_name: string }[]; current: string; action: (fd: FormData) => Promise<void> }) {
  const path = usePathname();
  const cur = products.find((p) => p.id === current) || products[0];
  const [busy, setBusy] = useState(false);
  useEffect(() => { setBusy(false); }, [current]);
  return (
    <form action={action} className="switch" onSubmit={(e) => { setBusy(true); const t = e.currentTarget.elements.namedItem('to') as HTMLInputElement; t.value = window.location.pathname + window.location.search; }}>
      <label htmlFor="product-switch">Product</label>
      <input type="hidden" name="to" defaultValue={path} />
      <div className="switch-btn" data-busy={busy || undefined}>
        <span className="mono" style={{ ['--h' as string]: monoHue(cur?.name || 'B') }} aria-hidden>{(cur?.name || '?')[0]}</span>
        <span className="switch-txt" aria-hidden><b>{cur?.name}</b><small>{cur?.newsletter_name}</small></span>
        <span className="switch-chev" aria-hidden>{busy ? <Spinner size={13} /> : <Icon name="updown" size={15} />}</span>
        <select key={current} id="product-switch" name="product" defaultValue={current} title={cur ? `${cur.name} · ${cur.newsletter_name}` : undefined}
          onChange={(e) => { const sel = e.currentTarget; const v = sel.value; sel.value = current; guardedNav(() => { sel.value = v; sel.form?.requestSubmit(); }); }}>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.newsletter_name}</option>)}
        </select>
      </div>
    </form>
  );
}

const setMenu = (open: boolean) => {
  const side = document.querySelector('.side');
  if (!side) return;
  const was = side.classList.contains('open');
  side.classList.toggle('open', open);
  document.querySelector('.backdrop')?.classList.toggle('on', open);
  document.documentElement.classList.toggle('menu-open', open);
  document.querySelectorAll('[data-menu-toggle]').forEach((b) => b.setAttribute('aria-expanded', String(open)));
  if (open && !was) setTimeout(() => (document.querySelector('.side .side-close') as HTMLElement | null)?.focus({ preventScroll: true }), 60);
  if (!open && was && window.matchMedia('(max-width: 900px)').matches) (document.querySelector('[data-menu-toggle]') as HTMLElement | null)?.focus({ preventScroll: true });
};
export function MobileToggle() {
  return (
    <button type="button" className="icon-btn" data-menu-toggle aria-controls="sidebar" aria-expanded="false" onClick={() => setMenu(!document.querySelector('.side')?.classList.contains('open'))}>
      <Icon name="menu" size={21} /><span className="sr">Menu</span>
    </button>
  );
}
export function MenuClose() {
  return <button type="button" className="side-close" aria-label="Close menu" onClick={() => setMenu(false)}><Icon name="close" size={14} strokeWidth={2.2} /></button>;
}
export function CloseOnNav() {
  const path = usePathname();
  useEffect(() => { setMenu(false); }, [path]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && document.querySelector('.side.open')) setMenu(false); };
    window.addEventListener('keydown', k);
    const mq = window.matchMedia('(min-width: 901px)');
    const wide = () => { if (mq.matches) setMenu(false); };
    mq.addEventListener('change', wide);
    return () => { window.removeEventListener('keydown', k); mq.removeEventListener('change', wide); };
  }, []);
  return <div className="backdrop" onClick={() => setMenu(false)} aria-hidden="true" />;
}
/** Glass bars sit flush with the page at rest and gain their hairline only once content scrolls beneath them. */
export function ScrollEdge() {
  const path = usePathname();
  useEffect(() => {
    const root = document.documentElement;
    let raf = 0;
    const sync = () => { raf = 0; root.toggleAttribute('data-scrolled', window.scrollY > 2); };
    const on = () => { if (!raf) raf = requestAnimationFrame(sync); };
    sync();
    window.addEventListener('scroll', on, { passive: true });
    return () => { window.removeEventListener('scroll', on); cancelAnimationFrame(raf); };
  }, [path]);
  return null;
}

/**
 * Phones: segmented controls and tab strips scroll sideways. Bring the selected segment into view on every
 * navigation so “Meeting booked” or the fourth filter is never hidden off the edge.
 */
export function SegmentInView() {
  const path = usePathname();
  const sp = useSearchParams();
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      document.querySelectorAll<HTMLElement>('main .tabs, main .seg, main .cx-radio-seg, main .se-nav, main [data-seg]').forEach((bar) => {
        if (bar.scrollWidth <= bar.clientWidth + 1) return;
        const on = bar.querySelector<HTMLElement>('[aria-current="page"], [aria-current="true"], [aria-pressed="true"], [aria-selected="true"], [aria-checked="true"], input:checked + span');
        if (!on) return;
        const b = bar.getBoundingClientRect(), r = on.getBoundingClientRect();
        if (r.left >= b.left + 8 && r.right <= b.right - 28) return;
        bar.scrollTo({ left: bar.scrollLeft + (r.left + r.width / 2) - (b.left + b.width / 2), behavior: 'instant' as ScrollBehavior });
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [path, sp]);
  return null;
}
