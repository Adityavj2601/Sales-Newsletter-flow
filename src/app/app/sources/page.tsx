import { all } from '@/lib/db';
import { requireProduct } from '@/lib/context';
import { fmtDate } from '@/lib/format';
import { gnewsUrl } from '@/lib/ingest';
import { Icon } from '@/components/content/icons';
import { Ago } from '@/components/shell/Motion';
import { SourceForm, SourceSwitch, SourceMenu } from '@/components/content/sources';
import { addSource, toggleSource, deleteSource } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'News sources' };

/** A Google News query as readable tokens: “exact phrases” and word runs become chips, OR and exclusions read as words. */
function QueryChips({ q }: { q: string }) {
  const parts = String(q).match(/-?"[^"]*"|-?“[^”]*”|\S+/g) || [];
  const out: React.ReactNode[] = [];
  let run: string[] = [];
  const flush = () => { if (run.length) out.push(<span key={out.length} className="so-tok">{run.join(' ')}</span>); run = []; };
  for (const t of parts) {
    if (t === 'OR' || t === '|') { flush(); out.push(<span key={out.length} className="so-op">or</span>); continue; }
    const neg = t.startsWith('-') && t.length > 1;
    const body = neg ? t.slice(1) : t;
    const quoted = /^["“].*["”]$/.test(body);
    if (!neg && !quoted) { run.push(body); continue; }
    flush();
    const txt = quoted ? `“${body.slice(1, -1)}”` : body;
    out.push(<span key={out.length} className={`so-tok${neg ? ' not' : ''}`}>{neg && <span className="sr">not </span>}{txt}</span>);
  }
  flush();
  return <span className="so-q-chips" aria-label={`Search: ${q}`}>{out}</span>;
}

const feedLabel = (u: string) => { try { const x = new URL(u); return (x.hostname.replace(/^www\./, '') + x.pathname.replace(/\/$/, '')).slice(0, 80); } catch { return u; } };
const niceName = (n: string) => { const s = String(n || '').replace(/^Google News:\s*/i, '').trim(); return s.replace(/^\p{Ll}/u, (c) => c.toUpperCase()); };

export default async function Sources() {
  const p = await requireProduct();
  const rows = all('SELECT * FROM sources WHERE product_id IS NULL OR product_id = ? ORDER BY active DESC, kind, name', p.id);
  const active = rows.filter((r) => r.active).length;
  const failing = rows.filter((r) => r.active && r.last_error).length;
  const groups = [
    { kind: 'gnews', title: 'Google News searches' },
    { kind: 'rss', title: 'RSS feeds' },
  ];
  return (
    <div className="pg so">
      <div className="ph">
        <div><span className="eyebrow">{p.name}<span className="sep" aria-hidden>·</span>{p.newsletter_name}</span><h1>News sources</h1><p className="sub">{rows.length > 0 && <>{active} active{rows.length - active ? `, ${rows.length - active} paused` : ''}{failing ? <>, <span className="so-failing">{failing} failing</span></> : ''}. </>}Google News searches (India edition, last 7 days) and RSS feeds. The “Fetch news” automation reads every active source each morning. Sources are shared by every product unless marked otherwise.</p></div>
      </div>

      <SourceForm action={addSource} productName={p.name} />

      {groups.map((g) => {
        const list = rows.filter((r) => r.kind === g.kind);
        if (!list.length) return null;
        return (
          <section key={g.kind} className="cx-group so-group">
            <h2 className="group-title">{g.title}<span className="cx-group-n">{list.length}</span></h2>
            <ul className="cx-group-box so-list">
              {list.map((r) => {
                const state = !r.active ? 'off' : r.last_error ? 'bad' : r.last_fetched_at ? 'ok' : 'idle';
                const stateLabel = { off: 'Paused', bad: 'Last read failed', ok: 'Working', idle: 'Not read yet' }[state];
                const href = r.kind === 'gnews' ? gnewsUrl(r.url) : r.url;
                const name = niceName(r.name);
                return (
                  <li key={r.id} className={`so-row ${state}`}>
                    <span className={`so-dot ${state}`} role="img" aria-label={stateLabel} title={stateLabel} />
                    <div className="so-main">
                      <div className="so-name"><b>{name}</b>{r.product_id && <span className="pill info">Only {p.name}</span>}</div>
                      <div className="so-url" title={r.url}>{r.kind === 'gnews' ? <QueryChips q={r.url} /> : <span className="so-feed">{feedLabel(r.url)}</span>}</div>
                      <div className="so-stat">
                        {r.last_error
                          ? <span className="so-err" title={r.last_error}><Icon name="warn" size={13} />Failed <Ago iso={r.last_fetched_at} />: {String(r.last_error).slice(0, 80)}</span>
                          : r.last_fetched_at
                            ? <span title={fmtDate(r.last_fetched_at, undefined, true)}>Read <Ago iso={r.last_fetched_at} /> · <span className="tnum">{r.last_count ?? 0}</span> new</span>
                            : <span>Not read yet</span>}
                      </div>
                    </div>
                    <div className="so-ctl">
                      <SourceSwitch action={toggleSource.bind(null, r.id)} active={!!r.active} name={name} />
                      <SourceMenu name={name} href={href} shared={!r.product_id} del={deleteSource.bind(null, r.id)} />
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
