import { requireUser } from '@/lib/auth';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { all, get, parse } from '@/lib/db';
import { ago, fmtDate } from '@/lib/format';
import { StagePill, Score, STAGE_LABEL } from '@/components/bits';
import { Submit, Confirm } from '@/components/ui';
import { saveContact, deleteContact, setStage } from '../../actions';
import { ContactFields } from '../fields';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Contact' };

const LABEL: Record<string, string> = { open: 'Opened the email', click: 'Clicked a link', view: 'Opened the edition', scroll: 'Scrolled', poll: 'Voted', share: 'Shared', interested: 'Tapped “I’m interested”', book: 'Tapped “Book 15 min”', more: 'Asked for more', notnow: 'Said “Not right now”', showcase: 'Tapped an “Our work” card', unsubscribe: 'Unsubscribed', resubscribe: 'Resubscribed', note: 'Left a note', wa_reply: 'Replied on WhatsApp', time: 'Time on page' };

export default async function Contact({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const c = get('SELECT * FROM contacts WHERE id = ?', id);
  if (!c) notFound();
  const events = all(`SELECT ev.*, e.number, e.content FROM events ev LEFT JOIN editions e ON e.id = ev.edition_id WHERE ev.contact_id = ? AND ev.type NOT IN ('time') ORDER BY ev.created_at DESC LIMIT 100`, id);
  const dels = all(`SELECT d.*, e.number, e.content FROM deliveries d JOIN editions e ON e.id = d.edition_id WHERE d.contact_id = ? ORDER BY d.created_at DESC LIMIT 30`, id);
  const name = `${c.first_name} ${c.last_name}`.trim() || c.email || c.phone;
  const wa = c.phone ? `https://wa.me/${String(c.phone).replace(/\D/g, '')}?text=${encodeURIComponent(`Hi ${c.first_name || ''}, thanks for your interest! `)}` : null;
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="ph">
        <div><div className="crumbs"><Link href="/app/contacts">Contacts</Link> / {name}</div><h1>{name}</h1><p className="sub">{[c.role, c.company, c.city].filter(Boolean).join(' · ')}</p></div>
        <div className="row"><StagePill stage={c.stage} /><Score n={c.score} />{wa && <a className="btn primary" href={wa} target="_blank" rel="noreferrer">WhatsApp them</a>}{c.email && <a className="btn" href={`mailto:${c.email}`}>Email</a>}</div>
      </div>
      {c.last_intent && <div className="notice ok"><b>Last signal:</b> {LABEL[c.last_intent] || c.last_intent}, {ago(c.last_intent_at)}. Reply soon; interest fades within days.</div>}
      <div className="row">{Object.entries(STAGE_LABEL).map(([k, v]) => <form key={k} action={setStage.bind(null, id, k)}><button className={`btn sm ${c.stage === k ? 'primary' : ''}`}>{v}</button></form>)}</div>
      <div className="grid2">
        <section className="card"><h2>Activity</h2>
          {events.length ? <ul className="tl" style={{ marginTop: 10 }}>{events.map((ev) => {
            const meta = parse<any>(ev.meta, {});
            return <li key={ev.id}><time>{ago(ev.created_at)}</time><div><b>{LABEL[ev.type] || ev.type}</b>{ev.type === 'scroll' ? ` ${ev.value}%` : ev.type === 'poll' ? `: “${ev.value}”` : ''}{ev.number ? <span className="hint"> · #{ev.number} {parse<any>(ev.content, {}).title}</span> : null}{meta.note && <div>“{meta.note}”</div>}</div></li>;
          })}</ul> : <p className="hint">No activity yet.</p>}
        </section>
        <section className="card"><h2>Editions sent</h2>
          {dels.length ? <ul className="tl" style={{ marginTop: 10 }}>{dels.map((d) => <li key={d.id}><time>{fmtDate(d.sent_at || d.created_at)}</time><div>#{d.number} {parse<any>(d.content, {}).title} <span className="hint">· {d.channel} · {d.status}</span></div></li>)}</ul> : <p className="hint">Nothing sent to this person yet.</p>}
          <hr />
          <div className="hint">Consent: email {c.email_consent ? '✓' : '✕'} · WhatsApp {c.wa_consent ? '✓' : '✕'} · {c.consent_source || 'source not recorded'}{c.consent_at ? ` · ${fmtDate(c.consent_at)}` : ''}<br />Frequency: {c.frequency === 'less' ? 'less often (every other edition)' : 'weekly'} · Status: {c.status}</div>
        </section>
      </div>
      <section className="card"><h2>Details</h2>
        <form action={saveContact} className="form-grid" style={{ marginTop: 10 }}>
          <ContactFields c={c} stage={false} />
          {c.status !== 'active' && <label className="check full"><input type="checkbox" name="resubscribe" /><span>They asked to be resubscribed (only tick with their explicit request)</span></label>}
          <div className="full row"><Submit>Save</Submit><span className="hint">Change the stage with the buttons at the top.</span></div>
        </form>
        <div className="row" style={{ marginTop: 12, justifyContent: 'flex-end' }}><Confirm action={deleteContact.bind(null, id)} label="Delete contact" /></div>
      </section>
    </div>
  );
}
