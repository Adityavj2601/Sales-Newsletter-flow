import Link from 'next/link';
import { all } from '@/lib/db';
import { requireProduct } from '@/lib/context';
import { ago, fmtDate } from '@/lib/format';
import { Submit } from '@/components/ui';
import { fetchNewsNow, addStory, setStoryStatus, clearOldStories } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Story pool' };

const FILTERS = [['open', 'To review'], ['shortlisted', 'Shortlisted'], ['used', 'Used'], ['dismissed', 'Dismissed']] as const;

export default async function Stories({ searchParams }: { searchParams: Promise<{ f?: string; q?: string }> }) {
  const p = await requireProduct();
  const sp = await searchParams;
  const f = sp.f || 'open';
  const where = f === 'open' ? "status IN ('new','shortlisted')" : 'status = ?';
  const args = f === 'open' ? [] : [f];
  let rows = all(`SELECT * FROM stories WHERE product_id = ? AND ${where} ORDER BY (status = 'shortlisted') DESC, score DESC, created_at DESC LIMIT 150`, p.id, ...args);
  if (sp.q) rows = rows.filter((r) => `${r.title} ${r.publisher} ${r.summary}`.toLowerCase().includes(sp.q!.toLowerCase()));
  const last = all('SELECT MAX(last_fetched_at) AS t FROM sources')[0]?.t;
  const short = rows.filter((r) => r.status === 'shortlisted').length;
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="ph">
        <div><div className="eyebrow">Inputs for the next draft</div><h1>Story pool</h1><p className="sub">News from your sources, scored for relevance to {p.name}’s readers. Shortlist 3–6 stories; the draft uses shortlisted stories first. Last fetched {ago(last)}.</p></div>
        <div className="row">
          <form action={fetchNewsNow}><Submit pending="Fetching… (up to a minute)">Fetch news now</Submit></form>
          <Link className="btn" href="/app/editions?new=1">Draft from shortlist{short ? ` (${short})` : ''}</Link>
        </div>
      </div>
      <form action={addStory} className="card tight row">
        <input className="in" style={{ flex: 1, minWidth: 240 }} type="url" name="url" required placeholder="Paste any article URL to add it to your shortlist" />
        <Submit className="btn" pending="Reading…">Add story</Submit>
      </form>
      <div className="row">
        <div className="tabs" style={{ marginBottom: 0, flex: 1 }}>{FILTERS.map(([k, l]) => <Link key={k} href={`/app/stories?f=${k}`} aria-current={f === k ? 'page' : undefined}>{l}</Link>)}</div>
        <form className="row"><input type="hidden" name="f" value={f} /><input className="in" name="q" defaultValue={sp.q} placeholder="Search" style={{ width: 200 }} /></form>
      </div>
      {rows.length ? (
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th className="num">Score</th><th>Story</th><th>Published</th><th></th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id}>
              <td className="num"><span className={`pill ${r.score >= 70 ? 'ok' : r.score >= 45 ? 'warn' : ''}`} title={r.score_reason || ''}>{r.score ?? '–'}</span></td>
              <td style={{ minWidth: 300 }}><a href={r.url} target="_blank" rel="noreferrer"><b>{r.title}</b></a><div className="hint">{r.publisher}{r.score_reason ? ` · ${r.score_reason}` : ''}{r.content ? ' · full text stored' : ''}</div>{r.summary && <div className="hint" style={{ marginTop: 4 }}>{String(r.summary).slice(0, 220)}</div>}</td>
              <td className="hint" style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.published_at || r.created_at)}</td>
              <td><div className="row end">
                {r.status !== 'shortlisted' && r.status !== 'used' && <form action={setStoryStatus.bind(null, r.id, 'shortlisted')}><button className="btn sm primary">Shortlist</button></form>}
                {r.status === 'shortlisted' && <form action={setStoryStatus.bind(null, r.id, 'new')}><button className="btn sm">Unshortlist</button></form>}
                {r.status !== 'dismissed' && r.status !== 'used' && <form action={setStoryStatus.bind(null, r.id, 'dismissed')}><button className="btn sm ghost">Dismiss</button></form>}
                {(r.status === 'dismissed' || r.status === 'used') && <form action={setStoryStatus.bind(null, r.id, 'new')}><button className="btn sm">Restore</button></form>}
              </div></td>
            </tr>
          ))}</tbody>
        </table></div>
      ) : (
        <div className="empty"><b>{f === 'open' ? 'No stories yet' : 'Nothing here'}</b><span>{f === 'open' ? 'Fetch news from your sources, or paste an article URL above.' : 'Try another filter.'}</span></div>
      )}
      <form action={clearOldStories} className="row end"><button className="btn sm ghost">Clean up stories older than 30 days</button></form>
    </div>
  );
}
