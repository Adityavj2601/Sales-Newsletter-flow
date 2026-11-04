'use client';
import { useState, useTransition } from 'react';
import { Icon } from './Icon';

/** One-tap stage change with optimistic feedback: the button turns into a ✓ immediately; the save follows a beat later so the confirmation is seen before the row moves views. */
export function StageAction({ action, label, done, className = 'btn sm' }: { action: () => Promise<void>; label: React.ReactNode; done: string; className?: string }) {
  const [ok, setOk] = useState(false);
  const [, start] = useTransition();
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (ok) return; setOk(true); setTimeout(() => start(async () => { try { await action(); } catch { setOk(false); } }), 650); }}>
      <button className={`${className} pact ${ok ? 'is-done' : ''}`} disabled={ok} aria-live="polite">
        {ok ? <><Icon name="check" size={14} stroke={2.4} />{done}</> : label}
      </button>
    </form>
  );
}

/**
 * Stage picker for a contact. Wide screens: the shared segmented control. Phones: seven stages never fit a
 * segmented control, so it becomes a pop-up menu (native select) that always shows the full current stage.
 * The chosen stage moves immediately and saves behind it.
 */
export function StagePicker({ stages, current, actions }: { stages: [string, string][]; current: string; actions: Record<string, () => Promise<void>> }) {
  const [sel, setSel] = useState(current);
  const [pending, start] = useTransition();
  const pick = (k: string) => {
    if (sel === k) return;
    const prev = sel;
    setSel(k);
    start(async () => { try { await actions[k](); } catch { setSel(prev); } });
  };
  return (
    <>
      <div className="seg pstage" role="group" aria-label="Stage" data-busy={pending || undefined}>
        {stages.map(([k, v]) => (
          <button key={k} type="button" aria-pressed={sel === k} className={`s-${k}`} onClick={() => pick(k)}>{v}</button>
        ))}
      </div>
      <select className={`in pstage-menu s-${sel}`} aria-label="Stage" value={sel} onChange={(e) => pick(e.target.value)} data-busy={pending || undefined}>
        {stages.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
    </>
  );
}
