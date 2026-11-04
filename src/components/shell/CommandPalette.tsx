'use client';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Icon, type IconName } from './icons';
import { NAV } from './nav';

type Cmd = { id: string; label: string; group: 'Actions' | 'Go to' | 'Products' | 'Account'; icon: IconName; href?: string; run?: () => void; keywords?: string; hint?: string };

export const openPalette = () => window.dispatchEvent(new Event('cmdk:open'));

/** Subsequence fuzzy match. Returns a score (higher is better) and the indexes to highlight, or null.
 *  Only a contiguous substring match is highlighted: scattered single letters read as noise. */
function fuzzy(q: string, text: string): { score: number; hits: number[] } | null {
  if (!q) return { score: 0, hits: [] };
  const t = text.toLowerCase();
  const direct = t.indexOf(q);
  if (direct >= 0) return { score: 1000 - direct * 4 - (t.length - q.length) * 0.5 + (direct === 0 || t[direct - 1] === ' ' ? 200 : 0), hits: Array.from({ length: q.length }, (_, i) => direct + i) };
  const hits: number[] = [];
  let score = 0, last = -2, ti = 0;
  for (const ch of q) {
    if (ch === ' ') continue;
    const at = t.indexOf(ch, ti);
    if (at < 0) return null;
    score += at === last + 1 ? 12 : at === 0 || t[at - 1] === ' ' ? 10 : 1;
    hits.push(at); last = at; ti = at + 1;
  }
  return { score: score - t.length * 0.1, hits: [] };
}

function Mark({ text, hits }: { text: string; hits: number[] }) {
  if (!hits.length) return <>{text}</>;
  const set = new Set(hits);
  return <>{[...text].map((c, i) => (set.has(i) ? <mark key={i}>{c}</mark> : <span key={i}>{c}</span>))}</>;
}

export function CommandPalette({ products, current, switchAction, logoutAction }: {
  products: { id: string; name: string; newsletter_name: string }[]; current?: string;
  switchAction: (fd: FormData) => Promise<void>; logoutAction: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const router = useRouter();
  const path = usePathname();
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const restore = useRef<HTMLElement | null>(null);
  const switchForm = useRef<HTMLFormElement>(null);
  const outForm = useRef<HTMLFormElement>(null);
  const uid = useId();

  const show = useCallback(() => {
    restore.current = document.activeElement as HTMLElement | null;
    setQ(''); setActive(0); setClosing(false); setOpen(true);
  }, []);
  const hide = useCallback(() => {
    setClosing(true);
    setTimeout(() => { setOpen(false); setClosing(false); restore.current?.focus?.(); }, 160);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); if (open) hide(); else show(); }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('cmdk:open', show);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('cmdk:open', show); };
  }, [open, show, hide]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => input.current?.focus());
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const cmds = useMemo<Cmd[]>(() => {
    const out: Cmd[] = [
      { id: 'new-edition', group: 'Actions', label: 'New edition', icon: 'plus', href: '/app/editions?new=1', keywords: 'draft create write' },
      { id: 'import', group: 'Actions', label: 'Import contacts', icon: 'upload', href: '/app/contacts?import=1', keywords: 'csv upload people' },
      { id: 'add-contact', group: 'Actions', label: 'Add a contact', icon: 'person', href: '/app/contacts?add=1', keywords: 'new person' },
      { id: 'add-kb', group: 'Actions', label: 'Add an “Our work” item', icon: 'knowledge', href: '/app/knowledge?add=1', keywords: 'case study knowledge' },
      { id: 'stories', group: 'Actions', label: 'Review this week’s stories', icon: 'stories', href: '/app/stories', keywords: 'news fetch shortlist' },
      { id: 'ai', group: 'Actions', label: 'Connect an AI provider', icon: 'sparkle', href: '/app/settings?tab=ai', keywords: 'claude chatgpt gemini openrouter key' },
      { id: 'smtp', group: 'Actions', label: 'Connect email sending (SMTP)', icon: 'mail', href: '/app/settings?tab=email', keywords: 'smtp mail' },
      { id: 'wa', group: 'Actions', label: 'Set up WhatsApp', icon: 'whatsapp', href: '/app/settings?tab=whatsapp', keywords: 'business api' },
    ];
    for (const g of NAV) for (const n of g.items) out.push({ id: 'nav' + n.href, group: 'Go to', label: n.label, icon: n.icon, href: n.href, keywords: n.keywords });
    for (const p of products) if (p.id !== current) out.push({
      id: 'p-' + p.id, group: 'Products', label: `Switch to ${p.name}`, hint: p.newsletter_name, icon: 'swap', keywords: p.newsletter_name,
      run: () => { const f = switchForm.current!; (f.elements.namedItem('product') as HTMLInputElement).value = p.id; (f.elements.namedItem('to') as HTMLInputElement).value = window.location.pathname + window.location.search; f.requestSubmit(); },
    });
    out.push({ id: 'signout', group: 'Account', label: 'Sign out', icon: 'signout', run: () => outForm.current?.requestSubmit(), keywords: 'logout log out' });
    return out;
  }, [products, current]);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return cmds.filter((c) => c.group !== 'Account').map((c) => ({ c, hits: [] as number[], score: 0 }));
    return cmds
      .map((c) => { const m = fuzzy(needle, c.label); const k = m ? null : fuzzy(needle, `${c.keywords || ''} ${c.hint || ''}`); return m ? { c, hits: m.hits, score: m.score + 50 } : k ? { c, hits: [], score: k.score - 100 } : null; })
      .filter(Boolean)
      .sort((a, b) => b!.score - a!.score) as { c: Cmd; hits: number[]; score: number }[];
  }, [q, cmds]);

  useEffect(() => { setActive(0); }, [q]);
  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const choose = (c?: Cmd) => {
    if (!c) return;
    hide();
    if (c.run) c.run();
    else if (c.href) router.push(c.href);
  };

  const onKey = (e: React.KeyboardEvent) => {
    const n = flat.length;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (n ? (a + 1) % n : 0)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (n ? (a - 1 + n) % n : 0)); }
    else if (e.key === 'Home' && e.ctrlKey) { e.preventDefault(); setActive(0); }
    else if (e.key === 'End' && e.ctrlKey) { e.preventDefault(); setActive(n - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(flat[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); hide(); }
    else if (e.key === 'Tab') e.preventDefault();
  };

  // Group while keeping score order inside groups (group order follows first appearance).
  const grouped: { group: string; rows: { c: Cmd; hits: number[]; i: number }[] }[] = [];
  results.forEach((r, i) => {
    let g = grouped.find((x) => x.group === r.c.group);
    if (!g) { g = { group: r.c.group, rows: [] }; grouped.push(g); }
    g.rows.push({ ...r, i });
  });
  // Flat index must match visual order, so re-number after grouping.
  let k = 0;
  const flat: Cmd[] = [];
  for (const g of grouped) for (const r of g.rows) { r.i = k++; flat.push(r.c); }
  const sel = flat[active];

  return (
    <>
      <form ref={switchForm} action={switchAction} hidden><input type="hidden" name="product" /><input type="hidden" name="to" /></form>
      <form ref={outForm} action={logoutAction} hidden />
      {open && (
        <div className={`cmdk-backdrop${closing ? ' out' : ''}`} onMouseDown={(e) => { if (e.target === e.currentTarget) hide(); }}>
          <div className="cmdk" role="dialog" aria-modal="true" aria-label="Command menu">
            <div className="cmdk-field">
              <Icon name="search" size={20} />
              <input
                ref={input} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey}
                placeholder="Search pages and actions…" aria-label="Search pages and actions" role="combobox" aria-expanded="true"
                aria-controls={`${uid}-list`} aria-activedescendant={sel ? `${uid}-${active}` : undefined} autoComplete="off" spellCheck={false}
              />
              <kbd className="cmdk-esc" onClick={hide}>esc</kbd>
            </div>
            <div className="cmdk-list" id={`${uid}-list`} role="listbox" ref={list} aria-label="Results">
              {flat.length === 0 && <div className="cmdk-empty"><Icon name="search" size={28} /><b>No results for “{q}”</b><span>Try a page name like “Leads” or an action like “New edition”.</span></div>}
              {grouped.map((g) => (
                <div key={g.group} role="group" aria-label={g.group}>
                  <div className="cmdk-grp" aria-hidden>{g.group}</div>
                  {g.rows.map(({ c, hits, i }) => {
                    const here = c.href && c.group === 'Go to' && (c.href === '/app' ? path === '/app' : path.startsWith(c.href));
                    return (
                      <div
                        key={c.id} id={`${uid}-${i}`} data-i={i} role="option" aria-selected={i === active}
                        className="cmdk-item" onMouseMove={() => i !== active && setActive(i)} onClick={() => choose(c)}
                      >
                        <span className="cmdk-ic"><Icon name={c.icon} size={17} /></span>
                        <span className="cmdk-lbl"><Mark text={c.label} hits={hits} />{c.hint && <span className="cmdk-hint">{c.hint}</span>}</span>
                        {here ? <span className="cmdk-here">Current page</span> : <span className="cmdk-enter" aria-hidden>↵</span>}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="cmdk-foot" aria-hidden>
              <span><kbd>↑</kbd><kbd>↓</kbd> to move</span><span><kbd>↵</kbd> to open</span><span><kbd>esc</kbd> to close</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Sidebar search field look-alike that opens the palette. */
export function PaletteButton({ variant = 'field' }: { variant?: 'field' | 'icon' }) {
  const [mac, setMac] = useState(true);
  useEffect(() => { setMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)); }, []);
  if (variant === 'icon') return <button type="button" className="icon-btn" onClick={openPalette} aria-label="Search and commands"><Icon name="search" size={20} /></button>;
  return (
    <button type="button" className="search-btn" onClick={openPalette} aria-keyshortcuts={mac ? 'Meta+K' : 'Control+K'}>
      <Icon name="search" size={15} />
      <span>Search</span>
      <span className="keys" aria-hidden><kbd>{mac ? '⌘' : 'Ctrl'}</kbd><kbd>K</kbd></span>
    </button>
  );
}
