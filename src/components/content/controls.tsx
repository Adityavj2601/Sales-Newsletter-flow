'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useFormStatus } from 'react-dom';
import { Submit } from '@/components/ui';
import { Icon, Tile } from './icons';

/* ---------- Save bar: sticky glass footer that notices unsaved edits ---------- */
export function SaveBar({ label = 'Save', pending = 'Saving…', children, note }: { label?: string; pending?: string; children?: React.ReactNode; note?: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [dirty, setDirty] = useState(false);
  const { pending: busy } = useFormStatus();
  const was = useRef(false);
  useEffect(() => {
    if (was.current && !busy) setDirty(false);
    was.current = busy;
  }, [busy]);
  useEffect(() => {
    const f = ref.current?.closest('form');
    if (!f) return;
    const on = (e: Event) => { if ((e.target as HTMLElement)?.closest?.('[data-nodirty]')) return; setDirty(true); };
    f.addEventListener('input', on);
    f.addEventListener('change', on);
    return () => { f.removeEventListener('input', on); f.removeEventListener('change', on); };
  }, []);
  return (
    <div ref={ref} className={`cx-savebar ${dirty ? 'dirty' : ''}`}>
      <span className="cx-savebar-msg" aria-live="polite">{dirty ? <><span className="cx-pulse" aria-hidden />Unsaved changes</> : note}</span>
      <span className="cx-savebar-actions">{children}<Submit pending={pending}>{label}</Submit></span>
    </div>
  );
}

/* ---------- Secret: masked value with Replace / Remove affordances ---------- */
export function SecretField({ name, clearName, saved, masked = '••••••••', placeholder, label }: { name: string; clearName?: string; saved: boolean; masked?: string; placeholder?: string; label: string }) {
  const [mode, setMode] = useState<'view' | 'edit' | 'remove'>(saved ? 'view' : 'edit');
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLSpanElement>(null);
  const touched = useRef(false);
  useEffect(() => { setMode(saved ? 'view' : 'edit'); touched.current = false; }, [saved, masked]);
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
function until(ms: number) {
  if (ms <= 0) return 'due now';
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (d >= 1) return `in ${d}d ${h}h`;
  if (h >= 1) return `in ${h}h ${String(m).padStart(2, '0')}m`;
  return `in ${m}:${String(sec).padStart(2, '0')}`;
}
export function Countdown({ iso }: { iso: string }) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(t); }, []);
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
  useEffect(() => { setC({ primary, accent, soft }); }, [primary, accent, soft]);
  useEffect(() => {
    const f = ref.current?.closest('form');
    if (!f) return;
    const val = (n: string) => (f.elements.namedItem(n) as HTMLInputElement | null)?.value ?? '';
    const read = () => setMeta({ newsletter: val('newsletter_name'), tagline: val('tagline'), logo: val('logoUrl') });
    f.addEventListener('input', read);
    return () => f.removeEventListener('input', read);
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
