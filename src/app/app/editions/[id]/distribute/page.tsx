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
import { EmailSend, WaList } from './Send';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Send' };

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
  const waApiAud = waReady() ? audienceFor(e, 'whatsapp') : [];
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

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="ph">
        <div>
          <div className="crumbs"><Link href="/app/editions">Editions</Link> / <Link href={`/app/editions/${e.id}`}>#{e.number}</Link> / Send</div>
          <h1>Send “{e.content.title}”</h1>
          <p className="sub">Approve first, then choose the channel. Every person gets their own tracked link, so you see who read and who tapped.</p>
        </div>
        <div className="row"><StatusPill status={e.status} /><Link className="btn" href={`/app/editions/${e.id}/analytics`}>Results</Link></div>
      </div>

      {blocked && e.status !== 'sent' && <div className="notice warn"><b>Not ready to send.</b> {blocked} <Link href={`/app/editions/${e.id}`}>Open the editor →</Link></div>}
      {e.status === 'scheduled' && <div className="notice"><b>Scheduled</b> for {fmtDate(e.scheduled_at, g.timezone, true)} ({ago(e.scheduled_at)}).</div>}
      {(e.status === 'sending' || counts.q > 0) && <div className="notice"><b>Sending:</b> {counts.s || 0} sent, {counts.q || 0} waiting, {counts.f || 0} failed. This page updates when you reload.</div>}

      <section className="card">
        <div className="card-head"><h2>1 · Share the link</h2><span className="hint">For posting anywhere. Opens are counted, but not tied to a person.</span></div>
        <div className="grid2">
          <div className="stack" style={{ gap: 8 }}>
            <label className="f"><span>Public link</span><div className="row"><input className="in" readOnly value={link} style={{ flex: 1 }} /><Copy text={link} /></div></label>
            <div className="row"><a className="btn sm" href={link + (e.status === 'sent' ? '' : '?preview=1')} target="_blank" rel="noreferrer">Open page ↗</a><a className="btn sm" href={`/api/editions/${e.id}/export?format=html`} target="_blank" rel="noreferrer">Email HTML for other tools ↗</a><Copy text={`${base}/og/${e.id}.png`} label="Copy preview image URL" /></div>
            <div className="hint">Using Mailchimp, Brevo or Apollo instead? Open “Email HTML” and paste the code into that tool.</div>
          </div>
          <label className="f"><span>WhatsApp text (generic)</span><textarea className="in" readOnly rows={5} value={genericWa} /><div><Copy text={genericWa} /></div></label>
        </div>
      </section>

      <section className="card">
        <div className="card-head"><h2>2 · Email</h2><span className={`pill ${smtpReady() ? 'ok' : 'warn'}`}>{smtpReady() ? 'SMTP connected' : 'Outbox mode: emails are saved, not sent'}</span></div>
        <EmailSend editionId={e.id} status={e.status} blocked={!!blocked} total={emailAud.length} emailPeople={pick(emailAud, gotEmail)} waPeople={pick(waApiAud, gotWa)} failed={failedCount} tags={tags} cities={cities} waApi={waReady()} defaultAt={defaultAt} tz={g.timezone} pace={g.emailsPerMinute} />
      </section>

      <section className="card">
        <div className="card-head"><h2>3 · WhatsApp, one by one</h2><span className="hint">Safest way to start: WhatsApp opens with the personal message filled in, and you press send.</span></div>
        <WaList editionId={e.id} blocked={!!blocked} contacts={waAud.map((c) => ({ id: c.id, name: `${c.first_name} ${c.last_name}`.trim(), company: c.company, phone: c.phone, sent: !!sentMap[c.id] }))} />
        <div className="hint" style={{ marginTop: 10 }}>Keep a human pace (a few dozen a day) and only message people who agreed to WhatsApp. Reports and blocks lower your number’s quality rating.</div>
      </section>

      <section className="card">
        <div className="card-head"><h2>4 · WhatsApp Business API</h2><span className={`pill ${waReady() ? 'ok' : ''}`}>{waReady() ? 'Connected' : 'Not connected'}</span></div>
        {waReady() ? <p className="hint">Tick “WhatsApp Business API” in the email section above to send your approved template (with the edition’s preview image and quick-reply buttons) to everyone with WhatsApp consent, together with the email.</p>
          : <p className="hint">For larger lists, connect Meta’s WhatsApp Cloud API with an approved Marketing template. Prospects then tap “Interested” right inside WhatsApp. <Link href="/app/settings?tab=whatsapp">Set it up →</Link></p>}
      </section>

      <section className="card">
        <div className="card-head"><h2>Delivery log</h2><span className="hint">Latest 60</span></div>
        {dl.length ? (
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Who</th><th>Channel</th><th>Status</th><th>When</th><th>Note</th></tr></thead>
            <tbody>{dl.map((d) => <tr key={d.id}><td>{d.contact_id ? <Link href={`/app/contacts/${d.contact_id}`}>{`${d.first_name || ''} ${d.last_name || ''}`.trim() || d.email || d.phone}</Link> : <span className="hint">test</span>}</td><td>{({ email: 'Email', whatsapp: 'WhatsApp API', wa_manual: 'WhatsApp (manual)', test: 'Test email' } as any)[d.channel] || d.channel}</td><td><span className={`pill ${d.status === 'failed' ? 'bad' : d.status === 'queued' || d.status === 'skipped' ? '' : 'ok'}`}>{d.status}</span></td><td>{ago(d.sent_at || d.created_at)}</td><td className="hint clip">{d.error || ''}</td></tr>)}</tbody>
          </table></div>
        ) : <div className="hint">Nothing sent yet.</div>}
      </section>
    </div>
  );
}
