'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BLOCK_LABELS, CTA_LABELS, MATURITY, PILLARS, newBlock, ovKey, type Block, type BlockType, type EditionContent, type CheckResult, type ChecksRun, type Source, type CtaAction, type Maturity, type Pillar } from '@/lib/types';
import { Confirm } from '@/components/ui';

type KB = { id: string; title: string; summary: string; problem: string; result: string; pillar: Pillar; status: Maturity; media_url: string | null; client_name: string | null; client_permission: number };
type Story = { id: string; title: string; url: string; publisher: string; published_at: string | null };
type Ed = { id: string; number: number; slug: string; status: string; content: EditionContent; checks: ChecksRun | null; overrides: Record<string, string>; planned_for: string | null; updated_at: string };

const STATUS_LABEL: Record<string, [string, string]> = { draft: ['', 'Draft'], review: ['warn', 'In review'], approved: ['info', 'Approved'], scheduled: ['info', 'Scheduled'], sending: ['warn', 'Sending'], sent: ['ok', 'Sent'] };
const QUICK = ['Make it punchier and shorter', 'Rewrite “why it matters” for a sales head', 'Make the headline more specific', 'Simplify the language', 'Write a warmer WhatsApp message', 'Check the tone is not salesy'];
const rid = () => Math.random().toString(36).slice(2, 9);

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
  const [note, setNote] = useState<{ kind: string; text: string } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
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

  /* ---------- autosave ---------- */
  const doSave = useCallback(async (content: EditionContent, opts: { version?: boolean; note?: string } = {}) => {
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
      setSave('saved');
    } catch (e: any) {
      setSave('error');
      setNote({ kind: 'bad', text: e.message });
    }
  }, [edition.id, status, planned]);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (locked) return;
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

  /* ---------- content helpers ---------- */
  const set = (patch: Partial<EditionContent>) => setC((x) => ({ ...x, ...patch }));
  const setBlock = (id: string, patch: any) => setC((x) => ({ ...x, blocks: x.blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b)) }));
  const move = (id: string, d: number) => setC((x) => {
    const i = x.blocks.findIndex((b) => b.id === id), j = i + d;
    if (j < 0 || j >= x.blocks.length) return x;
    const bl = [...x.blocks];
    [bl[i], bl[j]] = [bl[j], bl[i]];
    return { ...x, blocks: bl };
  });
  const remove = (id: string) => setC((x) => ({ ...x, blocks: x.blocks.filter((b) => b.id !== id) }));
  const add = (type: BlockType) => {
    const b = newBlock(type);
    setC((x) => {
      const ctaAt = x.blocks.findIndex((bb) => bb.type === 'cta');
      const bl = [...x.blocks];
      bl.splice(ctaAt < 0 ? bl.length : ctaAt, 0, b);
      return { ...x, blocks: bl };
    });
    setOpen(b.id);
  };

  /* ---------- preview ---------- */
  const [html, setHtml] = useState('');
  const [wa, setWa] = useState<any>(null);
  useEffect(() => {
    const t = setTimeout(async () => {
      const v = view === 'email' ? 'email' : view === 'wa' ? 'wa' : 'web';
      const r = await fetch(`/api/editions/${edition.id}/preview`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: c, view: v }) });
      if (v === 'wa') setWa(await r.json());
      else setHtml(await r.text());
    }, 500);
    return () => clearTimeout(t);
  }, [c, view, edition.id]);

  /* ---------- checks ---------- */
  const [checking, setChecking] = useState(false);
  async function runChecks() {
    if (save !== 'saved') await doSave(c);
    setChecking(true);
    setTab('checks');
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
  async function setStatusAction(action: 'approve' | 'unapprove') {
    if (save !== 'saved') await doSave(c);
    if (action === 'approve') { setChecking(true); setNote({ kind: '', text: stale || !checks ? 'Re-checking the latest version before approving…' : 'Approving…' }); }
    const r = await fetch(`/api/editions/${edition.id}/status`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action }) });
    const j = await r.json();
    setChecking(false);
    if (j.checks) { setChecks(j.checks); setCheckedAt(j.checks.at); }
    if (!r.ok) { setNote({ kind: 'bad', text: j.error }); setTab('checks'); document.querySelector('.ed-right')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    setStatus(j.status);
    setNote({ kind: 'ok', text: action === 'approve' ? 'Approved. Next: choose who gets it and when, on the Send page.' : 'Back in review.' });
  }
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
  async function ask(text?: string, blockId?: string) {
    const instruction = (text ?? instr).trim();
    if (!instruction) return;
    if (save !== 'saved') await doSave(c);
    setTab('ai');
    setChat((x) => [...x, { role: 'u', text: instruction + (blockId || target ? `\n(on: ${summary(c.blocks.find((b) => b.id === (blockId || target))!)})` : '') }]);
    setInstr('');
    setThinking(true);
    try {
      const r = await fetch(`/api/editions/${edition.id}/ai`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ instruction, blockId: blockId || target || undefined }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      const changes = diffContent(c, j.content);
      setChat((x) => [...x, { role: 'a', text: `${j.summary}${changes.length ? '' : '\n(No changes proposed.)'}${j.model && j.model !== 'demo' ? `\n— ${j.model}` : ''}` }]);
      if (changes.length) setProposal({ content: j.content, summary: j.summary, changes, instruction });
    } catch (e: any) {
      setChat((x) => [...x, { role: 'a', text: `Couldn’t do that: ${e.message}` }]);
    }
    setThinking(false);
  }
  function accept() {
    if (!proposal) return;
    setC(proposal.content);
    doSave(proposal.content, { version: true, note: `AI: ${proposal.instruction.slice(0, 80)}` });
    setProposal(null);
    setChat((x) => [...x, { role: 'a', text: 'Applied. A version was saved, so you can roll back any time.' }]);
  }

  /* ---------- subjects ---------- */
  const [subs, setSubs] = useState<{ subjects: string[]; waHooks: string[] } | null>(null);
  async function suggest() {
    if (saveRef.current !== 'saved') await doSave(latest.current);
    const r = await fetch(`/api/editions/${edition.id}/subjects`, { method: 'POST' });
    const j = await r.json();
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

  const [cls, lbl] = STATUS_LABEL[status] || ['', status];
  const saveLabel = { saved: 'All changes saved', dirty: 'Unsaved changes…', saving: 'Saving…', error: 'Not saved' }[save];

  return (
    <div>
      <div className="statusbar">
        <a href="/app/editions" className="btn sm ghost" onClick={(e) => { e.preventDefault(); go('/app/editions'); }}>← Editions</a>
        <span className="mono hint">#{String(edition.number).padStart(2, '0')}</span>
        <h1 title={c.title}>{c.title || 'Untitled edition'}</h1>
        <span className={`pill ${cls}`}><span className="dot" />{lbl}</span>
        <span className="hint" style={{ fontSize: 12.5 }}>{saveLabel}</span>
        <span className="spacer" />
        {!locked && <button className="btn" onClick={runChecks} disabled={checking}>{checking ? 'Checking…' : 'Run all checks'}</button>}
        {!locked && (status === 'approved' || status === 'scheduled'
          ? <button className="btn" onClick={() => setStatusAction('unapprove')}>Unapprove</button>
          : <button className="btn primary" onClick={() => setStatusAction('approve')} disabled={checking || (!stale && !!checks && blocking.length > 0)} title={stale || !checks ? 'Runs the checks on the latest version first' : blocking.length ? `${blocking.length} blocking check(s)` : ''}>{checking ? 'Checking…' : 'Approve'}</button>)}
        <a className={`btn ${status === 'approved' || status === 'scheduled' ? 'primary' : ''}`} href={`/app/editions/${edition.id}/${locked ? 'analytics' : 'distribute'}`} onClick={(e) => { e.preventDefault(); go(`/app/editions/${edition.id}/${locked ? 'analytics' : 'distribute'}`); }}>{locked ? 'Results →' : 'Send →'}</a>
        <a className="btn ghost" href={`${publicUrl}?preview=1`} target="_blank" rel="noreferrer">Open ↗</a>
      </div>
      {note && <div className={`notice ${note.kind}`} style={{ marginBottom: 12 }} onClick={() => setNote(null)}>{note.text}</div>}
      {locked && <div className="notice" style={{ marginBottom: 12 }}>This edition has been sent, so it’s read-only. Use “Duplicate” to reuse it.</div>}

      <div className="ed-shell">
        {/* LEFT: content */}
        <div className="ed-col">
          <fieldset disabled={locked} style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 10, minWidth: 0 }}>
            <div className="blk">
              <header role="button" tabIndex={0} aria-expanded={open === 'meta'} onClick={() => setOpen(open === 'meta' ? null : 'meta')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(open === 'meta' ? null : 'meta'); } }}><span className="typ">Top</span><span className="t">Headline & messages</span><span className="s">{c.subject}</span></header>
              {open === 'meta' || !c.title ? (
                <div className="body">
                  <label className="f"><span>Theme label (kicker)</span><input className="in" value={c.kicker} onChange={(e) => set({ kicker: e.target.value })} placeholder="e.g. Q3 in numbers" /></label>
                  <label className="f"><span>Headline <small>({c.title.length}/60)</small></span><input className="in" value={c.title} onChange={(e) => set({ title: e.target.value })} /></label>
                  <label className="f"><span>Subtitle</span><textarea className="in" rows={2} value={c.dek} onChange={(e) => set({ dek: e.target.value })} /></label>
                  <div className="form-grid">
                    <label className="f"><span>Read time (min)</span><input className="in" type="number" min={1} max={15} value={c.readMinutes} onChange={(e) => set({ readMinutes: Number(e.target.value) || 3 })} /></label>
                    <label className="f"><span>Planned send date</span><input className="in" type="date" value={planned} onChange={(e) => { dirtyPlanned.current = true; setPlanned(e.target.value); }} /></label>
                  </div>
                  <hr style={{ margin: '4px 0' }} />
                  <label className="f"><span>Email subject <small>({c.subject.replace('{first_name}', 'Rohan').length} chars; {'{first_name}'} is replaced per person)</small></span><input className="in" value={c.subject} onChange={(e) => set({ subject: e.target.value })} /></label>
                  <label className="f"><span>Email preview text</span><input className="in" value={c.preheader} onChange={(e) => set({ preheader: e.target.value })} /></label>
                  <div className="row"><button type="button" className="btn sm" onClick={suggest}>Suggest subject lines</button></div>
                  {subs && (
                    <div className="stack" style={{ gap: 6 }}>
                      <div className="chips">{subs.subjects.map((s) => <button type="button" key={s} className="chip" onClick={() => set({ subject: s })}>{s}</button>)}</div>
                      {subs.waHooks.length > 0 && <div className="hint">WhatsApp hooks: {subs.waHooks.join(' · ')}</div>}
                    </div>
                  )}
                  <label className="f"><span>WhatsApp message <small>({c.waText.length} chars; must include {'{link}'})</small></span><textarea className="in" rows={5} value={c.waText} onChange={(e) => set({ waText: e.target.value })} /></label>
                  <label className="f"><span>Link-preview title <small>({c.preview.title.length}/60)</small></span><input className="in" value={c.preview.title} onChange={(e) => set({ preview: { ...c.preview, title: e.target.value } })} /></label>
                  <label className="f"><span>Link-preview description <small>({c.preview.description.length}/110)</small></span><input className="in" value={c.preview.description} onChange={(e) => set({ preview: { ...c.preview, description: e.target.value } })} /></label>
                </div>
              ) : null}
            </div>

            {c.blocks.map((b, i) => (
              <div key={b.id} id={`blk-${b.id}`} className={`blk ${flagged.has(b.id) ? 'flag' : ''}`}>
                <header role="button" tabIndex={0} aria-expanded={open === b.id} onClick={() => setOpen(open === b.id ? null : b.id)} onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); setOpen(open === b.id ? null : b.id); } }}>
                  <span className="typ">{BLOCK_LABELS[b.type]}</span>
                  <span className="s">{summary(b)}</span>
                  <span className="tools" onClick={(e) => e.stopPropagation()}>
                    <button type="button" title="Move up" onClick={() => move(b.id, -1)} disabled={i === 0}>↑</button>
                    <button type="button" title="Move down" onClick={() => move(b.id, 1)} disabled={i === c.blocks.length - 1}>↓</button>
                    <button type="button" title="Ask the copilot about this block" onClick={() => { setTarget(b.id); setTab('ai'); }}>✦</button>
                    <button type="button" title="Delete block" onClick={() => remove(b.id)}>✕</button>
                  </span>
                </header>
                {open === b.id && <div className="body"><BlockForm b={b} c={c} kb={kb} stories={stories} setBlock={setBlock} setC={setC} /></div>}
              </div>
            ))}
            {!locked && (
              <div className="row">
                <select className="in" style={{ width: 'auto', flex: 1 }} id="addblock" defaultValue="">
                  <option value="" disabled>Add a block…</option>
                  {(Object.keys(BLOCK_LABELS) as BlockType[]).map((t) => <option key={t} value={t}>{BLOCK_LABELS[t]}</option>)}
                </select>
                <button type="button" className="btn" onClick={() => { const s = document.getElementById('addblock') as HTMLSelectElement; if (s.value) { add(s.value as BlockType); s.value = ''; } }}>Add</button>
              </div>
            )}
            <SourcesEditor c={c} setC={setC} stories={stories} />
          </fieldset>
          <details className="more card tight">
            <summary>More actions</summary>
            <div className="row" style={{ marginTop: 10 }}>
              {!locked && <button className="btn sm" type="button" onClick={() => doSave(c, { version: true, note: 'Saved by you' })}>Save a version</button>}
              <form action={duplicateAction}><button className="btn sm" type="submit">Duplicate</button></form>
              {!locked && <Confirm action={deleteAction} label="Delete edition" />}
            </div>
          </details>
        </div>

        {/* CENTER: preview */}
        <div className="ed-col ed-sticky">
          <div className="row">
            <div className="seg" role="group" aria-label="Preview">
              {(['phone', 'web', 'email', 'wa'] as const).map((v) => <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>{{ phone: 'Phone', web: 'Desktop', email: 'Email', wa: 'WhatsApp' }[v]}</button>)}
            </div>
            <span className="hint">Live preview · personalised for “Rohan”</span>
          </div>
          {view === 'phone' && <div className="phone-frame"><iframe title="Phone preview" srcDoc={html} sandbox="allow-scripts allow-popups" /></div>}
          {(view === 'web' || view === 'email') && <iframe className="preview-frame" title="Preview" srcDoc={html} sandbox="allow-scripts allow-popups" />}
          {view === 'wa' && wa && (
            <div className="wa-sim">
              <div className="wa-b">
                <div className="og">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={wa.og} alt="Link preview" /><div className="t"><b>{wa.title}</b><br />{wa.description}<br /><span style={{ opacity: .7 }}>{wa.host}</span></div></div>
                <div className="m">{wa.text}</div>
              </div>
              <div className="hint" style={{ justifySelf: 'center', background: 'rgba(255,255,255,.7)', padding: '4px 10px', borderRadius: 8 }}>The preview image updates when you save. WhatsApp caches previews per link.</div>
            </div>
          )}
        </div>

        {/* RIGHT: copilot / checks / versions */}
        <div className="ed-col ed-right">
          <div className="card tight" style={{ display: 'grid', gap: 10 }}>
            <div className="tabs" style={{ marginBottom: 0 }}>
              <button type="button" aria-pressed={tab === 'ai'} onClick={() => setTab('ai')}>AI copilot</button>
              <button type="button" aria-pressed={tab === 'checks'} onClick={() => setTab('checks')}>Checks {checks ? `(${checks.results.filter((r) => r.status === 'fail' && !overrides[ovKey(r)]).length})` : ''}</button>
              <button type="button" aria-pressed={tab === 'versions'} onClick={() => setTab('versions')}>History</button>
            </div>

            {tab === 'ai' && (
              <div className="stack" style={{ gap: 10 }}>
                {!aiReady && <div className="notice warn">Demo mode: connect an AI provider in <Link href="/app/settings?tab=ai">Settings → AI</Link> to edit with AI.</div>}
                <div className="chat">
                  {chat.length === 0 && <div className="hint">Ask for any change: “shorten story 2”, “add a line on Pune”, “make the WhatsApp text friendlier”. You’ll see the changes before anything is applied.</div>}
                  {chat.map((m, i) => <div key={i} className={`msg ${m.role}`}>{m.text}</div>)}
                  {thinking && <div className="msg a">Thinking…</div>}
                </div>
                {proposal && (
                  <div className="card tight" style={{ display: 'grid', gap: 8, borderColor: 'var(--accent)' }}>
                    <b>Proposed changes ({proposal.changes.length})</b>
                    <div className="diff">{proposal.changes.slice(0, 30).map((ch, i) => <div key={i}><div className="hint">{ch.where}</div>{ch.before && <del>{ch.before.slice(0, 300)}</del>} {ch.after && <ins>{ch.after.slice(0, 300)}</ins>}</div>)}</div>
                    <div className="row"><button type="button" className="btn primary sm" onClick={accept}>Apply changes</button><button type="button" className="btn sm" onClick={() => setProposal(null)}>Discard</button></div>
                  </div>
                )}
                {!locked && <>
                  <div className="chips">{QUICK.map((q) => <button type="button" key={q} className="chip" onClick={() => ask(q)}>{q}</button>)}</div>
                  <label className="f"><span>Apply to</span>
                    <select className="in" value={target} onChange={(e) => setTarget(e.target.value)}>
                      <option value="">Whole edition</option>
                      {c.blocks.map((b) => <option key={b.id} value={b.id}>{BLOCK_LABELS[b.type]}: {summary(b).slice(0, 40)}</option>)}
                    </select>
                  </label>
                  <textarea className="in" rows={3} aria-label="Instruction for the copilot" value={instr} placeholder="What should change?" onChange={(e) => setInstr(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) ask(); }} />
                  <div className="row"><button type="button" className="btn primary" disabled={thinking || !instr.trim()} onClick={() => ask()}>Ask</button><span className="hint"><span className="kbd">Ctrl</span> + <span className="kbd">Enter</span></span></div>
                </>}
              </div>
            )}

            {tab === 'checks' && (
              <div className="stack" style={{ gap: 10 }}>
                <div className="row"><button type="button" className="btn sm" onClick={runChecks} disabled={checking || locked}>{checking ? 'Checking links and facts…' : 'Run all checks'}</button>{checks && <span className="hint">Last run {new Date(checks.at).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}</span>}</div>
                {checks ? (
                  <>
                    {stale && <div className="notice warn">You’ve edited since these results. Run the checks again (Approve does it for you).</div>}
                    {blocking.length > 0 ? <div className="notice bad">{blocking.length} blocking check(s). Approval stays locked until they pass or you override them with a reason.</div> : <div className="notice ok">No blocking issues. You can approve.</div>}
                    <ul className="cl">{checks.results.map((r) => <CheckRow key={r.id} r={r} overridden={overrides[ovKey(r)]} onOpen={() => { if (r.blockId) { setOpen(r.blockId); document.getElementById(`blk-${r.blockId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } }} onOverride={(reason) => override(r.id, reason)} locked={locked} />)}</ul>
                  </>
                ) : <div className="hint">Checks cover sources, wording vs. maturity status, banned and spam words, preview lengths, email size, links, and an AI fact-check by a second model.</div>}
              </div>
            )}

            {tab === 'versions' && (
              <div className="stack" style={{ gap: 8 }}>
                {!versions ? <div className="hint">Loading…</div> : versions.map((v) => (
                  <div key={v.id} className="row" style={{ justifyContent: 'space-between', borderBottom: '1px solid var(--line-2)', paddingBottom: 6 }}>
                    <div><div style={{ fontSize: 13.5 }}>{v.note || 'Saved'}</div><div className="hint">{v.author} · {new Date(v.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div></div>
                    {!locked && <button type="button" className="btn sm" onClick={() => restore(v.id)}>Restore</button>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CheckRow({ r, overridden, onOpen, onOverride, locked }: { r: CheckResult; overridden?: string; onOpen: () => void; onOverride: (reason: string) => void; locked: boolean }) {
  const [ask, setAsk] = useState(false);
  const [reason, setReason] = useState('');
  const sym = { ok: '✓', warn: '!', fail: '✕', skip: '–' }[r.status];
  return (
    <li>
      <span className={`ic ${overridden ? 'skip' : r.status}`}>{overridden ? '↷' : sym}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ cursor: r.blockId ? 'pointer' : 'default', textDecoration: overridden ? 'line-through' : 'none' }} onClick={onOpen}>{r.label}</div>
        {r.detail && <div className="hint" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{r.detail}</div>}
        {overridden && <div className="hint">Overridden: {overridden} <button type="button" className="btn sm ghost" onClick={() => onOverride('')}>Undo</button></div>}
        {r.status === 'fail' && !overridden && !locked && (ask ? (
          <div className="row" style={{ marginTop: 6 }}><input className="in" style={{ flex: 1 }} placeholder="Why is this OK to send?" value={reason} onChange={(e) => setReason(e.target.value)} /><button type="button" className="btn sm" disabled={reason.trim().length < 5} onClick={() => { onOverride(reason); setAsk(false); }}>Override</button></div>
        ) : <button type="button" className="btn sm ghost" style={{ paddingLeft: 0 }} onClick={() => setAsk(true)}>Override with a reason</button>)}
      </div>
    </li>
  );
}

function SourcePicker({ ids, c, onChange }: { ids: string[]; c: EditionContent; onChange: (ids: string[]) => void }) {
  if (!c.sources.length) return <div className="hint">No sources on this edition yet. Add one under “Sources” below.</div>;
  return (
    <div className="f"><span style={{ fontWeight: 500, color: 'var(--ink)', fontSize: 13 }}>Sources for this block</span>
      <div style={{ display: 'grid', gap: 4 }}>
        {c.sources.map((s) => <label key={s.id} className="check" style={{ fontSize: 13 }}><input type="checkbox" checked={ids.includes(s.id)} onChange={() => onChange(ids.includes(s.id) ? ids.filter((x) => x !== s.id) : [...ids, s.id])} /><span>{s.publisher || s.url}: {s.title?.slice(0, 70)}</span></label>)}
      </div>
    </div>
  );
}

function BlockForm({ b, c, kb, stories, setBlock, setC }: { b: Block; c: EditionContent; kb: KB[]; stories: Story[]; setBlock: (id: string, p: any) => void; setC: React.Dispatch<React.SetStateAction<EditionContent>> }) {
  const up = (patch: any) => setBlock(b.id, patch);
  switch (b.type) {
    case 'tldr':
      return <>
        <label className="f"><span>Label</span><input className="in" value={b.heading || ''} onChange={(e) => up({ heading: e.target.value })} /></label>
        {b.bullets.map((x, i) => <div key={i} className="row"><textarea className="in" rows={2} style={{ flex: 1 }} value={x} onChange={(e) => up({ bullets: b.bullets.map((y, j) => (j === i ? e.target.value : y)) })} /><button type="button" className="btn sm ghost" onClick={() => up({ bullets: b.bullets.filter((_, j) => j !== i) })}>✕</button></div>)}
        <button type="button" className="btn sm" onClick={() => up({ bullets: [...b.bullets, ''] })}>Add bullet</button>
      </>;
    case 'stat':
      return <>
        <label className="f"><span>Number</span><input className="in" value={b.value} onChange={(e) => up({ value: e.target.value })} placeholder="e.g. 1.14 lakh" /></label>
        <label className="f"><span>What it means</span><textarea className="in" rows={2} value={b.caption} onChange={(e) => up({ caption: e.target.value })} /></label>
        <SourcePicker ids={b.sourceIds} c={c} onChange={(ids) => up({ sourceIds: ids })} />
      </>;
    case 'story':
      return <>
        <label className="f"><span>Headline</span><input className="in" value={b.headline} onChange={(e) => up({ headline: e.target.value })} /></label>
        <label className="f"><span>Story <small>({b.body.split(/\s+/).filter(Boolean).length} words, aim for 60–90)</small></span><textarea className="in" rows={6} value={b.body} onChange={(e) => up({ body: e.target.value })} /></label>
        <label className="f"><span>Why it matters for you</span><textarea className="in" rows={3} value={b.why} onChange={(e) => up({ why: e.target.value })} /></label>
        <label className="check"><input type="checkbox" checked={!!b.opinion} onChange={(e) => up({ opinion: e.target.checked })} /><span>This is our opinion (shows an “Our view” label; no statistics allowed)</span></label>
        {!b.opinion && <SourcePicker ids={b.sourceIds} c={c} onChange={(ids) => up({ sourceIds: ids })} />}
      </>;
    case 'chart':
      return <>
        <div className="form-grid">
          <label className="f"><span>Chart type</span><select className="in" value={b.kind} onChange={(e) => up({ kind: e.target.value })}><option value="bar">Horizontal bars</option><option value="column">Columns</option><option value="line">Line (trend)</option></select></label>
          <label className="f"><span>Unit</span><input className="in" value={b.unit} onChange={(e) => up({ unit: e.target.value })} placeholder="%, ₹, units" /></label>
        </div>
        <label className="f"><span>Title</span><input className="in" value={b.title} onChange={(e) => up({ title: e.target.value })} /></label>
        <label className="f"><span>Takeaway (one sentence)</span><input className="in" value={b.insight} onChange={(e) => up({ insight: e.target.value })} /></label>
        <div className="f"><span style={{ fontWeight: 500, color: 'var(--ink)', fontSize: 13 }}>Data</span>
          {b.data.map((d, i) => (
            <div key={i} className="row">
              <input className="in" style={{ flex: 2 }} value={d.label} placeholder="Label" onChange={(e) => up({ data: b.data.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
              <input className="in" style={{ flex: 1 }} type="number" step="any" value={d.value} onChange={(e) => up({ data: b.data.map((x, j) => (j === i ? { ...x, value: Number(e.target.value) } : x)) })} />
              <button type="button" className="btn sm ghost" onClick={() => up({ data: b.data.filter((_, j) => j !== i) })}>✕</button>
            </div>
          ))}
          <button type="button" className="btn sm" onClick={() => up({ data: [...b.data, { label: '', value: 0 }] })}>Add row</button>
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
        <div className="notice" style={{ fontSize: 12.5 }}><b>{st.label}:</b> may say {st.allowed}.{st.banned.length ? <> Never: {st.banned.map((x) => `“${x}”`).join(', ')}.</> : null}</div>
        <label className="f"><span>Title</span><input className="in" value={b.title} onChange={(e) => up({ title: e.target.value, placeholder: false })} /></label>
        <label className="f"><span>Text (problem → what it does → approved result)</span><textarea className="in" rows={4} value={b.body} onChange={(e) => up({ body: e.target.value, placeholder: false })} /></label>
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
        <label className="f"><span>Quote</span><textarea className="in" rows={3} value={b.text} onChange={(e) => up({ text: e.target.value })} /></label>
        <label className="f"><span>Who said it</span><input className="in" value={b.author} onChange={(e) => up({ author: e.target.value })} /></label>
        <div className="hint">Only quote people with their permission or from a published source.</div>
      </>;
    case 'text':
      return <>
        <label className="f"><span>Heading</span><input className="in" value={b.heading} onChange={(e) => up({ heading: e.target.value })} /></label>
        <label className="f"><span>Text (blank line = new paragraph)</span><textarea className="in" rows={6} value={b.body} onChange={(e) => up({ body: e.target.value })} /></label>
      </>;
    case 'poll':
      return <>
        <label className="f"><span>Question</span><input className="in" value={b.question} onChange={(e) => up({ question: e.target.value })} /></label>
        {b.options.map((o, i) => <div key={i} className="row"><input className="in" style={{ flex: 1 }} value={o} onChange={(e) => up({ options: b.options.map((x, j) => (j === i ? e.target.value : x)) })} /><button type="button" className="btn sm ghost" onClick={() => up({ options: b.options.filter((_, j) => j !== i) })}>✕</button></div>)}
        {b.options.length < 5 && <button type="button" className="btn sm" onClick={() => up({ options: [...b.options, ''] })}>Add option</button>}
        <div className="hint">Good polls reveal intent without asking for it, e.g. “Is this on your roadmap?”.</div>
      </>;
    case 'cta':
      return <>
        <label className="f"><span>Label</span><input className="in" value={b.heading} onChange={(e) => up({ heading: e.target.value })} /></label>
        <label className="f"><span>Line above the buttons</span><input className="in" value={b.body} onChange={(e) => up({ body: e.target.value })} /></label>
        <div className="f"><span style={{ fontWeight: 500, color: 'var(--ink)', fontSize: 13 }}>Buttons (the first one is highlighted)</span>
          {(Object.keys(CTA_LABELS) as CtaAction[]).map((a) => <label key={a} className="check"><input type="checkbox" checked={b.actions.includes(a)} onChange={() => up({ actions: b.actions.includes(a) ? b.actions.filter((x) => x !== a) : [...b.actions, a] })} /><span>{CTA_LABELS[a]}</span></label>)}
        </div>
      </>;
  }
}

function MediaInput({ value, onChange, accept = 'image/*,video/mp4' }: { value: string; onChange: (v: string) => void; accept?: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <div className="row">
      {err && <div className="notice bad" style={{ width: '100%' }}>{err}</div>}
      <input className="in" style={{ flex: 1 }} value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://…" />
      <label className="btn sm" style={{ cursor: 'pointer' }}>{busy ? 'Uploading…' : 'Upload'}
        <input type="file" accept={accept} hidden onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setBusy(true);
          const fd = new FormData();
          fd.append('file', f);
          const r = await fetch('/api/upload', { method: 'POST', body: fd });
          const j = await r.json();
          setBusy(false);
          if (r.ok) onChange(j.url); else setErr(j.error);
        }} />
      </label>
    </div>
  );
}

function SourcesEditor({ c, setC, stories }: { c: EditionContent; setC: React.Dispatch<React.SetStateAction<EditionContent>>; stories: Story[] }) {
  const [adding, setAdding] = useState(false);
  const [s, setS] = useState<Source>({ id: '', url: '', title: '', publisher: '', date: '' });
  const used = new Set(c.blocks.flatMap((b: any) => b.sourceIds || []));
  const addSrc = (src: Source) => setC((x) => ({ ...x, sources: [...x.sources, { ...src, id: src.id || `s${rid()}` }] }));
  return (
    <div className="blk">
      <header><span className="typ">Sources</span><span className="s">{c.sources.length} linked · every fact must cite one</span></header>
      <div className="body">
        {c.sources.map((src) => (
          <div key={src.id} className="row" style={{ alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}><a href={src.url} target="_blank" rel="noreferrer" style={{ fontSize: 13.5 }}>{src.title || src.url}</a><div className="hint">{src.publisher}{src.date ? ` · ${src.date}` : ''}{used.has(src.id) ? '' : ' · not used yet'}</div></div>
            <button type="button" className="btn sm ghost" onClick={() => setC((x) => ({ ...x, sources: x.sources.filter((y) => y.id !== src.id), blocks: x.blocks.map((b: any) => (b.sourceIds ? { ...b, sourceIds: b.sourceIds.filter((i: string) => i !== src.id) } : b)) }))}>✕</button>
          </div>
        ))}
        {adding ? (
          <div className="stack" style={{ gap: 8 }}>
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
        ) : <button type="button" className="btn sm" onClick={() => setAdding(true)}>Add source</button>}
      </div>
    </div>
  );
}
