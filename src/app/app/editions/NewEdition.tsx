'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Modal } from '@/components/editor/kit';
import { I } from '@/components/editor/icons';

type S = { id: string; title: string; publisher: string; score: number; score_reason: string; status: string; published_at?: string | null };
type K = { id: string; title: string; pillar: string; status: string };

const OPEN_EVENT = 'brief:new-edition';
const PILLAR: Record<string, string> = { feature: 'Fresh off the build', delivered: 'Recently shipped', concept: 'On the drawing board' };
const MAT: Record<string, string> = { live: 'ok', delivered: 'ok', pilot: 'warn', prototype: 'warn', concept: 'info' };
const BRIEF_IDEAS = ['Focus on Pune and Bengaluru', 'Keep it upbeat; the festive season just ended', 'Speak to sales heads, not marketers', 'Lead with the number of the week'];
/* Rough, honest stages: the AI writes the draft in one pass, so these follow typical timing. */
const STAGES: [number, string][] = [[0, 'Reading the stories you picked'], [5, 'Finding the angle for sales teams'], [13, 'Writing the summary, stories and “why it matters”'], [32, 'Adding Our-work cards, poll and call to action'], [48, 'Running the first checks']];

/** Opens the New edition sheet from anywhere on the page (e.g. an empty state). */
export function NewEditionButton({ className = 'btn primary', children }: { className?: string; children?: React.ReactNode }) {
  return <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}>{children || <><I.plus size={14} />New edition</>}</button>;
}

export function NewEdition({ open, stories, preStories, kb, preKb, planned, aiReady }: { open: boolean; stories: S[]; preStories: string[]; kb: K[]; preKb: string[]; planned: string; aiReady: boolean }) {
  const [show, setShow] = useState(open);
  const [step, setStep] = useState<1 | 2>(1);
  const [sel, setSel] = useState<string[]>(preStories);
  const [ksel, setKsel] = useState<string[]>(preKb);
  const [brief, setBrief] = useState('');
  const [date, setDate] = useState(planned);
  const [busy, setBusy] = useState<null | 'ai' | 'blank' | 'done'>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const router = useRouter();
  const path = usePathname();
  const toggle = (arr: string[], set: (v: string[]) => void, id: string) => set(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

  useEffect(() => { if (open) setShow(true); }, [open]);
  useEffect(() => {
    const h = () => { setShow(true); setStep(1); };
    window.addEventListener(OPEN_EVENT, h);
    return () => window.removeEventListener(OPEN_EVENT, h);
  }, []);
  const close = useCallback(() => {
    if (busy) return;
    setShow(false);
    setErr(null);
    if (open) router.replace(path, { scroll: false });
  }, [busy, open, path, router]);

  useEffect(() => {
    if (busy !== 'ai') return;
    const t0 = Date.now();
    setElapsed(0);
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 250);
    return () => clearInterval(t);
  }, [busy]);

  async function create(mode: 'ai' | 'blank') {
    setBusy(mode);
    setErr(null);
    try {
      const r = await fetch('/api/editions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode, storyIds: sel, kbIds: ksel, brief, plannedFor: date }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Something went wrong');
      setBusy('done');
      router.push(`/app/editions/${j.id}?msg=${encodeURIComponent(j.message || 'Draft ready.')}`);
    } catch (e: any) { setErr(e.message); setBusy(null); }
  }

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? stories.filter((x) => `${x.title} ${x.publisher}`.toLowerCase().includes(s)) : stories;
  }, [q, stories]);
  const shortlisted = stories.filter((s) => s.status === 'shortlisted').map((s) => s.id);
  const stageIdx = STAGES.reduce((acc, [t], i) => (elapsed >= t ? i : acc), 0);
  const mmss = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bodyRef.current?.scrollTo({ top: 0 }); }, [step]);

  return (
    <>
      <NewEditionButton />
      <Modal open={show} onClose={close} label="New edition" className={`ne ${stories.length && !busy ? 'tall' : ''}`} dismissable={!busy}>
        {busy ? (
          <div className="ne-busy" aria-live="polite">
            {busy === 'done' ? (
              <><span className="ne-orb done"><I.check size={30} /></span><h2>Draft ready</h2><p className="hint">Opening the editor…</p></>
            ) : busy === 'blank' ? (
              <><span className="ne-orb"><span className="spin" /></span><h2>Creating a blank edition…</h2></>
            ) : (
              <>
                <span className="ne-orb writing"><I.sparkle size={30} /></span>
                <h2>{aiReady ? 'Writing your draft' : 'Building a demo draft'}</h2>
                <p className="hint">{aiReady ? <>Using {sel.length} {sel.length === 1 ? 'story' : 'stories'}{ksel.length ? ` and ${ksel.length} Our-work ${ksel.length === 1 ? 'item' : 'items'}` : ''}. This usually takes 20–60 seconds.</> : 'Assembling it from the stories’ own text. This takes a few seconds.'}</p>
                <div className="ne-bar" aria-hidden><span /></div>
                <ol className="ne-stages">
                  {STAGES.map(([, label], i) => (
                    <li key={label} className={i < stageIdx ? 'done' : i === stageIdx ? 'now' : ''}>
                      <span className="ne-st" aria-hidden>{i < stageIdx ? <I.check size={11} /> : i === stageIdx ? <span className="spin" /> : null}</span>{label}
                    </li>
                  ))}
                </ol>
                <p className="ne-time"><I.clock size={13} />{mmss} elapsed · steps are approximate; the draft is written in one pass</p>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="ne-h">
              <div>
                <div className="eyebrow">Step {step} of 2</div>
                <h2>{step === 1 ? 'Pick this week’s stories' : 'Add Our work and a brief'}</h2>
              </div>
              <button type="button" className="icon-btn" onClick={close} aria-label="Close"><I.close size={16} /></button>
              <div className="ne-steps" aria-hidden><span className="on" /><span className={step === 2 ? 'on' : ''} /></div>
            </div>
            <div className="ne-b" ref={bodyRef}>
              {!aiReady && <div className="notice warn ne-demo">No AI provider is connected, so the draft is assembled in demo mode from the stories’ own text. Add a key in Settings → AI for real writing.</div>}
              {err && <div className="notice bad">{err}</div>}
              <div className="ne-pane" key={step}>
                {step === 1 ? (
                  stories.length ? (
                    <>
                      <div className="ne-tools">
                        <label className="ne-search"><I.search size={14} /><input data-autofocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter stories" aria-label="Filter stories" /></label>
                        <span className="ne-count">{sel.length} selected</span>
                        {shortlisted.length > 0 && <button type="button" className="btn sm ghost" onClick={() => setSel(shortlisted)}>Shortlisted</button>}
                        <button type="button" className="btn sm ghost" onClick={() => setSel([])} disabled={!sel.length}>Clear</button>
                      </div>
                      <ul className="ne-list" role="list">
                        {shown.map((s, i) => {
                          const on = sel.includes(s.id);
                          return (
                            <li key={s.id} style={{ animationDelay: `${Math.min(i, 10) * 22}ms` }}>
                              <label className={`ne-opt ${on ? 'on' : ''}`}>
                                <input type="checkbox" className="sr" checked={on} onChange={() => toggle(sel, setSel, s.id)} />
                                <span className="ne-ck" aria-hidden><I.check size={11} /></span>
                                <span className="ne-t">
                                  <b>{s.title}</b>
                                  <span className="ne-m">
                                    <span>{s.publisher || 'Unknown source'}</span>
                                    {s.status === 'shortlisted' && <span className="pill info">Shortlisted</span>}
                                  </span>
                                  {s.score_reason && <span className="ne-why">{s.score_reason}</span>}
                                </span>
                                <span className={`ne-score ${s.score >= 50 ? 'hi' : s.score >= 15 ? 'mid' : ''}`} title="Relevance score"><b>{s.score}</b><i style={{ width: `${Math.max(6, Math.min(100, s.score))}%` }} /></span>
                              </label>
                            </li>
                          );
                        })}
                        {!shown.length && <li className="hint ne-none">No stories match “{q}”.</li>}
                      </ul>
                    </>
                  ) : (
                    <div className="empty ne-empty"><b>The story pool is empty</b><span>Fetch this week’s news or add a story by URL, then come back. You can also start blank.</span><Link className="btn" href="/app/stories">Go to Story pool</Link></div>
                  )
                ) : (
                  <div className="ne-s2">
                    <section>
                      <div className="ne-sec-h"><b>Our work</b><span className={`ne-count ${ksel.length > 2 ? 'warn' : ''}`}>{ksel.length} selected · 2 recommended</span></div>
                      {kb.length ? (
                        <div className="ne-kb">
                          {kb.map((k) => {
                            const on = ksel.includes(k.id);
                            return (
                              <label key={k.id} className={`ne-opt kb ${on ? 'on' : ''}`}>
                                <input type="checkbox" className="sr" checked={on} onChange={() => toggle(ksel, setKsel, k.id)} />
                                <span className="ne-ck" aria-hidden><I.check size={11} /></span>
                                <span className="ne-t"><b>{k.title}</b><span className="ne-m"><span>{PILLAR[k.pillar] || k.pillar}</span><span className={`pill ${MAT[k.status] || ''}`}>{k.status[0].toUpperCase() + k.status.slice(1)}</span></span></span>
                              </label>
                            );
                          })}
                        </div>
                      ) : <div className="hint">No knowledge-base items yet. The draft gets a placeholder card you can fill or delete.</div>}
                      {ksel.length > 2 && <div className="hint warn-t">More than two makes the edition feel salesy. The draft keeps it tight.</div>}
                    </section>
                    <section>
                      <label className="f"><span>Brief for the AI <small>Optional</small></span><textarea className="in" rows={3} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="e.g. Focus on Pune and Bengaluru. Keep it upbeat; the festive season just ended." /></label>
                      <div className="chips ne-ideas">{BRIEF_IDEAS.map((b) => <button type="button" key={b} className="chip" onClick={() => setBrief((x) => (x.trim() ? `${x.trim().replace(/\.?$/, '.')} ${b}.` : `${b}.`))}><I.plus size={11} />{b}</button>)}</div>
                    </section>
                    <section className="ne-date">
                      <label className="f"><span>Planned send date</span><input className="in" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
                      <p className="hint">Defaults to the next free send slot. You can change it later.</p>
                    </section>
                  </div>
                )}
              </div>
            </div>
            <div className="ne-f">
              {step === 1 ? (
                <>
                  <button type="button" className="btn ghost" onClick={() => create('blank')}>Start blank</button>
                  <span className="spacer" />
                  {!sel.length && stories.length > 0 && <span className="hint">Pick at least one story</span>}
                  <button type="button" className="btn primary" disabled={!sel.length} onClick={() => setStep(2)}>Continue<I.chevron size={13} /></button>
                </>
              ) : (
                <>
                  <button type="button" className="btn" onClick={() => setStep(1)}><I.back size={13} />Back</button>
                  <span className="spacer" />
                  <span className="hint ne-sum">{sel.length} {sel.length === 1 ? 'story' : 'stories'} · {ksel.length} Our work</span>
                  <button type="button" className="btn primary" disabled={!sel.length} onClick={() => create('ai')}><I.sparkle size={14} />{aiReady ? 'Write draft with AI' : 'Build demo draft'}</button>
                </>
              )}
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
