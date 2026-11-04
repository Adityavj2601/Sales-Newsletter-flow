import { EnsureProduct } from '@/components/EnsureProduct';
import { activeProduct } from '@/lib/context';
import { requireUser } from '@/lib/auth';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { all, get } from '@/lib/db';
import { getEdition } from '@/lib/editions';
import { getProduct, baseUrl, getSetting } from '@/lib/settings';
import { fmtDay, fmtTime, edNo } from '@/lib/format';
import { editionMetrics, pollResults, pct } from '@/lib/metrics';
import { StatusPill, Score } from '@/components/bits';
import { StatTile, editionTiles } from '@/components/StatTile';
import { Icon } from '@/components/people/Icon';
import { Avatar } from '@/components/people/Avatar';
import { Rel } from '@/components/people/Rel';
import { Popover } from '@/components/people/Popover';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Results' };

const ACT: Record<string, [string, string]> = {
  interested: ['Interested', 'ok'], book: ['Booked 15 min', 'ok'], showcase: ['Our-work card', 'ok'], more: ['Wants more', 'info'], share: ['Shared', 'info'],
  poll: ['Voted', ''], view: ['Opened', ''], open: ['Email open', ''], click: ['Clicked', ''], notnow: ['Not now', ''], unsubscribe: ['Unsubscribed', 'bad'], note: ['Left a note', 'info'], wa_reply: ['WhatsApp reply', 'info'], resubscribe: ['Resubscribed', ''],
};
const BTN: [string, string, string][] = [
  ['interested', 'I’m interested', 'ok'], ['book', 'Book 15 min', 'ok'], ['more', 'Send me more on this', 'accent'], ['share', 'Share', 'accent'], ['notnow', 'Not right now', 'gray'], ['unsubscribe', 'Unsubscribed', 'bad'],
];

/** The one horizontal bar used on this page: label + value row, 8px track. */
function Bar({ label, n, max, note, tone = 'accent', lead = false }: { label: string; n: number; max: number; note?: string; tone?: string; lead?: boolean }) {
  const w = max ? Math.min(100, (n / max) * 100) : 0;
  return (
    <div className={`rb ${lead ? 'is-lead' : ''}`}>
      <div className="rb-top"><span className="rb-l" title={label}>{label}</span><span className="rb-n">{note ? <small>{note}</small> : null}<span className="tnum">{n}</span></span></div>
      <div className="rb-track"><i className={`t-${tone}`} style={{ width: `${n ? Math.max(2, w) : 0}%` }} /></div>
    </div>
  );
}

export default async function Analytics({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const e = getEdition(id);
  if (!e) notFound();
  const p = getProduct(e.product_id)!;
  const tz = getSetting('general').timezone;
  const m = editionMetrics([id]);
  const { delivered, cta: ctaMap } = m;
  const show = m.showcase;
  const pollBlocks = e.content.blocks.filter((b) => b.type === 'poll') as any[];
  const people = all(`SELECT c.id, c.first_name, c.last_name, c.company, c.role, c.score, c.stage,
      GROUP_CONCAT(DISTINCT ev.type) AS acts, MAX(ev.created_at) AS last
    FROM events ev JOIN contacts c ON c.id = ev.contact_id WHERE ev.edition_id = ? AND ev.type NOT IN ('time')
    GROUP BY c.id ORDER BY (SUM(ev.type IN ('interested','book','showcase')) > 0) DESC, c.score DESC LIMIT 100`, id);
  const notes = all("SELECT ev.meta, ev.type, ev.created_at, c.first_name, c.last_name, c.id AS cid FROM events ev LEFT JOIN contacts c ON c.id = ev.contact_id WHERE ev.edition_id = ? AND ev.meta LIKE '%\"note\"%' ORDER BY ev.created_at DESC", id);
  const max = Math.max(1, ...Object.values(ctaMap), ...show.map((s) => s.n));
  const kbTitle = (v: string) => get('SELECT title FROM kb_items WHERE id = ?', v)?.title || (e.content.blocks.find((b) => b.id === v) as any)?.title || v;
  const noteText = (meta: string) => { try { return JSON.parse(meta).note; } catch { return ''; } };
  const isSent = e.status === 'sent';
  const link = `${baseUrl()}/e/${p.slug}/${e.slug}`;

  // The same four tiles as Home's “Last edition”; the funnel bars below reuse their numbers.
  const tiles = editionTiles(m);
  const funnel = tiles.map((t) => ({ k: t.label, n: t.value, tone: t.tone }));

  const __active = await activeProduct();
  return (
    <div className="res">
      <EnsureProduct productId={e.product_id} activeId={__active?.id || null} />
      <div className="ph">
        <div>
          <div className="crumbs"><Link href="/app/editions">Editions</Link> / <Link href={`/app/editions/${e.id}`}>{edNo(e.number)}</Link> / Results</div>
          <h1>{e.content.title}</h1>
          <p className="sub res-sub"><StatusPill status={e.status} /><span>{e.sent_at ? `Sent ${fmtDay(e.sent_at, tz)}, ${fmtTime(e.sent_at, tz)}` : 'Not sent yet. Tests and previews are never counted.'}</span></p>
        </div>
        <div className="row">
          <Popover className="pmenu" summary={<><Icon name="more" size={18} /><span className="pmenu-l">More</span></>}>
            {isSent
              ? <Link href={`/app/editions/${e.id}/distribute`}><Icon name="send" size={15} />Send to new contacts</Link>
              : <a href={`${link}?preview=1`} target="_blank" rel="noreferrer"><Icon name="eye" size={15} />Preview</a>}
            <a href={`/api/export?type=events&edition=${e.id}`}><Icon name="doc" size={15} />Export CSV</a>
          </Popover>
          {isSent
            ? <a className="btn" href={link} target="_blank" rel="noreferrer">Open page<Icon name="out" size={13} /></a>
            : <Link className="btn primary" href={`/app/editions/${e.id}/distribute`}><Icon name="send" size={15} />Go to Send</Link>}
        </div>
      </div>

      <section className="card" aria-labelledby="h-overview">
        <div className="card-head"><h2 id="h-overview">Overview</h2><span className="hint">Share of delivered · people with a personal link</span></div>
        <div className="grid4 res-tiles">
          {tiles.map(({ key, ...t }) => <StatTile key={key} {...t} />)}
        </div>
      </section>

      <section className="card" aria-labelledby="h-funnel">
        <div className="card-head"><h2 id="h-funnel">Reader funnel</h2><span className="hint">Each step as a share of delivered</span></div>
        <div className="rbs res-funnel">
          {funnel.map((f) => <Bar key={f.k} label={f.k} n={f.n} max={delivered} note={delivered ? `${pct(f.n, delivered)} of delivered` : undefined} tone={f.tone || 'accent'} />)}
        </div>
      </section>

      <div className="res-two">
        <section className="card" aria-labelledby="h-btn">
          <div className="card-head"><h2 id="h-btn">Buttons tapped</h2><span className="hint">Unique people per button</span></div>
          <div className="rbs">
            {BTN.map(([k, l, tone]) => <Bar key={k} label={l} n={ctaMap[k] || 0} max={max} tone={tone} />)}
            {show.map((s) => <Bar key={s.value} label={`Our work: ${kbTitle(s.value)}`} n={s.n} max={max} tone="ok" />)}
          </div>
        </section>
        <section className="card" aria-labelledby="h-poll">
          <div className="card-head"><h2 id="h-poll">Poll</h2>{pollBlocks.length > 0 && <span className="hint">Latest answer per person</span>}</div>
          {pollBlocks.length ? pollBlocks.map((b) => {
            const res = pollResults(id, b.id);
            const total = res.reduce((a, x) => a + x.n, 0);
            const best = Math.max(0, ...res.map((x) => x.n));
            return (
              <div key={b.id} className="res-poll">
                <p className="res-q">{b.question}</p>
                <div className="rbs">{b.options.map((o: string) => { const n = res.find((x) => x.value === o)?.n || 0; const lead = !!n && n === best; return <Bar key={o} label={o} n={n} max={Math.max(1, total)} note={total ? pct(n, total) : undefined} tone={lead ? 'accent' : 'gray'} lead={lead} />; })}</div>
                <div className="hint">{total} {total === 1 ? 'person' : 'people'} voted</div>
              </div>
            );
          }) : <div className="res-empty"><Icon name="poll" size={22} /><span>This edition has no poll.</span></div>}
        </section>
      </div>

      {notes.length > 0 && (
        <section className="card" aria-labelledby="h-notes">
          <div className="card-head"><h2 id="h-notes">Notes from readers</h2><span className="hint">{notes.length} {notes.length === 1 ? 'note' : 'notes'}</span></div>
          <ul className="res-notes">{notes.map((x, i) => {
            const nm = x.cid ? `${x.first_name} ${x.last_name}`.trim() : 'Anonymous';
            return (
              <li key={i}>
                <Avatar name={nm} size={34} />
                <div>
                  <div className="res-note-h">{x.cid ? <Link href={`/app/contacts/${x.cid}`}><b>{nm}</b></Link> : <b>{nm}</b>}<span className="hint">after “{ACT[x.type]?.[0] || x.type}” · <Rel iso={x.created_at} /></span></div>
                  <blockquote>{noteText(x.meta)}</blockquote>
                </div>
              </li>
            );
          })}</ul>
        </section>
      )}

      <section className="card" aria-labelledby="h-who">
        <div className="card-head"><h2 id="h-who">Who engaged</h2><Link className="more" href="/app/leads">All leads<Icon name="chev" size={13} /></Link></div>
        {people.length ? (
          <ul className="res-people">{people.map((r) => {
            const nm = `${r.first_name} ${r.last_name}`.trim();
            const acts = String(r.acts).split(',').filter((a) => a !== 'scroll');
            return (
              <li key={r.id}>
                <Link href={`/app/contacts/${r.id}`} className="res-person">
                  <Avatar name={nm} size={36} />
                  <span className="res-pn"><b>{nm}</b><span>{[r.role, r.company].filter(Boolean).join(', ') || '—'}</span></span>
                </Link>
                <div className="res-acts">{acts.map((a) => <span key={a} className={`pill ${ACT[a]?.[1] || ''}`}>{ACT[a]?.[0] || a}</span>)}</div>
                <span className="res-last hint"><Rel iso={r.last} /></span>
                <span className="res-score"><Score n={r.score} /></span>
              </li>
            );
          })}</ul>
        ) : <div className="res-empty"><Icon name="users" size={22} /><span>No tracked engagement yet. Readers who open their personal link appear here.</span></div>}
      </section>
    </div>
  );
}
