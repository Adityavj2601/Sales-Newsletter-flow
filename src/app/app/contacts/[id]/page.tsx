import { EnsureProduct } from '@/components/EnsureProduct';
import { activeProduct } from '@/lib/context';
import { requireUser } from '@/lib/auth';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { all, get, parse } from '@/lib/db';
import { fmtDate, fmtPhone, edNo } from '@/lib/format';
import { STAGE_LABEL } from '@/components/bits';
import { HOT_SCORE } from '@/lib/tracking';
import { Submit, Confirm } from '@/components/ui';
import { Avatar } from '@/components/people/Avatar';
import { Icon } from '@/components/people/Icon';
import { Rel } from '@/components/people/Rel';
import { StagePicker } from '@/components/people/StageAction';
import { EditSheet, ConsentSwitches } from '@/components/people/ContactBits';
import { saveContact, deleteContact, setStage } from '../../actions';
import { ContactFields } from '../fields';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Contact' };

const LABEL: Record<string, string> = { open: 'Opened the email', click: 'Clicked a link', view: 'Opened the edition', scroll: 'Scrolled', poll: 'Voted', share: 'Shared', interested: 'Tapped “I’m interested”', book: 'Tapped “Book 15 min”', more: 'Asked for more', notnow: 'Said “Not right now”', showcase: 'Tapped an “Our work” card', unsubscribe: 'Unsubscribed', resubscribe: 'Resubscribed', note: 'Left a note', wa_reply: 'Replied on WhatsApp', time: 'Time on page' };
/* Timeline glyphs use the tinted status chips: green = intent, red = opt-out, accent = everything else. */
const EV: Record<string, [string, string]> = {
  open: ['mail', ''], click: ['link', ''], view: ['eye', ''], scroll: ['doc', ''], poll: ['poll', ''], share: ['send', ''],
  interested: ['flame', 'ok'], book: ['calendar', 'ok'], showcase: ['spark', 'ok'], more: ['mail', ''], notnow: ['minus', 'warn'],
  unsubscribe: ['x', 'bad'], resubscribe: ['check', 'ok'], note: ['pencil', ''], wa_reply: ['chat', 'ok'],
};
const CH: Record<string, string> = { email: 'Email', whatsapp: 'WhatsApp API', wa_manual: 'WhatsApp', test: 'Test' };
const DST: Record<string, [string, string]> = { queued: ['', 'Queued'], skipped: ['', 'Skipped'], failed: ['bad', 'Failed'], sent: ['ok', 'Sent'], delivered: ['ok', 'Delivered'], opened: ['ok', 'Opened'], clicked: ['ok', 'Clicked'] };
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Notes are stored as text; lines like "[2026-11-04] Reader note: …" become dated timeline items. */
function parseNotes(raw: string | null) {
  const items: { date: string | null; reader: boolean; text: string }[] = [];
  for (const line of String(raw || '').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    const m = t.match(/^\[(\d{4}-\d{2}-\d{2})\]\s*(Reader note:\s*)?(.*)$/i);
    if (m) items.push({ date: m[1], reader: !!m[2], text: m[3] });
    else if (items.length && !items[items.length - 1].date) items[items.length - 1].text += '\n' + t;
    else items.push({ date: null, reader: false, text: t });
  }
  return items.reverse();
}

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
  const name = `${c.first_name} ${c.last_name}`.trim() || c.email || fmtPhone(c.phone);
  const wa = c.phone ? `https://wa.me/${String(c.phone).replace(/\D/g, '')}?text=${encodeURIComponent(`Hi ${c.first_name || ''}, thanks for your interest! `)}` : null;
  const tags = String(c.tags || '').split(',').map((t: string) => t.trim()).filter(Boolean);
  const stageActions = Object.fromEntries(Object.keys(STAGE_LABEL).map((k) => [k, setStage.bind(null, id, k)]));
  const notes = parseNotes(c.notes);
  const score = Number(c.score || 0);
  const heat = score >= HOT_SCORE ? ['ok', 'Hot'] : score >= 15 ? ['warn', 'Warming up'] : ['', score > 0 ? 'Cool' : 'No signal yet'];
  const info: [string, string, React.ReactNode][] = [
    ['mail', 'Email', c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : null],
    ['phone', 'Mobile', c.phone ? <a className="tnum" href={`tel:${c.phone}`}>{fmtPhone(c.phone)}</a> : null],
    ['building', 'Company', c.company || null],
    ['briefcase', 'Role', c.role || null],
    ['pin', 'City', c.city || null],
  ];
  const __active = await activeProduct();
  return (
    <div className="pc">
      <EnsureProduct productId={c.product_id} activeId={__active?.id || null} />
      <div className="ph">
        <div>
          <div className="crumbs"><Link href="/app/contacts">Contacts</Link> / {name}</div>
          <h1>{name}</h1>
          <p className="sub">{[c.role, c.company, c.city].filter(Boolean).join(' · ') || 'No details yet'}</p>
        </div>
        <div className="row">
          <EditSheet>
            <form action={saveContact} className="form-grid">
              <ContactFields c={c} stage={false} />
              {c.status !== 'active' && <label className="check full"><input type="checkbox" name="resubscribe" /><span>They asked to be resubscribed (only tick with their explicit request)</span></label>}
              <div className="full padd-foot"><span className="hint">Change the stage on the contact card.</span><Submit>Save</Submit></div>
            </form>
          </EditSheet>
          {wa && <a className="btn wa" href={wa} target="_blank" rel="noreferrer"><Icon name="chat" size={15} />WhatsApp</a>}
        </div>
      </div>

      <section className="card pc-card" aria-label="Contact card">
        <div className="pc-top">
          <Avatar name={name} size={64} className="pc-av" />
          <div className="pc-reach">
            {c.email ? <a className="pc-chan" href={`mailto:${c.email}`}><span className="icon-chip" aria-hidden><Icon name="mail" size={15} /></span><span><small>Email</small><b>{c.email}</b></span></a> : null}
            {c.phone ? <a className="pc-chan" href={`tel:${c.phone}`}><span className="icon-chip" aria-hidden><Icon name="phone" size={15} /></span><span><small>Mobile</small><b className="tnum">{fmtPhone(c.phone)}</b></span></a> : null}
            {!c.email && !c.phone && <span className="hint">No email or mobile yet.</span>}
          </div>
          <div className="pc-score">
            <span className="pc-score-v tnum">{score}</span>
            <span className="pc-score-k">Lead score</span>
            <span className={`pill ${heat[0]}`}>{heat[1]}</span>
            {c.status !== 'active' && <span className="pill bad">{cap(c.status)}</span>}
          </div>
        </div>
        <div className="pc-stage">
          <span className="pc-label">Stage</span>
          <StagePicker stages={Object.entries(STAGE_LABEL)} current={c.stage} actions={stageActions} />
        </div>
      </section>

      {c.last_intent && (
        <div className="notice ok pc-signal" role="status">
          <span className="ni" aria-hidden><Icon name={EV[c.last_intent]?.[0] || 'flame'} size={12} stroke={2.2} /></span>
          <div><b>{LABEL[c.last_intent] || c.last_intent}</b> <span className="pc-signal-t"><Rel iso={c.last_intent_at} />. Reply soon; interest fades within days.</span></div>
          {wa && <a className="btn sm wa" href={wa} target="_blank" rel="noreferrer">Reply on WhatsApp</a>}
        </div>
      )}

      <div className="pc-grid">
        <div className="pc-main">
          <section className="card pc-activity" aria-labelledby="h-act">
            <div className="card-head"><h2 id="h-act">Activity</h2><span className="hint">{events.length ? `${events.length} ${events.length === 1 ? 'event' : 'events'}` : ''}</span></div>
            {events.length ? <ol className="ptl">{events.map((ev) => {
              const meta = parse<any>(ev.meta, {});
              const [ic, tone] = EV[ev.type] || ['spark', ''];
              return (
                <li key={ev.id}>
                  <span className={`icon-chip ptl-dot ${tone}`} aria-hidden><Icon name={ic} size={14} /></span>
                  <div className="ptl-body">
                    <div className="ptl-t"><b>{LABEL[ev.type] || ev.type}{ev.type === 'scroll' ? ` to ${ev.value}%` : ev.type === 'poll' ? `: “${ev.value}”` : ''}</b><Rel iso={ev.created_at} title={fmtDate(ev.created_at, undefined, true)} /></div>
                    {ev.number ? <div className="ptl-s">{edNo(ev.number)} · {parse<any>(ev.content, {}).title}</div> : null}
                    {meta.note && <blockquote className="ptl-note">“{meta.note}”</blockquote>}
                  </div>
                </li>
              );
            })}</ol> : <div className="pc-empty"><Icon name="clock" size={20} /><span>No activity yet. Opens, reads and taps show up here.</span></div>}
          </section>

          <section className="card" aria-labelledby="h-notes">
            <div className="card-head"><h2 id="h-notes">Notes</h2><span className="hint">{notes.length ? `${notes.length} ${notes.length === 1 ? 'note' : 'notes'}` : 'Add one with Edit'}</span></div>
            {notes.length ? <ol className="ptl pnotes">{notes.map((n, i) => (
              <li key={i}>
                <span className={`icon-chip ptl-dot ${n.reader ? 'ok' : ''}`} aria-hidden><Icon name={n.reader ? 'chat' : 'pencil'} size={14} /></span>
                <div className="ptl-body">
                  <div className="ptl-t"><b>{n.reader ? 'From the reader' : 'Your note'}</b>{n.date ? <time dateTime={n.date}>{fmtDate(n.date)}</time> : null}</div>
                  <p className="pnote">{n.text}</p>
                </div>
              </li>
            ))}</ol> : <p className="hint pc-none">Reader notes and your own notes about {c.first_name || 'this person'} appear here.</p>}
          </section>
        </div>

        <div className="pc-side">
          <section className="card pc-info" aria-labelledby="h-info">
            <div className="card-head"><h2 id="h-info">Details</h2></div>
            <dl className="pc-list">
              {info.map(([ic, k, v]) => <div key={k}><dt><Icon name={ic} size={14} />{k}</dt><dd className={v ? '' : 'hint'}>{v || '—'}</dd></div>)}
              <div><dt><Icon name="tag" size={14} />Tags</dt><dd>{tags.length ? <span className="ptags">{tags.map((t) => <span key={t} className="ptag">{t}</span>)}</span> : <span className="hint">—</span>}</dd></div>
            </dl>
          </section>

          <section className="card" aria-labelledby="h-consent">
            <div className="card-head"><h2 id="h-consent">Consent</h2><span className="hint">Saved instantly</span></div>
            <ConsentSwitches action={saveContact} c={c} />
            <p className="pc-meta">{c.consent_source || 'Source not recorded'}{c.consent_at ? ` · ${fmtDate(c.consent_at)}` : ''}<br />Frequency: {c.frequency === 'less' ? 'less often (every other edition)' : 'weekly'} · Status: {cap(c.status)}</p>
          </section>

          <section className="card" aria-labelledby="h-sent">
            <div className="card-head"><h2 id="h-sent">Editions sent</h2></div>
            {dels.length ? <ul className="pc-sent">{dels.map((d) => {
              const [tone, label] = DST[d.status] || ['', cap(d.status)];
              return (
                <li key={d.id}>
                  <span className="pc-sent-n tnum">{edNo(d.number)}</span>
                  <div><b>{parse<any>(d.content, {}).title}</b><span>{CH[d.channel] || d.channel} · {fmtDate(d.sent_at || d.created_at)}</span></div>
                  <span className={`pill ${tone}`}>{label}</span>
                </li>
              );
            })}</ul> : <p className="hint">Nothing sent to this person yet.</p>}
          </section>

          <div className="pc-danger"><Confirm action={deleteContact.bind(null, id)} label="Delete contact" confirmLabel="Yes, delete" /></div>
        </div>
      </div>
    </div>
  );
}
