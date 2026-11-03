'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type S = { id: string; title: string; publisher: string; score: number; score_reason: string; status: string };
type K = { id: string; title: string; pillar: string; status: string };

export function NewEdition({ open, stories, preStories, kb, preKb, planned, aiReady }: { open: boolean; stories: S[]; preStories: string[]; kb: K[]; preKb: string[]; planned: string; aiReady: boolean }) {
  const [show, setShow] = useState(open);
  const [sel, setSel] = useState<string[]>(preStories);
  const [ksel, setKsel] = useState<string[]>(preKb);
  const [brief, setBrief] = useState('');
  const [date, setDate] = useState(planned);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  const toggle = (arr: string[], set: (v: string[]) => void, id: string) => set(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
  async function create(mode: 'ai' | 'blank') {
    setBusy(mode === 'ai' ? 'Writing the draft. This takes 20–60 seconds…' : 'Creating…');
    setErr(null);
    try {
      const r = await fetch('/api/editions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode, storyIds: sel, kbIds: ksel, brief, plannedFor: date }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Something went wrong');
      router.push(`/app/editions/${j.id}?msg=${encodeURIComponent(j.message || 'Draft ready.')}`);
    } catch (e: any) { setErr(e.message); setBusy(null); }
  }
  if (!show) return <button className="btn primary" onClick={() => setShow(true)}>New edition</button>;
  return (
    <section className="card" style={{ width: '100%', display: 'grid', gap: 14 }}>
      <div className="card-head"><h2>New edition</h2><button className="btn sm ghost" onClick={() => setShow(false)}>Close</button></div>
      {!aiReady && <div className="notice warn">No AI provider is connected, so the draft is assembled in demo mode from the stories’ own text. Add a key in Settings → AI for real writing.</div>}
      <div className="grid2">
        <div className="stack" style={{ gap: 8 }}>
          <div className="eyebrow">Stories to use ({sel.length})</div>
          {stories.length ? (
            <div style={{ maxHeight: 300, overflowY: 'auto', display: 'grid', gap: 6 }}>
              {stories.map((s) => (
                <label key={s.id} className="check"><input type="checkbox" checked={sel.includes(s.id)} onChange={() => toggle(sel, setSel, s.id)} /><span><b>{s.title}</b><br /><span className="hint">{s.publisher} · score {s.score}{s.status === 'shortlisted' ? ' · shortlisted' : ''}</span></span></label>
              ))}
            </div>
          ) : <div className="notice warn">The story pool is empty. Go to Story pool → Fetch news, or add a story by URL.</div>}
        </div>
        <div className="stack" style={{ gap: 8 }}>
          <div className="eyebrow">“Our work” items ({ksel.length}, max 2 recommended)</div>
          {kb.length ? kb.map((k) => (
            <label key={k.id} className="check"><input type="checkbox" checked={ksel.includes(k.id)} onChange={() => toggle(ksel, setKsel, k.id)} /><span>{k.title} <span className="hint">· {k.pillar} · {k.status}</span></span></label>
          )) : <div className="hint">No knowledge-base items yet. The draft gets a placeholder card you can fill or delete.</div>}
          <label className="f"><span>Brief for the AI (optional)</span><textarea className="in" value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="e.g. Focus on Pune and Bengaluru. Keep it upbeat; the festive season just ended." /></label>
          <label className="f"><span>Planned send date</span><input className="in" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        </div>
      </div>
      {err && <div className="notice bad">{err}</div>}
      <div className="row end">
        {busy ? <span className="hint">{busy}</span> : <>
          <button className="btn" onClick={() => create('blank')}>Start blank</button>
          <button className="btn primary" disabled={!sel.length} onClick={() => create('ai')}>{aiReady ? 'Write draft with AI' : 'Build demo draft'}</button>
        </>}
      </div>
    </section>
  );
}
