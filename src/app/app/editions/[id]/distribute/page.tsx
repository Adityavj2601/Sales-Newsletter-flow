import { EnsureProduct } from '@/components/EnsureProduct';
import { activeProduct } from '@/lib/context';
import { requireUser } from '@/lib/auth';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { all, get } from '@/lib/db';
import { getEdition } from '@/lib/editions';
import { getProduct, baseUrl, getSetting, smtpReady, waReady } from '@/lib/settings';
import { audienceFor, canSend } from '@/lib/send';
import { renderWhatsApp } from '@/lib/render/email';
import { utcToZonedInput, fmtDate, fmtDay, fmtTime, fmtPhone, edNo, relDay } from '@/lib/format';
import { flowState } from '@/lib/flow';
import { StatusPill } from '@/components/bits';
import { Icon } from '@/components/people/Icon';
import { Avatar } from '@/components/people/Avatar';
import { Rel } from '@/components/people/Rel';
import { CopyButton } from '@/components/people/CopyButton';
import { Channels, EmailSend, LogTable, WaList } from './Send';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Send' };

const CH: Record<string, [string, string]> = { email: ['Email', 'mail'], whatsapp: ['WhatsApp API', 'bolt'], wa_manual: ['WhatsApp', 'chat'], test: ['Test email', 'mail'] };
const ST: Record<string, string> = { failed: 'bad', queued: 'wait', skipped: 'wait', sent: 'ok', delivered: 'ok', opened: 'ok', clicked: 'ok' };
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const LOG_SHOWN = 5;

export default async function Distribute({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const e = getEdition(id);
  if (!e) notFound();
  const p = getProduct(e.product_id)!;
  const g = getSetting('general');
  const tz = g.timezone;
  const base = baseUrl();
  const link = `${base}/e/${p.slug}/${e.slug}`;
  const blocked = canSend(e);
  const emailAud = audienceFor(e, 'email');
  const waAud = audienceFor(e, 'wa_manual');
  const waOn = waReady();
  const smtpOn = smtpReady();
  const waApiAud = waOn ? audienceFor(e, 'whatsapp') : [];
  const have = (ch: string) => new Set(all('SELECT contact_id FROM deliveries WHERE edition_id = ? AND channel = ?', e.id, ch).map((r) => r.contact_id));
  const gotEmail = have('email'), gotWa = have('whatsapp');
  for (const r of all("SELECT contact_id FROM deliveries WHERE edition_id = ? AND channel = 'wa_manual' AND status <> 'queued'", e.id)) gotWa.add(r.contact_id);
  const pick = (rows: any[], got: Set<any>) => rows.filter((c) => !got.has(c.id)).map((c) => ({ tags: String(c.tags || '').split(',').map((t: string) => t.trim().toLowerCase()).filter(Boolean), city: String(c.city || '').toLowerCase() }));
  const failedCount = Number(get("SELECT COUNT(*) AS n FROM deliveries WHERE edition_id = ? AND status = 'failed' AND channel IN ('email','whatsapp')", e.id)?.n || 0);
  const tags = [...new Set(all("SELECT tags FROM contacts WHERE product_id = ? AND status = 'active'", p.id).flatMap((r) => String(r.tags || '').split(',').map((t: string) => t.trim()).filter(Boolean)))].sort();
  const cities = [...new Set(all("SELECT city FROM contacts WHERE product_id = ? AND status = 'active' AND city <> ''", p.id).map((r) => r.city))].sort();
  const manual = all("SELECT contact_id, status, sent_at FROM deliveries WHERE edition_id = ? AND channel = 'wa_manual'", e.id);
  const sentMap = Object.fromEntries(manual.map((m) => [m.contact_id, m.status !== 'queued']));
  const dl = all(`SELECT d.*, c.first_name, c.last_name, c.email, c.phone FROM deliveries d LEFT JOIN contacts c ON c.id = d.contact_id WHERE d.edition_id = ? ORDER BY d.created_at DESC LIMIT 60`, e.id);
  const counts = get(`SELECT SUM(status='queued') AS q, SUM(status IN ('sent','delivered','opened','clicked')) AS s, SUM(status='failed') AS f FROM deliveries WHERE edition_id = ? AND channel IN ('email','whatsapp')`, e.id) || {};
  const defaultAt = e.scheduled_at ? utcToZonedInput(e.scheduled_at, tz) : `${e.planned_for || new Date().toISOString().slice(0, 10)}T${g.sendTime}`;
  const genericWa = renderWhatsApp(e, p, link, '');

  const fs = flowState(e);
  const approved = ['approved', 'scheduled', 'sending', 'sent'].includes(e.status);
  const ready = !blocked;
  const isSent = e.status === 'sent';
  const live = isSent || e.status === 'sending';
  const q = Number(counts.q || 0), s = Number(counts.s || 0), f = Number(counts.f || 0);
  const progress = q + s + f;
  const waDone = waAud.filter((c) => sentMap[c.id]).length;
  const reach = new Set([...emailAud, ...waAud].map((c) => c.id)).size;
  const at = (iso: string | null) => `${fmtDay(iso, tz)}, ${fmtTime(iso, tz)}`;
  const editor = `/app/editions/${e.id}`;
  // "Planned for tomorrow" reads best for the next two days; further out (or overdue) the date itself is clearer.
  const rd = relDay(e.planned_for, tz);
  const planned = e.planned_for && !live && e.status !== 'scheduled' ? `Planned for ${rd === 'today' || rd === 'tomorrow' ? rd : fmtDay(e.planned_for, tz)}` : '';
  const people = (n: number) => `${n} ${n === 1 ? 'person' : 'people'}`;
  const audienceLine = reach ? `${people(emailAud.length)} by email · ${waAud.length} on WhatsApp.` : 'No one has agreed to email or WhatsApp yet.';

  // One summary that follows the weekly flow (lib/flow): what happened, or the single next thing to do.
  const sum = isSent ? { tone: 'ok', icon: 'check', h: `Sent ${at(e.sent_at)}`, d: <>{s} delivered{f ? ` · ${f} failed` : ''}{q ? ` · ${q} still going out` : ''}. New contacts can still get it.</> }
    : e.status === 'sending' ? { tone: '', icon: 'send', h: 'Sending now', d: <>{s} of {progress} delivered. You can close this page.</> }
    : e.status === 'scheduled' ? { tone: '', icon: 'calendar', h: `Scheduled for ${at(e.scheduled_at)}`, d: <>Goes out <Rel iso={e.scheduled_at} /> ({tz}). You can cancel it or send now instead.</> }
    : ready ? { tone: '', icon: 'send', h: fs.title, d: <>Approved and ready. {audienceLine}{reach ? '' : ' Import contacts, or share the link.'}</> }
    : approved ? { tone: 'warn', icon: 'warn', h: 'Fix the checks', d: <>{blocked} Sending unlocks as soon as they pass.</> }
    : { tone: 'warn', icon: 'lock', h: fs.title, d: <>Sending unlocks once it’s approved. Until then you can send yourself a test.</> };

  // Readiness, named as tasks while they're still to do.
  const checksOk = approved ? ready : fs.current === 'approve';
  const steps = [
    { ok: checksOk, warn: !checksOk && fs.blockers > 0, t: checksOk ? 'Checks pass' : approved || fs.blockers ? 'Fix the checks' : 'Run checks', d: checksOk ? 'Nothing blocking' : approved ? String(blocked) : fs.detail },
    { ok: approved, warn: false, t: approved ? 'Approved' : 'Approve', d: approved ? (e.approved_by ? `by ${e.approved_by}` : 'Signed off') : checksOk ? 'Ready for sign-off' : 'After the checks pass' },
    { ok: reach > 0, warn: reach === 0, t: reach ? `${people(reach)} can get it` : 'Add contacts', d: reach ? `${emailAud.length} email · ${waAud.length} WhatsApp` : 'No one has agreed yet', href: reach ? undefined : '/app/contacts' },
  ];

  const channels = [
    { key: 'email', label: 'Email', icon: 'mail', badge: live ? `${gotEmail.size}` : `${emailAud.length}`, hint: live ? 'sent' : 'with consent' },
    { key: 'whatsapp', label: 'WhatsApp', icon: 'chat', badge: waAud.length ? `${waDone}/${waAud.length}` : '0', hint: 'sent' },
    { key: 'link', label: 'Link', icon: 'link' },
    { key: 'api', label: 'WhatsApp API', short: 'API', icon: 'bolt', badge: waOn ? undefined : 'Off' },
  ];
  const logRow = (d: any) => {
    const who = `${d.first_name || ''} ${d.last_name || ''}`.trim() || d.email || fmtPhone(d.phone);
    const [chName, chIcon] = CH[d.channel] || [d.channel, 'doc'];
    const when = d.sent_at || d.created_at;
    return (
      <tr key={d.id}>
        <td>{d.contact_id ? <Link className="snd-who" href={`/app/contacts/${d.contact_id}`}><Avatar name={who || '?'} size={26} /><span>{who}</span></Link> : <span className="snd-who"><span className="snd-test"><Icon name="spark" size={13} /></span><span className="hint">Test</span></span>}</td>
        <td><span className="snd-ch"><Icon name={chIcon} size={14} />{chName}</span></td>
        <td><span className={`snd-st ${ST[d.status] || 'wait'}`}><i />{cap(d.status)}</span></td>
        <td className="hint"><Rel iso={when} title={fmtDate(when, tz, true)} /></td>
        <td className="hint clip">{d.error || ''}</td>
      </tr>
    );
  };
  const logHead = <thead><tr><th>Who</th><th>Channel</th><th>Status</th><th>When</th><th>Note</th></tr></thead>;

  const __active = await activeProduct();
  return (
    <div className="snd">
      <EnsureProduct productId={e.product_id} activeId={__active?.id || null} />
      <div className="ph">
        <div>
          <div className="crumbs"><Link href="/app/editions">Editions</Link> / <Link href={editor}>{edNo(e.number)}</Link> / Send</div>
          <h1>{e.content.title}</h1>
          <p className="sub">{edNo(e.number)}<span className="sep" aria-hidden>·</span>{p.newsletter_name || p.name}{planned ? <><span className="sep" aria-hidden>·</span>{planned}</> : null}</p>
        </div>
        <div className="row">
          <a className="btn" href={link + (isSent ? '' : '?preview=1')} target="_blank" rel="noreferrer"><Icon name="eye" size={15} />{isSent ? 'Open page' : 'Preview'}</a>
          {!ready && !live
            ? <Link className="btn primary" href={editor}><Icon name="pencil" size={15} />{approved ? 'Open editor' : fs.cta}</Link>
            : <Link className={`btn${live ? ' primary' : ''}`} href={`/app/editions/${e.id}/analytics`}><Icon name="chart" size={15} />Results</Link>}
        </div>
      </div>

      <section className={`card snd-hero is-${live ? 'sent' : ready ? 'ready' : 'blocked'}`} aria-label="Send summary">
        <div className="snd-sum">
          <span className={`icon-chip snd-sum-ic ${sum.tone}`} aria-hidden><Icon name={sum.icon} size={20} /></span>
          <div className="snd-sum-t">
            <h2>{sum.h}</h2>
            <p>{sum.d}</p>
          </div>
          <StatusPill status={e.status} />
        </div>

        {!live && (
          <ol className={`snd-ready${steps.every((st) => st.ok) ? ' all-ok' : ''}`} aria-label="Before you send">
            {steps.map((st, i) => {
              const body = <><span className="snd-dot" aria-hidden>{st.ok ? <Icon name="check" size={12} stroke={2.6} /> : i + 1}</span><span className="snd-ready-t"><b>{st.t}</b><span>{st.d}</span></span></>;
              return <li key={i} className={st.ok ? 'ok' : st.warn ? 'warn' : 'todo'}>{st.href ? <Link href={st.href} className="snd-ready-a">{body}</Link> : body}</li>;
            })}
          </ol>
        )}

        {progress > 0 && (
          <div className="snd-progress" aria-label="Delivery progress">
            <div className="snd-progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={progress} aria-valuenow={s}>
              <i className="ok" style={{ width: `${(s / progress) * 100}%` }} />
              <i className="wait" style={{ width: `${(q / progress) * 100}%` }} />
              <i className="bad" style={{ width: `${(f / progress) * 100}%` }} />
            </div>
            <div className="snd-progress-legend">
              <span><i className="ok" />{s} sent</span>
              {q > 0 && <span><i className="wait" />{q} waiting</span>}
              {f > 0 && <span><i className="bad" />{f} failed</span>}
              {q > 0 && <span className="hint">Reload to update.</span>}
            </div>
          </div>
        )}
      </section>

      <Channels items={channels}>
        <div className="snd-pane">
          <p className="snd-intro"><span>Everyone gets their own tracked link, so you see who read and who tapped.</span><span className={`pill ${smtpOn ? 'ok' : 'warn'}`}><span className="dot" />{smtpOn ? 'SMTP connected' : 'Outbox mode'}</span></p>
          <EmailSend editionId={e.id} status={e.status} blocked={blocked || ''} tags={tags} cities={cities} waApi={waOn} defaultAt={defaultAt} tz={tz} pace={g.emailsPerMinute} emailPeople={pick(emailAud, gotEmail)} waPeople={pick(waApiAud, gotWa)} failed={failedCount} smtp={smtpOn} scheduledLabel={e.status === 'scheduled' ? at(e.scheduled_at) : ''} scheduledAt={e.scheduled_at || ''} />
        </div>
        <div className="snd-pane">
          <p className="snd-intro"><span>The safest way to start: WhatsApp opens with their personal message filled in, and you press send.</span></p>
          <WaList editionId={e.id} blocked={blocked || ''} contacts={waAud.map((c) => ({ id: c.id, name: `${c.first_name} ${c.last_name}`.trim(), company: c.company, phone: fmtPhone(c.phone), sent: !!sentMap[c.id] }))} />
          <p className="snd-foot"><Icon name="clock" size={13} />Keep a human pace (a few dozen a day) and only message people who agreed to WhatsApp. Reports and blocks lower your number’s quality rating.</p>
        </div>
        <div className="snd-pane">
          <p className="snd-intro"><span>Post it anywhere. Opens are counted, but not tied to a person.{isSent ? '' : ' Until it’s sent, the link only works as a preview for you.'}</span><span className={`pill ${isSent ? 'ok' : ''}`}><span className="dot" />{isSent ? 'Live' : 'Preview only'}</span></p>
          <div className="snd-link">
            <div className="snd-link-main">
              <label className="f"><span>Public link</span>
                <div className="snd-url"><input className="in" readOnly value={link} aria-label="Public link" /><CopyButton text={link} /></div>
              </label>
              <div className="snd-link-actions">
                <a className="btn sm" href={link + (isSent ? '' : '?preview=1')} target="_blank" rel="noreferrer">Open page<Icon name="out" size={13} /></a>
                <a className="btn sm" href={`/api/editions/${e.id}/export?format=html`} target="_blank" rel="noreferrer">Email HTML<Icon name="out" size={13} /></a>
                <CopyButton text={`${base}/og/${e.id}.png`} label="Copy image URL" />
              </div>
              <p className="hint">Using Mailchimp, Brevo or Apollo? Open “Email HTML” and paste the code into that tool.</p>
            </div>
            <div className="snd-bubble-wrap">
              <div className="snd-bubble-head"><span>WhatsApp text (generic)</span><CopyButton text={genericWa} /></div>
              <div className="snd-bubble"><p>{genericWa}</p></div>
            </div>
          </div>
        </div>
        <div className="snd-pane">
          <div className="snd-api">
            <span className="icon-chip" aria-hidden><Icon name="bolt" size={17} /></span>
            <div>
              <b>{waOn ? 'WhatsApp Business API is connected' : 'Send to larger lists through WhatsApp'}</b>
              {waOn ? <p>Switch on “Also send via WhatsApp Business API” under Email to send your approved template (with the preview image and quick-reply buttons) to everyone with WhatsApp consent.</p>
                : <p>Connect Meta’s WhatsApp Cloud API with an approved Marketing template. Prospects then tap “Interested” right inside WhatsApp.</p>}
            </div>
            {waOn ? <span className="pill ok"><span className="dot" />Connected</span> : <Link className="btn" href="/app/settings?tab=whatsapp">Set it up<Icon name="arrow" size={13} /></Link>}
          </div>
        </div>
      </Channels>

      {dl.length > 0 && (
        <section className="card snd-logcard" aria-labelledby="h-log">
          <div className="card-head"><h2 id="h-log">Delivery log</h2><span className="hint">Newest first</span></div>
          <LogTable head={logHead} rows={dl.map(logRow)} shown={LOG_SHOWN} />
        </section>
      )}
    </div>
  );
}
