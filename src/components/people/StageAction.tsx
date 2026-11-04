'use client';
import { useState, useTransition } from 'react';
import { Icon } from './Icon';

/** One-tap stage change with optimistic feedback: the button turns into a ✓ immediately; the save follows a beat later so the confirmation is seen before the row moves views. */
export function StageAction({ action, label, done, className = 'btn sm' }: { action: () => Promise<void>; label: string; done: string; className?: string }) {
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

/** Stage picker for a contact: a segmented row, the chosen stage slides in immediately. */
export function StagePicker({ stages, current, actions }: { stages: [string, string][]; current: string; actions: Record<string, () => Promise<void>> }) {
  const [sel, setSel] = useState(current);
  const [pending, start] = useTransition();
  return (
    <div className="pstage" role="group" aria-label="Stage" aria-busy={pending}>
      {stages.map(([k, v]) => (
        <form key={k} onSubmit={(e) => { e.preventDefault(); if (sel === k) return; const prev = sel; setSel(k); start(async () => { try { await actions[k](); } catch { setSel(prev); } }); }}>
          <button aria-pressed={sel === k} className={`pstage-b s-${k}`}>{sel === k && <Icon name="check" size={13} stroke={2.4} />}{v}</button>
        </form>
      ))}
    </div>
  );
}
