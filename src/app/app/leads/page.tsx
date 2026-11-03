import Link from 'next/link';
import { all } from '@/lib/db';
import { requireProduct } from '@/lib/context';
import { ago } from '@/lib/format';
import { HOT_SCORE } from '@/lib/tracking';
import { StagePill, Score, STAGE_LABEL } from '@/components/bits';
import { setStage } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Leads' };

const VIEWS = [['hot', 'Asked for contact'], ['warm', 'Warming up'], ['pipeline', 'In conversation'], ['all', 'Everyone engaged']] as const;
const ACT: Record<string, string> = { interested: 'I’m interested', book: 'Book 15 min', showcase: 'Our-work card', more: 'Send me more' };

export default async function Leads({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const p = await requireProduct();
  const view = (await searchParams).view || 'hot';
  let sql = "SELECT * FROM contacts WHERE product_id = ? AND status = 'active'";
  if (view === 'hot') sql += " AND last_intent IN ('interested','book','showcase') AND stage IN ('new','warm')";
  if (view === 'warm') sql += " AND score > 0 AND (last_intent IS NULL OR last_intent = 'more') AND stage IN ('new','warm')";
  if (view === 'pipeline') sql += " AND stage IN ('contacted','meeting')";
  if (view === 'all') sql += ' AND score > 0';
  sql += ' ORDER BY COALESCE(last_intent_at, last_engaged_at) DESC, score DESC LIMIT 300';
  const rows = all(sql, p.id);
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="ph">
        <div><div className="eyebrow">Turn reads into conversations</div><h1>Leads</h1><p className="sub">Everyone who engaged, ranked by intent. Scores add up per edition: open page +5, read 75% +5, poll +10, “send me more” +15, “Our work” card +30, book +40, interested +50, not now −10. {HOT_SCORE}+ is hot.</p></div>
        <a className="btn" href="/api/export?type=leads">Export leads CSV</a>
      </div>
      <div className="tabs">{VIEWS.map(([k, l]) => <Link key={k} href={`/app/leads?view=${k}`} aria-current={view === k ? 'page' : undefined}>{l}</Link>)}</div>
      {rows.length ? (
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>Person</th><th>Signal</th><th className="num">Score</th><th>Stage</th><th>Next step</th></tr></thead>
          <tbody>{rows.map((c) => {
            const wa = c.phone ? `https://wa.me/${String(c.phone).replace(/\D/g, '')}?text=${encodeURIComponent(`Hi ${c.first_name || ''}, `)}` : null;
            return (
              <tr key={c.id}>
                <td style={{ minWidth: 200 }}><Link href={`/app/contacts/${c.id}`}><b>{`${c.first_name} ${c.last_name}`.trim() || c.email}</b></Link><div className="hint">{[c.role, c.company, c.city].filter(Boolean).join(' · ')}</div></td>
                <td>{c.last_intent ? <span className="pill ok">{ACT[c.last_intent] || c.last_intent} · {ago(c.last_intent_at)}</span> : <span className="hint">Read {ago(c.last_engaged_at)}</span>}</td>
                <td className="num"><Score n={c.score} /></td>
                <td><StagePill stage={c.stage} /></td>
                <td><div className="row">
                  {wa && <a className="btn sm primary" href={wa} target="_blank" rel="noreferrer">WhatsApp</a>}
                  {c.email && <a className="btn sm" href={`mailto:${c.email}`}>Email</a>}
                  {c.stage !== 'contacted' && <form action={setStage.bind(null, c.id, 'contacted')}><button className="btn sm ghost">Mark contacted</button></form>}
                  {c.stage === 'contacted' && <form action={setStage.bind(null, c.id, 'meeting')}><button className="btn sm ghost">{STAGE_LABEL.meeting}</button></form>}
                </div></td>
              </tr>
            );
          })}</tbody>
        </table></div>
      ) : <div className="empty"><b>No one here yet</b><span>{view === 'hot' ? 'When someone taps “I’m interested”, “Book 15 min” or an Our-work card, they appear here and you get an alert.' : 'Engagement from sent editions shows up here.'}</span></div>}
    </div>
  );
}
