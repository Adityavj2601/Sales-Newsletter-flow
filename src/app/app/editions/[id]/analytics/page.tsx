import { requireUser } from '@/lib/auth';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { all, get } from '@/lib/db';
import { getEdition } from '@/lib/editions';
import { getProduct, baseUrl } from '@/lib/settings';
import { CTA_LABELS } from '@/lib/types';
import { fmtDate, ago } from '@/lib/format';
import { editionMetrics, pollResults, pct } from '@/lib/metrics';
import { StatusPill, Score } from '@/components/bits';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Results' };

function Bar({ label, n, max, total }: { label: string; n: number; max: number; total?: number }) {
  return <div className="hbar"><span className="clip" style={{ maxWidth: 150 }} title={label}>{label}</span><div className="track"><div className="fill" style={{ width: `${max ? Math.max(2, (n / max) * 100) : 0}%` }} /></div><span className="n">{n}{total ? ` · ${pct(n, total)}` : ''}</span></div>;
}

export default async function Analytics({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const e = getEdition(id);
  if (!e) notFound();
  const p = getProduct(e.product_id)!;
  const m = editionMetrics([id]);
  const { delivered, failed, opens, halfway: s50, finished: s100, avgTime, cta: ctaMap } = m;
  const viewers = m.readers;
  const anon = m.anonViews;
  const byChannel = Object.entries(m.byChannel).map(([channel, n]) => ({ channel, n }));
  const intents = m.intentPeople;
  const show = m.showcase;
  const pollBlocks = e.content.blocks.filter((b) => b.type === 'poll') as any[];
  const people = all(`SELECT c.id, c.first_name, c.last_name, c.company, c.role, c.score, c.stage,
      GROUP_CONCAT(DISTINCT ev.type) AS acts, MAX(ev.created_at) AS last
    FROM events ev JOIN contacts c ON c.id = ev.contact_id WHERE ev.edition_id = ? AND ev.type NOT IN ('time')
    GROUP BY c.id ORDER BY (SUM(ev.type IN ('interested','book','showcase')) > 0) DESC, c.score DESC LIMIT 100`, id);
  const notes = all("SELECT ev.meta, ev.type, ev.created_at, c.first_name, c.last_name, c.id AS cid FROM events ev LEFT JOIN contacts c ON c.id = ev.contact_id WHERE ev.edition_id = ? AND ev.meta LIKE '%\"note\"%' ORDER BY ev.created_at DESC", id);
  const max = Math.max(1, ...Object.values(ctaMap), ...show.map((s) => s.n));
  const kbTitle = (v: string) => get('SELECT title FROM kb_items WHERE id = ?', v)?.title || (e.content.blocks.find((b) => b.id === v) as any)?.title || v;
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="ph">
        <div>
          <div className="crumbs"><Link href="/app/editions">Editions</Link> / <Link href={`/app/editions/${e.id}`}>#{e.number}</Link> / Results</div>
          <h1>{e.content.title}</h1>
          <p className="sub">{e.sent_at ? `Sent ${fmtDate(e.sent_at, undefined, true)}` : 'Not sent yet. Numbers from tests and previews are excluded.'}</p>
        </div>
        <div className="row"><StatusPill status={e.status} /><a className="btn" href={`${baseUrl()}/e/${p.slug}/${e.slug}`} target="_blank" rel="noreferrer">Open page ↗</a><a className="btn" href={`/api/export?type=events&edition=${e.id}`}>Export CSV</a></div>
      </div>
      <div className="grid4">
        <div className="card kpi"><div className="v">{delivered}</div><div className="k">Delivered</div><div className="d">{byChannel.map((c) => `${({ email: 'email', whatsapp: 'WA API', wa_manual: 'WA manual' } as any)[c.channel] || c.channel} ${c.n}`).join(' · ') || '–'}{failed ? ` · ${failed} failed` : ''}</div></div>
        <div className="card kpi"><div className="v">{viewers}</div><div className="k">Opened the page</div><div className="d">{pct(viewers, delivered)} of delivered{anon ? ` · +${anon} views via shared link` : ''}</div></div>
        <div className="card kpi"><div className="v">{s50}</div><div className="k">Read past halfway</div><div className="d">{s100} reached the end{avgTime ? ` · avg ${avgTime}s on page` : ''}</div></div>
        <div className="card kpi"><div className="v">{intents}</div><div className="k">People who showed interest</div><div className="d">{pct(intents, delivered)} of delivered{m.anonIntents ? ` · +${m.anonIntents} taps via shared link` : ''} · email opens {opens} (approximate)</div></div>
      </div>
      <div className="grid2">
        <section className="card"><h2>Buttons tapped</h2><p className="hint">Unique people per button.</p>
          <div className="funnel">
            {(['interested', 'book', 'more', 'share', 'notnow', 'unsubscribe'] as const).map((k) => <Bar key={k} label={k === 'unsubscribe' ? 'Unsubscribed' : (CTA_LABELS as any)[k]} n={ctaMap[k] || 0} max={max} />)}
            {show.map((s) => <Bar key={s.value} label={`Our work: ${kbTitle(s.value)}`} n={s.n} max={max} />)}
          </div>
        </section>
        <section className="card"><h2>Poll</h2>
          {pollBlocks.length ? pollBlocks.map((b) => {
            const res = pollResults(id, b.id);
            const total = res.reduce((a, x) => a + x.n, 0);
            return <div key={b.id} className="stack" style={{ gap: 8 }}><p className="hint">{b.question}</p>{b.options.map((o: string) => <Bar key={o} label={o} n={res.find((x) => x.value === o)?.n || 0} max={Math.max(1, ...res.map((x) => x.n))} total={total} />)}<div className="hint">{total} {total === 1 ? 'person' : 'people'} voted (latest answer counts)</div></div>;
          }) : <div className="hint">This edition has no poll.</div>}
        </section>
      </div>
      {notes.length > 0 && (
        <section className="card"><h2>Notes from readers</h2>
          <ul className="tl">{notes.map((x, i) => <li key={i}><time>{ago(x.created_at)}</time><div>{x.cid ? <Link href={`/app/contacts/${x.cid}`}><b>{`${x.first_name} ${x.last_name}`.trim()}</b></Link> : <b>Anonymous</b>} after “{x.type}”: “{JSON.parse(x.meta).note}”</div></li>)}</ul>
        </section>
      )}
      <section className="card">
        <div className="card-head"><h2>Who engaged</h2><Link href="/app/leads">All leads →</Link></div>
        {people.length ? (
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>Person</th><th>What they did</th><th>Last</th><th className="num">Score</th></tr></thead>
            <tbody>{people.map((r) => <tr key={r.id}><td><Link href={`/app/contacts/${r.id}`}><b>{`${r.first_name} ${r.last_name}`.trim()}</b></Link><div className="hint">{[r.role, r.company].filter(Boolean).join(', ')}</div></td><td><div className="chips">{String(r.acts).split(',').filter((a) => a !== 'scroll').map((a) => <span key={a} className={`pill ${['interested', 'book', 'showcase'].includes(a) ? 'ok' : a === 'unsubscribe' || a === 'notnow' ? 'bad' : ''}`}>{a}</span>)}</div></td><td>{ago(r.last)}</td><td className="num"><Score n={r.score} /></td></tr>)}</tbody>
          </table></div>
        ) : <div className="hint">No tracked engagement yet. Readers who open their personal link appear here.</div>}
      </section>
    </div>
  );
}
