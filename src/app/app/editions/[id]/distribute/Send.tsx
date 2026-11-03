'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

async function post(url: string, body: any) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || 'Failed');
  return j;
}

export function EmailSend({ editionId, status, blocked, total, tags, cities, waApi, defaultAt, tz, pace }: { editionId: string; status: string; blocked: boolean; total: number; tags: string[]; cities: string[]; waApi: boolean; defaultAt: string; tz: string; pace: number }) {
  const [sel, setSel] = useState<string[]>([]);
  const [city, setCity] = useState('');
  const [wa, setWa] = useState(false);
  const [to, setTo] = useState('');
  const [at, setAt] = useState(defaultAt);
  const [msg, setMsg] = useState<{ k: string; t: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const router = useRouter();
  const audience = { tags: sel, city: city || undefined };
  const channels = wa ? ['email', 'whatsapp'] : ['email'];
  async function go(body: any) {
    setBusy(true); setMsg(null);
    try { const j = await post(`/api/editions/${editionId}/send`, body); setMsg({ k: 'ok', t: j.message }); router.refresh(); }
    catch (e: any) { setMsg({ k: 'bad', t: e.message }); }
    setBusy(false); setConfirm(false);
  }
  const done = status === 'sent' || status === 'sending';
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="grid2">
        <div className="stack" style={{ gap: 8 }}>
          <div className="eyebrow">Send a test first</div>
          <div className="row"><input className="in" style={{ flex: 1 }} type="email" placeholder="you@company.com" value={to} onChange={(e) => setTo(e.target.value)} /><button className="btn" disabled={busy || !to} onClick={() => go({ mode: 'test', to })}>Send test</button></div>
          <div className="hint">Tests don’t need approval and aren’t counted in results.</div>
        </div>
        <div className="stack" style={{ gap: 8 }}>
          <div className="eyebrow">Who gets it</div>
          {tags.length > 0 && <div className="chips">{tags.map((t) => <button key={t} type="button" className="chip" style={sel.includes(t) ? { borderColor: 'var(--accent)', color: 'var(--accent)', background: 'var(--accent-soft)' } : {}} onClick={() => setSel(sel.includes(t) ? sel.filter((x) => x !== t) : [...sel, t])}>{sel.includes(t) ? '✓ ' : ''}{t}</button>)}</div>}
          {cities.length > 0 && <select className="in" value={city} onChange={(e) => setCity(e.target.value)}><option value="">All cities</option>{cities.map((c) => <option key={c}>{c}</option>)}</select>}
          <div className="hint">{sel.length || city ? 'Filtered audience. ' : ''}Everyone with email consent{sel.length ? ` tagged ${sel.join(' or ')}` : ''}{city ? ` in ${city}` : ''}. Up to {total} people (unsubscribed and “less often” readers are skipped automatically).</div>
          {waApi && <label className="check"><input type="checkbox" checked={wa} onChange={(e) => setWa(e.target.checked)} /><span>Also send via WhatsApp Business API (to people with WhatsApp consent)</span></label>}
        </div>
      </div>
      {msg && <div className={`notice ${msg.k}`}>{msg.t}</div>}
      {!done && (
        <div className="row" style={{ borderTop: '1px solid var(--line-2)', paddingTop: 14 }}>
          <label className="f" style={{ flexDirection: 'row' }}><span>Send at ({tz})</span><input className="in" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} /></label>
          {status === 'scheduled'
            ? <button className="btn" disabled={busy} onClick={() => go({ mode: 'unschedule' })}>Cancel schedule</button>
            : <button className="btn" disabled={busy || blocked} onClick={() => go({ mode: 'schedule', at, channels, audience })}>Schedule</button>}
          <span className="spacer" />
          {confirm
            ? <><span className="hint">Send to up to {total} people now?</span><button className="btn primary" disabled={busy} onClick={() => go({ mode: 'now', channels, audience })}>Yes, send now</button><button className="btn ghost" onClick={() => setConfirm(false)}>Cancel</button></>
            : <button className="btn primary" disabled={busy || blocked || total === 0} onClick={() => setConfirm(true)}>Send now</button>}
        </div>
      )}
      {!done && <div className="hint">Emails go out at {pace} per minute to protect your sender reputation. You can close this page.</div>}
      {status === 'approved' && <div className="hint">Only sending by WhatsApp or link? <button className="btn sm ghost" onClick={() => go({ mode: 'markSent' })}>Mark this edition as sent</button></div>}
    </div>
  );
}

export function WaList({ editionId, contacts, blocked }: { editionId: string; contacts: { id: string; name: string; company: string; phone: string; sent: boolean }[]; blocked: boolean }) {
  const [sent, setSent] = useState<Record<string, boolean>>(Object.fromEntries(contacts.map((c) => [c.id, c.sent])));
  const [q, setQ] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const done = Object.values(sent).filter(Boolean).length;
  if (!contacts.length) return <div className="empty"><b>No one with WhatsApp consent yet</b><span>Tick “WhatsApp consent” on contacts who agreed to receive it.</span></div>;
  const list = contacts.filter((c) => !q || `${c.name} ${c.company} ${c.phone}`.toLowerCase().includes(q.toLowerCase()));
  async function open(c: { id: string }) {
    setErr(null);
    const w = window.open('about:blank', '_blank');
    try {
      const j = await post(`/api/editions/${editionId}/wa`, { contactId: c.id });
      if (w) w.location.href = j.url; else window.location.href = j.url;
      await post(`/api/editions/${editionId}/wa`, { deliveryId: j.deliveryId });
      setSent((s) => ({ ...s, [c.id]: true }));
    } catch (e: any) { w?.close(); setErr(e.message); }
  }
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="row"><span className="pill info">{done} of {contacts.length} sent</span><input className="in" style={{ maxWidth: 260 }} type="search" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {blocked && <div className="notice warn">Approve the edition before sending.</div>}
      {err && <div className="notice bad">{err}</div>}
      <div className="tbl-wrap" style={{ maxHeight: 380, overflowY: 'auto' }}><table className="tbl"><tbody>
        {list.map((c) => <tr key={c.id}><td><b>{c.name || c.phone}</b><div className="hint">{c.company}</div></td><td className="mono">{c.phone}</td><td className="num">{sent[c.id] ? <span className="pill ok">Sent ✓</span> : null} <button className={`btn sm ${sent[c.id] ? '' : 'primary'}`} disabled={blocked} onClick={() => open(c)}>{sent[c.id] ? 'Open again' : 'Open WhatsApp'}</button></td></tr>)}
      </tbody></table></div>
    </div>
  );
}
