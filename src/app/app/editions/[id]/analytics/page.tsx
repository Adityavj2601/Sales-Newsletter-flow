import { EnsureProduct } from '@/components/EnsureProduct';
import { activeProduct } from '@/lib/context';
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
import { Icon } from '@/components/people/Icon';
import { Avatar } from '@/components/people/Avatar';
import { Ticker } from '@/components/people/Ticker';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Results' };

const ACT: Record<string, [string, string]> = {
  interested: ['Interested', 'ok'], book: ['Booked 15 min', 'ok'], showcase: ['Our-work card', 'ok'], more: ['Wants more', 'info'], share: ['Shared', 'info'],
  poll: ['Voted', ''], view: ['Opened', ''], open: ['Email open', ''], click: ['Clicked', ''], notnow: ['Not now', 'bad'], unsubscribe: ['Unsubscribed', 'bad'], note: ['Left a note', 'info'], wa_reply: ['WhatsApp reply', 'info'], resubscribe: ['Resubscribed', ''],
};
const TONE: Record<string, string> = { interested: 'ok', book: 'ok', more: 'blue', share: 'blue', notnow: 'gray', unsubscribe: 'bad' };

function Bar({ label, n, max, total, tone = 'blue', i = 0, lead = false }: { label: string; n: number; max: number; total?: number; tone?: string; i?: number; lead?: boolean }) {
  const w = max ? (n / max) * 100 : 0;
  return (
    <div className={`rb ${lead ? 'is-lead' : ''}`} style={{ ['--i' as any]: i }}>
      <div className="rb-top"><span className="rb-l" title={label}>{label}</span><span className="rb-n">{n}{total ? <small>{pct(n, total)}</small> : null}</span></div>
      <div className="rb-track"><i className={`tn-${tone}`} style={{ width: `${n ? Math.max(3, w) : 0}%` }} /></div>
    </div>
  );
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
  const chName = (c: string) => ({ email: 'Email', whatsapp: 'WA API', wa_manual: 'WhatsApp' } as any)[c] || c;
  const noteText = (meta: string) => { try { return JSON.parse(meta).note; } catch { return ''; } };

  const funnel = [
    { k: 'Delivered', n: delivered, icon: 'send', d: byChannel.map((c) => `${chName(c.channel)} ${c.n}`).join(' · ') || 'Nothing delivered yet' },
    { k: 'Opened the page', n: viewers, icon: 'eye', d: anon ? `+${anon} views via shared link` : `${opens} email opens (approximate)` },
    { k: 'Read past halfway', n: s50, icon: 'doc', d: `${s100} reached the end${avgTime ? ` · avg ${avgTime}s on page` : ''}` },
    { k: 'Showed interest', n: intents, icon: 'flame', d: m.anonIntents ? `+${m.anonIntents} taps via shared link` : 'Interested, booked or tapped Our work' },
  ];
  const top = Math.max(1, delivered, viewers, s50, intents);

  const __active = await activeProduct();
  return (
    <div className="res">
      <EnsureProduct productId={e.product_id} activeId={__active?.id || null} />
      <div className="ph">
        <div>
          <div className="crumbs"><Link href="/app/editions">Editions</Link> / <Link href={`/app/editions/${e.id}`}>#{e.number}</Link> / Results</div>
          <h1>{e.content.title}</h1>
          <p className="sub res-sub"><StatusPill status={e.status} /><span>{e.sent_at ? `Sent ${fmtDate(e.sent_at, undefined, true)}` : 'Not sent yet. Numbers from tests and previews are excluded.'}</span></p>
        </div>
        <div className="row">
          <a className="btn" href={`${baseUrl()}/e/${p.slug}/${e.slug}`} target="_blank" rel="noreferrer">Open page<Icon name="out" size={13} /></a>
          <a className="btn" href={`/api/export?type=events&edition=${e.id}`}>Export CSV</a>
          <Link className="btn primary" href={`/app/editions/${e.id}/distribute`}><Icon name="send" size={15} stroke={2} />Send</Link>
        </div>
      </div>

      <div className="res-kpis">
        {funnel.map((f, i) => (
          <div key={f.k} className={`card res-kpi k${i}`}>
            <div className="res-kpi-top"><span className={`res-kpi-ic k${i}`}><Icon name={f.icon} size={15} stroke={2} /></span><span className="res-kpi-k">{f.k}</span></div>
            <div className="res-kpi-v"><Ticker value={f.n} />{i > 0 && delivered > 0 && <span className="res-kpi-pct">{pct(f.n, delivered)}</span>}</div>
            <div className="res-kpi-d">{f.d}{i === 0 && failed ? ` · ${failed} failed` : ''}</div>
          </div>
        ))}
      </div>

      <section className="card res-funnel" aria-labelledby="h-funnel">
        <div className="res-head"><h2 id="h-funnel">Reader funnel</h2><span className="hint">People with a personal link. Each step as a share of delivered.</span></div>
        <ol className="fn">
          {funnel.map((f, i) => {
            const prev = i ? funnel[i - 1].n : 0;
            return (
              <li key={f.k} style={{ ['--i' as any]: i }}>
                <div className="fn-l"><b>{f.k}</b>{i > 0 && <span>{prev ? `${pct(f.n, prev)} of previous step` : '–'}</span>}</div>
                <div className="fn-track"><i className={`k${i}`} style={{ width: `${f.n ? Math.max(2, (f.n / top) * 100) : 0}%` }} /></div>
                <div className="fn-n">{f.n}</div>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="res-two">
        <section className="card" aria-labelledby="h-btn">
          <div className="res-head"><h2 id="h-btn">Buttons tapped</h2><span className="hint">Unique people per button</span></div>
          <div className="rbs">
            {(['interested', 'book', 'more', 'share', 'notnow', 'unsubscribe'] as const).map((k, i) => <Bar key={k} i={i} label={k === 'unsubscribe' ? 'Unsubscribed' : (CTA_LABELS as any)[k]} n={ctaMap[k] || 0} max={max} tone={TONE[k]} />)}
            {show.map((s, i) => <Bar key={s.value} i={6 + i} label={`Our work: ${kbTitle(s.value)}`} n={s.n} max={max} tone="ok" />)}
          </div>
        </section>
        <section className="card" aria-labelledby="h-poll">
          <div className="res-head"><h2 id="h-poll">Poll</h2>{pollBlocks.length > 0 && <span className="hint">Latest answer counts</span>}</div>
          {pollBlocks.length ? pollBlocks.map((b) => {
            const res = pollResults(id, b.id);
            const total = res.reduce((a, x) => a + x.n, 0);
            const best = Math.max(0, ...res.map((x) => x.n));
            return (
              <div key={b.id} className="res-poll">
                <p className="res-q">{b.question}</p>
                <div className="rbs">{b.options.map((o: string, i: number) => { const n = res.find((x) => x.value === o)?.n || 0; return <Bar key={o} i={i} label={o} n={n} max={Math.max(1, total)} total={total} tone={n && n === best ? 'blue' : 'gray'} lead={!!n && n === best} />; })}</div>
                <div className="hint">{total} {total === 1 ? 'person' : 'people'} voted</div>
              </div>
            );
          }) : <div className="res-empty"><Icon name="poll" size={22} /><span>This edition has no poll.</span></div>}
        </section>
      </div>

      {notes.length > 0 && (
        <section className="card" aria-labelledby="h-notes">
          <div className="res-head"><h2 id="h-notes">Notes from readers</h2><span className="hint">{notes.length} {notes.length === 1 ? 'note' : 'notes'}</span></div>
          <ul className="res-notes">{notes.map((x, i) => {
            const nm = x.cid ? `${x.first_name} ${x.last_name}`.trim() : 'Anonymous';
            return (
              <li key={i}>
                <Avatar name={nm} size={34} />
                <div>
                  <div className="res-note-h">{x.cid ? <Link href={`/app/contacts/${x.cid}`}><b>{nm}</b></Link> : <b>{nm}</b>}<span className="hint">after “{ACT[x.type]?.[0] || x.type}” · {ago(x.created_at)}</span></div>
                  <blockquote>{noteText(x.meta)}</blockquote>
                </div>
              </li>
            );
          })}</ul>
        </section>
      )}

      <section className="card" aria-labelledby="h-who">
        <div className="res-head"><h2 id="h-who">Who engaged</h2><Link className="btn sm ghost" href="/app/leads">All leads<Icon name="arrow" size={13} /></Link></div>
        {people.length ? (
          <ul className="res-people">{people.map((r) => {
            const nm = `${r.first_name} ${r.last_name}`.trim();
            const acts = String(r.acts).split(',').filter((a) => a !== 'scroll');
            return (
              <li key={r.id}>
                <Link href={`/app/contacts/${r.id}`} className="res-person">
                  <Avatar name={nm} size={38} />
                  <span className="res-pn"><b>{nm}</b><span>{[r.role, r.company].filter(Boolean).join(', ') || '—'}</span></span>
                </Link>
                <div className="res-acts">{acts.map((a) => <span key={a} className={`pill ${ACT[a]?.[1] || ''}`}>{ACT[a]?.[0] || a}</span>)}</div>
                <span className="res-last hint">{ago(r.last)}</span>
                <span className="res-score"><Score n={r.score} /></span>
              </li>
            );
          })}</ul>
        ) : <div className="res-empty"><Icon name="users" size={22} /><span>No tracked engagement yet. Readers who open their personal link appear here.</span></div>}
      </section>
    </div>
  );
}
