import Link from 'next/link';
import { all } from '@/lib/db';
import { requireProduct } from '@/lib/context';
import { HOT_SCORE } from '@/lib/tracking';
import { StagePill, STAGE_LABEL } from '@/components/bits';
import { Icon } from '@/components/people/Icon';
import { Avatar } from '@/components/people/Avatar';
import { StageAction } from '@/components/people/StageAction';
import { Rel } from '@/components/people/Rel';
import { Popover } from '@/components/people/Popover';
import { setStage } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Leads' };

const ACT: Record<string, [string, string]> = { interested: ['I’m interested', 'flame'], book: ['Book 15 min', 'calendar'], showcase: ['Our-work card', 'spark'], more: ['Send me more', 'mail'] };
/** The stage tiles are the only filter. "All" is everyone who engaged; the rest are pipeline stages, ending in Won or Lost. */
const TILES = ['all', 'new', 'warm', 'contacted', 'meeting', 'won', 'lost'] as const;
/** The older "Not interested" stage is counted and listed as Lost. */
const STAGE_SQL: Partial<Record<Tile, string>> = { lost: "stage IN ('lost','not_interested')" };
const SHORT: Partial<Record<Tile, string>> = { meeting: 'Meeting' };
type Tile = (typeof TILES)[number];
/** Older links (alerts, nudges) used ?view=…; map them onto the stages. */
const LEGACY: Record<string, Tile> = { hot: 'all', all: 'all', warm: 'warm', pipeline: 'contacted' };
const EMPTY: Record<Tile, string> = {
  all: 'When someone opens an edition or taps “I’m interested”, “Book 15 min” or an Our-work card, they appear here, and intent taps send you an alert.',
  new: 'Readers who engaged but haven’t tapped anything yet show up here.',
  warm: 'Readers move here the moment they tap a button in an edition.',
  contacted: 'After you reply to a lead, tap “Mark contacted” and they move here.',
  meeting: 'Leads you’ve booked a meeting with show up here.',
  won: 'Mark a lead as won on their contact page.',
  lost: 'Leads who said no or went quiet. Mark them Lost on their contact page to keep the pipeline honest.',
};

export default async function Leads({ searchParams }: { searchParams: Promise<{ stage?: string; view?: string }> }) {
  const p = await requireProduct();
  const sp = await searchParams;
  const stage: Tile = (TILES as readonly string[]).includes(sp.stage || '') ? (sp.stage as Tile) : LEGACY[sp.view || ''] || 'all';
  const engaged = "SELECT * FROM contacts WHERE product_id = ? AND status = 'active' AND (score > 0 OR stage <> 'new')";
  const rows = stage === 'all'
    ? all(`${engaged} ORDER BY COALESCE(last_intent_at, last_engaged_at) DESC, score DESC LIMIT 300`, p.id)
    : STAGE_SQL[stage] ? all(`${engaged} AND ${STAGE_SQL[stage]} ORDER BY COALESCE(last_intent_at, last_engaged_at) DESC, score DESC LIMIT 300`, p.id)
    : all(`${engaged} AND stage = ? ORDER BY COALESCE(last_intent_at, last_engaged_at) DESC, score DESC LIMIT 300`, p.id, stage);
  const stageN: Record<string, number> = Object.fromEntries(all("SELECT stage, COUNT(*) AS n FROM contacts WHERE product_id = ? AND status = 'active' AND (score > 0 OR stage <> 'new') GROUP BY stage", p.id).map((r) => [r.stage, Number(r.n)]));
  const n = (k: Tile) => (k === 'all' ? Object.values(stageN).reduce((a, b) => a + b, 0) : k === 'lost' ? (stageN.lost || 0) + (stageN.not_interested || 0) : stageN[k] || 0);
  return (
    <div className="leads">
      <div className="ph">
        <div>
          <span className="eyebrow">{p.name}<span className="sep" aria-hidden>·</span>{p.newsletter_name}</span>
          <h1>Leads</h1>
          <p className="sub">Everyone who engaged, latest intent first. Reply the same day; interest fades fast.</p>
        </div>
        <div className="row">
          <Popover summary={<><Icon name="spark" size={15} />How scoring works</>}>
              <b>Every reader earns points per edition</b>
              <ul>
                <li><span>Email open</span><span>+1</span></li><li><span>Link click</span><span>+3</span></li><li><span>Open page</span><span>+5</span></li><li><span>Read 75%</span><span>+5</span></li>
                <li><span>Poll</span><span>+10</span></li><li><span>Share or “send me more”</span><span>+15</span></li><li><span>“Our work” card</span><span>+30</span></li><li><span>Book</span><span>+40</span></li>
                <li><span>Interested</span><span>+50</span></li><li><span>Not now</span><span>−10</span></li>
              </ul>
              <span className="hint">The score ranks people; the stage is where they are with you. A tap on Interested, Book or an Our-work card moves a New reader to Warm and sends you an alert.</span>
          </Popover>
          <a className="btn" href="/api/export?type=leads">Export CSV</a>
        </div>
      </div>

      <nav className="lp" aria-label="Filter by stage">
        {TILES.map((k) => (
          <Link key={k} href={k === 'all' ? '/app/leads' : `/app/leads?stage=${k}`} className={`lp-s s-${k}${n(k) ? '' : ' is-zero'}`} aria-current={stage === k ? 'page' : undefined} scroll={false}>
            <span className="lp-k">{k === 'all' ? 'All' : SHORT[k] ? <><span className="lp-long">{STAGE_LABEL[k]}</span><span className="lp-short">{SHORT[k]}</span></> : STAGE_LABEL[k]}</span>
            <span className="lp-v">{n(k)}</span>
          </Link>
        ))}
      </nav>

      {rows.length ? (
        <div className="tbl-wrap ptbl-wrap">
          <table className="tbl ptbl ltbl">
            <thead><tr><th>Person</th><th>Signal</th><th>Score</th><th>Stage</th><th className="num">Next step</th></tr></thead>
            <tbody>{rows.map((c) => {
              const name = `${c.first_name} ${c.last_name}`.trim() || c.email;
              const wa = c.phone ? `https://wa.me/${String(c.phone).replace(/\D/g, '')}?text=${encodeURIComponent(`Hi ${c.first_name || ''}, `)}` : null;
              const act = c.last_intent ? ACT[c.last_intent] : null;
              const top = c.score >= HOT_SCORE;
              return (
                <tr key={c.id}>
                  <td className="ptd-who">
                    <Link href={`/app/contacts/${c.id}`} className="pwho">
                      <Avatar name={name} size={38} />
                      <span><b>{name}</b><span>{[c.role, c.company, c.city].filter(Boolean).join(' · ') || c.email}</span></span>
                    </Link>
                  </td>
                  <td className="ptd-sig">{c.last_intent
                    ? <span className={`lsig ${c.last_intent === 'more' ? 'info' : 'ok'}`}><Icon name={act?.[1] || 'spark'} size={13} />{act?.[0] || c.last_intent}<small><Rel iso={c.last_intent_at} /></small></span>
                    : <span className="lsig"><Icon name="eye" size={13} />Read<small><Rel iso={c.last_engaged_at} /></small></span>}</td>
                  <td className="ptd-score"><span className={`lscore ${top ? 'hot' : c.score >= 15 ? 'warm' : ''}`} title={`Lead score ${c.score}`}><b>{c.score}</b><span className="lscore-bar"><i style={{ width: `${Math.min(100, c.score)}%` }} /></span></span></td>
                  <td className="ptd-stage"><StagePill stage={c.stage} /></td>
                  <td className="ptd-act"><div className="lact">
                    {wa && <a className="btn sm l-wa" href={wa} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${name}`}><Icon name="chat" size={14} /><span>WhatsApp</span></a>}
                    {c.email && <a className="btn sm" href={`mailto:${c.email}`} aria-label={`Email ${name}`}><Icon name="mail" size={14} /><span>Email</span></a>}
                    {(c.stage === 'new' || c.stage === 'warm') && <StageAction action={setStage.bind(null, c.id, 'contacted')} label={<><Icon name="check" size={14} />Mark contacted</>} done="Contacted" className="btn sm" />}
                    {c.stage === 'contacted' && <StageAction action={setStage.bind(null, c.id, 'meeting')} label={<><Icon name="calendar" size={14} />Mark meeting</>} done="Meeting booked" className="btn sm" />}
                  </div></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      ) : (
        <div className="empty lempty">
          <span className="lempty-ic"><Icon name={stage === 'all' || stage === 'warm' ? 'flame' : 'users'} size={24} /></span>
          <b>{stage === 'all' ? 'No leads yet' : `No one in ${STAGE_LABEL[stage]}`}</b>
          <span>{EMPTY[stage]}</span>
          {stage !== 'all' && n('all') > 0 && <Link className="btn" href="/app/leads" scroll={false}>Show everyone</Link>}
        </div>
      )}
    </div>
  );
}
