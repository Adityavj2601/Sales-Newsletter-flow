import { requireUser } from '@/lib/auth';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { all, get } from '@/lib/db';
import { getEdition } from '@/lib/editions';
import { getProduct, baseUrl, getSetting, smtpReady, waReady } from '@/lib/settings';
import { audienceFor, canSend } from '@/lib/send';
import { renderWhatsApp } from '@/lib/render/email';
import { utcToZonedInput, fmtDate, ago } from '@/lib/format';
import { StatusPill } from '@/components/bits';
import { Copy } from '@/components/ui';
import { Icon } from '@/components/people/Icon';
import { Avatar } from '@/components/people/Avatar';
import { EmailSend, WaList } from './Send';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Send' };

const CH: Record<string, [string, string]> = { email: ['Email', 'mail'], whatsapp: ['WhatsApp API', 'bolt'], wa_manual: ['WhatsApp', 'chat'], test: ['Test email', 'mail'] };
const ST: Record<string, string> = { failed: 'bad', queued: 'wait', skipped: 'wait', sent: 'ok', delivered: 'ok', opened: 'ok', clicked: 'ok' };

export default async function Distribute({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const e = getEdition(id);
  if (!e) notFound();
  const p = getProduct(e.product_id)!;
  const g = getSetting('general');
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
  const defaultAt = e.scheduled_at ? utcToZonedInput(e.scheduled_at, g.timezone) : `${e.planned_for || new Date().toISOString().slice(0, 10)}T${g.sendTime}`;
  const genericWa = renderWhatsApp(e, p, link, '');

  const approved = ['approved', 'scheduled', 'sending', 'sent'].includes(e.status);
  const ready = !blocked;
  const isSent = e.status === 'sent';
  const q = Number(counts.q || 0), s = Number(counts.s || 0), f = Number(counts.f || 0);
  const progress = q + s + f;
  const waDone = waAud.filter((c) => sentMap[c.id]).length;
  const headline = isSent ? `Sent ${fmtDate(e.sent_at, g.timezone, true)}`
    : e.status === 'scheduled' ? `Scheduled for ${fmtDate(e.scheduled_at, g.timezone, true)} (${ago(e.scheduled_at)})`
    : e.status === 'sending' ? 'Sending now'
    : ready ? 'Ready to send' : 'Not ready to send yet';

  const tiles = [
    { href: '#email', icon: 'mail', tone: 'blue', name: 'Email', state: gotEmail.size ? `${gotEmail.size} sent` : `${emailAud.length} with consent`, ok: gotEmail.size > 0 },
    { href: '#wa', icon: 'chat', tone: 'green', name: 'WhatsApp, one by one', state: waAud.length ? `${waDone} of ${waAud.length} sent` : 'No one opted in', ok: waAud.length > 0 && waDone === waAud.length },
    { href: '#link', icon: 'link', tone: 'indigo', name: 'Share the link', state: isSent ? 'Live' : 'Preview only', ok: isSent },
    { href: '#wa-api', icon: 'bolt', tone: 'orange', name: 'WhatsApp API', state: waOn ? 'Connected' : 'Not connected', ok: waOn },
  ];

  return (
    <div className="snd">
      <div className="crumbs"><Link href="/app/editions">Editions</Link> / <Link href={`/app/editions/${e.id}`}>#{e.number}</Link> / Send</div>

      <section className={`card snd-hero ${isSent ? 'is-sent' : ready ? 'is-ready' : 'is-blocked'}`} aria-labelledby="snd-title">
        <div className="snd-hero-top">
          <div className="snd-hero-text">
            <div className="snd-kicker"><span>Edition #{e.number}</span><span aria-hidden>·</span><span>{p.newsletter_name || p.name}</span></div>
            <h1 id="snd-title">{e.content.title}</h1>
            <div className="snd-status"><StatusPill status={e.status} /><span>{headline}</span></div>
          </div>
          <div className="snd-hero-actions">
            <a className="btn" href={link + (isSent ? '' : '?preview=1')} target="_blank" rel="noreferrer"><Icon name="eye" size={15} />Preview</a>
            <Link className="btn" href={`/app/editions/${e.id}/analytics`}><Icon name="chart" size={15} />Results</Link>
          </div>
        </div>

        <ol className="snd-ready" aria-label="Readiness">
          <li className={approved ? 'ok' : 'todo'}><span className="snd-dot">{approved ? <Icon name="check" size={12} stroke={2.6} /> : '1'}</span><div><b>Approved</b><span>{approved ? (e.approved_by ? `by ${e.approved_by}` : 'Signed off') : 'Approve it in the editor'}</span></div></li>
          <li className={ready ? 'ok' : approved ? 'warn' : 'todo'}><span className="snd-dot">{ready ? <Icon name="check" size={12} stroke={2.6} /> : '2'}</span><div><b>Checks</b><span>{ready ? 'All blocking checks pass' : approved ? blocked : 'Run before approving'}</span></div></li>
          <li className={emailAud.length || waAud.length ? 'ok' : 'warn'}><span className="snd-dot">{emailAud.length || waAud.length ? <Icon name="check" size={12} stroke={2.6} /> : '3'}</span><div><b>Audience</b><span>{emailAud.length} email · {waAud.length} WhatsApp</span></div></li>
          <li className={smtpOn ? 'ok' : 'info'}><span className="snd-dot">{smtpOn ? <Icon name="check" size={12} stroke={2.6} /> : <Icon name="doc" size={12} stroke={2.2} />}</span><div><b>Email delivery</b><span>{smtpOn ? 'SMTP connected' : 'Outbox mode: saved, not sent'}</span></div></li>
        </ol>

        {blocked && !isSent && <div className="snd-block"><Icon name="pencil" size={15} /><span>{blocked}</span><Link className="btn sm" href={`/app/editions/${e.id}`}>Open the editor<Icon name="arrow" size={13} /></Link></div>}

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

      <nav className="snd-tiles" aria-label="Channels">
        {tiles.map((t) => (
          <a key={t.href} href={t.href} className="snd-tile">
            <span className={`snd-ico tn-${t.tone}`}><Icon name={t.icon} size={17} stroke={2} /></span>
            <span className="snd-tile-text"><b>{t.name}</b><span className={t.ok ? 'ok' : ''}>{t.ok && <Icon name="check" size={11} stroke={2.6} />}{t.state}</span></span>
          </a>
        ))}
      </nav>

      <section className="card snd-sec" id="email" aria-labelledby="h-email">
        <header className="snd-sec-head">
          <span className="snd-ico tn-blue"><Icon name="mail" size={18} stroke={2} /></span>
          <div><h2 id="h-email">Email</h2><p>Every person gets their own tracked link, so you see who read and who tapped.</p></div>
          <span className={`pill ${smtpOn ? 'ok' : 'warn'}`}><span className="dot" />{smtpOn ? 'SMTP connected' : 'Outbox mode'}</span>
        </header>
        <EmailSend editionId={e.id} status={e.status} blocked={!!blocked} total={emailAud.length} emailPeople={pick(emailAud, gotEmail)} waPeople={pick(waApiAud, gotWa)} failed={failedCount} tags={tags} cities={cities} waApi={waOn} defaultAt={defaultAt} tz={g.timezone} pace={g.emailsPerMinute} smtp={smtpOn} scheduledLabel={e.status === 'scheduled' ? `${fmtDate(e.scheduled_at, g.timezone, true)} · ${ago(e.scheduled_at)}` : ''} />
      </section>

      <section className="card snd-sec" id="wa" aria-labelledby="h-wa">
        <header className="snd-sec-head">
          <span className="snd-ico tn-green"><Icon name="chat" size={18} stroke={2} /></span>
          <div><h2 id="h-wa">WhatsApp, one by one</h2><p>The safest way to start. WhatsApp opens with their personal message filled in, and you press send.</p></div>
        </header>
        <WaList editionId={e.id} blocked={!!blocked} contacts={waAud.map((c) => ({ id: c.id, name: `${c.first_name} ${c.last_name}`.trim(), company: c.company, phone: c.phone, sent: !!sentMap[c.id] }))} />
        <p className="snd-foot"><Icon name="clock" size={13} />Keep a human pace (a few dozen a day) and only message people who agreed to WhatsApp. Reports and blocks lower your number’s quality rating.</p>
      </section>

      <section className="card snd-sec" id="link" aria-labelledby="h-link">
        <header className="snd-sec-head">
          <span className="snd-ico tn-indigo"><Icon name="link" size={18} stroke={2} /></span>
          <div><h2 id="h-link">Share the link</h2><p>Post it anywhere. Opens are counted, but not tied to a person.</p></div>
        </header>
        <div className="snd-link">
          <div className="snd-link-main">
            <label className="f"><span>Public link</span>
              <div className="snd-url"><input className="in" readOnly value={link} aria-label="Public link" /><Copy text={link} className="btn primary sm" /></div>
            </label>
            <div className="snd-link-actions">
              <a className="btn sm" href={link + (isSent ? '' : '?preview=1')} target="_blank" rel="noreferrer">Open page<Icon name="out" size={13} /></a>
              <a className="btn sm" href={`/api/editions/${e.id}/export?format=html`} target="_blank" rel="noreferrer">Email HTML<Icon name="out" size={13} /></a>
              <Copy text={`${base}/og/${e.id}.png`} label="Copy preview image URL" />
            </div>
            <p className="hint">Using Mailchimp, Brevo or Apollo instead? Open “Email HTML” and paste the code into that tool.</p>
          </div>
          <div className="snd-bubble-wrap">
            <div className="snd-bubble-head"><span>WhatsApp text (generic)</span><Copy text={genericWa} /></div>
            <div className="snd-bubble"><p>{genericWa}</p></div>
          </div>
        </div>
      </section>

      <section className="card snd-sec" id="wa-api" aria-labelledby="h-api">
        <header className="snd-sec-head">
          <span className="snd-ico tn-orange"><Icon name="bolt" size={18} stroke={2} /></span>
          <div><h2 id="h-api">WhatsApp Business API</h2>
            {waOn ? <p>Switch on “Also send via WhatsApp Business API” in the Email section to send your approved template (with the preview image and quick-reply buttons) to everyone with WhatsApp consent.</p>
              : <p>For larger lists, connect Meta’s WhatsApp Cloud API with an approved Marketing template. Prospects then tap “Interested” right inside WhatsApp.</p>}
          </div>
          {waOn ? <span className="pill ok"><span className="dot" />Connected</span> : <Link className="btn sm" href="/app/settings?tab=whatsapp">Set it up<Icon name="arrow" size={13} /></Link>}
        </header>
      </section>

      <section className="card snd-sec" aria-labelledby="h-log">
        <header className="snd-sec-head">
          <span className="snd-ico tn-gray"><Icon name="doc" size={18} stroke={2} /></span>
          <div><h2 id="h-log">Delivery log</h2><p>{dl.length ? `Latest ${Math.min(60, dl.length)} messages, newest first.` : 'Messages appear here as they go out.'}</p></div>
        </header>
        {dl.length ? (
          <div className="snd-log">
            <table className="tbl">
              <thead><tr><th>Who</th><th>Channel</th><th>Status</th><th>When</th><th>Note</th></tr></thead>
              <tbody>{dl.map((d) => {
                const who = `${d.first_name || ''} ${d.last_name || ''}`.trim() || d.email || d.phone;
                const [chName, chIcon] = CH[d.channel] || [d.channel, 'doc'];
                return (
                  <tr key={d.id}>
                    <td>{d.contact_id ? <Link className="snd-who" href={`/app/contacts/${d.contact_id}`}><Avatar name={who || '?'} size={26} /><span>{who}</span></Link> : <span className="snd-who"><span className="snd-test"><Icon name="spark" size={13} /></span><span className="hint">Test</span></span>}</td>
                    <td><span className="snd-ch"><Icon name={chIcon} size={14} />{chName}</span></td>
                    <td><span className={`snd-st ${ST[d.status] || 'wait'}`}><i />{d.status}</span></td>
                    <td className="hint">{ago(d.sent_at || d.created_at)}</td>
                    <td className="hint clip">{d.error || ''}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        ) : <div className="snd-empty"><Icon name="send" size={22} /><span>Nothing sent yet.</span></div>}
      </section>
    </div>
  );
}
