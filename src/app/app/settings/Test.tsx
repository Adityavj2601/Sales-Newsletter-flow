'use client';
import { useEffect, useState } from 'react';
import { Spinner } from '@/components/ui';
import { Icon } from '@/components/content/icons';

/** Inline connection test: idle → spinner → passed / failed, with the server’s explanation underneath. */
export function TestButton({ what, provider, label, needsInput }: { what: string; provider?: string; label: string; needsInput?: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'ok' | 'fail'>('idle');
  const [msg, setMsg] = useState('');
  const [input, setInput] = useState('');
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (state !== 'ok' && state !== 'fail') return;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 2600);
    return () => clearTimeout(t);
  }, [state, msg]);
  async function run() {
    setState('busy'); setMsg('');
    try {
      const r = await fetch('/api/test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ what, provider, to: input }) });
      const j = await r.json().catch(() => ({}));
      setMsg((r.ok ? j.message : j.error) || (r.ok ? 'It works.' : 'The test failed.'));
      setState(r.ok ? 'ok' : 'fail');
    } catch (e: any) { setMsg(e?.message || 'Couldn’t reach the server.'); setState('fail'); }
  }
  const busy = state === 'busy';
  return (
    <span className={`cx-test ${state}`} data-nodirty>
      <span className="cx-test-row">
        {needsInput && <input className="in" type="tel" inputMode="tel" placeholder={needsInput} aria-label={needsInput} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (input && !busy) run(); } }} />}
        <button type="button" className={`btn sm cx-test-b ${flash ? state : ''}`} onClick={run} disabled={busy || (!!needsInput && !input)} aria-busy={busy}>
          {busy ? <><Spinner size={13} />Testing…</>
            : flash && state === 'ok' ? <><Icon name="check" size={14} strokeWidth={2.4} />Passed</>
              : flash && state === 'fail' ? <><Icon name="x" size={13} strokeWidth={2.4} />Failed</>
                : <><Icon name="bolt" size={14} />{state === 'fail' ? 'Try again' : label}</>}
        </button>
      </span>
      {msg && <span className={`cx-test-msg ${state === 'ok' ? 'ok' : 'bad'}`} role="status"><Icon name={state === 'ok' ? 'check' : 'warn'} size={13} strokeWidth={2.2} /><span>{msg}</span></span>}
    </span>
  );
}
