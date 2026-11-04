import { EnsureProduct } from '@/components/EnsureProduct';
import { activeProduct } from '@/lib/context';
import { requireUser } from '@/lib/auth';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { all, get, parse } from '@/lib/db';
import { ago, fmtDate } from '@/lib/format';
import { Score, STAGE_LABEL } from '@/components/bits';
import { Submit, Confirm } from '@/components/ui';
import { Avatar } from '@/components/people/Avatar';
import { Icon } from '@/components/people/Icon';
import { StagePicker } from '@/components/people/StageAction';
import { EditSheet, ConsentSwitches } from '@/components/people/ContactBits';
import { saveContact, deleteContact, setStage } from '../../actions';
import { ContactFields } from '../fields';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Contact' };

const LABEL: Record<string, string> = { open: 'Opened the email', click: 'Clicked a link', view: 'Opened the edition', scroll: 'Scrolled', poll: 'Voted', share: 'Shared', interested: 'Tapped “I’m interested”', book: 'Tapped “Book 15 min”', more: 'Asked for more', notnow: 'Said “Not right now”', showcase: 'Tapped an “Our work” card', unsubscribe: 'Unsubscribed', resubscribe: 'Resubscribed', note: 'Left a note', wa_reply: 'Replied on WhatsApp', time: 'Time on page' };
const EV: Record<string, [string, string]> = {
  open: ['mail', 'gray'], click: ['link', 'gray'], view: ['eye', 'blue'], scroll: ['doc', 'gray'], poll: ['poll', 'indigo'], share: ['send', 'indigo'],
  interested: ['flame', 'green'], book: ['calendar', 'green'], showcase: ['spark', 'green'], more: ['mail', 'blue'], notnow: ['minus', 'orange'],
  unsubscribe: ['x', 'red'], resubscribe: ['check', 'green'], note: ['pencil', 'indigo'], wa_reply: ['chat', 'green'],
};
const CH: Record<string, string> = { email: 'Email', whatsapp: 'WhatsApp API', wa_manual: 'WhatsApp', test: 'Test' };

export default async function Contact({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const c = get('SELECT * FROM contacts WHERE id = ?', id);
  if (!c) notFound();
  // Scroll depth arrives as 25/50/75/100 milestones; keep only the deepest one per edition so the timeline stays calm.
  const deepest = new Map<string, number>();
  const raw = all(`SELECT ev.*, e.number, e.content FROM events ev LEFT JOIN editions e ON e.id = ev.edition_id WHERE ev.contact_id = ? AND ev.type NOT IN ('time') ORDER BY ev.created_at DESC LIMIT 100`, id);
  for (const ev of raw) if (ev.type === 'scroll') deepest.set(ev.edition_id, Math.max(deepest.get(ev.edition_id) || 0, Number(ev.value) || 0));
  const events = raw.filter((ev) => { if (ev.type !== 'scroll') return true; if (Number(ev.value) !== deepest.get(ev.edition_id)) return false; deepest.set(ev.edition_id, -1); return true; });
  const dels = all(`SELECT d.*, e.number, e.content FROM deliveries d JOIN editions e ON e.id = d.edition_id WHERE d.contact_id = ? ORDER BY d.created_at DESC LIMIT 30`, id);
  const name = `${c.first_name} ${c.last_name}`.trim() || c.email || c.phone;
  const wa = c.phone ? `https://wa.me/${String(c.phone).replace(/\D/g, '')}?text=${encodeURIComponent(`Hi ${c.first_name || ''}, thanks for your interest! `)}` : null;
  const tags = String(c.tags || '').split(',').map((t: string) => t.trim()).filter(Boolean);
  const stageActions = Object.fromEntries(Object.keys(STAGE_LABEL).map((k) => [k, setStage.bind(null, id, k)]));
  const info: [string, string, React.ReactNode][] = [
    ['mail', 'Email', c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : null],
    ['phone', 'Mobile', c.phone ? <a className="tnum" href={`tel:${c.phone}`}>{c.phone}</a> : null],
    ['building', 'Company', c.company || null],
    ['briefcase', 'Role', c.role || null],
    ['pin', 'City', c.city || null],
  ];
  const __active = await activeProduct();
  return (
    <div className="pc">
      <EnsureProduct productId={c.product_id} activeId={__active?.id || null} />
      <div className="crumbs"><Link href="/app/contacts">Contacts</Link> / {name}</div>

      <section className="card pc-hero" aria-labelledby="pc-name">
        <Avatar name={name} size={88} className="pc-av" />
        <h1 id="pc-name">{name}</h1>
        <p className="pc-sub">{[c.role, c.company, c.city].filter(Boolean).join(' · ') || 'No details yet'}</p>
        <div className="pc-badges"><Score n={c.score} /><span className="hint">lead score</span>{c.status !== 'active' && <span className="pill bad">{c.status}</span>}</div>
        <div className="pc-acts">
          {wa ? <a className="pc-act is-wa" href={wa} target="_blank" rel="noreferrer"><span className="pc-act-ic"><Icon name="chat" size={18} stroke={2} /></span><span>WhatsApp</span></a> : null}
          {c.email ? <a className="pc-act" href={`mailto:${c.email}`}><span className="pc-act-ic"><Icon name="mail" size={18} stroke={2} /></span><span>Email</span></a> : null}
          {c.phone ? <a className="pc-act" href={`tel:${c.phone}`}><span className="pc-act-ic"><Icon name="phone" size={18} stroke={2} /></span><span>Call</span></a> : null}
          <EditSheet>
            <form action={saveContact} className="form-grid">
              <ContactFields c={c} stage={false} />
              {c.status !== 'active' && <label className="check full"><input type="checkbox" name="resubscribe" /><span>They asked to be resubscribed (only tick with their explicit request)</span></label>}
              <div className="full padd-foot"><span className="hint">Change the stage on the contact card.</span><Submit>Save</Submit></div>
            </form>
          </EditSheet>
        </div>
      </section>

      {c.last_intent && (
        <div className="pc-signal" role="status">
          <span className="pc-signal-ic"><Icon name={EV[c.last_intent]?.[0] || 'flame'} size={16} stroke={2} /></span>
          <div><b>{LABEL[c.last_intent] || c.last_intent}</b> <span>{ago(c.last_intent_at)}. Reply soon; interest fades within days.</span></div>
          {wa && <a className="btn sm wa" href={wa} target="_blank" rel="noreferrer">Reply on WhatsApp</a>}
        </div>
      )}

      <section className="pc-stage-wrap" aria-label="Stage">
        <span className="pc-label">Stage</span>
        <StagePicker stages={Object.entries(STAGE_LABEL)} current={c.stage} actions={stageActions} />
      </section>

      <div className="pc-grid">
        <section className="card pc-activity" aria-labelledby="h-act">
          <div className="pc-h"><h2 id="h-act">Activity</h2><span className="hint">{events.length ? `${events.length} ${events.length === 1 ? 'event' : 'events'}` : ''}</span></div>
          {events.length ? <ol className="ptl">{events.map((ev) => {
            const meta = parse<any>(ev.meta, {});
            const [ic, tone] = EV[ev.type] || ['spark', 'gray'];
            return (
              <li key={ev.id}>
                <span className={`ptl-dot tn-${tone}`}><Icon name={ic} size={13} stroke={2.2} /></span>
                <div className="ptl-body">
                  <div className="ptl-t"><b>{LABEL[ev.type] || ev.type}{ev.type === 'scroll' ? ` to ${ev.value}%` : ev.type === 'poll' ? `: “${ev.value}”` : ''}</b><time>{ago(ev.created_at)}</time></div>
                  {ev.number ? <div className="ptl-s">#{ev.number} {parse<any>(ev.content, {}).title}</div> : null}
                  {meta.note && <blockquote className="ptl-note">“{meta.note}”</blockquote>}
                </div>
              </li>
            );
          })}</ol> : <div className="pc-empty"><Icon name="clock" size={20} /><span>No activity yet. Opens, reads and taps show up here.</span></div>}
        </section>

        <div className="pc-side">
          <section className="card pc-info" aria-labelledby="h-info">
            <div className="pc-h"><h2 id="h-info">Details</h2></div>
            <dl className="pc-list">
              {info.map(([ic, k, v]) => <div key={k}><dt><Icon name={ic} size={14} />{k}</dt><dd className={v ? '' : 'hint'}>{v || '—'}</dd></div>)}
              <div><dt><Icon name="tag" size={14} />Tags</dt><dd>{tags.length ? <span className="ptags">{tags.map((t) => <span key={t} className="ptag">{t}</span>)}</span> : <span className="hint">—</span>}</dd></div>
            </dl>
            {c.notes && <div className="pc-notes"><span className="pc-label">Notes</span><p>{c.notes}</p></div>}
          </section>

          <section className="card" aria-labelledby="h-consent">
            <div className="pc-h"><h2 id="h-consent">Consent</h2><span className="hint">Saved instantly</span></div>
            <ConsentSwitches action={saveContact} c={c} />
            <p className="pc-meta">{c.consent_source || 'Source not recorded'}{c.consent_at ? ` · ${fmtDate(c.consent_at)}` : ''}<br />Frequency: {c.frequency === 'less' ? 'less often (every other edition)' : 'weekly'} · Status: {c.status}</p>
          </section>

          <section className="card" aria-labelledby="h-sent">
            <div className="pc-h"><h2 id="h-sent">Editions sent</h2></div>
            {dels.length ? <ul className="pc-sent">{dels.map((d) => (
              <li key={d.id}>
                <span className="pc-sent-n">#{d.number}</span>
                <div><b>{parse<any>(d.content, {}).title}</b><span>{CH[d.channel] || d.channel} · {fmtDate(d.sent_at || d.created_at)}</span></div>
                <span className={`pill ${d.status === 'failed' ? 'bad' : d.status === 'queued' || d.status === 'skipped' ? '' : 'ok'}`}>{d.status}</span>
              </li>
            ))}</ul> : <p className="hint">Nothing sent to this person yet.</p>}
          </section>

          <div className="pc-danger"><Confirm action={deleteContact.bind(null, id)} label="Delete contact" confirmLabel="Yes, delete" /></div>
        </div>
      </div>
    </div>
  );
}
