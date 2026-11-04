'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormStatus, createPortal } from 'react-dom';
import { Submit } from '@/components/ui';
import { setNavGuard } from '@/components/shell/navGuard';
import { Icon, Tile } from './icons';

/* ---------- Save bar: sticky glass footer that notices unsaved edits and guards leaving ---------- */
/** Where to go once a “Save” chosen in the unsaved-changes alert has finished (module scope: survives a remount). */
let afterSave: { go: () => void; at: number } | null = null;
function continueAfterSave() {
  const a = afterSave;
  afterSave = null;
  // Let the save's own redirect and toast settle, then go where the person was heading.
  if (a && Date.now() - a.at < 20000) setTimeout(a.go, 320);
}

export function SaveBar({ label = 'Save', pending = 'Saving…', children, note, scope }: { label?: string; pending?: string; children?: React.ReactNode; note?: React.ReactNode; scope?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [dirty, setDirty] = useState(false);
  const [leaving, setLeaving] = useState<null | (() => void)>(null);
  const { pending: busy } = useFormStatus();
  const router = useRouter();
  const was = useRef(false);
  const form = () => ref.current?.closest('form') || null;

  useEffect(() => {
    if (was.current && !busy) { setDirty(false); continueAfterSave(); }
    was.current = busy;
  }, [busy]);
  // The save's redirect can remount this page (its loading boundary); the fresh bar picks up where the old one left off.
  useEffect(() => { if (afterSave && !busy) continueAfterSave(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const f = form();
    if (!f) return;
    const on = (e: Event) => { if ((e.target as HTMLElement)?.closest?.('[data-nodirty]')) return; setDirty(true); };
    f.addEventListener('input', on);
    f.addEventListener('change', on);
    return () => { f.removeEventListener('input', on); f.removeEventListener('change', on); };
  }, []);

  // While there are unsaved edits: catch in-app link clicks (section list, sidebar, tabs), the palette and tab close.
  useEffect(() => {
    if (!dirty) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download') || a.closest('[role="alertdialog"]')) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname.startsWith('/api/')) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      e.preventDefault();
      e.stopPropagation();
      const to = url.pathname + url.search + url.hash;
      setLeaving(() => () => router.push(to));
    };
    const onUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('click', onClick, true);
    window.addEventListener('beforeunload', onUnload);
    setNavGuard((proceed) => { setLeaving(() => proceed); return true; });
    return () => { window.removeEventListener('click', onClick, true); window.removeEventListener('beforeunload', onUnload); setNavGuard(null); };
  }, [dirty, router]);

  const revert = () => { form()?.reset(); setDirty(false); };
  const choose = (what: 'save' | 'discard' | 'cancel') => {
    const go = leaving;
    setLeaving(null);
    if (!go || what === 'cancel') return;
    if (what === 'discard') { revert(); go(); return; }
    const f = form();
    if (!f) return;
    if (!f.checkValidity()) { f.reportValidity(); return; }
    afterSave = { go, at: Date.now() };
    f.requestSubmit();
  };

  // One save pattern: nothing shows while the form matches what's saved; the first edit brings up the floating bar.
  const show = dirty || busy;
  return (
    <div ref={ref} className={`cx-savebar ${show ? 'dirty' : 'clean'}${note ? ' has-note' : ''}`}>
      <span className="cx-savebar-msg" aria-live="polite">{show ? <><span className="cx-pulse" aria-hidden />Unsaved changes</> : note}</span>
      {show && (
        <span className="cx-savebar-actions">
          {!busy && <button type="button" className="btn" onClick={revert}>Revert</button>}
          {children}<Submit pending={pending}>{label}</Submit>
        </span>
      )}
      {leaving && <UnsavedAlert scope={scope} onChoose={choose} />}
    </div>
  );
}

/** macOS-style “save changes?” alert: Save is the default, Don't save discards, Cancel stays. */
function UnsavedAlert({ scope, onChoose }: { scope?: string; onChoose: (what: 'save' | 'discard' | 'cancel') => void }) {
  const save = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const prevFocus = document.activeElement as HTMLElement | null;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); onChoose('cancel'); } };
    window.addEventListener('keydown', k);
    requestAnimationFrame(() => save.current?.focus());
    return () => { window.removeEventListener('keydown', k); prevFocus?.focus?.({ preventScroll: true }); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!mounted) return null;
  const h = document.querySelector('.se-head h2')?.textContent;
  const where = scope || (h ? `the ${h} settings` : 'these settings');
  return createPortal(
    <div className="sheet-backdrop cx-alert-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onChoose('cancel'); }}>
      <div className="sheet cx-alert" role="alertdialog" aria-modal="true" aria-labelledby="cx-alert-t" aria-describedby="cx-alert-d">
        <span className="cx-alert-ic" aria-hidden><Icon name="warn" size={22} /></span>
        <h2 id="cx-alert-t">Save your changes?</h2>
        <p id="cx-alert-d">You changed {where}. If you don’t save, those changes are lost.</p>
        <div className="cx-alert-actions">
          <button type="button" className="btn ghost cx-danger-text" onClick={() => onChoose('discard')}>Don’t save</button>
          <span className="spacer" />
          <button type="button" className="btn" onClick={() => onChoose('cancel')}>Cancel</button>
          <button type="button" ref={save} className="btn primary" onClick={() => onChoose('save')}>Save</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ---------- Secret: masked value with Replace / Remove affordances ---------- */
export function SecretField({ name, clearName, saved, masked = '••••••••', placeholder, label }: { name: string; clearName?: string; saved: boolean; masked?: string; placeholder?: string; label: string }) {
  const [mode, setMode] = useState<'view' | 'edit' | 'remove'>(saved ? 'view' : 'edit');
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLSpanElement>(null);
  const touched = useRef(false);
  useEffect(() => { setMode(saved ? 'view' : 'edit'); touched.current = false; }, [saved, masked]);
  // “Revert” in the save bar resets the form; put the field back to how it was saved too.
  const savedRef = useRef(saved);
  savedRef.current = saved;
  useEffect(() => {
    const f = box.current?.closest('form') || input.current?.closest('form');
    if (!f) return;
    const r = () => { touched.current = false; setMode(savedRef.current ? 'view' : 'edit'); };
    f.addEventListener('reset', r);
    return () => f.removeEventListener('reset', r);
  }, []);
  useEffect(() => {
    if (!touched.current) return;
    if (mode === 'edit') input.current?.focus();
    box.current?.closest('form')?.dispatchEvent(new Event('change', { bubbles: true }));
  }, [mode]);
  const go = (m: typeof mode) => { touched.current = true; setMode(m); };
  if (mode === 'view') {
    return (
      <span ref={box} className="cx-secret">
        <span className="cx-secret-v" title="Saved and encrypted"><Icon name="lock" size={14} /><span className="cx-mask">{masked}</span></span>
        <button type="button" className="btn sm" onClick={() => go('edit')} aria-label={`Replace ${label}`}>Replace</button>
        {clearName && <button type="button" className="btn sm ghost cx-danger-text" onClick={() => go('remove')} aria-label={`Remove ${label}`}>Remove</button>}
      </span>
    );
  }
  if (mode === 'remove') {
    return (
      <span ref={box} className="cx-secret removing">
        <input type="hidden" name={clearName} value="on" />
        <span className="cx-secret-v"><Icon name="trash" size={14} /><span>Removed when you save</span></span>
        <button type="button" className="btn sm" onClick={() => go('view')}>Undo</button>
      </span>
    );
  }
  return (
    <span ref={box} className="cx-secret editing">
      <input ref={input} className="in" type="password" name={name} autoComplete="new-password" aria-label={label} placeholder={placeholder || (saved ? 'Paste a new value' : '')} />
      {saved && <button type="button" className="btn sm ghost" onClick={() => go('view')}>Cancel</button>}
    </span>
  );
}

/* ---------- iOS switch that saves its form the moment it flips ---------- */
export function AutoToggle({ name, defaultChecked, label }: { name?: string; defaultChecked: boolean; label: string }) {
  return <input type="checkbox" role="switch" className="toggle" name={name} defaultChecked={defaultChecked} aria-label={label} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}

/* ---------- Live countdown ---------- */
/** Same words as ago() in lib/format ("in 14 min", "in 7 h", "in 2 d"), ticking live. */
function until(ms: number) {
  if (ms <= 30_000) return 'due now';
  const f = ms / 1000;
  if (f < 3600) return `in ${Math.max(1, Math.round(f / 60))} min`;
  if (f < 86400) return `in ${Math.round(f / 3600)} h`;
  return `in ${Math.round(f / 86400)} d`;
}
export function Countdown({ iso }: { iso: string }) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 15_000); return () => clearInterval(t); }, []);
  return <span className="cx-count" suppressHydrationWarning>{until(+new Date(iso) - Date.now())}</span>;
}

/* ---------- Settings sidebar (list on desktop, scrolling capsules on phones) ---------- */
export function SettingsNav({ items, current }: { items: { key: string; label: string; icon: string; tone: string }[]; current: string }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = ref.current;
    const a = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !a || nav.scrollWidth <= nav.clientWidth) return;
    nav.scrollTo({ left: a.offsetLeft - nav.clientWidth / 2 + a.offsetWidth / 2, behavior: 'smooth' });
  }, [current]);
  return (
    <nav ref={ref} className="se-nav" aria-label="Settings sections">
      {items.map((t) => (
        <Link key={t.key} href={`/app/settings?tab=${t.key}`} aria-current={current === t.key ? 'page' : undefined}>
          <Tile icon={t.icon} tone={t.tone} size="sm" /><span>{t.label}</span>
        </Link>
      ))}
    </nav>
  );
}

/* ---------- Team member row with an inline “Reset password” drawer ---------- */
export function MemberRow({ top, actions, reset, name }: { top: React.ReactNode; actions?: React.ReactNode; reset?: React.ReactNode; name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <li className={`se-member ${open ? 'open' : ''}`}>
      <div className="se-member-top">
        {top}
        {(reset || actions) && (
          <span className="se-member-acts">
            {reset && <button type="button" className="btn sm" aria-expanded={open} aria-label={open ? 'Cancel password reset' : `Reset password for ${name}`} onClick={() => setOpen(!open)}>{open ? 'Cancel' : 'Reset password'}</button>}
            {actions}
          </span>
        )}
      </div>
      {open && <div className="se-member-reset">{reset}</div>}
    </li>
  );
}

/* ---------- Brand colours with a live newsletter preview ---------- */
const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const onColor = (hex: string) => (/^#[0-9a-f]{6}$/i.test(hex) && lum(hex) > 0.42 ? '#1d1d1f' : '#ffffff');

export function BrandColors({ primary, accent, soft, newsletter, tagline, logo }: { primary: string; accent: string; soft: string; newsletter: string; tagline: string; logo: string }) {
  const [c, setC] = useState({ primary, accent, soft });
  const [meta, setMeta] = useState({ newsletter, tagline, logo });
  const ref = useRef<HTMLDivElement>(null);
  const latest = useRef({ primary, accent, soft, newsletter, tagline, logo });
  latest.current = { primary, accent, soft, newsletter, tagline, logo };
  useEffect(() => { setC({ primary, accent, soft }); }, [primary, accent, soft]);
  useEffect(() => {
    const f = ref.current?.closest('form');
    if (!f) return;
    const val = (n: string) => (f.elements.namedItem(n) as HTMLInputElement | null)?.value ?? '';
    const read = () => setMeta({ newsletter: val('newsletter_name'), tagline: val('tagline'), logo: val('logoUrl') });
    const reset = () => { const l = latest.current; setC({ primary: l.primary, accent: l.accent, soft: l.soft }); setMeta({ newsletter: l.newsletter, tagline: l.tagline, logo: l.logo }); };
    f.addEventListener('input', read);
    f.addEventListener('reset', reset);
    return () => { f.removeEventListener('input', read); f.removeEventListener('reset', reset); };
  }, []);
  const swatches = [['primary', 'Primary', 'Header and headings'], ['accent', 'Accent', 'Buttons and highlights'], ['soft', 'Soft background', 'Page and card tint']] as const;
  const okLogo = /^https?:\/\//.test(meta.logo);
  return (
    <div ref={ref} className="se-brand">
      <div className="cx-group-box se-swatches">
        {swatches.map(([k, l, s]) => (
          <label key={k} className="cx-row">
            <span className="cx-row-l"><span className="cx-row-t">{l}</span><small className="cx-row-s">{s}</small></span>
            <span className="cx-row-c se-sw">
              <span className="se-hex tnum">{c[k].toUpperCase()}</span>
              <input type="color" className="se-swatch" name={k} value={c[k]} aria-label={`${l} colour`} onChange={(e) => setC({ ...c, [k]: e.target.value })} />
            </span>
          </label>
        ))}
      </div>
      <figure className="se-preview" aria-label="Live preview of the newsletter colours" style={{ ['--bp-p' as any]: c.primary, ['--bp-a' as any]: c.accent, ['--bp-s' as any]: c.soft, ['--bp-on-p' as any]: onColor(c.primary), ['--bp-on-a' as any]: onColor(c.accent) }}>
        <div className="bp-mail">
          <div className="bp-head">
            {okLogo ? <img src={meta.logo} alt="" /> : <b>{meta.newsletter || 'Your newsletter'}</b>}
            <span>{meta.tagline || 'Weekly briefing'}</span>
          </div>
          <div className="bp-body">
            <span className="bp-kick">This week</span>
            <span className="bp-h">Pune launches jump 20% as site visits climb</span>
            <span className="bp-l" /><span className="bp-l s" />
            <span className="bp-row"><span className="bp-cta">I’m interested</span><span className="bp-ghost">Book 15 min</span></span>
          </div>
        </div>
        <figcaption>Live preview</figcaption>
      </figure>
    </div>
  );
}
