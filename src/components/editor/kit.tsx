'use client';
/* Small interaction primitives for the editions area: segmented control with a sliding
   indicator, popover, modal sheet with focus management, cross-fading preview frame,
   progress ring and a FLIP helper for smooth list reordering. */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Segmented control ---------- */
export function Segmented<T extends string>({ value, options, onChange, label, className = '' }: {
  value: T; options: { value: T; label: React.ReactNode; title?: string }[]; onChange: (v: T) => void; label: string; className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [ind, setInd] = useState<{ x: number; w: number } | null>(null);
  const [anim, setAnim] = useState(false);
  const measure = useCallback(() => {
    const root = ref.current;
    const b = root?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
    if (!root || !b) return;
    setInd({ x: b.offsetLeft, w: b.offsetWidth });
  }, []);
  useLayoutEffect(() => { measure(); }, [value, measure, options.length]);
  /* When the control scrolls sideways (narrow screens), keep the selected segment in view: on load and on change. */
  useEffect(() => {
    const root = ref.current;
    const b = root?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
    if (!root || !b || root.scrollWidth <= root.clientWidth + 1) return;
    const left = b.offsetLeft - (root.clientWidth - b.offsetWidth) / 2;
    root.scrollTo({ left: Math.max(0, left), behavior: reducedMotion() ? 'auto' : 'smooth' });
  }, [value]);
  useEffect(() => {
    const t = requestAnimationFrame(() => setAnim(true));
    const ro = new ResizeObserver(() => measure());
    if (ref.current) ro.observe(ref.current);
    return () => { cancelAnimationFrame(t); ro.disconnect(); };
  }, [measure]);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const i = options.findIndex((o) => o.value === value);
    const n = options[(i + (e.key === 'ArrowRight' ? 1 : options.length - 1)) % options.length];
    onChange(n.value);
    requestAnimationFrame(() => ref.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')?.focus());
  };
  return (
    <div ref={ref} className={`seg slide ${ind ? 'ready' : ''} ${anim ? 'anim' : ''} ${className}`} role="group" aria-label={label} onKeyDown={onKey}>
      <span className="seg-ind" aria-hidden style={ind ? { transform: `translateX(${ind.x - 2}px)`, width: ind.w } : undefined} />
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} title={o.title} tabIndex={value === o.value ? 0 : -1} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

/* ---------- Mount/unmount with an exit phase ---------- */
export function usePresence(open: boolean, ms = 180) {
  const [mounted, setMounted] = useState(open);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (open) { setMounted(true); setLeaving(false); return; }
    if (!mounted) return;
    setLeaving(true);
    const t = setTimeout(() => { setMounted(false); setLeaving(false); }, reducedMotion() ? 0 : ms);
    return () => clearTimeout(t);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  return { mounted, leaving };
}

/* ---------- Popover ---------- */
export function Popover({ open, onClose, anchor, children, className = '', label, place = 'bottom', align = 'start', role = 'dialog' }: {
  open: boolean; onClose: () => void; anchor: React.RefObject<HTMLElement | null>; children: React.ReactNode; className?: string; label: string;
  place?: 'bottom' | 'top' | 'auto'; align?: 'start' | 'end'; role?: string;
}) {
  const { mounted, leaving } = usePresence(open, 140);
  const ref = useRef<HTMLDivElement>(null);
  const [side, setSide] = useState<'bottom' | 'top'>('bottom');
  useLayoutEffect(() => {
    if (!open || place !== 'auto') { if (place !== 'auto') setSide(place); return; }
    const r = anchor.current?.getBoundingClientRect();
    if (r) setSide(window.innerHeight - r.bottom < 420 && r.top > window.innerHeight - r.bottom ? 'top' : 'bottom');
  }, [open, place, anchor]);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => { const t = e.target as Node; if (!ref.current?.contains(t) && !anchor.current?.contains(t)) onClose(); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); anchor.current?.focus(); } };
    document.addEventListener('pointerdown', down);
    document.addEventListener('keydown', key, true);
    const f = requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>('[data-autofocus], button:not([disabled]), input, select, textarea')?.focus());
    return () => { document.removeEventListener('pointerdown', down); document.removeEventListener('keydown', key, true); cancelAnimationFrame(f); };
  }, [open, onClose, anchor]);
  if (!mounted) return null;
  return <div ref={ref} className={`ed-pop ${side} ${align} ${leaving ? 'out' : ''} ${className}`} role={role} aria-label={label}>{children}</div>;
}

/* ---------- Modal sheet (portal, focus trap, exit animation) ---------- */
export function Modal({ open, onClose, label, children, className = '', dismissable = true }: {
  open: boolean; onClose: () => void; label: string; children: React.ReactNode; className?: string; dismissable?: boolean;
}) {
  const { mounted, leaving } = usePresence(open, 220);
  const ref = useRef<HTMLDivElement>(null);
  const prevFocus = useRef<HTMLElement | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const dis = useRef(dismissable);
  dis.current = dismissable;
  // Portal only after mount: a sheet that starts open (e.g. ?new=1) must not differ between server and hydration.
  const [client, setClient] = useState(false);
  useEffect(() => setClient(true), []);
  useEffect(() => {
    if (!open) return;
    prevFocus.current = document.activeElement as HTMLElement;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dis.current) { e.preventDefault(); closeRef.current(); }
      if (e.key === 'Tab' && ref.current) {
        const f = [...ref.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', key);
    const t = requestAnimationFrame(() => (ref.current?.querySelector<HTMLElement>('[data-autofocus]') || ref.current)?.focus());
    return () => { window.removeEventListener('keydown', key); document.body.style.overflow = prev; cancelAnimationFrame(t); prevFocus.current?.focus?.(); };
  }, [open, client]);
  if (!mounted || !client) return null;
  return createPortal(
    <div className={`sheet-backdrop ed-modal ${leaving ? 'out' : ''}`} onMouseDown={(e) => { if (e.target === e.currentTarget && dis.current) onClose(); }}>
      <div ref={ref} tabIndex={-1} className={`sheet ${className}`} role="dialog" aria-modal="true" aria-label={label}>{children}</div>
    </div>,
    document.body,
  );
}

/* ---------- Preview iframe that cross-fades instead of flashing white ----------
   With `fit`, the page reports its own height (the frame is sandboxed, so it posts a message) and the frame grows
   to it: on phones the preview then scrolls with the page instead of inside a box of its own. */
const FIT_SCRIPT = '<script>(function(){var b=document.body;if(!b||!window.ResizeObserver)return;var p=function(){var h=Math.ceil(b.getBoundingClientRect().bottom+(parseFloat(getComputedStyle(b).marginBottom)||0));parent.postMessage({pfH:h},"*")};new ResizeObserver(p).observe(b);addEventListener("load",p);p();})()</script>';
const withFit = (html: string) => (!html ? html : html.includes('</body>') ? html.replace('</body>', `${FIT_SCRIPT}</body>`) : html + FIT_SCRIPT);
export function PreviewFrame({ html, title, style, fit = false, onHeight }: { html: string; title: string; style?: React.CSSProperties; fit?: boolean; onHeight?: (h: number) => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [fh, setFh] = useState(0);
  const onH = useRef(onHeight);
  onH.current = onHeight;
  useEffect(() => {
    if (!fit) return;
    const on = (e: MessageEvent) => {
      const fr = wrap.current?.querySelectorAll('iframe');
      // A frame inside a hidden pane measures 0: keep the last real height until it is shown again.
      if (!fr?.length || fr[fr.length - 1].contentWindow !== e.source || !(Number(e.data?.pfH) > 40)) return;
      const h = Number(e.data.pfH);
      setFh(h);
      onH.current?.(h);
    };
    window.addEventListener('message', on);
    return () => window.removeEventListener('message', on);
  }, [fit]);
  const [frames, setFrames] = useState<{ k: number; html: string; ready: boolean }[]>(() => [{ k: 0, html, ready: false }]);
  useEffect(() => {
    setFrames((f) => {
      if (f[f.length - 1].html === html) return f;
      const lastReady = [...f].reverse().find((x) => x.ready);
      return [...(lastReady ? [lastReady] : []), { k: f[f.length - 1].k + 1, html, ready: false }];
    });
  }, [html]);
  const loaded = (k: number) => {
    setFrames((f) => f.map((x) => (x.k === k ? { ...x, ready: true } : x)));
    // Keep the old frame underneath until the new one has faded in, then drop it.
    setTimeout(() => setFrames((f) => { const i = f.findIndex((x) => x.k === k); return i > 0 ? f.slice(i) : f; }), 320);
  };
  return (
    <div ref={wrap} className={`pf ${fit ? 'fit' : ''} ${fit && fh ? 'sized' : ''}`} style={fit && fh && !onHeight ? { ...style, height: fh } : style}>
      {frames.map((f) => (
        <iframe key={f.k} title={title} srcDoc={fit ? withFit(f.html) : f.html} sandbox="allow-scripts allow-popups" className={f.ready ? 'on' : ''} onLoad={() => loaded(f.k)} />
      ))}
      {!frames.some((f) => f.ready && f.html) && <div className="pf-skel" aria-hidden><span className="skeleton" /><span className="skeleton" /><span className="skeleton" /><span className="skeleton" /></div>}
    </div>
  );
}

/* ---------- Preview rendered at a real viewport width, scaled down to fit its pane ---------- */
export function ScaledPreview({ html, title, width, fit = false }: { html: string; title: string; width: number; fit?: boolean }) {
  const [fh, setFh] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const m = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    m();
    const ro = new ResizeObserver(m);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const s = box ? Math.min(1, box.w / width) : 1;
  return (
    <div ref={ref} className="scaled" style={fit && fh ? { flex: 'none', height: Math.ceil(fh * s) } : undefined}>
      {box && box.w > 0 && <PreviewFrame html={html} title={title} fit={fit} onHeight={setFh} style={{ width: s < 1 ? width : box.w, height: fit && fh ? fh : box.h / s, transform: s < 1 ? `scale(${s})` : undefined }} />}
      {box && s < 1 && <span className="scale-badge">{Math.round(s * 100)}%</span>}
    </div>
  );
}

/* ---------- Progress ring ----------
   Arc length shows the pass ratio; each state gets its own segment (passed → failing → warnings),
   so 14/18 with one failure reads as "mostly green, a sliver of red" rather than an all-red ring. */
export type RingPart = { n: number; tone: 'ok' | 'warn' | 'bad' };
export function Ring({ parts = [], total, size = 44, stroke = 4.5, spinning = false, children }: { parts?: RingPart[]; total: number; size?: number; stroke?: number; spinning?: boolean; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const shown = parts.filter((p) => p.n > 0);
  const gap = shown.length > 1 ? Math.min(3, c * 0.012) + stroke : 0; // round caps need the stroke width as extra gap
  let at = 0;
  return (
    <span className={`ck-ring ${spinning ? 'spinning' : ''}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="ck-ring-track" />
        {spinning
          ? <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="ck-ring-val spin-arc" strokeDasharray={`${c * 0.28} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
          : total > 0 && shown.map((p, i) => {
            const len = Math.max(0.001, (p.n / total) * c - gap);
            const el = <circle key={p.tone} cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className={`ck-ring-val ${p.tone}`} style={{ ['--len' as any]: `${len}px`, animationDelay: `${i * 90}ms` }} strokeDasharray={`${len} ${c}`} strokeDashoffset={-at} transform={`rotate(-90 ${size / 2} ${size / 2})`} />;
            at += (p.n / total) * c;
            return el;
          })}
      </svg>
      {children && <span className="ck-ring-c">{children}</span>}
    </span>
  );
}

/* ---------- FLIP: capture positions, change state, then animate from old to new ---------- */
export function useFlip(root: React.RefObject<HTMLElement | null>) {
  const snap = useRef<Map<string, DOMRect> | null>(null);
  const capture = useCallback(() => {
    if (!root.current || reducedMotion()) return;
    const m = new Map<string, DOMRect>();
    root.current.querySelectorAll<HTMLElement>('[data-flip]').forEach((el) => m.set(el.dataset.flip!, el.getBoundingClientRect()));
    snap.current = m;
  }, [root]);
  const play = useCallback(() => {
    const m = snap.current;
    snap.current = null;
    if (!m || !root.current) return;
    root.current.querySelectorAll<HTMLElement>('[data-flip]').forEach((el) => {
      const a = m.get(el.dataset.flip!);
      const b = el.getBoundingClientRect();
      if (!a) { el.animate([{ opacity: 0, transform: 'scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.22,1,.36,1)' }); return; }
      const dy = a.top - b.top;
      if (Math.abs(dy) < 1) return;
      el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 360, easing: 'cubic-bezier(.22,1,.36,1)' });
    });
  }, [root]);
  return { capture, play };
}

/* ---------- Platform-aware shortcut label (⌘ on Apple devices, Ctrl elsewhere) ---------- */
export function useMod() {
  const [mod, setMod] = useState('⌘');
  useEffect(() => { if (!/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) setMod('Ctrl'); }, []);
  return mod;
}
export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}
