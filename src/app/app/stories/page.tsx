import Link from 'next/link';
import { all, get } from '@/lib/db';
import { requireProduct } from '@/lib/context';
import { ago, fmtDate } from '@/lib/format';
import { Submit } from '@/components/ui';
import { Icon } from '@/components/content/icons';
import { Ago } from '@/components/shell/Motion';
import { StarButton, RowAction } from '@/components/content/stories';
import { fetchNewsNow, addStory, setStoryStatus, clearOldStories } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Story pool' };

const FILTERS = [['open', 'To review'], ['shortlisted', 'Shortlisted'], ['used', 'Used'], ['dismissed', 'Dismissed']] as const;
const GOAL = 6;

function ScoreRing({ n, reason }: { n: number | null; reason?: string | null }) {
  const R = 15, C = +(2 * Math.PI * R).toFixed(2);
  const v = typeof n === 'number' ? Math.max(0, Math.min(100, n)) : null;
  const tone = v == null ? 'none' : v >= 70 ? 'hi' : v >= 45 ? 'mid' : 'lo';
  const off = v == null ? C : +(C * (1 - v / 100)).toFixed(2);
  const label = v == null ? 'Not scored yet' : `Relevance ${v} out of 100${reason ? `: ${reason}` : ''}`;
  return (
    <span className={`st-ring ${tone}`} title={label} role="img" aria-label={label}>
      <svg viewBox="0 0 36 36" aria-hidden>
        <circle className="trk" cx="18" cy="18" r={R} />
        <circle className="val" cx="18" cy="18" r={R} strokeDasharray={C} strokeDashoffset={off} transform="rotate(-90 18 18)" />
      </svg>
      <b>{v ?? '–'}</b>
    </span>
  );
}

const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
/** One naming rule for where a story came from: the publisher’s own name, a bare domain when that is all we have. */
function pubName(publisher: string | null, url: string) {
  let p = String(publisher || '').replace(/^Google News:\s*/i, '').trim() || host(url) || 'Unknown source';
  if (/^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(p)) return p.replace(/^www\./i, '').toLowerCase();
  if (p === p.toLowerCase()) p = p.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
  return p;
}

export default async function Stories({ searchParams }: { searchParams: Promise<{ f?: string; q?: string }> }) {
  const p = await requireProduct();
  const sp = await searchParams;
  const f = FILTERS.some(([k]) => k === sp.f) ? sp.f! : 'open';
  const q = (sp.q || '').trim();
  const where = f === 'open' ? "status IN ('new','shortlisted')" : 'status = ?';
  const args = f === 'open' ? [] : [f];
  // Sorted by relevance only, so a row never jumps away from under your finger when you star it.
  let rows = all(`SELECT * FROM stories WHERE product_id = ? AND ${where} ORDER BY score DESC, created_at DESC LIMIT 150`, p.id, ...args);
  if (q) rows = rows.filter((r) => `${r.title} ${r.publisher} ${r.summary}`.toLowerCase().includes(q.toLowerCase()));
  const byStatus: Record<string, number> = Object.fromEntries(all('SELECT status, COUNT(*) AS n FROM stories WHERE product_id = ? GROUP BY status', p.id).map((r) => [r.status, Number(r.n)]));
  const count = (k: string) => (k === 'open' ? (byStatus.new || 0) + (byStatus.shortlisted || 0) : byStatus[k] || 0);
  const src = get('SELECT MAX(last_fetched_at) AS t, COUNT(*) AS n, SUM(active) AS a FROM sources WHERE product_id IS NULL OR product_id = ?', p.id) || {};
  const nSrc = Number(src.a || 0);
  const short = byStatus.shortlisted || 0;
  const pool = count('open');
  const hint = short === 0 ? (pool ? 'Star at least one to unlock drafting; 3–6 is ideal' : 'Fetch news, then star the ones worth writing about') : short < 3 ? `Star ${3 - short} more for a full draft` : short <= GOAL ? 'Ready to draft' : 'Plenty. The draft uses the best six';
  const emptyPool = f === 'open' && !q && pool === 0;
  const qs = (k: string) => `/app/stories?f=${k}${q ? `&q=${encodeURIComponent(q)}` : ''}`;

  return (
    <div className="pg st">
      <div className="ph">
        <div>
          <span className="eyebrow">{p.name}<span className="sep" aria-hidden>·</span>{p.newsletter_name}</span>
          <h1>Story pool</h1>
          <p className="sub">News from your sources, scored for how much {p.name}’s readers will care. Star the ones worth writing about; the draft uses your shortlist first.</p>
        </div>
        {/* An empty pool has one action, in the empty state below; the header stays quiet until there is something to draft from. */}
        {!emptyPool && (
          <div className="row">
            <form action={fetchNewsNow}><Submit className="btn" pending="Fetching…"><Icon name="refresh" size={16} />Fetch news now</Submit></form>
            {short > 0
              ? <Link className="btn primary" href="/app/editions?new=1"><Icon name="sparkles" size={16} />Draft from shortlist <span className="tnum">({short})</span></Link>
              : <span className="btn" role="link" aria-disabled="true" aria-describedby="st-why" title="Shortlist at least one story first"><Icon name="sparkles" size={16} />Draft from shortlist</span>}
          </div>
        )}
      </div>

      <div className="st-status">
        <div className={`st-meter ${short >= 3 ? 'ready' : ''}`}>
          {short > 0
            ? <span className="st-pips" role="img" aria-label={`${Math.min(short, GOAL)} of ${GOAL} shortlisted`}>{Array.from({ length: GOAL }, (_, i) => <i key={i} className={i < short ? 'on' : ''} />)}</span>
            : <Icon name="star" size={16} className="cx-ic st-star-ic" />}
          <span id="st-why"><b className="tnum">{short ? `${short} shortlisted` : 'Nothing shortlisted yet'}</b><span className="st-dim"> · {hint}</span></span>
        </div>
        <span className="st-src">
          <Icon name="clock" size={15} />
          {src.t ? <span>Fetched <Ago iso={src.t} title={fmtDate(src.t, undefined, true)} /></span> : <span>Never fetched</span>}
          <span aria-hidden>·</span><span className="tnum">{nSrc} source{nSrc === 1 ? '' : 's'}</span>
          <span aria-hidden>·</span><Link href="/app/sources">Manage</Link>
        </span>
      </div>

      <form action={addStory} className="st-add">
        <Icon name="link" size={18} />
        <input className="in" aria-label="Article URL" type="url" name="url" required placeholder="Paste an article link" />
        <Submit className={`btn${emptyPool ? '' : ' primary'}`} pending="Reading…">Add story</Submit>
      </form>

      <div className="st-tools">
        <nav className="tabs st-filter" aria-label="Filter stories">
          {FILTERS.map(([k, l]) => <Link key={k} href={qs(k)} aria-current={f === k ? 'page' : undefined} scroll={false}>{l}<span className="n tnum">{count(k)}</span></Link>)}
        </nav>
        <form className="cx-search" role="search">
          <Icon name="search" size={15} />
          <input type="hidden" name="f" value={f} />
          <input type="search" name="q" aria-label="Search stories" defaultValue={q} placeholder="Search stories" />
          {q && <Link href={`/app/stories?f=${f}`} className="cx-search-x" aria-label="Clear search" scroll={false}><Icon name="x" size={12} strokeWidth={2.4} /></Link>}
        </form>
      </div>

      {rows.length ? (
        <div className="st-list-wrap">
          <table className="tbl st-list">
            <thead><tr><th>Relevance</th><th>Story</th><th>Actions</th></tr></thead>
            <tbody>{rows.map((r) => {
              const isShort = r.status === 'shortlisted';
              const when = r.published_at || r.created_at;
              return (
                <tr key={r.id} className={isShort ? 'is-short' : ''}>
                  <td className="st-score"><ScoreRing n={r.score} reason={r.score_reason} /></td>
                  <td className="st-main">
                    <div className="st-meta">
                      <span className="st-pub">{pubName(r.publisher, r.url)}</span>
                      <span aria-hidden>·</span>
                      <time dateTime={when} title={fmtDate(when, undefined, true)} className="tnum">{ago(when)}</time>
                      {r.content && <span className="st-tag" title="Full article text stored for the AI"><Icon name="doc" size={12} />Full text</span>}
                    </div>
                    <a className="st-title" href={r.url} target="_blank" rel="noreferrer"><b>{r.title}</b><Icon name="arrowUpRight" size={14} /></a>
                    {r.summary && <p className="st-sum">{String(r.summary).slice(0, 260)}</p>}
                    {r.score_reason && <p className="st-why"><Icon name="sparkles" size={13} />{r.score_reason}</p>}
                  </td>
                  <td className="st-acts">
                    <div className="st-acts-in">
                      {r.status !== 'used' && r.status !== 'dismissed' && (
                        <StarButton on={isShort} title={r.title} leaveWhenOff={f === 'shortlisted'}
                          onAction={setStoryStatus.bind(null, r.id, 'shortlisted')} offAction={setStoryStatus.bind(null, r.id, 'new')} />
                      )}
                      {r.status !== 'dismissed' && r.status !== 'used' && <RowAction action={setStoryStatus.bind(null, r.id, 'dismissed')} label="Dismiss" icon="x" title={r.title} />}
                      {(r.status === 'dismissed' || r.status === 'used') && <RowAction action={setStoryStatus.bind(null, r.id, 'new')} label="Restore" icon="refresh" title={r.title} className="st-act restore" />}
                    </div>
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      ) : (
        <div className="empty cx-empty">
          <span className="cx-empty-i"><Icon name={q ? 'search' : 'newspaper'} size={26} /></span>
          <b>{q ? `Nothing matches “${q}”` : f === 'open' ? 'Your pool is empty' : f === 'shortlisted' ? 'No stories shortlisted yet' : 'Nothing here'}</b>
          <span>{q ? 'Try a shorter search, or another filter.' : f === 'open' ? `Fetch news from your ${nSrc} source${nSrc === 1 ? '' : 's'}, or paste an article link above.` : f === 'shortlisted' ? 'Star stories in “To review” and they’ll gather here.' : 'Try another filter.'}</span>
          {f === 'open' && !q && <form action={fetchNewsNow}><Submit className="btn primary" pending="Fetching…"><Icon name="refresh" size={16} />Fetch news now</Submit></form>}
        </div>
      )}

      <form action={clearOldStories} className="st-foot"><button className="btn sm ghost"><Icon name="trash" size={14} />Clean up stories older than 30 days</button></form>
    </div>
  );
}
