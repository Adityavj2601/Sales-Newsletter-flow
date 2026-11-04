import Link from 'next/link';
import { all, get } from '@/lib/db';
import { requireProduct } from '@/lib/context';
import { ago } from '@/lib/format';
import { HOT_SCORE } from '@/lib/tracking';
import { StagePill, STAGE_LABEL } from '@/components/bits';
import { Icon } from '@/components/people/Icon';
import { Avatar } from '@/components/people/Avatar';
import { StageAction } from '@/components/people/StageAction';
import { setStage } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Leads' };

const VIEWS = [['hot', 'Asked for contact'], ['warm', 'Warming up'], ['pipeline', 'In conversation'], ['all', 'Everyone engaged']] as const;
const ACT: Record<string, [string, string]> = { interested: ['I’m interested', 'flame'], book: ['Book 15 min', 'calendar'], showcase: ['Our-work card', 'spark'], more: ['Send me more', 'mail'] };
const WHERE: Record<string, string> = {
  hot: " AND last_intent IN ('interested','book','showcase') AND stage IN ('new','warm')",
  warm: " AND score > 0 AND (last_intent IS NULL OR last_intent = 'more') AND stage IN ('new','warm')",
  pipeline: " AND stage IN ('contacted','meeting')",
  all: ' AND score > 0',
};
const PIPE = ['new', 'warm', 'contacted', 'meeting', 'won'] as const;

export default async function Leads({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const p = await requireProduct();
  const view = (await searchParams).view || 'hot';
  const base = "SELECT * FROM contacts WHERE product_id = ? AND status = 'active'";
  const sql = base + (WHERE[view] || '') + ' ORDER BY COALESCE(last_intent_at, last_engaged_at) DESC, score DESC LIMIT 300';
  const rows = all(sql, p.id);
  const counts = Object.fromEntries(VIEWS.map(([k]) => [k, Number(get(`SELECT COUNT(*) AS n FROM contacts WHERE product_id = ? AND status = 'active'${WHERE[k]}`, p.id)?.n || 0)]));
  const stageN = Object.fromEntries(all("SELECT stage, COUNT(*) AS n FROM contacts WHERE product_id = ? AND status = 'active' AND (score > 0 OR stage <> 'new') GROUP BY stage", p.id).map((r) => [r.stage, Number(r.n)]));
  const pipeMax = Math.max(1, ...PIPE.map((k) => stageN[k] || 0));
  return (
    <div className="leads">
      <div className="ph">
        <div>
          <div className="eyebrow">Turn reads into conversations</div>
          <h1>Leads</h1>
          <p className="sub">Everyone who engaged, ranked by intent. Reply while it’s warm: interest fades within days.</p>
        </div>
        <div className="row">
          <details className="pop">
            <summary className="btn">How scoring works</summary>
            <div className="pop-body" role="note">
              <b>Scores add up per edition</b>
              <ul>
                <li><span>Email open</span><span>+1</span></li><li><span>Link click</span><span>+3</span></li><li><span>Open page</span><span>+5</span></li><li><span>Read 75%</span><span>+5</span></li>
                <li><span>Poll</span><span>+10</span></li><li><span>Share or “send me more”</span><span>+15</span></li><li><span>“Our work” card</span><span>+30</span></li><li><span>Book</span><span>+40</span></li>
                <li><span>Interested</span><span>+50</span></li><li><span>Not now</span><span>−10</span></li>
              </ul>
              <span className="hint">{HOT_SCORE}+ is hot.</span>
            </div>
          </details>
          <a className="btn" href="/api/export?type=leads">Export CSV</a>
        </div>
      </div>

      <div className="lp" aria-label="Pipeline">
        {PIPE.map((k, i) => (
          <Link key={k} href={k === 'contacted' || k === 'meeting' ? '/app/leads?view=pipeline' : k === 'won' ? '/app/leads?view=all' : '/app/leads?view=all'} className={`lp-s s-${k}`} style={{ ['--i' as any]: i }}>
            <span className="lp-k">{STAGE_LABEL[k]}</span>
            <span className="lp-v">{stageN[k] || 0}</span>
            <span className="lp-bar"><i style={{ width: `${((stageN[k] || 0) / pipeMax) * 100}%` }} /></span>
          </Link>
        ))}
      </div>

      <nav className="tabs lseg" aria-label="Lead views">
        {VIEWS.map(([k, l]) => <Link key={k} href={`/app/leads?view=${k}`} aria-current={view === k ? 'page' : undefined} scroll={false}>{l}<span className="lseg-n">{counts[k]}</span></Link>)}
      </nav>

      {rows.length ? (
        <div className="tbl-wrap ptbl-wrap">
          <table className="tbl ptbl ltbl">
            <thead><tr><th>Person</th><th>Signal</th><th>Score</th><th>Stage</th><th className="num">Next step</th></tr></thead>
            <tbody>{rows.map((c, i) => {
              const name = `${c.first_name} ${c.last_name}`.trim() || c.email;
              const wa = c.phone ? `https://wa.me/${String(c.phone).replace(/\D/g, '')}?text=${encodeURIComponent(`Hi ${c.first_name || ''}, `)}` : null;
              const act = c.last_intent ? ACT[c.last_intent] : null;
              const hot = c.score >= HOT_SCORE;
              return (
                <tr key={c.id} style={{ ['--i' as any]: Math.min(i, 12) }}>
                  <td className="ptd-who">
                    <Link href={`/app/contacts/${c.id}`} className="pwho">
                      <Avatar name={name} size={38} />
                      <span><b>{name}</b><span>{[c.role, c.company, c.city].filter(Boolean).join(' · ') || c.email}</span></span>
                    </Link>
                  </td>
                  <td className="ptd-sig">{c.last_intent
                    ? <span className={`lsig ${c.last_intent === 'more' ? 'info' : 'ok'}`}><Icon name={act?.[1] || 'spark'} size={13} stroke={2} />{act?.[0] || c.last_intent}<small>{ago(c.last_intent_at)}</small></span>
                    : <span className="lsig"><Icon name="eye" size={13} stroke={2} />Read<small>{ago(c.last_engaged_at)}</small></span>}</td>
                  <td className="ptd-score"><span className={`lscore ${hot ? 'hot' : c.score >= 15 ? 'warm' : ''}`} title="Lead score"><b>{c.score}</b><span className="lscore-bar"><i style={{ width: `${Math.min(100, (c.score / 100) * 100)}%` }} /></span></span></td>
                  <td className="ptd-stage"><StagePill stage={c.stage} /></td>
                  <td className="ptd-act"><div className="lact">
                    {wa && <a className="btn sm wa" href={wa} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${name}`}><Icon name="chat" size={14} stroke={2} /><span>WhatsApp</span></a>}
                    {c.email && <a className="btn sm" href={`mailto:${c.email}`} aria-label={`Email ${name}`}><Icon name="mail" size={14} stroke={2} /><span>Email</span></a>}
                    {(c.stage === 'new' || c.stage === 'warm') && <StageAction action={setStage.bind(null, c.id, 'contacted')} label="Mark contacted" done="Contacted" className="btn sm ghost" />}
                    {c.stage === 'contacted' && <StageAction action={setStage.bind(null, c.id, 'meeting')} label={STAGE_LABEL.meeting} done="Meeting booked" className="btn sm ghost" />}
                  </div></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      ) : (
        <div className="empty lempty">
          <span className="lempty-ic"><Icon name={view === 'hot' ? 'flame' : 'users'} size={24} /></span>
          <b>No one here yet</b>
          <span>{view === 'hot' ? 'When someone taps “I’m interested”, “Book 15 min” or an Our-work card, they appear here and you get an alert.' : 'Engagement from sent editions shows up here.'}</span>
        </div>
      )}
    </div>
  );
}
