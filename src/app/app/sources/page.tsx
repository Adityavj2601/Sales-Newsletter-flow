import { all } from '@/lib/db';
import { requireProduct } from '@/lib/context';
import { ago } from '@/lib/format';
import { gnewsUrl } from '@/lib/ingest';
import { Submit, Confirm } from '@/components/ui';
import { addSource, toggleSource, deleteSource } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'News sources' };

export default async function Sources() {
  const p = await requireProduct();
  const rows = all('SELECT * FROM sources WHERE product_id IS NULL OR product_id = ? ORDER BY active DESC, kind, name', p.id);
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="ph"><div><div className="eyebrow">Where stories come from</div><h1>News sources</h1><p className="sub">Google News searches (India edition, last 7 days) and RSS feeds. The “Fetch news” automation reads them every morning. Shared sources feed every product.</p></div></div>
      <form action={addSource} className="card">
        <h2>Add a source</h2>
        <div className="form-grid" style={{ marginTop: 10 }}>
          <label className="f"><span>Type</span><select className="in" name="kind"><option value="gnews">Google News search</option><option value="rss">RSS / Atom feed URL</option></select></label>
          <label className="f"><span>Use for</span><select className="in" name="scope"><option value="product">Only {p.name}</option><option value="all">All products</option></select></label>
          <label className="f full"><span>Search words or feed URL</span><input className="in" name="url" required placeholder={'e.g.  "channel partner" real estate India   or   https://example.com/feed'} /></label>
          <label className="f full"><span>Name (optional)</span><input className="in" name="name" placeholder="e.g. Google News: channel partners" /></label>
        </div>
        <div className="row" style={{ marginTop: 12 }}><Submit>Add source</Submit><span className="hint">Search tips: use quotes for phrases, OR between alternatives, and a minus sign to exclude words.</span></div>
      </form>
      <div className="tbl-wrap"><table className="tbl">
        <thead><tr><th>Source</th><th>Scope</th><th>Last read</th><th>Result</th><th></th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.id} style={{ opacity: r.active ? 1 : 0.55 }}>
            <td style={{ minWidth: 260 }}><b>{r.name}</b><div className="hint clip">{r.kind === 'gnews' ? <a href={gnewsUrl(r.url)} target="_blank" rel="noreferrer">{r.url}</a> : <a href={r.url} target="_blank" rel="noreferrer">{r.url}</a>}</div></td>
            <td>{r.product_id ? p.name : 'All products'}</td>
            <td className="hint">{ago(r.last_fetched_at)}</td>
            <td>{r.last_error ? <span className="pill bad" title={r.last_error}>Failed: {String(r.last_error).slice(0, 40)}</span> : r.last_fetched_at ? <span className="pill ok">{r.last_count ?? 0} new</span> : <span className="hint">not read yet</span>}</td>
            <td><div className="row end"><form action={toggleSource.bind(null, r.id)}><button className="btn sm">{r.active ? 'Pause' : 'Resume'}</button></form><Confirm action={deleteSource.bind(null, r.id)} label="Delete" confirmLabel={r.product_id ? 'Yes, delete' : 'Delete for all products'} className="btn sm ghost" /></div></td>
          </tr>
        ))}</tbody>
      </table></div>
    </div>
  );
}
