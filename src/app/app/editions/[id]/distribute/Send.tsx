'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui';
import { BodySheet as Sheet } from '@/components/people/BodySheet';
import { Icon } from '@/components/people/Icon';
import { Avatar } from '@/components/people/Avatar';
import { Ticker } from '@/components/people/Ticker';
import { Rel } from '@/components/people/Rel';

async function post(url: string, body: any) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || 'Failed');
  return j;
}

const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;
/** "2026-11-12T10:00" (already in the studio's time zone) → "Thu, 12 Nov, 10:00 am". */
function fmtLocal(at: string) {
  const m = at.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return at;
  const day = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12)).toLocaleDateString('en-IN', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });
  const h = +m[4];
  return `${day}, ${h % 12 || 12}:${m[5]} ${h >= 12 ? 'pm' : 'am'}`;
}
const Notice = ({ k, children }: { k: string; children: React.ReactNode }) => (
  <div className={`notice ${k}`} role="status"><span className="ni" aria-hidden>{k === 'ok' ? '✓' : '!'}</span><div>{children}</div></div>
);

type P = { tags: string[]; city: string };
export function EmailSend({ editionId, status, blocked, editorHref, tags, cities, waApi, defaultAt, tz, pace, emailPeople, waPeople, failed, smtp = false, scheduledLabel = '', scheduledAt = '' }: { editionId: string; status: string; blocked: string; editorHref: string; fixLabel: string; total: number; tags: string[]; cities: string[]; waApi: boolean; defaultAt: string; tz: string; pace: number; emailPeople: P[]; waPeople: P[]; failed: number; smtp?: boolean; scheduledLabel?: string; scheduledAt?: string }) {
  const [sel, setSel] = useState<string[]>([]);
  const [city, setCity] = useState('');
  const [wa, setWa] = useState(false);
  const [to, setTo] = useState('');
  const [at, setAt] = useState(defaultAt);
  const [when, setWhen] = useState<'now' | 'later'>(status === 'scheduled' ? 'later' : 'now');
  const [msg, setMsg] = useState<{ k: string; t: string; where: 'test' | 'main' } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [sheet, setSheet] = useState<null | 'ask' | 'done'>(null);
  const [sheetErr, setSheetErr] = useState<string | null>(null);
  const [doneMsg, setDoneMsg] = useState('');
  const router = useRouter();
  const audience = { tags: sel, city: city || undefined };
  const channels = wa ? ['email', 'whatsapp'] : ['email'];

  async function go(body: any, where: 'test' | 'main' = 'main') {
    setBusy(body.mode); setMsg(null);
    try {
      const j = await post(`/api/editions/${editionId}/send`, body);
      setMsg({ k: 'ok', t: j.message, where });
      if (body.mode === 'schedule' || body.mode === 'unschedule') {
        // Morph the button into a check first, then let the page settle into its new state.
        setDone(body.mode); setBusy(null);
        setTimeout(() => { setDone(null); router.refresh(); }, 900);
        return;
      }
      router.refresh();
    } catch (e: any) { setMsg({ k: 'bad', t: e.message, where }); }
    setBusy(null);
  }
  async function sendNow() {
    setBusy('now'); setSheetErr(null); setMsg(null);
    try { const j = await post(`/api/editions/${editionId}/send`, { mode: 'now', channels, audience }); setDoneMsg(j.message); setSheet('done'); router.refresh(); }
    catch (e: any) { setSheetErr(e.message); }
    setBusy(null);
  }

  const match = (p: P) => (!sel.length || sel.some((t) => p.tags.includes(t.toLowerCase()))) && (!city || p.city === city.toLowerCase());
  const nEmail = useMemo(() => emailPeople.filter(match).length, [emailPeople, sel, city]); // eslint-disable-line react-hooks/exhaustive-deps
  const nWa = useMemo(() => (wa ? waPeople.filter(match).length : 0), [waPeople, sel, city, wa]); // eslint-disable-line react-hooks/exhaustive-deps
  const count = nEmail + nWa;
  const countLabel = `${plural(nEmail, 'email')}${wa ? ` + ${nWa} WhatsApp` : ''}`;
  const sent = status === 'sent' || status === 'sending';
  const scheduled = status === 'scheduled';
  const locked = !!blocked && !sent;
  const filtered = sel.length > 0 || !!city;
  const minutes = Math.max(1, Math.ceil(nEmail / Math.max(1, pace)));
  const who = `Everyone with email consent${sel.length ? `, tagged ${sel.join(' or ')}` : ''}${city ? `, in ${city}` : ''}`;
  const disabledReason = count === 0 ? (sent ? 'Everyone has it already' : 'No one matches') : '';

  return (
    <div className="es">
      <div className="es-grid">
        <div className="es-panel">
          <div className="es-label"><Icon name="users" size={14} />Audience</div>
          <div className="es-count" aria-live="polite">
            <span className="es-num"><Ticker value={count} from={null} duration={420} /></span>
            <span className="es-unit">{count === 1 ? 'person' : 'people'}{sent ? ' still to receive it' : ''}</span>
          </div>
          <p className="es-desc">{who}. {wa ? `${countLabel}. ` : ''}Unsubscribed and “less often” readers are skipped automatically.</p>
          {(tags.length > 0 || cities.length > 0) && (
            <div className="es-filters">
              {tags.length > 0 && (
                <div className="seg es-tags" role="group" aria-label="Filter by tag">
                  <button type="button" aria-pressed={!sel.length} onClick={() => setSel([])}>Everyone</button>
                  {tags.map((t) => {
                    const on = sel.includes(t);
                    return <button key={t} type="button" aria-pressed={on} onClick={() => setSel(on ? sel.filter((x) => x !== t) : [...sel, t])}>{t}</button>;
                  })}
                </div>
              )}
              {cities.length > 0 && (
                <select className="in es-city" aria-label="City" value={city} onChange={(e) => setCity(e.target.value)}>
                  <option value="">All cities</option>{cities.map((c) => <option key={c}>{c}</option>)}
                </select>
              )}
              {filtered && <button type="button" className="btn sm ghost" onClick={() => { setSel([]); setCity(''); }}>Reset</button>}
            </div>
          )}
          {waApi && !locked && (
            <label className="es-switch">
              <span><b>Also send via WhatsApp Business API</b><small>To people with WhatsApp consent, together with the email.</small></span>
              <input type="checkbox" className="toggle" checked={wa} onChange={(e) => setWa(e.target.checked)} />
            </label>
          )}
        </div>

        <div className="es-panel es-when">
          <div className="es-label"><Icon name={locked ? 'lock' : 'clock'} size={14} />{locked ? 'Sending' : sent ? 'Top-up' : 'When'}</div>
          {locked ? (
            <div className="es-locked">
              <span className="icon-chip warn" aria-hidden><Icon name="lock" size={17} /></span>
              <b>Locked until it’s approved</b>
              <p>{blocked} Emails can’t go out before then, but you can send yourself a test below.</p>
              <Link className="btn" href={editorHref}><Icon name="pencil" size={15} />Open editor</Link>
            </div>
          ) : (
            <>
              {scheduled ? (
                <div className="es-sched">
                  <span className="icon-chip es-sched-ic" aria-hidden><Icon name="calendar" size={18} /></span>
                  <div><b>Scheduled for {scheduledLabel || fmtLocal(at)}</b><span>{scheduledAt ? <>Goes out <Rel iso={scheduledAt} /> · </> : null}{tz}</span></div>
                  <button className={`btn sm ${done === 'unschedule' ? 'is-done' : ''}`} disabled={!!busy || !!done} onClick={() => go({ mode: 'unschedule' })}>
                    {busy === 'unschedule' ? <Spinner size={13} /> : done === 'unschedule' ? <Icon name="check" size={13} stroke={2.4} /> : null}{done === 'unschedule' ? 'Schedule cancelled' : 'Cancel schedule'}
                  </button>
                </div>
              ) : !sent ? (
                <div className="seg es-seg" role="group" aria-label="When to send">
                  <button type="button" aria-pressed={when === 'now'} onClick={() => setWhen('now')}>Send now</button>
                  <button type="button" aria-pressed={when === 'later'} onClick={() => setWhen('later')}>Schedule</button>
                </div>
              ) : <p className="es-desc">Already sent. New contacts and people added since then can get it too.</p>}

              {!sent && !scheduled && when === 'later' && (
                <label className="f es-at"><span>Send at <small>({tz})</small></span><input className="in" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} /></label>
              )}

              <div className="es-cta">
                {!sent && !scheduled && when === 'later'
                  ? <button className={`btn primary lg es-go ${done === 'schedule' ? 'is-done' : ''}`} disabled={!!busy || !!done || count === 0} onClick={() => go({ mode: 'schedule', at, channels, audience })}>
                      {busy === 'schedule' ? <Spinner size={15} /> : <Icon name={done === 'schedule' ? 'check' : 'calendar'} size={16} stroke={done === 'schedule' ? 2.4 : 1.7} />}{done === 'schedule' ? 'Scheduled' : `Schedule for ${fmtLocal(at)}`}
                    </button>
                  : sent && count === 0 ? <div className="es-done-note"><Icon name="check" size={15} stroke={2.4} />Everyone with consent has it</div>
                  : <button className="btn primary lg es-go" disabled={!!busy || !!done || count === 0} onClick={() => { setSheetErr(null); setSheet('ask'); }}><Icon name="send" size={16} />{sent ? `Send to the rest (${count})` : scheduled ? `Send now instead (${count})` : `Send to ${plural(count, 'person', 'people')}`}</button>}
                {disabledReason && !(sent && count === 0) && <span className="es-why">{disabledReason}</span>}
              </div>
              {!sent && <p className="es-desc es-pace">Emails go out at {pace} per minute to protect your sender reputation{nEmail > pace ? `, about ${minutes} min in total` : ''}. You can close this page.</p>}
              {failed > 0 && <button className="btn sm danger" disabled={!!busy} onClick={() => go({ mode: 'retry' })}>{busy === 'retry' ? <Spinner size={13} /> : null}Retry {failed} failed</button>}
            </>
          )}
        </div>
      </div>

      {msg && msg.where === 'main' && <Notice k={msg.k}>{msg.t}</Notice>}

      <div className="es-test">
        <span className="es-test-l"><Icon name="spark" size={15} /><span><b>Send yourself a test</b><small>Doesn’t need approval and isn’t counted in results.</small></span></span>
        <form className="es-test-f" onSubmit={(e) => { e.preventDefault(); if (to) go({ mode: 'test', to }, 'test'); }}>
          <input className="in" type="email" required aria-label="Test email address" placeholder="you@company.com" value={to} onChange={(e) => setTo(e.target.value)} />
          <button className="btn" disabled={!!busy}>{busy === 'test' ? <Spinner size={13} /> : <Icon name="send" size={14} />}Send test</button>
        </form>
      </div>
      {msg && msg.where === 'test' && <Notice k={msg.k}>{msg.t}</Notice>}
      {status === 'approved' && !locked && <p className="es-desc">Only sending by WhatsApp or link? <button className="btn sm ghost" disabled={!!busy} onClick={() => go({ mode: 'markSent' })}>Mark this edition as sent</button></p>}

      <Sheet open={!!sheet} onClose={() => { if (busy !== 'now') setSheet(null); }} width={440}>
        {sheet === 'done' ? (
          <div className="es-sheet es-done">
            <svg className="es-tick" viewBox="0 0 52 52" aria-hidden><circle cx="26" cy="26" r="24" /><path d="M15 27l7 7 15-16" /></svg>
            <h2>On its way</h2>
            <p>{doneMsg || 'Your messages are queued.'}</p>
            {!smtp && <p className="hint">Outbox mode is on, so emails are saved to the Email outbox instead of being delivered.</p>}
            <button className="btn primary lg" autoFocus onClick={() => setSheet(null)}>Done</button>
          </div>
        ) : (
          <div className="es-sheet">
            <span className="es-sheet-ic"><Icon name="send" size={26} /></span>
            <h2>Send {countLabel} now?</h2>
            <p>This can’t be undone. Each person gets their own tracked link.</p>
            <dl className="es-sum">
              <div><dt>Audience</dt><dd>{who}</dd></div>
              <div><dt>Channels</dt><dd>Email{wa ? ' + WhatsApp API' : ''}</dd></div>
              <div><dt>Pace</dt><dd>{pace} per minute{nEmail > pace ? ` · about ${minutes} min` : ''}</dd></div>
              <div><dt>Delivery</dt><dd>{smtp ? 'SMTP' : 'Outbox (saved, not sent)'}</dd></div>
            </dl>
            {sheetErr && <Notice k="bad">{sheetErr}</Notice>}
            <div className="es-sheet-btns">
              <button className="btn lg" disabled={busy === 'now'} onClick={() => setSheet(null)}>Cancel</button>
              <button className="btn primary lg" autoFocus disabled={busy === 'now'} onClick={sendNow}>{busy === 'now' ? <><Spinner size={15} />Sending…</> : 'Yes, send now'}</button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}

type WaC = { id: string; name: string; company: string; phone: string; sent: boolean };
export function WaList({ editionId, contacts, blocked }: { editionId: string; contacts: WaC[]; blocked: string }) {
  const [sent, setSent] = useState<Record<string, boolean>>(Object.fromEntries(contacts.map((c) => [c.id, c.sent])));
  const [q, setQ] = useState('');
  const [show, setShow] = useState<'all' | 'todo' | 'sent'>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const done = contacts.filter((c) => sent[c.id]).length;
  if (!contacts.length) return <div className="snd-empty"><Icon name="chat" size={22} /><b>No one with WhatsApp consent yet</b><span>Turn on “WhatsApp consent” for contacts who agreed to receive it.</span></div>;
  const list = contacts.filter((c) => (!q || `${c.name} ${c.company} ${c.phone}`.toLowerCase().includes(q.toLowerCase())) && (show === 'all' || (show === 'sent' ? sent[c.id] : !sent[c.id])));
  const pctDone = Math.round((done / contacts.length) * 100);
  async function open(c: { id: string }) {
    setErr(null); setBusy(c.id);
    const w = window.open('about:blank', '_blank');
    try {
      const j = await post(`/api/editions/${editionId}/wa`, { contactId: c.id });
      if (w) w.location.href = j.url; else window.location.href = j.url;
      await post(`/api/editions/${editionId}/wa`, { deliveryId: j.deliveryId });
      setSent((s) => ({ ...s, [c.id]: true }));
      setFresh(c.id);
    } catch (e: any) { w?.close(); setErr(e.message); }
    setBusy(null);
  }
  return (
    <div className="wl">
      <div className="wl-top">
        <div className="wl-prog">
          <div className="wl-prog-t"><b><Ticker value={done} from={null} duration={400} /> of {contacts.length} sent</b><span>{done === contacts.length ? 'All done' : `${contacts.length - done} to go`}</span></div>
          <div className="wl-bar" role="progressbar" aria-label="WhatsApp progress" aria-valuemin={0} aria-valuemax={contacts.length} aria-valuenow={done}><i style={{ width: `${pctDone}%` }} /></div>
        </div>
        <div className="wl-tools">
          <div className="seg" role="group" aria-label="Show">
            {(['all', 'todo', 'sent'] as const).map((k) => <button key={k} type="button" aria-pressed={show === k} onClick={() => setShow(k)}>{{ all: 'All', todo: 'To send', sent: 'Sent' }[k]}</button>)}
          </div>
          <label className="psearch"><Icon name="search" size={15} /><input type="search" aria-label="Search WhatsApp list" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        </div>
      </div>
      {blocked && <Notice k="warn">{blocked} The WhatsApp buttons unlock after that.</Notice>}
      {err && <Notice k="bad">{err}</Notice>}
      <ul className="wl-list">
        {list.map((c) => {
          const isSent = !!sent[c.id];
          return (
            <li key={c.id} className={`${isSent ? 'is-sent' : ''} ${fresh === c.id ? 'is-fresh' : ''}`}>
              <span className="wl-check" aria-hidden><Icon name="check" size={12} stroke={3} /></span>
              <Avatar name={c.name || c.phone} size={36} />
              <div className="wl-who"><b>{c.name || c.phone}</b><span>{c.company ? <>{c.company} · </> : null}<span className="tnum">{c.phone}</span></span></div>
              <div className="wl-act">
                {isSent && <span className="wl-sent"><Icon name="check" size={12} stroke={2.8} />Sent</span>}
                <button className={`btn sm ${isSent ? 'ghost' : 'wa'}`} disabled={!!blocked || busy === c.id} onClick={() => open(c)} aria-label={`${isSent ? 'Open WhatsApp again for' : 'Open WhatsApp for'} ${c.name || c.phone}`}>
                  {busy === c.id ? <><Spinner size={13} />Opening…</> : isSent ? 'Open again' : <><Icon name="chat" size={14} />Open WhatsApp</>}
                </button>
              </div>
            </li>
          );
        })}
        {!list.length && <li className="wl-none">No one matches.</li>}
      </ul>
    </div>
  );
}
