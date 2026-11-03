'use client';
import { useState } from 'react';

export function TestButton({ what, provider, label, needsInput }: { what: string; provider?: string; label: string; needsInput?: string }) {
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState('');
  async function run() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ what, provider, to: input }) });
      const j = await r.json();
      setMsg({ ok: r.ok, t: r.ok ? j.message : j.error });
    } catch (e: any) { setMsg({ ok: false, t: e.message }); }
    setBusy(false);
  }
  return (
    <span className="row" style={{ display: 'inline-flex' }}>
      {needsInput && <input className="in" style={{ width: 200 }} placeholder={needsInput} value={input} onChange={(e) => setInput(e.target.value)} />}
      <button type="button" className="btn sm" onClick={run} disabled={busy || (!!needsInput && !input)}>{busy ? 'Testing…' : label}</button>
      {msg && <span className={`pill ${msg.ok ? 'ok' : 'bad'}`} style={{ whiteSpace: 'normal' }}>{msg.t}</span>}
    </span>
  );
}
