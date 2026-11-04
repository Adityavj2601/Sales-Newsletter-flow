'use client';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Icon, type IconName } from './icons';
import { NAV } from './nav';
import { guardedNav } from './navGuard';

type Group = 'Actions' | 'Go to' | 'Contacts' | 'Editions' | 'Stories' | 'Products' | 'Account';
type Cmd = { id: string; label: string; group: Group; icon: IconName; href?: string; run?: () => void; keywords?: string; hint?: string; content?: boolean };
const CONTENT: Record<PaletteItem['k'], [Group, IconName]> = { c: ['Contacts', 'person'], e: ['Editions', 'editions'], s: ['Stories', 'newspaper'] };
const PER_GROUP = 5;

export const openPalette = () => window.dispatchEvent(new Event('cmdk:open'));

/** What the palette can find besides pages and actions: a compact list the server layout passes in. */
export type PaletteItem = { k: 'c' | 'e' | 's'; id: string; label: string; hint?: string; href: string };

/**
 * Rank a label against the query. Prefix beats a word start, which beats any contiguous run; a command can also
 * match by its initials (“ne” → New edition). Returns the score and the letters to highlight, or null.
 */
function rank(q: string, text: string, initials = false, anywhere = true): { score: number; hits: number[] } | null {
  if (!q) return { score: 0, hits: [] };
  const t = text.toLowerCase();
  const run = (at: number) => Array.from({ length: q.length }, (_, i) => at + i);
  if (t.startsWith(q)) return { score: 3000 - t.length * 0.5, hits: run(0) };
  const word = new RegExp(`(^|[^\\p{L}\\p{N}])${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'u').exec(t);
  if (word) { const at = word.index + word[1].length; return { score: 2500 - at * 2 - t.length * 0.2, hits: run(at) }; }
  const at = t.indexOf(q);
  if (anywhere && at >= 0) return { score: 1800 - at * 2 - t.length * 0.2, hits: run(at) };
  if (initials && !q.includes(' ') && q.length >= 2) {
    const starts = [...t.matchAll(/(^|[^\p{L}\p{N}])(\p{L}|\p{N})/gu)].map((m) => m.index! + m[1].length);
    let i = 0;
    const hits: number[] = [];
    for (const s of starts) if (i < q.length && t[s] === q[i]) { hits.push(s); i++; }
    if (i === q.length) return { score: 1500 - t.length * 0.2, hits };
  }
  return null;
}

function Mark({ text, hits }: { text: string; hits: number[] }) {
  if (!hits.length) return <>{text}</>;
  const set = new Set(hits);
  return <>{[...text].map((c, i) => (set.has(i) ? <mark key={i}>{c}</mark> : <span key={i}>{c}</span>))}</>;
}

export function CommandPalette({ products, current, switchAction, logoutAction, items = [] }: {
  products: { id: string; name: string; newsletter_name: string }[]; current?: string; items?: PaletteItem[];
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
    for (const it of items) { const [group, icon] = CONTENT[it.k]; out.push({ id: `${it.k}-${it.id}`, group, label: it.label, hint: it.hint, icon, href: it.href, content: true }); }
    return out;
  }, [products, current, items]);

  type Row = { c: Cmd; hits: number[]; score: number; hintHits?: number[]; alias?: { text: string; hits: number[] } };
  const results = useMemo<Row[]>(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return cmds.filter((c) => c.group !== 'Account' && !c.content).map((c) => ({ c, hits: [] as number[], score: 0 }));
    const seen: Partial<Record<Group, number>> = {};
    return (cmds
      .map((c): Row | null => {
        const m = rank(needle, c.label, !c.content);
        if (m) return { c, hits: m.hits, score: m.score };
        // The secondary line (company, status) counts at a word start, below any label match, and is highlighted where it matched.
        const h = c.hint ? rank(needle, c.hint, false, false) : null;
        if (h) return { c, hits: [], hintHits: h.hits, score: h.score - 2000 };
        // A keyword alias (“articles” → Story pool) needs 3+ letters, and the matched word shows as a faint hint, so a result never appears for no visible reason.
        if (needle.length < 3 || !c.keywords) return null;
        for (const word of c.keywords.split(/\s+/)) {
          const k = rank(needle, word, false, false);
          if (k) return { c, hits: [], alias: { text: word, hits: k.hits }, score: k.score - 2200 };
        }
        return null;
      })
      .filter(Boolean) as Row[])
      .sort((a, b) => b.score - a.score)
      .filter((r) => !r.c.content || (seen[r.c.group] = (seen[r.c.group] || 0) + 1) <= PER_GROUP);
  }, [q, cmds]);

  useEffect(() => { setActive(0); }, [q]);
  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const choose = (c?: Cmd) => {
    if (!c) return;
    hide();
    // Unsaved settings get a say before the palette navigates away.
    guardedNav(() => { if (c.run) c.run(); else if (c.href) router.push(c.href); });
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
  const grouped: { group: string; rows: (Row & { i: number })[] }[] = [];
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
                placeholder="Search pages, people, editions and stories" aria-label="Search pages, people, editions and stories" role="combobox" aria-expanded="true"
                aria-controls={`${uid}-list`} aria-activedescendant={sel ? `${uid}-${active}` : undefined} autoComplete="off" spellCheck={false}
              />
              <kbd className="cmdk-esc" onClick={hide}>esc</kbd>
            </div>
            <div className="cmdk-list" id={`${uid}-list`} role="listbox" ref={list} aria-label="Results">
              {flat.length === 0 && <div className="cmdk-empty"><Icon name="search" size={28} /><b>No results for “{q}”</b><span>Try a person, an edition title, a page like “Leads” or an action like “New edition”.</span></div>}
              {grouped.map((g) => (
                <div key={g.group} role="group" aria-label={g.group}>
                  <div className="cmdk-grp" aria-hidden>{g.group}</div>
                  {g.rows.map(({ c, hits, hintHits, alias, i }) => {
                    const here = c.href && c.group === 'Go to' && (c.href === '/app' ? path === '/app' : path.startsWith(c.href));
                    return (
                      <div
                        key={c.id} id={`${uid}-${i}`} data-i={i} role="option" aria-selected={i === active}
                        className="cmdk-item" onMouseMove={() => i !== active && setActive(i)} onClick={() => choose(c)}
                      >
                        <span className="cmdk-ic"><Icon name={c.icon} size={17} /></span>
                        <span className="cmdk-lbl">
                          <Mark text={c.label} hits={hits} />
                          {c.hint && <span className="cmdk-hint"><Mark text={c.hint} hits={hintHits || []} /></span>}
                          {alias && <span className="cmdk-alias"><span className="sr">, matches </span><Mark text={alias.text} hits={alias.hits} /></span>}
                        </span>
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
    <button type="button" className="search-btn" onClick={openPalette} aria-keyshortcuts={mac ? 'Meta+K' : 'Control+K'} aria-label="Search" title={`Search (${mac ? '⌘' : 'Ctrl+'}K)`}>
      <Icon name="search" size={15} />
      <span>Search</span>
      <span className="keys" aria-hidden><kbd>{mac ? '⌘' : 'Ctrl'}</kbd><kbd>K</kbd></span>
    </button>
  );
}
