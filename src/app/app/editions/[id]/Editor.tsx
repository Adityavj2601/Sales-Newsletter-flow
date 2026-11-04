'use client';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BLOCK_LABELS, CTA_LABELS, MATURITY, PILLARS, newBlock, ovKey, type Block, type BlockType, type EditionContent, type CheckResult, type ChecksRun, type Source, type CtaAction, type Maturity, type Pillar } from '@/lib/types';
import { Confirm } from '@/components/ui';
import { I, BlockIcon, BLOCK_META } from '@/components/editor/icons';
import { Segmented, Popover, PreviewFrame, ScaledPreview, Ring, useFlip, useMod, Kbd, reducedMotion } from '@/components/editor/kit';
import { ago, edNo, fmtDay, fmtTime, relDay, todayIn } from '@/lib/format';
import { FlowStepper } from '@/components/FlowStepper';
import { flowState, type FlowStage } from '@/lib/flow';

type KB = { id: string; title: string; summary: string; problem: string; result: string; pillar: Pillar; status: Maturity; media_url: string | null; client_name: string | null; client_permission: number };
type Story = { id: string; title: string; url: string; publisher: string; published_at: string | null };
type Ed = { id: string; number: number; slug: string; status: string; content: EditionContent; checks: ChecksRun | null; overrides: Record<string, string>; planned_for: string | null; updated_at: string };
type Note = { kind: string; text: string; action?: { label: string; run: () => void } };
type Toast = Note & { id: number; out?: boolean };

const STATUS_LABEL: Record<string, [string, string]> = { draft: ['', 'Draft'], review: ['warn', 'In review'], approved: ['info', 'Approved'], scheduled: ['info', 'Scheduled'], sending: ['warn', 'Sending'], sent: ['ok', 'Sent'] };
const QUICK = ['Make it punchier and shorter', 'Rewrite “why it matters” for a sales head', 'Make the headline more specific', 'Simplify the language', 'Write a warmer WhatsApp message', 'Check the tone is not salesy'];
const VIEWS = [{ value: 'phone' as const, label: 'Phone' }, { value: 'web' as const, label: 'Desktop' }, { value: 'email' as const, label: 'Email' }, { value: 'wa' as const, label: 'WhatsApp' }];
const WIDE = '(min-width: 1500px)';
const STACK = '(max-width: 999px)';
const PHONE = '(max-width: 640px)';
const rid = () => Math.random().toString(36).slice(2, 9);
/** "9:01 pm" today, otherwise "Wed, 4 Nov · 9:01 pm" — the app-wide time format. */
const when = (iso: string) => (new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) === todayIn() ? fmtTime(iso) : `${fmtDay(iso)} · ${fmtTime(iso)}`);
/* The web preview carries a "Preview. Taps here are not recorded." strip for the reader page. Inside the editor's
   device frames the caption under the device already says so, so the strip is hidden. */
const CALM_STRIP = '<style>.pv{display:none!important}</style>';
const calm = (html: string) => (html.includes('</head>') ? html.replace('</head>', `${CALM_STRIP}</head>`) : html);

function summary(b: Block): string {
  switch (b.type) {
    case 'tldr': return b.bullets.filter(Boolean)[0] || 'Empty';
    case 'stat': return `${b.value} ${b.caption}`.trim() || 'Empty';
    case 'story': return b.headline || 'Untitled story';
    case 'chart': return b.title || `${b.data.length} data points`;
    case 'showcase': return b.title || 'Empty card';
    case 'video': case 'image': return b.url || 'No media yet';
    case 'quote': return b.text || 'Empty';
    case 'text': return b.heading || b.body.slice(0, 60) || 'Empty';
    case 'poll': return b.question || 'Empty poll';
    case 'cta': return b.actions.map((a) => CTA_LABELS[a]).join(' · ');
  }
}

/* ---------- diff for AI proposals ---------- */
type Change = { where: string; before: string; after: string };
function diffContent(a: EditionContent, b: EditionContent): Change[] {
  const out: Change[] = [];
  const flat = (o: any, prefix = ''): Record<string, string> => {
    const r: Record<string, string> = {};
    for (const [k, v] of Object.entries(o || {})) {
      if (k === 'id' || k === 'sourceIds') continue;
      if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(r, flat(v, `${prefix}${k}.`));
      else r[`${prefix}${k}`] = Array.isArray(v) ? v.map((x) => (typeof x === 'object' ? JSON.stringify(x) : x)).join(' | ') : String(v ?? '');
    }
    return r;
  };
  for (const k of ['kicker', 'title', 'dek', 'subject', 'preheader', 'waText'] as const) if (a[k] !== b[k]) out.push({ where: k, before: String(a[k]), after: String(b[k]) });
  const ap = flat(a.preview, 'preview.'), bp = flat(b.preview, 'preview.');
  for (const k of Object.keys(bp)) if (ap[k] !== bp[k]) out.push({ where: k, before: ap[k] || '', after: bp[k] });
  const amap = new Map(a.blocks.map((x) => [x.id, x]));
  b.blocks.forEach((blk) => {
    const old = amap.get(blk.id);
    if (!old) { out.push({ where: `New ${BLOCK_LABELS[blk.type]}`, before: '', after: summary(blk) }); return; }
    const fa = flat(old), fb = flat(blk);
    for (const k of Object.keys(fb)) if (fa[k] !== fb[k]) out.push({ where: `${BLOCK_LABELS[blk.type]} · ${k}`, before: fa[k] || '', after: fb[k] });
  });
  for (const old of a.blocks) if (!b.blocks.some((x) => x.id === old.id)) out.push({ where: `Removed ${BLOCK_LABELS[old.type]}`, before: summary(old), after: '' });
  if (a.blocks.map((x) => x.id).join() !== b.blocks.filter((x) => amap.has(x.id)).map((x) => x.id).join() && a.blocks.length === b.blocks.length) out.push({ where: 'Block order', before: 'old order', after: 'new order' });
  return out;
}
const WHERE: Record<string, string> = { kicker: 'Theme label', title: 'Headline', dek: 'Subtitle', subject: 'Email subject', preheader: 'Email preview text', waText: 'WhatsApp message', 'preview.title': 'Link-preview title', 'preview.description': 'Link-preview description' };

function Count({ n, max, min, unit = '' }: { n: number; max?: number; min?: number; unit?: string }) {
  const bad = (max != null && n > max) || (min != null && n > 0 && n < min);
  return <small className={`cnt ${bad ? 'over' : ''}`}>{max != null && !unit ? `${n}/${max}` : `${n}${unit}`}</small>;
}

function SaveState({ save, onRetry }: { save: 'saved' | 'dirty' | 'saving' | 'error'; onRetry: () => void }) {
  const label = { saved: 'All changes saved', dirty: 'Unsaved changes…', saving: 'Saving…', error: 'Not saved' }[save];
  return (
    <span className={`savest ${save}`} role="status" aria-live="polite" title={label}>
      <span className="sv-ic" key={save} aria-hidden>
        {save === 'saved' ? <I.check size={11} /> : save === 'saving' ? <span className="spin" /> : save === 'error' ? '!' : <span className="sv-dot" />}
      </span>
      <span className="sv-l">{label}</span>
      {save === 'error' && <button type="button" className="sv-retry" onClick={onRetry}>Retry</button>}
    </span>
  );
}

export function Editor({ edition, product, kb, stories, publicUrl, aiReady, duplicateAction, deleteAction }: {
  edition: Ed; product: { id: string; name: string; slug: string; newsletter: string }; kb: KB[]; stories: Story[]; publicUrl: string; aiReady: boolean;
  duplicateAction: () => Promise<void>; deleteAction: () => Promise<void>;
}) {
  const [c, setC] = useState<EditionContent>(edition.content);
  const [status, setStatus] = useState(edition.status);
  const [planned, setPlanned] = useState(edition.planned_for || '');
  const [checks, setChecks] = useState<ChecksRun | null>(edition.checks);
  const [overrides, setOverrides] = useState<Record<string, string>>(edition.overrides || {});
  const [save, setSave] = useState<'saved' | 'dirty' | 'saving' | 'error'>('saved');
  const [open, setOpenRaw] = useState<string | null>(null);
  const [closing, setClosing] = useState<string | null>(null);
  const [view, setView] = useState<'phone' | 'web' | 'email' | 'wa'>('phone');
  const [tab, setTab] = useState<'ai' | 'checks' | 'versions'>(edition.checks ? 'checks' : 'ai');
  const locked = status === 'sent' || status === 'sending';
  const first = useRef(true);
  const dirtyPlanned = useRef(false);
  const router = useRouter();
  const latest = useRef(c);
  latest.current = c;
  const saveRef = useRef(save);
  saveRef.current = save;
  const plannedRef = useRef(planned);
  plannedRef.current = planned;
  const [checkedAt, setCheckedAt] = useState(edition.checks?.at || '');
  const [editedAt, setEditedAt] = useState(edition.updated_at);
  const stale = !!checks && editedAt > checkedAt;
  const mod = useMod();

  /* ---------- toasts (replace the old inline notice) ---------- */
  const [toasts, setToasts] = useState<Toast[]>([]);
  const tid = useRef(0);
  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.map((x) => (x.id === id ? { ...x, out: true } : x)));
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 240);
  }, []);
  const setNote = useCallback((n: Note | null) => {
    if (!n) return;
    const id = ++tid.current;
    setToasts((t) => [...t.filter((x) => !x.out).slice(-2), { ...n, id }]);
    setTimeout(() => dismiss(id), n.kind === 'bad' || n.kind === 'warn' || n.action ? 8000 : 4500);
  }, [dismiss]);

  /* ---------- responsive inspector: inline (wide), drawer (mid), stacked (narrow) ---------- */
  const [layout, setLayout] = useState<'wide' | 'mid' | 'stack'>('wide');
  /* Phones: the preview grows to the page's height and scrolls with the page (no box-in-a-box scrolling). */
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(PHONE);
    const u = () => setPhone(m.matches);
    u();
    m.addEventListener('change', u);
    return () => m.removeEventListener('change', u);
  }, []);
  const [inspHidden, setInspHidden] = useState(false);
  const [drawer, setDrawer] = useState(false);
  /* Narrow screens show one pane at a time, switched from the bottom bar. Each pane keeps its own scroll position. */
  const [pane, setPaneRaw] = useState<'content' | 'preview' | 'insp'>('content');
  const paneRef = useRef(pane);
  paneRef.current = pane;
  const paneScroll = useRef<Record<string, number>>({});
  const setPane = useCallback((next: 'content' | 'preview' | 'insp') => {
    if (paneRef.current === next) return;
    paneScroll.current[paneRef.current] = window.scrollY;
    setPaneRaw(next);
  }, []);
  // After the new pane is in the DOM: first visit to Preview/Copilot lands on the pane itself (just under the bar),
  // not on the large title above it; later visits return to where you left it.
  const paneMounted = useRef(false);
  useLayoutEffect(() => {
    if (!paneMounted.current) { paneMounted.current = true; return; }
    const saved = paneScroll.current[pane];
    const shell = document.querySelector<HTMLElement>('.ed-shell');
    const bar = document.querySelector<HTMLElement>('.ed-top');
    const paneTop = shell && bar && pane !== 'content' ? Math.max(0, shell.getBoundingClientRect().top + window.scrollY - bar.offsetHeight - 12) : 0;
    window.scrollTo({ top: saved ?? paneTop });
  }, [pane]);
  useEffect(() => {
    const w = window.matchMedia(WIDE), s = window.matchMedia(STACK);
    const u = () => setLayout(w.matches ? 'wide' : s.matches ? 'stack' : 'mid');
    u();
    w.addEventListener('change', u); s.addEventListener('change', u);
    return () => { w.removeEventListener('change', u); s.removeEventListener('change', u); };
  }, []);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const reveal = useCallback((t: 'ai' | 'checks' | 'versions', scroll = false) => {
    setTab(t);
    const l = layoutRef.current;
    if (l === 'wide') setInspHidden(false);
    else if (l === 'mid') setDrawer(true);
    else setPane('insp');
  }, [setPane]);
  const toggleInspector = () => {
    if (layout === 'wide') setInspHidden((h) => !h);
    else if (layout === 'mid') setDrawer((d) => !d);
    else setPane('insp');
  };
  const inspVisible = layout === 'wide' ? !inspHidden : layout === 'mid' ? drawer : pane === 'insp';

  /* ---------- expand / collapse with an exit phase ---------- */
  const openRef = useRef(open);
  openRef.current = open;
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const setOpen = useCallback((id: string | null) => {
    const prev = openRef.current;
    if (prev === id) return;
    if (prev && !reducedMotion()) {
      setClosing(prev);
      clearTimeout(closeTimer.current);
      closeTimer.current = setTimeout(() => setClosing(null), 260);
    }
    setOpenRaw(id);
  }, []);
  const toggle = (id: string) => setOpen(open === id ? null : id);
  /* Hovering (or focusing) a collapsed row shortens its title to one line to make room for the tools. Hold the
     row's resting height first (data-hold gates that CSS), so the list never shifts under the pointer. */
  const holdRow = (e: React.SyntheticEvent<HTMLElement>) => {
    const h = e.currentTarget;
    if (h.dataset.hold || h.getAttribute('aria-expanded') === 'true' || !window.matchMedia('(hover: hover)').matches) return;
    h.style.minHeight = `${h.getBoundingClientRect().height}px`;
    h.dataset.hold = '1';
  };
  const dropRow = (h: HTMLElement) => { h.style.minHeight = ''; delete h.dataset.hold; };
  const releaseRow = (e: React.SyntheticEvent<HTMLElement>) => {
    const h = e.currentTarget;
    requestAnimationFrame(() => { if (!h.matches(':hover') && !h.contains(document.activeElement)) dropRow(h); });
  };
  const onHeadKey = (id: string) => (e: React.KeyboardEvent<HTMLElement>) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); dropRow(e.currentTarget); toggle(id); } };
  const renderBody = (id: string, shown: boolean, children: React.ReactNode) => {
    const leaving = !shown && closing === id;
    if (!shown && !leaving) return null;
    return <div className={`bx ${leaving ? 'closing' : ''}`} inert={leaving || undefined}><div className="bx-in"><div className={shown ? 'body' : 'body-closing'}>{children}</div></div></div>;
  };

  /* ---------- highlight blocks that just changed ---------- */
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const flash = useCallback((ids: string[]) => {
    if (!ids.length) return;
    setFresh(new Set(ids));
    setTimeout(() => setFresh(new Set()), 1600);
  }, []);

  /* ---------- autosave ---------- */
  // Edits made while a save is in flight must not be reported as saved.
  const rev = useRef(0);
  const doSave = useCallback(async (content: EditionContent, opts: { version?: boolean; note?: string } = {}) => {
    const at = rev.current;
    setSave('saving');
    try {
      const r = await fetch(`/api/editions/${edition.id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content, ...opts, ...(dirtyPlanned.current ? { plannedFor: planned } : {}) }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      dirtyPlanned.current = false;
      if (j.updated_at) setEditedAt(j.updated_at);
      if (j.status !== status) {
        if ((status === 'approved' || status === 'scheduled') && j.status === 'review') setNote({ kind: 'warn', text: 'You changed an approved edition, so it went back to review. Run checks and approve again.' });
        setStatus(j.status);
      }
      setSave(rev.current === at ? 'saved' : 'dirty');
      return true;
    } catch (e: any) {
      setSave('error');
      setNote({ kind: 'bad', text: e.message });
      return false;
    }
  }, [edition.id, status, planned, setNote]);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (locked) return;
    rev.current++;
    setSave('dirty');
    const t = setTimeout(() => doSave(c), 1200);
    return () => clearTimeout(t);
  }, [c, planned]); // eslint-disable-line react-hooks/exhaustive-deps
  // Never lose the last keystrokes: flush pending changes when leaving the editor inside the app.
  useEffect(() => () => {
    if ((saveRef.current === 'dirty' || saveRef.current === 'saving') && !locked) {
      fetch(`/api/editions/${edition.id}`, { method: 'PUT', keepalive: true, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: latest.current, ...(dirtyPlanned.current ? { plannedFor: plannedRef.current } : {}) }) }).catch(() => null);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  async function go(href: string) {
    if (!locked && saveRef.current !== 'saved') await doSave(latest.current);
    router.push(href);
  }
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (save === 'dirty' || save === 'saving') { e.preventDefault(); } };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [save]);
  const saveVersion = async () => {
    if (locked) return;
    if (await doSave(latest.current, { version: true, note: 'Saved by you' })) setNote({ kind: 'ok', text: 'Version saved. You’ll find it under History.' });
  };

  /* ---------- content helpers (with FLIP-animated reordering) ---------- */
  const listRef = useRef<HTMLFieldSetElement>(null);
  const flip = useFlip(listRef);
  const orderKey = c.blocks.map((b) => b.id).join(',');
  useLayoutEffect(() => { flip.play(); }, [orderKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (patch: Partial<EditionContent>) => setC((x) => ({ ...x, ...patch }));
  const setBlock = (id: string, patch: any) => setC((x) => ({ ...x, blocks: x.blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b)) }));
  const move = (id: string, d: number) => {
    flip.capture();
    setC((x) => {
      const i = x.blocks.findIndex((b) => b.id === id), j = i + d;
      if (j < 0 || j >= x.blocks.length) return x;
      const bl = [...x.blocks];
      [bl[i], bl[j]] = [bl[j], bl[i]];
      return { ...x, blocks: bl };
    });
  };
  const remove = (id: string) => setC((x) => ({ ...x, blocks: x.blocks.filter((b) => b.id !== id) }));
  const removeAnimated = (id: string) => {
    const idx = c.blocks.findIndex((x) => x.id === id);
    const b = c.blocks[idx];
    if (!b) return;
    const finish = () => {
      flip.capture();
      remove(id);
      setNote({ kind: '', text: `${BLOCK_LABELS[b.type]} deleted`, action: { label: 'Undo', run: () => { flip.capture(); setC((x) => { const bl = [...x.blocks]; bl.splice(Math.min(idx, bl.length), 0, b); return { ...x, blocks: bl }; }); flash([b.id]); } } });
    };
    const el = document.getElementById(`blk-${id}`);
    if (!el || reducedMotion()) { finish(); return; }
    el.style.overflow = 'hidden';
    el.style.pointerEvents = 'none';
    const a = el.animate([{ height: `${el.offsetHeight}px`, opacity: 1, transform: 'scale(1)' }, { height: '0px', opacity: 0, transform: 'scale(.96)', marginBottom: '-10px' }], { duration: 220, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
    a.onfinish = finish;
  };
  const add = (type: BlockType) => {
    const b = newBlock(type);
    flip.capture();
    setC((x) => {
      const ctaAt = x.blocks.findIndex((bb) => bb.type === 'cta');
      const bl = [...x.blocks];
      bl.splice(ctaAt < 0 ? bl.length : ctaAt, 0, b);
      return { ...x, blocks: bl };
    });
    if (layoutRef.current === 'stack') setPane('content');
    setOpen(b.id);
    flash([b.id]);
    setTimeout(() => document.getElementById(`blk-${b.id}`)?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' }), 60);
  };
  const focusBlock = (id: string) => {
    if (layoutRef.current === 'stack') setPane('content');
    setOpen(id);
    flash([id]);
    setTimeout(() => document.getElementById(`blk-${id}`)?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' }), 30);
  };

  /* ---------- drag to reorder ---------- */
  const [dragArm, setDragArm] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const onDragOver = (b: Block, i: number) => (e: React.DragEvent) => {
    if (!dragId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragId === b.id) return;
    const from = c.blocks.findIndex((x) => x.id === dragId);
    const r = e.currentTarget.getBoundingClientRect();
    const after = e.clientY > r.top + r.height / 2;
    if ((from < i && !after) || (from > i && after)) return;
    flip.capture();
    setC((x) => { const bl = [...x.blocks]; const [m] = bl.splice(from, 1); bl.splice(i, 0, m); return { ...x, blocks: bl }; });
  };

  /* ---------- preview ---------- */
  const [pv, setPv] = useState<{ kind: string; html: string }>({ kind: '', html: '' });
  const [wa, setWa] = useState<any>(null);
  const [updating, setUpdating] = useState(true);
  const lastView = useRef(view);
  useEffect(() => {
    const v = view === 'email' ? 'email' : view === 'wa' ? 'wa' : 'web';
    const switched = lastView.current !== view;
    lastView.current = view;
    setUpdating(true);
    let live = true;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/editions/${edition.id}/preview`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: c, view: v }) });
        if (v === 'wa') { const j = await r.json(); if (live) setWa(j); }
        else { const h = await r.text(); if (live) setPv({ kind: v, html: v === 'web' ? calm(h) : h }); }
      } finally { if (live) setUpdating(false); }
    }, switched ? 60 : 500);
    return () => { live = false; clearTimeout(t); };
  }, [c, view, edition.id]);
  const htmlFor = (k: string) => (pv.kind === k ? pv.html : '');

  /* ---------- checks ---------- */
  const [checking, setChecking] = useState(false);
  async function runChecks() {
    if (save !== 'saved') await doSave(c);
    setChecking(true);
    reveal('checks');
    try {
      const r = await fetch(`/api/editions/${edition.id}/checks`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ deep: true }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setChecks(j);
      setCheckedAt(j.at);
      if (status === 'draft') setStatus('review');
    } catch (e: any) { setNote({ kind: 'bad', text: e.message }); }
    setChecking(false);
  }
  const blocking = useMemo(() => (checks ? checks.results.filter((r) => r.status === 'fail' && r.blocking && !overrides[ovKey(r)]) : []), [checks, overrides]);
  const flagged = useMemo(() => new Set((checks?.results || []).filter((r) => r.status === 'fail' && r.blockId && !overrides[ovKey(r)]).map((r) => r.blockId!)), [checks, overrides]);
  const tally = useMemo(() => {
    const rs = checks?.results || [];
    const counted = rs.filter((r) => r.status !== 'skip');
    const passed = counted.filter((r) => r.status === 'ok' || (r.status === 'fail' && overrides[ovKey(r)])).length;
    const fails = rs.filter((r) => r.status === 'fail' && !overrides[ovKey(r)]).length;
    const warns = rs.filter((r) => r.status === 'warn').length;
    return { total: counted.length, passed, fails, warns };
  }, [checks, overrides]);
  /* Approve morphs into a check before the status pill cross-fades and Send becomes the next step. */
  const [approving, setApproving] = useState(false);
  const [morph, setMorph] = useState(false);
  const unapproveRef = useRef<() => void>(() => {});
  async function setStatusAction(action: 'approve' | 'unapprove') {
    if (saveRef.current !== 'saved') await doSave(latest.current);
    const recheck = action === 'approve' && (stale || !checks);
    if (action === 'approve') setApproving(true);
    if (recheck) setNote({ kind: '', text: 'Re-checking the latest version before approving…' });
    const r = await fetch(`/api/editions/${edition.id}/status`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action }) });
    const j = await r.json();
    if (j.checks) { setChecks(j.checks); setCheckedAt(j.checks.at); }
    if (!r.ok) { setApproving(false); setNote({ kind: 'bad', text: j.error }); reveal('checks', true); return; }
    if (action === 'approve' && !reducedMotion()) {
      setMorph(true);
      await new Promise((res) => setTimeout(res, 760));
    }
    setMorph(false);
    setApproving(false);
    setStatus(j.status);
    setNote(action === 'approve'
      ? { kind: 'ok', text: 'Approved. Next: choose who gets it and when.', action: { label: 'Undo', run: () => unapproveRef.current() } }
      : { kind: '', text: 'Back in review. Approve again when it’s ready.' });
  }
  unapproveRef.current = () => { setStatusAction('unapprove'); };
  async function override(checkId: string, reason: string) {
    const r = await fetch(`/api/editions/${edition.id}/status`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'override', checkId, reason }) });
    const j = await r.json();
    if (r.ok) setOverrides(j.overrides);
  }

  /* ---------- copilot ---------- */
  const [chat, setChat] = useState<{ role: 'u' | 'a'; text: string }[]>([]);
  const [instr, setInstr] = useState('');
  const [target, setTarget] = useState('');
  const [thinking, setThinking] = useState(false);
  const [proposal, setProposal] = useState<{ content: EditionContent; summary: string; changes: Change[]; instruction: string } | null>(null);
  const [applied, setApplied] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const inspBody = useRef<HTMLDivElement>(null);
  async function ask(text?: string, blockId?: string) {
    const instruction = (text ?? instr).trim();
    if (!instruction) return;
    if (save !== 'saved') await doSave(c);
    reveal('ai');
    setChat((x) => [...x, { role: 'u', text: instruction + (blockId || target ? `\n(on: ${summary(c.blocks.find((b) => b.id === (blockId || target))!)})` : '') }]);
    setInstr('');
    setThinking(true);
    try {
      const r = await fetch(`/api/editions/${edition.id}/ai`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ instruction, blockId: blockId || target || undefined }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      const changes = diffContent(c, j.content);
      setChat((x) => [...x, { role: 'a', text: `${j.summary}${changes.length ? '' : '\n(No changes proposed.)'}${j.model && j.model !== 'demo' ? `\n— ${j.model}` : ''}` }]);
      if (changes.length) { setApplied(false); setProposal({ content: j.content, summary: j.summary, changes, instruction }); }
    } catch (e: any) {
      setChat((x) => [...x, { role: 'a', text: `Couldn’t do that: ${e.message}` }]);
    }
    setThinking(false);
  }
  function accept() {
    if (!proposal) return;
    const before = new Map(c.blocks.map((b) => [b.id, JSON.stringify(b)]));
    const touched = proposal.content.blocks.filter((b) => before.get(b.id) !== JSON.stringify(b)).map((b) => b.id);
    flip.capture();
    setC(proposal.content);
    doSave(proposal.content, { version: true, note: `AI: ${proposal.instruction.slice(0, 80)}` });
    setApplied(true);
    flash(touched);
    setTimeout(() => { setProposal(null); setApplied(false); }, reducedMotion() ? 0 : 650);
    setChat((x) => [...x, { role: 'a', text: 'Applied. A version was saved, so you can roll back any time.' }]);
  }
  useEffect(() => {
    const el = inspBody.current;
    if (!el || tab !== 'ai') return;
    // An empty conversation starts at the top so the demo banner is fully visible;
    // only follow the tail once there is something to follow.
    if (!chat.length && !thinking && !proposal) { el.scrollTop = 0; return; }
    el.scrollTo({ top: el.scrollHeight, behavior: reducedMotion() ? 'auto' : 'smooth' });
  }, [chat.length, thinking, proposal, tab]);
  const autosize = (el: HTMLTextAreaElement | null) => { if (!el || el.offsetParent === null) return; el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 168)}px`; };
  useEffect(() => { autosize(inputRef.current); }, [instr, pane, tab, layout, drawer, inspHidden]);

  /* ---------- subjects ---------- */
  const [subs, setSubs] = useState<{ subjects: string[]; waHooks: string[] } | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  async function suggest() {
    setSuggesting(true);
    if (saveRef.current !== 'saved') await doSave(latest.current);
    const r = await fetch(`/api/editions/${edition.id}/subjects`, { method: 'POST' });
    const j = await r.json();
    setSuggesting(false);
    if (r.ok) setSubs(j); else setNote({ kind: 'bad', text: j.error });
  }

  /* ---------- versions ---------- */
  const [versions, setVersions] = useState<any[] | null>(null);
  useEffect(() => { if (tab === 'versions') fetch(`/api/editions/${edition.id}/versions`).then((r) => r.json()).then(setVersions); }, [tab, edition.id, save]);
  async function restore(vid: string) {
    const r = await fetch(`/api/editions/${edition.id}/versions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ versionId: vid }) });
    const j = await r.json();
    if (!r.ok) { setNote({ kind: 'bad', text: j.error }); return; }
    first.current = true;
    setC(j.content);
    setStatus(j.status);
    setSave('saved');
    if (j.updated_at) setEditedAt(j.updated_at);
    setNote({ kind: 'ok', text: 'Version restored.' });
  }

  /* ---------- keyboard shortcuts: ⌘S version · ⌘↵ copilot · ⌘. collapse ---------- */
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyRef.current = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && drawer && !document.querySelector('.ed-pop')) { setDrawer(false); return; }
    if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 's') { e.preventDefault(); saveVersion(); }
    else if (k === '.') { e.preventDefault(); setOpen(null); }
    else if (k === 'enter') {
      if ((e.target as HTMLElement)?.id === 'copilot-input' || locked) return;
      e.preventDefault();
      reveal('ai', true);
      if (instr.trim()) ask(); else setTimeout(() => inputRef.current?.focus(), 80);
    }
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  /* ---------- menus ---------- */
  const [menu, setMenu] = useState(false);
  const moreRef = useRef<HTMLButtonElement>(null);
  const [addOpen, setAddOpen] = useState(false);
  const addRef = useRef<HTMLButtonElement>(null);
  const closeMenu = useCallback(() => setMenu(false), []);
  const closeAdd = useCallback(() => setAddOpen(false), []);
  const gridKeys = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const d = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 2, ArrowUp: -2 }[e.key];
    if (!d) return;
    e.preventDefault();
    const tiles = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('button')];
    const i = tiles.indexOf(document.activeElement as HTMLButtonElement);
    tiles[Math.max(0, Math.min(tiles.length - 1, i + d))]?.focus();
  };

  const sendHref = `/app/editions/${edition.id}/${locked ? 'analytics' : 'distribute'}`;
  const approved = status === 'approved' || status === 'scheduled';
  const subjectFor = c.subject.replace('{first_name}', 'Rohan');
  const sortedChecks = useMemo(() => {
    const rank = (r: CheckResult) => (r.status === 'fail' && !overrides[ovKey(r)] ? 0 : r.status === 'warn' ? 1 : r.status === 'skip' ? 2 : 3);
    const all = [...(checks?.results || [])].sort((a, b) => rank(a) - rank(b));
    return { issues: all.filter((r) => rank(r) < 3), passed: all.filter((r) => rank(r) === 3) };
  }, [checks, overrides]);

  /* ---------- the weekly state machine: Draft → Run checks → Approve → Send ---------- */
  const phase: 'check' | 'checking' | 'fix' | 'approve' | 'send' | 'sent' =
    locked ? 'sent' : approved && !morph ? 'send' : checking ? 'checking' : approving || morph ? 'approve' : !checks || stale ? 'check' : blocking.length ? 'fix' : 'approve';
  const nBlock = blocking.length;
  const sendWhy = 'Approve first to send to everyone. You can still send yourself a test.';
  /* The same weekly-flow model as Home and Editions: one stepper, one next step, the same words. */
  const stage: FlowStage | 'done' = phase === 'sent' ? 'done' : phase === 'send' ? 'send' : phase === 'approve' ? 'approve' : 'check';
  const flow = flowState({ id: edition.id, status, updated_at: editedAt, checks: checks ? { ...checks, at: checkedAt } : null, overrides });
  const nextStep = (
    phase === 'check' || phase === 'checking'
      ? <button type="button" className="btn primary flow-now" onClick={runChecks} disabled={checking} title={flow.detail}>{checking ? <><span className="spin" />Checking…</> : <><I.shield size={15} />Run all checks</>}</button>
      : phase === 'fix'
        ? <button type="button" className="btn flow-now issue" onClick={() => reveal('checks', true)} title={flow.detail}><span className="flow-n tnum">{nBlock}</span>{nBlock === 1 ? 'Fix 1 issue' : `Fix ${nBlock} issues`}</button>
        : phase === 'approve'
          ? <MorphButton morph={morph} busy={approving} onClick={() => setStatusAction('approve')}>Approve</MorphButton>
          : <a className="btn primary flow-now" href={sendHref} onClick={(e) => { e.preventDefault(); go(sendHref); }}>{locked ? 'Results →' : status === 'scheduled' ? 'View schedule →' : 'Send →'}</a>
  );

  /* Keep the sticky panes clear of the toolbar, whatever its height (it wraps on narrow screens). */
  const edRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const bar = barRef.current, ed = edRef.current;
    if (!bar || !ed) return;
    // The toolbar's page-coloured strip is pinned at top: 0, so the panes stick just below its bottom edge.
    const set = () => {
      ed.style.setProperty('--ed-top', `${Math.round(bar.getBoundingClientRect().height + 18)}px`);
      // Pane height from where the panes sit before scrolling, so the preview footer is never cut off at rest.
      const shell = ed.querySelector<HTMLElement>('.ed-shell');
      if (shell) ed.style.setProperty('--ed-rest', `${Math.round(shell.getBoundingClientRect().top + window.scrollY)}px`);
    };
    set();
    const ro = new ResizeObserver(set);
    ro.observe(bar);
    window.addEventListener('resize', set);
    window.addEventListener('scroll', set, { passive: true });
    return () => { ro.disconnect(); window.removeEventListener('resize', set); window.removeEventListener('scroll', set); };
  }, []);

  /* Glass hairline only once content scrolls under the toolbar; on narrow screens the small title appears
     in the bar once the large title has scrolled away beneath it. */
  const [scrolled, setScrolled] = useState(false);
  const [titled, setTitled] = useState(false);
  const headRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const on = () => {
      setScrolled(window.scrollY > 4);
      const h = headRef.current, bar = barRef.current;
      setTitled(!!h && !!bar && h.offsetParent !== null && h.getBoundingClientRect().bottom < bar.getBoundingClientRect().bottom);
    };
    on();
    window.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on);
    return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on); };
  }, []);

  /* 1000–1499px: the inspector floats over the preview. While it is open, the device slides (and if needed scales)
     into the space left of it, so the preview stays whole; window views narrow instead and re-fit their page. */
  const centerRef = useRef<HTMLDivElement>(null);
  const overlay = layout === 'mid' && drawer;
  useLayoutEffect(() => {
    const el = centerRef.current;
    if (!el || !overlay) return;
    const fit = () => {
      const aside = el.parentElement?.querySelector<HTMLElement>('.ed-right');
      if (!aside) return;
      const r = el.getBoundingClientRect();
      const edge = window.innerWidth - (parseFloat(getComputedStyle(aside).right) || 0) - aside.offsetWidth - 20;
      const pad = Math.max(0, Math.round(r.right - edge));
      const dev = el.querySelector<HTMLElement>('.pv-stage > .phone-frame');
      const s = dev ? Math.min(1, (r.width - pad - 24) / dev.offsetWidth) : 1;
      el.style.setProperty('--pv-pad', `${pad}px`);
      el.style.setProperty('--pv-dx', `${-pad / 2}px`);
      el.style.setProperty('--pv-s', String(Math.max(0.5, Math.round(s * 1000) / 1000)));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [overlay, view]);

  const [keysOpen, setKeysOpen] = useState(false);
  const keysRef = useRef<HTMLButtonElement>(null);
  const closeKeys = useCallback(() => setKeysOpen(false), []);

  return (
    <div className="ed ed-route" ref={edRef}>
      {/* ---------- Toolbar: pinned to the top on a page-coloured strip, so nothing shows above or behind it ---------- */}
      <div className={`ed-top ${scrolled ? 'scrolled' : ''} ${titled ? 'titled' : ''}`} ref={barRef}>
      <div className="statusbar ed-bar">
        <div className="tb-l">
          <a href="/app/editions" className="tb-back" onClick={(e) => { e.preventDefault(); go('/app/editions'); }} aria-label="Back to editions"><I.back size={17} /><span>Editions</span></a>
          <span className="tb-sep" aria-hidden />
          <span className="tb-num tnum">{edNo(edition.number)}</span>
          <h1 className="tb-title" title={c.title}>{c.title || 'Untitled edition'}</h1>
          <span className="tb-mini" aria-hidden>{c.title || 'Untitled edition'}</span>
          <StatusSwap status={status} />
          {!locked && <SaveState save={save} onRetry={() => doSave(latest.current)} />}
        </div>
        <div className="tb-r">
          <div className="tb-flow"><FlowStepper current={stage} compact /></div>
          <div className="tb-tools">
            <button type="button" className={`icon-btn tb-insp ${inspVisible ? 'on' : ''}`} onClick={toggleInspector} aria-pressed={inspVisible} title={inspVisible ? 'Hide inspector' : 'Show inspector'} aria-label="Inspector">
              <I.sidebar />{tally.fails > 0 && <span className="badge-dot" aria-hidden />}
            </button>
            <a className="icon-btn tb-ext" href={`${publicUrl}?preview=1`} target="_blank" rel="noreferrer" title="Open the reader page in a new tab" aria-label="Open reader page"><I.external /></a>
            <span className="pop-anchor">
              <button ref={moreRef} type="button" className="icon-btn" aria-haspopup="menu" aria-expanded={menu} title="More actions" aria-label="More actions" onClick={() => setMenu((m) => !m)}><I.more /></button>
              <Popover open={menu} onClose={closeMenu} anchor={moreRef} label="More actions" align="end" className="ed-menu" role="menu">
                {!locked && <button type="button" role="menuitem" onClick={() => { setMenu(false); saveVersion(); }}><I.save size={16} /><span>Save a version</span><span className="mk"><Kbd>{mod}</Kbd><Kbd>S</Kbd></span></button>}
                <button type="button" role="menuitem" onClick={() => { setMenu(false); setOpen(null); }}><I.collapse size={16} /><span>Collapse all blocks</span><span className="mk"><Kbd>{mod}</Kbd><Kbd>.</Kbd></span></button>
                {!locked && <button type="button" role="menuitem" onClick={() => { setMenu(false); reveal('ai', true); setTimeout(() => inputRef.current?.focus(), 80); }}><I.sparkle size={16} /><span>Ask the copilot</span><span className="mk"><Kbd>{mod}</Kbd><Kbd>↵</Kbd></span></button>}
                {!locked && checks && !checking && <button type="button" role="menuitem" onClick={() => { setMenu(false); runChecks(); }}><I.refresh size={16} /><span>Run the checks again</span></button>}
                {!locked && !approved && <a role="menuitem" href={sendHref} onClick={(e) => { e.preventDefault(); setMenu(false); go(sendHref); }}><I.mail size={16} /><span>Send yourself a test</span></a>}
                <a role="menuitem" href={`${publicUrl}?preview=1`} target="_blank" rel="noreferrer" onClick={() => setMenu(false)}><I.external size={16} /><span>Open reader page</span></a>
                <form action={duplicateAction}><button type="submit" role="menuitem"><I.copy size={16} /><span>Duplicate edition</span></button></form>
                {!locked && approved && <><div className="menu-sep" /><button type="button" role="menuitem" onClick={() => { setMenu(false); setStatusAction('unapprove'); }}><I.back size={16} /><span>Unapprove (back to review)</span></button></>}
                {!locked && <><div className="menu-sep" /><div className="menu-danger"><Confirm action={deleteAction} label="Delete edition…" confirmLabel="Delete" /></div></>}
              </Popover>
            </span>
          </div>
          <div className={`ed-flow is-${phase}`} aria-label="Next step" role="group">
            {!approved && !locked && <a className="flow-st" href={sendHref} title={sendWhy} onClick={(e) => { e.preventDefault(); go(sendHref); }}>Send →</a>}
            {nextStep}
          </div>
        </div>
      </div>
      </div>

      {/* ---------- Large title (narrow screens): title, status and where it is in the weekly flow ---------- */}
      <header className="ed-head">
        <div className="eyebrow"><span className="tnum">{edNo(edition.number)}</span>{planned ? <><span className="sep" aria-hidden>·</span><span title={relDay(planned)}>Planned for {fmtDay(planned)}</span></> : null}</div>
        <h1 ref={headRef}>{c.title || 'Untitled edition'}</h1>
        <div className="ed-head-m"><StatusSwap status={status} /><span className="ed-head-next">{phase === 'sent' ? 'Sent · read-only' : status === 'scheduled' ? flow.detail : `Next: ${flow.title}`}</span></div>
        <FlowStepper current={stage} />
      </header>
      {locked && (
        <div className="notice ed-locked">
          <span className="ni" aria-hidden><I.lock size={12} /></span>
          <div>This edition has been sent, so it’s read-only. Duplicate it to reuse the layout.</div>
          <form action={duplicateAction}><button type="submit" className="btn sm">Duplicate</button></form>
        </div>
      )}
      <div className={`ed-shell ed-v2 ${inspHidden ? 'no-insp' : ''} ${overlay ? 'insp-over' : ''}`} data-pane={pane}>
        {/* ---------- LEFT: content ---------- */}
        <div className="ed-col ed-left">
          <div className="pane-h">
            <h2>Content</h2>
            <span className="pane-c">{c.blocks.length} blocks</span>
            <span className="spacer" />
            {open && <button type="button" className="btn sm pane-collapse" onClick={() => setOpen(null)} title={`Collapse all (${mod} .)`}><I.collapse size={14} />Collapse</button>}
            <span className="pop-anchor">
              <button ref={keysRef} type="button" className="icon-btn sm" aria-haspopup="dialog" aria-expanded={keysOpen} onClick={() => setKeysOpen((o) => !o)} title="Keyboard shortcuts" aria-label="Keyboard shortcuts"><I.keyboard size={16} /></button>
              <Popover open={keysOpen} onClose={closeKeys} anchor={keysRef} label="Keyboard shortcuts" align="end" className="ed-keys">
                <b>Keyboard shortcuts</b>
                <dl>
                  <dt><Kbd>{mod}</Kbd><Kbd>S</Kbd></dt><dd>Save a version</dd>
                  <dt><Kbd>{mod}</Kbd><Kbd>↵</Kbd></dt><dd>Ask the copilot</dd>
                  <dt><Kbd>{mod}</Kbd><Kbd>.</Kbd></dt><dd>Collapse all blocks</dd>
                  <dt><Kbd>Esc</Kbd></dt><dd>Close menus and the inspector</dd>
                </dl>
              </Popover>
            </span>
          </div>
          <fieldset ref={listRef} disabled={locked} className="ed-blocks">
            <div className={`blk meta ${open === 'meta' || !c.title ? 'open' : ''}`} data-flip="meta">
              <header role="button" tabIndex={0} aria-expanded={open === 'meta' || !c.title} onClick={() => toggle('meta')} onKeyDown={onHeadKey('meta')}>
                <span className="bi t-ink" aria-hidden><I.doc size={16} /></span>
                <span className="hd"><span className="typ">Headline & messages</span><span className="s">{c.title || 'Add a headline'}</span></span>
                <span className="chev" aria-hidden><I.chevron size={13} /></span>
              </header>
              {renderBody('meta', open === 'meta' || !c.title, <>
                <div className="grp-h">Page</div>
                <label className="f"><span>Theme label (kicker)</span><input className="in" value={c.kicker} onChange={(e) => set({ kicker: e.target.value })} placeholder="e.g. Q3 in numbers" /></label>
                <label className="f"><span>Headline <Count n={c.title.length} max={60} /></span><input className="in" value={c.title} onChange={(e) => set({ title: e.target.value })} /></label>
                <label className="f"><span>Subtitle</span><Area rows={2} value={c.dek} onChange={(e) => set({ dek: e.target.value })} /></label>
                <div className="form-grid">
                  <label className="f"><span>Read time (min)</span><input className="in" type="number" min={1} max={15} value={c.readMinutes} onChange={(e) => set({ readMinutes: Number(e.target.value) || 3 })} /></label>
                  <label className="f"><span>Planned send date</span><input className="in" type="date" value={planned} onChange={(e) => { dirtyPlanned.current = true; setPlanned(e.target.value); }} /></label>
                </div>
                <div className="grp-h">Email</div>
                <label className="f"><span>Email subject <Count n={subjectFor.length} unit=" chars" /></span><input className="in" value={c.subject} onChange={(e) => set({ subject: e.target.value })} /><small>{'{first_name}'} is replaced per person.</small></label>
                <label className="f"><span>Email preview text</span><input className="in" value={c.preheader} onChange={(e) => set({ preheader: e.target.value })} /></label>
                <div className="row"><button type="button" className="btn sm" onClick={suggest} disabled={suggesting}>{suggesting ? <><span className="spin" />Thinking…</> : <><I.sparkle size={14} />Suggest subject lines</>}</button></div>
                {subs && (
                  <div className="stack subs" style={{ gap: 6 }}>
                    <div className="chips">{subs.subjects.map((s, i) => <button type="button" key={s} className="chip" style={{ animationDelay: `${i * 40}ms` }} onClick={() => set({ subject: s })} aria-pressed={c.subject === s}>{s}</button>)}</div>
                    {subs.waHooks.length > 0 && <div className="hint">WhatsApp hooks: {subs.waHooks.join(' · ')}</div>}
                  </div>
                )}
                <div className="grp-h">WhatsApp & link preview</div>
                <label className="f"><span>WhatsApp message <Count n={c.waText.length} unit=" chars" /></span><Area rows={3} value={c.waText} onChange={(e) => set({ waText: e.target.value })} /><small className={c.waText.includes('{link}') ? '' : 'warn-t'}>{c.waText.includes('{link}') ? 'Includes {link}, replaced by each person’s link.' : 'Must include {link}.'}</small></label>
                <label className="f"><span>Link-preview title <Count n={c.preview.title.length} max={60} /></span><input className="in" value={c.preview.title} onChange={(e) => set({ preview: { ...c.preview, title: e.target.value } })} /></label>
                <label className="f"><span>Link-preview description <Count n={c.preview.description.length} max={110} /></span><input className="in" value={c.preview.description} onChange={(e) => set({ preview: { ...c.preview, description: e.target.value } })} /></label>
              </>)}
            </div>

            {c.blocks.map((b, i) => (
              <div key={b.id} id={`blk-${b.id}`} data-flip={b.id}
                className={`blk ${flagged.has(b.id) ? 'flag' : ''} ${open === b.id ? 'open' : ''} ${fresh.has(b.id) ? 'fresh' : ''} ${dragId === b.id ? 'dragging' : ''}`}
                draggable={!locked && dragArm === b.id}
                onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', b.id); setDragId(b.id); }}
                onDragEnd={() => { setDragId(null); setDragArm(null); }}
                onDragOver={onDragOver(b, i)} onDrop={(e) => { e.preventDefault(); setDragId(null); setDragArm(null); }}>
                <header role="button" tabIndex={0} aria-expanded={open === b.id} onClick={(e) => { dropRow(e.currentTarget); toggle(b.id); }} onKeyDown={onHeadKey(b.id)}
                  onPointerEnter={locked ? undefined : holdRow} onFocus={locked ? undefined : holdRow} onPointerLeave={locked ? undefined : releaseRow} onBlur={locked ? undefined : releaseRow}>
                  {!locked && <span className="grip" title="Drag to reorder" aria-hidden onPointerDown={() => setDragArm(b.id)} onPointerUp={() => setDragArm(null)} onClick={(e) => e.stopPropagation()}><I.grip size={14} /></span>}
                  <BlockIcon type={b.type} />
                  <span className="hd"><span className="typ">{BLOCK_LABELS[b.type]}</span><span className="s">{summary(b)}</span></span>
                  {flagged.has(b.id) && <span className="flag-dot" title="A check failed on this block" />}
                  {!locked && (
                    <span className="tools" onClick={(e) => e.stopPropagation()}>
                      <button type="button" title="Move up" aria-label="Move up" onClick={() => move(b.id, -1)} disabled={i === 0}><I.up size={14} /></button>
                      <button type="button" title="Move down" aria-label="Move down" onClick={() => move(b.id, 1)} disabled={i === c.blocks.length - 1}><I.down size={14} /></button>
                      <button type="button" title="Ask the copilot about this block" aria-label="Ask the copilot about this block" onClick={() => { setTarget(b.id); reveal('ai', true); setTimeout(() => inputRef.current?.focus(), 80); }}><I.sparkle size={14} /></button>
                      <button type="button" title="Delete block" aria-label="Delete block" className="del" onClick={() => removeAnimated(b.id)}><I.trash size={14} /></button>
                    </span>
                  )}
                  <span className="chev" aria-hidden><I.chevron size={13} /></span>
                </header>
                {renderBody(b.id, open === b.id, <BlockForm b={b} c={c} kb={kb} stories={stories} setBlock={setBlock} setC={setC} />)}
              </div>
            ))}

            {!locked && (
              <div className="addblk" data-flip="add">
                <button ref={addRef} type="button" className="addblk-trigger" aria-haspopup="dialog" aria-expanded={addOpen} onClick={() => setAddOpen((o) => !o)}>
                  <span className="plus" aria-hidden><I.plus size={13} /></span>Add block
                </button>
                <Popover open={addOpen} onClose={closeAdd} anchor={addRef} label="Add a block" place="auto" className="addmenu">
                  <div className="addmenu-h"><b>Add a block</b><span>Goes in before the call to action</span></div>
                  <div className="addgrid" onKeyDown={gridKeys}>
                    {(Object.keys(BLOCK_LABELS) as BlockType[]).map((t, i) => (
                      <button key={t} type="button" className="addtile" style={{ animationDelay: `${i * 18}ms` }} onClick={() => { setAddOpen(false); add(t); }}>
                        <BlockIcon type={t} size={17} /><span><b>{BLOCK_LABELS[t]}</b><small>{BLOCK_META[t].desc}</small></span>
                      </button>
                    ))}
                  </div>
                </Popover>
              </div>
            )}

            <div className={`blk src ${open === 'sources' ? 'open' : ''}`} data-flip="sources">
              <header role="button" tabIndex={0} aria-expanded={open === 'sources'} onClick={() => toggle('sources')} onKeyDown={onHeadKey('sources')}>
                <span className="bi t-gray" aria-hidden><I.link size={16} /></span>
                <span className="hd"><span className="typ">Sources</span><span className="s">{c.sources.length} linked · every fact must cite one</span></span>
                <span className="chev" aria-hidden><I.chevron size={13} /></span>
              </header>
              {renderBody('sources', open === 'sources', <SourcesEditor c={c} setC={setC} stories={stories} />)}
            </div>
          </fieldset>
        </div>

        {/* ---------- CENTER: preview ---------- */}
        <div className="ed-col ed-center" ref={centerRef}>
          <div className="pv-head">
            <Segmented label="Preview" value={view} onChange={setView} options={VIEWS} />
            <span className={`pv-live ${updating ? 'busy' : ''}`} aria-live="polite">{updating ? <><span className="spin" />Updating</> : <><span className="live-dot" />Live</>}</span>
          </div>
          <div className={`pv-stage ${phone ? 'fit' : ''}`} key={view}>
            {view === 'phone' && (
              <div className="phone-frame"><StatusBar /><PreviewFrame html={htmlFor('web')} title="Phone preview" fit={phone} /></div>
            )}
            {view === 'web' && (
              <div className="win browser">
                <div className="win-bar"><span className="lights" aria-hidden><i /><i /><i /></span><span className="url"><I.shield size={12} />{publicUrl.replace(/^https?:\/\//, '')}</span><span className="lights-sp" /></div>
                <ScaledPreview html={htmlFor('web')} title="Desktop preview" width={1180} fit={phone} />
              </div>
            )}
            {view === 'email' && (
              <div className="win mailwin">
                <div className="win-bar"><span className="lights" aria-hidden><i /><i /><i /></span><span className="url"><I.mail size={12} />Inbox</span><span className="lights-sp" /></div>
                <div className="mail-h">
                  <span className="av" aria-hidden>{product.name.slice(0, 1)}</span>
                  <div className="mail-m"><div className="mail-from"><b>{product.newsletter}</b><span>to Rohan</span></div><div className="mail-subj">{subjectFor || 'No subject'}</div><div className="mail-pre">{c.preheader}</div></div>
                </div>
                <ScaledPreview html={htmlFor('email')} title="Email preview" width={680} fit={phone} />
              </div>
            )}
            {view === 'wa' && (
              <div className="phone-frame wa">
                <StatusBar />
                <div className="wa-top"><I.back size={18} /><span className="av" aria-hidden>R</span><span><b>Rohan</b><small>online</small></span></div>
                <div className="wa-sim">
                  {wa ? (<>
                    <div className="wa-day">Today</div>
                    <div className="wa-b">
                      <div className="og">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={wa.og} alt="Link preview" /><div className="t"><b>{wa.title}</b><span>{wa.description}</span><small>{wa.host}</small></div></div>
                      <div className="m">{wa.text}<span className="wa-time">10:00 am <svg width="16" height="10" viewBox="0 0 16 10" aria-hidden><path d="m1 5 3 3 6-7M6 8l1 1 6-8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg></span></div>
                    </div>
                    <div className="wa-note">The preview image updates when you save. WhatsApp caches previews per link.</div>
                  </>) : <div className="wa-load"><span className="skeleton" /><span className="skeleton" /></div>}
                </div>
              </div>
            )}
          </div>
          <div className="pv-foot">Live preview · personalised for “Rohan”</div>
        </div>

        {/* ---------- RIGHT: inspector ---------- */}
        <div className={`insp-scrim ${drawer ? 'on' : ''}`} onClick={() => setDrawer(false)} aria-hidden />
        <aside className={`ed-col ed-right ${drawer ? 'drawer-open' : ''}`} aria-label="Inspector">
          <div className="insp">
            <div className="insp-h">
              <Segmented className="insp-tabs" label="Inspector" value={tab} onChange={setTab} options={[
                { value: 'ai', label: <><I.sparkle size={13} />Copilot</> },
                { value: 'checks', label: <>Checks{checks ? (tally.fails ? <span className="tab-badge bad">{tally.fails}</span> : <span className="tab-badge ok"><I.check size={9} /></span>) : null}</> },
                { value: 'versions', label: 'History' },
              ]} />
              <button type="button" className="icon-btn insp-close" onClick={() => setDrawer(false)} aria-label="Close inspector"><I.close size={16} /></button>
            </div>

            <div className="insp-b" ref={inspBody} key={tab}>
              {tab === 'ai' && (
                <div className="cp">
                  {!aiReady && <div className="notice warn cp-demo"><span className="ni" aria-hidden>!</span><div>Demo mode. <Link href="/app/settings?tab=ai">Connect an AI provider</Link> to edit with the copilot.</div></div>}
                  {chat.length === 0 && !thinking ? (
                    <div className="cp-empty">
                      <span className="cp-orb" aria-hidden><I.sparkle size={22} /></span>
                      <b>What should change?</b>
                      <span className="hint">Ask for any change: “shorten story 2”, “add a line on Pune”, “make the WhatsApp text friendlier”. You’ll see the changes before anything is applied.</span>
                      {!locked && <div className={`cp-quick ${aiReady ? '' : 'demo'}`}>
                        {QUICK.map((q, i) => <button type="button" key={q} style={{ animationDelay: `${60 + i * 35}ms` }} disabled={!aiReady} title={aiReady ? undefined : 'Suggestions need an AI provider'} onClick={() => ask(q)}>{q}</button>)}
                        {!aiReady && <span className="hint cp-why">Suggestions need an AI provider. You can still type an instruction to try the demo.</span>}
                      </div>}
                    </div>
                  ) : (
                    <div className="chat">
                      {chat.map((m, i) => <div key={i} className={`msg ${m.role}`}>{m.text}</div>)}
                      {thinking && <div className="msg a typing" aria-label="Thinking"><i /><i /><i /></div>}
                    </div>
                  )}
                  {proposal && (
                    <div className={`proposal ${applied ? 'applied' : ''}`}>
                      <div className="proposal-h"><b>Proposed changes</b><span className="pill info">{proposal.changes.length}</span></div>
                      <div className="diff">{proposal.changes.slice(0, 30).map((ch, i) => (
                        <div key={i} className="diff-i" style={{ animationDelay: `${i * 30}ms` }}>
                          <div className="diff-w">{WHERE[ch.where] || ch.where}</div>
                          {ch.before && <del>{ch.before.slice(0, 300)}</del>}{ch.before && ch.after ? ' ' : null}{ch.after && <ins>{ch.after.slice(0, 300)}</ins>}
                        </div>
                      ))}</div>
                      <div className="proposal-f">
                        <button type="button" className="btn primary sm" onClick={accept} disabled={applied}>{applied ? <><I.check size={13} />Applied</> : 'Apply changes'}</button>
                        <button type="button" className="btn sm" onClick={() => setProposal(null)} disabled={applied}>Discard</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {tab === 'checks' && (
                <div className="ck">
                  <div className="ck-sum">
                    <Ring total={tally.total} spinning={checking || (approving && (stale || !checks))} size={52} stroke={5}
                      parts={checks ? [{ n: tally.passed, tone: 'ok' }, { n: tally.warns, tone: 'warn' }, { n: tally.fails, tone: 'bad' }] : []}>
                      {checking ? null : checks ? <span className="ring-frac"><b>{tally.passed}</b><i>/{tally.total}</i></span> : <I.shield size={18} />}
                    </Ring>
                    <div className="ck-sum-t">
                      <b>{checking ? 'Checking links and facts…' : checks ? (tally.fails ? `${tally.passed} of ${tally.total} passed` : tally.warns ? `All clear · ${tally.warns} to review` : `All ${tally.total} passed`) : 'Not checked yet'}</b>
                      {checks ? <span className="hint">Last run {when(checks.at)}</span> : <span className="hint">Sources, wording, links, size and an AI fact-check.</span>}
                    </div>
                    <button type="button" className={`icon-btn ck-run ${checking ? 'busy' : ''}`} onClick={runChecks} disabled={checking || locked} title="Run all checks again" aria-label="Run all checks again"><I.refresh size={17} /></button>
                  </div>
                  {checks ? (
                    <>
                      {stale && <div className="notice warn"><span className="ni" aria-hidden>!</span><div>You’ve edited since these results. Run the checks again; Approve does it for you.</div></div>}
                      {nBlock > 0
                        ? <div className="notice bad"><span className="ni" aria-hidden>!</span><div><b>{nBlock} {nBlock === 1 ? 'check blocks' : 'checks block'} approval</b><span className="ck-nsub">Fix {nBlock === 1 ? 'it' : 'them'}, or override with a reason.</span></div></div>
                        : <div className="notice ok"><span className="ni" aria-hidden><I.check size={11} /></span><div>Nothing blocks approval.</div></div>}
                      {sortedChecks.issues.length > 0 && <>
                        <div className="ck-grp">Needs attention · {sortedChecks.issues.length}</div>
                        <ul className="cl">{sortedChecks.issues.map((r, i) => <CheckRow key={r.id + r.label} i={i} r={r} overridden={overrides[ovKey(r)]} onOpen={() => { if (r.blockId) focusBlock(r.blockId); }} onOverride={(reason) => override(r.id, reason)} locked={locked} />)}</ul>
                      </>}
                      {sortedChecks.passed.length > 0 && (
                        <details className="ck-passed" open={!sortedChecks.issues.length}>
                          <summary><span className="ic ok"><I.check size={11} /></span>Passed · {sortedChecks.passed.length}<I.chevron size={12} /></summary>
                          <ul className="cl">{sortedChecks.passed.map((r, i) => <CheckRow key={r.id + r.label} i={i} r={r} overridden={overrides[ovKey(r)]} onOpen={() => { if (r.blockId) focusBlock(r.blockId); }} onOverride={(reason) => override(r.id, reason)} locked={locked} />)}</ul>
                        </details>
                      )}
                    </>
                  ) : checking ? <div className="ck-skel" aria-hidden>{[0, 1, 2, 3, 4].map((i) => <span key={i} className="skeleton" />)}</div> : null}
                </div>
              )}

              {tab === 'versions' && (
                <div className="vh">
                  {!versions ? <div className="ck-skel" aria-hidden>{[0, 1, 2, 3].map((i) => <span key={i} className="skeleton" />)}</div>
                    : !versions.length ? (
                      <div className="cp-empty"><span className="cp-orb gray" aria-hidden><I.history size={22} /></span><b>No versions yet</b><span className="hint">Press <Kbd>{mod}</Kbd> <Kbd>S</Kbd> to save one. Copilot edits save a version automatically.</span></div>
                    ) : (
                      <ol>
                        {versions.map((v, i) => (
                          <li key={v.id} style={{ animationDelay: `${i * 30}ms` }}>
                            <span className="vh-dot" aria-hidden />
                            <div className="vh-m"><div className="vh-n">{v.note || 'Saved'}</div><div className="hint" title={when(v.created_at)}>{v.author} · {ago(v.created_at)}</div></div>
                            {!locked && <button type="button" className="btn sm" onClick={() => restore(v.id)}>Restore</button>}
                          </li>
                        ))}
                      </ol>
                    )}
                </div>
              )}
            </div>

            {tab === 'ai' && !locked && (
              <div className="insp-f composer">
                {chat.length > 0 && aiReady && <div className="cp-chips">{QUICK.map((q) => <button type="button" key={q} className="chip" onClick={() => ask(q)} disabled={thinking}>{q}</button>)}</div>}
                <div className="cp-box">
                  <div className="cp-target">
                    <span>Apply to</span>
                    <select className="cp-sel" aria-label="Apply to" value={target} onChange={(e) => setTarget(e.target.value)}>
                      <option value="">Whole edition</option>
                      {c.blocks.map((b) => <option key={b.id} value={b.id}>{BLOCK_LABELS[b.type]}: {summary(b).slice(0, 40)}</option>)}
                    </select>
                  </div>
                  <div className="cp-row">
                    <textarea id="copilot-input" ref={inputRef} className="cp-in" rows={1} aria-label="Instruction for the copilot" value={instr} placeholder="What should change?" onChange={(e) => setInstr(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); ask(); } }} />
                    <button type="button" className="cp-send" disabled={thinking || !instr.trim()} onClick={() => ask()} aria-label="Ask" title={`Ask (${mod} ↵)`}>{thinking ? <span className="spin" /> : <I.send size={15} />}</button>
                  </div>
                </div>
                <div className="cp-hint"><Kbd>{mod}</Kbd><Kbd>↵</Kbd> to ask</div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* ---------- Bottom bar (narrow screens): pane switcher + the one next step ---------- */}
      <nav className="ed-dock" aria-label="Editor">
        <Segmented className="ed-panes" label="Show" value={pane} onChange={setPane} options={[
          { value: 'content', label: 'Content' },
          { value: 'preview', label: 'Preview' },
          { value: 'insp', label: <>Copilot{tally.fails > 0 && <span className="tab-badge bad">{tally.fails}</span>}</> },
        ]} />
        <div className="ed-dock-next">{nextStep}</div>
      </nav>

      {/* ---------- Toasts ---------- */}
      <div className="ed-toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`ed-toast ${t.kind} ${t.out ? 'out' : ''}`} onClick={() => dismiss(t.id)}>
            <span className="ti" aria-hidden>{t.kind === 'bad' ? '!' : t.kind === 'warn' ? '!' : t.kind === 'ok' ? <I.check size={11} /> : <I.sparkle size={11} />}</span>
            <span className="tt">{t.text}</span>
            {t.action && <button type="button" onClick={(e) => { e.stopPropagation(); t.action!.run(); dismiss(t.id); }}>{t.action.label}</button>}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBar() {
  return (
    <div className="ph-status" aria-hidden>
      <span className="ph-time">9:41</span><span className="island" />
      <span className="ph-icons">
        <svg width="17" height="11" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="1" /><rect x="4.5" y="5" width="3" height="6" rx="1" /><rect x="9" y="2.5" width="3" height="8.5" rx="1" /><rect x="13.5" y="0" width="3" height="11" rx="1" /></svg>
        <svg width="24" height="11" viewBox="0 0 24 11"><rect x="0.5" y="0.5" width="21" height="10" rx="3" fill="none" stroke="currentColor" opacity=".4" /><rect x="2" y="2" width="16" height="7" rx="1.6" /><rect x="22.5" y="3.5" width="1.5" height="4" rx=".7" opacity=".4" /></svg>
      </span>
    </div>
  );
}

/** Status pill that cross-fades when the edition moves through the flow. */
function StatusSwap({ status }: { status: string }) {
  const [s, setS] = useState<{ cur: string; prev: string | null }>({ cur: status, prev: null });
  useEffect(() => {
    if (status === s.cur) return;
    setS({ cur: status, prev: s.cur });
    const t = setTimeout(() => setS((x) => ({ ...x, prev: null })), 420);
    return () => clearTimeout(t);
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps
  const pill = (st: string, cls: string) => {
    const [tone, label] = STATUS_LABEL[st] || ['', st];
    return <span key={`${st}-${cls}`} className={`pill ${tone} ${cls}`} aria-hidden={cls === 'sp-out' || undefined}><span className="dot" />{label}</span>;
  };
  return <span className="tb-status" role="status">{s.prev && pill(s.prev, 'sp-out')}{pill(s.cur, s.prev ? 'sp-in' : '')}</span>;
}

/** Primary pill that collapses into a green check on success. */
function MorphButton({ morph, busy, onClick, children }: { morph: boolean; busy: boolean; onClick: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLButtonElement>(null);
  const w = useRef(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!morph) { w.current = el.offsetWidth; return; }
    const h = el.offsetHeight;
    const a = el.animate([{ width: `${w.current}px` }, { width: `${h}px` }], { duration: 320, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'forwards' });
    return () => a.cancel();
  });
  return (
    <button ref={ref} type="button" className={`btn primary flow-now ${morph ? 'morph' : ''}`} onClick={onClick} disabled={busy} aria-label={morph ? 'Approved' : undefined}>
      {morph ? <I.check size={16} /> : busy ? <><span className="spin" />Approving…</> : children}
    </button>
  );
}

/* Failed links arrive as "url (code)" lines; show them as rows instead of a wall of URLs. */
function parseLinks(detail?: string) {
  if (!detail) return [];
  return detail.split('\n').map((line) => {
    const m = line.trim().match(/^(\S+)\s+\((.*)\)$/);
    if (!m) return null;
    let host = m[1], path = '';
    try { const u = new URL(m[1]); host = u.hostname.replace(/^www\./, ''); path = (u.pathname + u.search).replace(/\/$/, ''); } catch { /* keep raw */ }
    const code = m[2];
    const n = Number(code);
    const why = n === 404 || n === 410 ? 'Not found' : n === 401 || n === 403 ? 'Blocked' : n >= 500 ? 'Server error' : n >= 300 && n < 400 ? 'Redirects' : 'Unreachable';
    return { url: m[1], host, path, why, code };
  }).filter(Boolean) as { url: string; host: string; path: string; why: string; code: string }[];
}

function CheckRow({ r, i, overridden, onOpen, onOverride, locked }: { r: CheckResult; i: number; overridden?: string; onOpen: () => void; onOverride: (reason: string) => void; locked: boolean }) {
  const [ask, setAsk] = useState(false);
  const [reason, setReason] = useState('');
  const sym = { ok: <I.check size={11} />, warn: '!', fail: <I.close size={10} />, skip: '–' }[r.status];
  const links = r.id === 'links' ? parseLinks(r.detail) : [];
  const isBlocking = r.blocking && r.status === 'fail' && !overridden;
  return (
    <li style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}>
      <span className={`ic ${overridden ? 'skip' : r.status}`}>{overridden ? '↷' : sym}</span>
      <div className="ck-main">
        <div className="ck-top">
          <div className={`ck-l ${r.blockId ? 'link' : ''} ${overridden ? 'struck' : ''}`} onClick={onOpen}>{r.label}</div>
          {isBlocking && <span className="pill bad ck-block">Blocking</span>}
        </div>
        {links.length > 0 ? (
          <ul className="ck-links">
            {links.map((l) => (
              <li key={l.url}>
                <span className="ck-lk-ic" aria-hidden><I.link size={13} /></span>
                <span className="ck-lk-t" title={l.url}><b>{l.host}</b><span className="ck-lk-m"><span className={`pill ${l.why === 'Redirects' ? 'warn' : 'bad'}`} title={`Response: ${l.code}`}>{l.why}</span>{l.path && <span className="ck-lk-p">{l.path}</span>}</span></span>
                <a className="icon-btn sm" href={l.url} target="_blank" rel="noreferrer" aria-label={`Open ${l.host}`} title="Open the link"><I.external size={13} /></a>
              </li>
            ))}
          </ul>
        ) : r.detail && <div className="hint ck-d">{r.detail}</div>}
        {r.blockId && <button type="button" className="ck-go" onClick={onOpen}>Show block <I.chevron size={10} /></button>}
        {overridden && <div className="hint">Overridden: {overridden} <button type="button" className="btn sm ghost" onClick={() => onOverride('')}>Undo</button></div>}
        {r.status === 'fail' && !overridden && !locked && (ask ? (
          <div className="ck-ov"><input className="in" autoFocus placeholder="Why is this OK to send?" value={reason} onChange={(e) => setReason(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && reason.trim().length >= 5) { onOverride(reason); setAsk(false); } if (e.key === 'Escape') setAsk(false); }} /><button type="button" className="btn sm" disabled={reason.trim().length < 5} onClick={() => { onOverride(reason); setAsk(false); }}>Override</button></div>
        ) : <button type="button" className="ck-go" onClick={() => setAsk(true)}>Override with a reason</button>)}
      </div>
    </li>
  );
}

function SourcePicker({ ids, c, onChange }: { ids: string[]; c: EditionContent; onChange: (ids: string[]) => void }) {
  if (!c.sources.length) return <div className="hint">No sources on this edition yet. Add one under “Sources” below.</div>;
  return (
    <div className="f"><span className="flbl">Sources for this block</span>
      <div className="srcpick">
        {c.sources.map((s) => <label key={s.id} className="check"><input type="checkbox" checked={ids.includes(s.id)} onChange={() => onChange(ids.includes(s.id) ? ids.filter((x) => x !== s.id) : [...ids, s.id])} /><span>{s.publisher || s.url}: {s.title?.slice(0, 70)}</span></label>)}
      </div>
    </div>
  );
}

/** Textarea that grows with its text instead of scrolling or showing a resize grip; `rows` is the resting minimum. */
function Area(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const cs = getComputedStyle(el);
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth)}px`;
  }, []);
  useLayoutEffect(fit, [props.value, fit]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let w = el.offsetWidth;
    const ro = new ResizeObserver(() => { if (el.offsetWidth !== w) { w = el.offsetWidth; fit(); } });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit]);
  return <textarea {...props} ref={ref} className={`in grow ${props.className || ''}`} />;
}

const XBtn = ({ onClick, label }: { onClick: () => void; label: string }) => <button type="button" className="icon-btn sm" aria-label={label} title={label} onClick={onClick}><I.close size={13} /></button>;

function BlockForm({ b, c, kb, stories, setBlock, setC }: { b: Block; c: EditionContent; kb: KB[]; stories: Story[]; setBlock: (id: string, p: any) => void; setC: React.Dispatch<React.SetStateAction<EditionContent>> }) {
  const up = (patch: any) => setBlock(b.id, patch);
  switch (b.type) {
    case 'tldr':
      return <>
        <label className="f"><span>Label</span><input className="in" value={b.heading || ''} onChange={(e) => up({ heading: e.target.value })} /></label>
        <div className="f"><span className="flbl">Bullets</span>
          {b.bullets.map((x, i) => <div key={i} className="row lst"><span className="lst-n">{i + 1}</span><Area rows={2} style={{ flex: 1 }} value={x} onChange={(e) => up({ bullets: b.bullets.map((y, j) => (j === i ? e.target.value : y)) })} /><XBtn label="Remove bullet" onClick={() => up({ bullets: b.bullets.filter((_, j) => j !== i) })} /></div>)}
        </div>
        <button type="button" className="btn sm add-row" onClick={() => up({ bullets: [...b.bullets, ''] })}><I.plus size={12} />Add bullet</button>
      </>;
    case 'stat':
      return <>
        <label className="f"><span>Number</span><input className="in big" value={b.value} onChange={(e) => up({ value: e.target.value })} placeholder="e.g. 1.14 lakh" /></label>
        <label className="f"><span>What it means</span><Area rows={2} value={b.caption} onChange={(e) => up({ caption: e.target.value })} /></label>
        <SourcePicker ids={b.sourceIds} c={c} onChange={(ids) => up({ sourceIds: ids })} />
      </>;
    case 'story': {
      const words = b.body.split(/\s+/).filter(Boolean).length;
      return <>
        <label className="f"><span>Headline</span><input className="in" value={b.headline} onChange={(e) => up({ headline: e.target.value })} /></label>
        <label className="f"><span>Story <small className={`cnt ${words && (words < 60 || words > 90) ? 'over' : ''}`}>{words} words · aim for 60–90</small></span><Area rows={3} value={b.body} onChange={(e) => up({ body: e.target.value })} /></label>
        <label className="f"><span>Why it matters for you</span><Area rows={3} value={b.why} onChange={(e) => up({ why: e.target.value })} /></label>
        <label className="check tgl"><input type="checkbox" className="toggle" checked={!!b.opinion} onChange={(e) => up({ opinion: e.target.checked })} /><span>This is our opinion<small>Shows an “Our view” label; no statistics allowed.</small></span></label>
        {!b.opinion && <SourcePicker ids={b.sourceIds} c={c} onChange={(ids) => up({ sourceIds: ids })} />}
      </>;
    }
    case 'chart':
      return <>
        <div className="form-grid">
          <label className="f"><span>Chart type</span><select className="in" value={b.kind} onChange={(e) => up({ kind: e.target.value })}><option value="bar">Horizontal bars</option><option value="column">Columns</option><option value="line">Line (trend)</option></select></label>
          <label className="f"><span>Unit</span><input className="in" value={b.unit} onChange={(e) => up({ unit: e.target.value })} placeholder="%, ₹, units" /></label>
        </div>
        <label className="f"><span>Title</span><input className="in" value={b.title} onChange={(e) => up({ title: e.target.value })} /></label>
        <label className="f"><span>Takeaway (one sentence)</span><input className="in" value={b.insight} onChange={(e) => up({ insight: e.target.value })} /></label>
        <div className="f"><span className="flbl">Data</span>
          {b.data.map((d, i) => (
            <div key={i} className="row lst">
              <input className="in" style={{ flex: 2 }} value={d.label} placeholder="Label" aria-label="Label" onChange={(e) => up({ data: b.data.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
              <input className="in num" style={{ flex: 1 }} type="number" step="any" value={d.value} aria-label="Value" onChange={(e) => up({ data: b.data.map((x, j) => (j === i ? { ...x, value: Number(e.target.value) } : x)) })} />
              <XBtn label="Remove row" onClick={() => up({ data: b.data.filter((_, j) => j !== i) })} />
            </div>
          ))}
          <button type="button" className="btn sm add-row" onClick={() => up({ data: [...b.data, { label: '', value: 0 }] })}><I.plus size={12} />Add row</button>
        </div>
        <SourcePicker ids={b.sourceIds} c={c} onChange={(ids) => up({ sourceIds: ids })} />
      </>;
    case 'showcase': {
      const st = MATURITY[b.status];
      return <>
        <label className="f"><span>From the knowledge base</span>
          <select className="in" value={b.kbId || ''} onChange={(e) => {
            const k = kb.find((x) => x.id === e.target.value);
            if (!k) { up({ kbId: undefined }); return; }
            up({ kbId: k.id, title: k.title, body: [k.problem, k.summary, k.result].filter(Boolean).join(' '), pillar: k.pillar, status: k.status, mediaUrl: k.media_url || undefined, cta: MATURITY[k.status].cta, placeholder: false });
          }}>
            <option value="">— Pick an item —</option>
            {kb.map((k) => <option key={k.id} value={k.id}>{PILLARS[k.pillar].label}: {k.title} ({k.status})</option>)}
          </select>
        </label>
        {!kb.length && <div className="hint">No active items yet. <Link href="/app/knowledge">Add your features, delivered work and concepts →</Link></div>}
        <div className="form-grid">
          <label className="f"><span>Section</span><select className="in" value={b.pillar} onChange={(e) => up({ pillar: e.target.value })}>{(Object.keys(PILLARS) as Pillar[]).map((k) => <option key={k} value={k}>{PILLARS[k].label}</option>)}</select></label>
          <label className="f"><span>Honest status</span><select className="in" value={b.status} onChange={(e) => up({ status: e.target.value, cta: MATURITY[e.target.value as Maturity].cta })}>{(Object.keys(MATURITY) as Maturity[]).map((k) => <option key={k} value={k}>{MATURITY[k].label}</option>)}</select></label>
        </div>
        <div className="notice mat-note"><span className="ni" aria-hidden>i</span><div><b>{st.label}</b> may say {st.allowed}.{st.banned.length ? <> Never: {st.banned.map((x) => `“${x}”`).join(', ')}.</> : null}</div></div>
        <label className="f"><span>Title</span><input className="in" value={b.title} onChange={(e) => up({ title: e.target.value, placeholder: false })} /></label>
        <label className="f"><span>Text (problem → what it does → approved result)</span><Area rows={3} value={b.body} onChange={(e) => up({ body: e.target.value, placeholder: false })} /></label>
        <label className="f"><span>Image or short video URL</span><MediaInput value={b.mediaUrl || ''} onChange={(v) => up({ mediaUrl: v || undefined })} /></label>
        <label className="f"><span>Button label</span><input className="in" value={b.cta} onChange={(e) => up({ cta: e.target.value })} /></label>
      </>;
    }
    case 'video':
      return <>
        <label className="f"><span>Video (YouTube, Vimeo, or upload an .mp4)</span><MediaInput value={b.url} accept="video/mp4,video/webm" onChange={(v) => up({ url: v })} /></label>
        <label className="f"><span>Caption</span><input className="in" value={b.caption} onChange={(e) => up({ caption: e.target.value })} placeholder="e.g. A 60-second take from our team" /></label>
        <div className="hint">Email can’t play video, so emails show a thumbnail that opens the web page.</div>
      </>;
    case 'image':
      return <>
        <label className="f"><span>Image</span><MediaInput value={b.url} accept="image/*" onChange={(v) => up({ url: v })} /></label>
        <label className="f"><span>Alt text (describe it for screen readers)</span><input className="in" value={b.alt} onChange={(e) => up({ alt: e.target.value })} /></label>
        <label className="f"><span>Caption</span><input className="in" value={b.caption} onChange={(e) => up({ caption: e.target.value })} /></label>
        <div className="hint">Use your own images, charts or licensed photos. Don’t copy news photos.</div>
      </>;
    case 'quote':
      return <>
        <label className="f"><span>Quote</span><Area rows={3} value={b.text} onChange={(e) => up({ text: e.target.value })} /></label>
        <label className="f"><span>Who said it</span><input className="in" value={b.author} onChange={(e) => up({ author: e.target.value })} /></label>
        <div className="hint">Only quote people with their permission or from a published source.</div>
      </>;
    case 'text':
      return <>
        <label className="f"><span>Heading</span><input className="in" value={b.heading} onChange={(e) => up({ heading: e.target.value })} /></label>
        <label className="f"><span>Text (blank line = new paragraph)</span><Area rows={3} value={b.body} onChange={(e) => up({ body: e.target.value })} /></label>
      </>;
    case 'poll':
      return <>
        <label className="f"><span>Question</span><input className="in" value={b.question} onChange={(e) => up({ question: e.target.value })} /></label>
        <div className="f"><span className="flbl">Options <small className="cnt">{b.options.length}/5</small></span>
          {b.options.map((o, i) => <div key={i} className="row lst"><span className="lst-n">{String.fromCharCode(65 + i)}</span><input className="in" style={{ flex: 1 }} value={o} aria-label={`Option ${i + 1}`} onChange={(e) => up({ options: b.options.map((x, j) => (j === i ? e.target.value : x)) })} /><XBtn label="Remove option" onClick={() => up({ options: b.options.filter((_, j) => j !== i) })} /></div>)}
        </div>
        {b.options.length < 5 && <button type="button" className="btn sm add-row" onClick={() => up({ options: [...b.options, ''] })}><I.plus size={12} />Add option</button>}
        <div className="hint">Good polls reveal intent without asking for it, e.g. “Is this on your roadmap?”.</div>
      </>;
    case 'cta':
      return <>
        <label className="f"><span>Label</span><input className="in" value={b.heading} onChange={(e) => up({ heading: e.target.value })} /></label>
        <label className="f"><span>Line above the buttons</span><input className="in" value={b.body} onChange={(e) => up({ body: e.target.value })} /></label>
        <div className="f"><span className="flbl">Buttons (the first one is highlighted)</span>
          <div className="cta-opts">
            {(Object.keys(CTA_LABELS) as CtaAction[]).map((a) => <label key={a} className={`cta-opt ${b.actions.includes(a) ? 'on' : ''} ${b.actions[0] === a ? 'first' : ''}`}><input type="checkbox" className="sr" checked={b.actions.includes(a)} onChange={() => up({ actions: b.actions.includes(a) ? b.actions.filter((x) => x !== a) : [...b.actions, a] })} /><span className="cta-ck" aria-hidden><I.check size={10} /></span>{CTA_LABELS[a]}</label>)}
          </div>
        </div>
      </>;
  }
}

function MediaInput({ value, onChange, accept = 'image/*,video/mp4' }: { value: string; onChange: (v: string) => void; accept?: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const isImg = /\.(png|jpe?g|gif|webp|avif|svg)(\?|$)/i.test(value);
  return (
    <div className="media-in">
      {err && <div className="notice bad"><span className="ni" aria-hidden>!</span><div>{err}</div></div>}
      <div className="row">
        <input className="in" style={{ flex: 1 }} value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://…" />
        <label className="btn sm" style={{ cursor: 'pointer' }}>{busy ? <><span className="spin" />Uploading…</> : 'Upload'}
          <input type="file" accept={accept} hidden onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setBusy(true);
            setErr('');
            const fd = new FormData();
            fd.append('file', f);
            const r = await fetch('/api/upload', { method: 'POST', body: fd });
            const j = await r.json();
            setBusy(false);
            if (r.ok) onChange(j.url); else setErr(j.error);
          }} />
        </label>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {isImg && <img className="media-thumb" src={value} alt="" />}
    </div>
  );
}

function SourcesEditor({ c, setC, stories }: { c: EditionContent; setC: React.Dispatch<React.SetStateAction<EditionContent>>; stories: Story[] }) {
  const [adding, setAdding] = useState(false);
  const [s, setS] = useState<Source>({ id: '', url: '', title: '', publisher: '', date: '' });
  const used = new Set(c.blocks.flatMap((b: any) => b.sourceIds || []));
  const addSrc = (src: Source) => setC((x) => ({ ...x, sources: [...x.sources, { ...src, id: src.id || `s${rid()}` }] }));
  return (
    <>
      {c.sources.length > 0 && (
        <ul className="src-list">
          {c.sources.map((src) => (
            <li key={src.id}>
              <span className="src-fav" aria-hidden>{(src.publisher || src.url.replace(/^https?:\/\/(www\.)?/, '')).slice(0, 1).toUpperCase()}</span>
              <div style={{ flex: 1, minWidth: 0 }}><a href={src.url} target="_blank" rel="noreferrer">{src.title || src.url}</a><div className="hint">{src.publisher}{src.date ? ` · ${src.date}` : ''}{used.has(src.id) ? '' : <span className="unused"> · not used yet</span>}</div></div>
              <XBtn label="Remove source" onClick={() => setC((x) => ({ ...x, sources: x.sources.filter((y) => y.id !== src.id), blocks: x.blocks.map((b: any) => (b.sourceIds ? { ...b, sourceIds: b.sourceIds.filter((i: string) => i !== src.id) } : b)) }))} />
            </li>
          ))}
        </ul>
      )}
      {adding ? (
        <div className="stack src-add" style={{ gap: 8 }}>
          <select className="in" defaultValue="" onChange={(e) => { const st = stories.find((x) => x.id === e.target.value); if (st) { addSrc({ id: '', url: st.url, title: st.title, publisher: st.publisher, date: (st.published_at || '').slice(0, 10) }); setAdding(false); } }}>
            <option value="">From the story pool…</option>
            {stories.filter((st) => !c.sources.some((x) => x.url === st.url)).map((st) => <option key={st.id} value={st.id}>{st.title.slice(0, 80)}</option>)}
          </select>
          <div className="hint">…or enter one by hand:</div>
          <input className="in" placeholder="https://…" value={s.url} onChange={(e) => setS({ ...s, url: e.target.value })} />
          <input className="in" placeholder="Article title" value={s.title} onChange={(e) => setS({ ...s, title: e.target.value })} />
          <input className="in" placeholder="Publisher" value={s.publisher} onChange={(e) => setS({ ...s, publisher: e.target.value })} />
          <div className="row"><button type="button" className="btn sm primary" disabled={!/^https?:\/\//.test(s.url)} onClick={() => { addSrc(s); setS({ id: '', url: '', title: '', publisher: '', date: '' }); setAdding(false); }}>Add source</button><button type="button" className="btn sm" onClick={() => setAdding(false)}>Cancel</button></div>
        </div>
      ) : <button type="button" className="btn sm add-row" onClick={() => setAdding(true)}><I.plus size={12} />Add source</button>}
    </>
  );
}
