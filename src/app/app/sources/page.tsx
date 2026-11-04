import { all } from '@/lib/db';
import { requireProduct } from '@/lib/context';
import { ago, fmtDate } from '@/lib/format';
import { gnewsUrl } from '@/lib/ingest';
import { Confirm } from '@/components/ui';
import { Icon, Tile } from '@/components/content/icons';
import { SourceForm, SourceSwitch } from '@/components/content/sources';
import { addSource, toggleSource, deleteSource } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'News sources' };

export default async function Sources() {
  const p = await requireProduct();
  const rows = all('SELECT * FROM sources WHERE product_id IS NULL OR product_id = ? ORDER BY active DESC, kind, name', p.id);
  const active = rows.filter((r) => r.active).length;
  const failing = rows.filter((r) => r.active && r.last_error).length;
  const groups = [
    { kind: 'gnews', title: 'Google News searches', icon: 'search', tone: 'blue' },
    { kind: 'rss', title: 'RSS feeds', icon: 'rss', tone: 'orange' },
  ];
  return (
    <div className="stack so" style={{ gap: 22 }}>
      <div className="ph">
        <div><div className="eyebrow">Where stories come from</div><h1>News sources</h1><p className="sub">Google News searches (India edition, last 7 days) and RSS feeds. The “Fetch news” automation reads every active source each morning. Sources are shared by every product unless marked otherwise.</p></div>
        <div className="so-sum" aria-label="Source summary">
          <span><b>{active}</b> active</span>
          <span><b>{rows.length - active}</b> paused</span>
          <span className={failing ? 'bad' : ''}><b>{failing}</b> failing</span>
        </div>
      </div>

      <SourceForm action={addSource} productName={p.name} />

      {groups.map((g) => {
        const list = rows.filter((r) => r.kind === g.kind);
        if (!list.length) return null;
        return (
          <section key={g.kind} className="cx-group so-group">
            <h3 className="cx-group-h"><Tile icon={g.icon} tone={g.tone} size="sm" />{g.title}<span className="cx-group-n">{list.length}</span></h3>
            <ul className="cx-group-box so-list">
              {list.map((r) => {
                const state = !r.active ? 'off' : r.last_error ? 'bad' : r.last_fetched_at ? 'ok' : 'idle';
                const stateLabel = { off: 'Paused', bad: 'Last read failed', ok: 'Working', idle: 'Not read yet' }[state];
                const href = r.kind === 'gnews' ? gnewsUrl(r.url) : r.url;
                return (
                  <li key={r.id} className={`so-row ${state}`}>
                    <span className={`so-dot ${state}`} role="img" aria-label={stateLabel} title={stateLabel} />
                    <div className="so-main">
                      <div className="so-name"><b>{r.kind === 'gnews' ? String(r.name).replace(/^Google News:\s*/i, '') : r.name}</b>{r.product_id && <span className="pill info">Only {p.name}</span>}</div>
                      <a className="so-url" href={href} target="_blank" rel="noreferrer" title={r.url}>{r.url}</a>
                      <div className="so-stat">
                        {r.last_error
                          ? <span className="so-err" title={r.last_error}><Icon name="warn" size={13} />Failed {ago(r.last_fetched_at)}: {String(r.last_error).slice(0, 80)}</span>
                          : r.last_fetched_at
                            ? <span title={fmtDate(r.last_fetched_at, undefined, true)}>Read {ago(r.last_fetched_at)} · {r.last_count ?? 0} new</span>
                            : <span>Not read yet</span>}
                      </div>
                    </div>
                    <div className="so-ctl">
                      <SourceSwitch action={toggleSource.bind(null, r.id)} active={!!r.active} name={r.name} />
                      <Confirm action={deleteSource.bind(null, r.id)} label="Delete" confirmLabel={r.product_id ? 'Delete' : 'Delete for all'} className="btn sm ghost cx-danger-text" />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {!rows.length && <div className="empty cx-empty"><span className="cx-empty-i"><Icon name="rss" size={26} /></span><b>No sources yet</b><span>Add a Google News search or an RSS feed above. Stories start arriving on the next fetch.</span></div>}
    </div>
  );
}
