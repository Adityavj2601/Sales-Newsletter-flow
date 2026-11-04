import Link from 'next/link';
import { all } from '@/lib/db';
import { requireProduct } from '@/lib/context';
import { listEditions, pickKb, pickStories } from '@/lib/editions';
import { baseUrl, getSetting } from '@/lib/settings';
import { configuredProviders } from '@/lib/ai/providers';
import { fmtDay, ago, nextSendDate, todayIn, edNo } from '@/lib/format';
import { editionMetrics } from '@/lib/metrics';
import { StatusPill } from '@/components/bits';
import { ovKey } from '@/lib/types';
import { I } from '@/components/editor/icons';
import { FlowStepper } from '@/components/FlowStepper';
import { flowState } from '@/lib/flow';
import { NewEdition, NewEditionButton } from './NewEdition';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Editions' };

export default async function Editions({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const p = await requireProduct();
  const sp = await searchParams;
  const eds = listEditions(p.id);
  const stories = all("SELECT id, title, publisher, score, score_reason, status, published_at FROM stories WHERE product_id = ? AND status IN ('new','shortlisted') ORDER BY (status = 'shortlisted') DESC, score DESC LIMIT 25", p.id);
  const preStories = pickStories(p.id).map((s) => s.id);
  const kb = all('SELECT id, title, pillar, status FROM kb_items WHERE product_id = ? AND active = 1 ORDER BY pillar, title', p.id);
  const preKb = pickKb(p.id).map((k) => k.id);
  const general = getSetting('general');
  const planned = nextSendDate(general, eds.map((e) => e.planned_for));
  const stat = (id: string) => { const m = editionMetrics([id]); return { sent: m.delivered, views: m.readers, intents: m.intentPeople }; };
  const base = baseUrl();
  const today = todayIn();

  const sendDate = (e: (typeof eds)[number]) => (e.status === 'sent' ? e.sent_at : e.scheduled_at || e.planned_for);
  // Upcoming reads in the order they go out: soonest first. Undated drafts sit at the end.
  const upcoming = eds.filter((e) => e.status !== 'sent' && e.status !== 'sending')
    .sort((a, b) => String(sendDate(a) || '9999').localeCompare(String(sendDate(b) || '9999')) || a.number - b.number);
  const done = eds.filter((e) => e.status === 'sent' || e.status === 'sending');
  // "Up next": the soonest upcoming edition that is still in the future (or the newest one if none are dated).
  const next = [...upcoming].filter((e) => (sendDate(e) || '').slice(0, 10) >= today).sort((a, b) => String(sendDate(a)).localeCompare(String(sendDate(b))))[0] || upcoming[0];
  const checksLine = (e: (typeof eds)[number]) => {
    if (!e.checks) return { cls: '', text: 'Not checked yet' };
    const fails = e.checks.results.filter((r) => r.status === 'fail' && !e.overrides?.[ovKey(r)]).length;
    return fails ? { cls: 'bad', text: `${fails} failing` } : { cls: 'ok', text: 'All checks pass' };
  };
  const preview = (e: (typeof eds)[number]) => `${base}/e/${p.slug}/${e.slug}${e.status === 'sent' ? '' : '?preview=1'}`;
  const cover = (e: (typeof eds)[number]) => `/og/${e.id}.png?v=${encodeURIComponent(e.updated_at)}`;
  const rel = (iso: string | null | undefined) => (iso ? ago(iso.length === 10 ? `${iso}T04:30:00Z` : iso) : '');

  return (
    <div className="eds">
      <div className="ph">
        <div>
          <div className="eyebrow">{p.name} · {p.newsletter_name}</div>
          <h1>Editions</h1>
          <p className="sub">{upcoming.length} upcoming · {done.length} sent. Editing an approved edition sends it back to review.</p>
        </div>
        <div className="row"><NewEdition open={!!sp.new} stories={stories as any} preStories={preStories} kb={kb as any} preKb={preKb} planned={planned} aiReady={configuredProviders().length > 0} /></div>
      </div>

      {next && (() => {
        const st = flowState(next);
        const inEditor = st.href === `/app/editions/${next.id}`;
        return (
          <section className="eds-next" aria-label="Up next">
            <Link className="eds-cover-w" href={`/app/editions/${next.id}`} tabIndex={-1} aria-hidden>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="eds-cover" src={cover(next)} alt="" loading="lazy" />
            </Link>
            <div className="eds-next-b">
              <div className="eds-next-k"><span className="eyebrow">Up next</span><span className="eds-when"><I.calendar size={13} />{fmtDay(sendDate(next))}{rel(sendDate(next)) ? <span> · {rel(sendDate(next))}</span> : null}</span></div>
              <h2><span className="eds-no tnum">{edNo(next.number)}</span>{next.content.title || 'Untitled'}</h2>
              {next.content.dek && <p className="eds-dek">{next.content.dek}</p>}
              <FlowStepper current={st.current} />
              <div className="eds-step">
                <div className="eds-step-t"><b>{st.title}</b><span>{st.detail}</span></div>
                <div className="eds-next-a">
                  <a className="icon-btn eds-share" href={cover(next)} target="_blank" rel="noreferrer" title="See the share image people get with the link" aria-label="Open the share image"><I.share size={17} /></a>
                  <a className="btn" href={preview(next)} target="_blank" rel="noreferrer">Preview<I.external size={13} /></a>
                  {!inEditor && <Link className="btn" href={`/app/editions/${next.id}`}>Edit</Link>}
                  <Link className="btn primary" href={st.href}>{st.cta}</Link>
                </div>
              </div>
            </div>
          </section>
        );
      })()}

      {upcoming.length > 0 && (
        <section className="eds-grp">
          <h2 className="group-title">Upcoming</h2>
          <div className="tbl-wrap eds-list">
            <table className="tbl">
              <thead><tr><th className="c-no">#</th><th>Edition</th><th>Status</th><th>Send date</th><th>Checks</th><th className="c-act"><span className="sr">Actions</span></th></tr></thead>
              <tbody>
                {upcoming.map((e) => {
                  const ck = checksLine(e);
                  return (
                    <tr key={e.id}>
                      <td className="c-no"><span className="eds-no tnum">{edNo(e.number)}</span></td>
                      <td className="c-main">
                        <div className="eds-item">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img className="eds-thumb" src={cover(e)} alt="" loading="lazy" />
                          <div className="eds-t"><Link className="eds-link" href={`/app/editions/${e.id}`}><span className="eds-no-m tnum">{edNo(e.number)}</span>{e.content.title || 'Untitled'}</Link><div className="hint">{[e.content.kicker, `edited ${ago(e.updated_at)}`].filter(Boolean).join(' · ')}</div></div>
                        </div>
                      </td>
                      <td className="c-st"><StatusPill status={e.status} /></td>
                      <td className="c-date"><div>{fmtDay(sendDate(e))}</div><div className="hint">{e.scheduled_at ? 'Scheduled' : rel(sendDate(e))}</div></td>
                      <td className="c-ck"><span className={`eds-ck ${ck.cls}`}><span className="dot" />{ck.text}</span></td>
                      <td className="c-act"><div className="eds-acts">
                        {(e.status === 'approved' || e.status === 'scheduled') && <Link className="btn sm primary" href={`/app/editions/${e.id}/distribute`}>{e.status === 'scheduled' ? 'Schedule' : 'Send'}</Link>}
                        <a className="icon-btn" href={preview(e)} target="_blank" rel="noreferrer" title="View the reader page" aria-label={`View edition ${e.number}`}><I.external size={15} /></a>
                        <span className="eds-chev" aria-hidden><I.chevron size={14} /></span>
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {done.length > 0 && (
        <section className="eds-grp">
          <h2 className="group-title">Sent</h2>
          <div className="tbl-wrap eds-list sent">
            <table className="tbl">
              <thead><tr><th className="c-no">#</th><th>Edition</th><th>Sent</th><th className="num">Delivered</th><th className="num">Readers</th><th className="num">Interested</th><th className="c-act"><span className="sr">Actions</span></th></tr></thead>
              <tbody>
                {done.map((e) => {
                  const s = stat(e.id);
                  const rate = s.sent ? Math.round((s.views / s.sent) * 100) : 0;
                  return (
                    <tr key={e.id}>
                      <td className="c-no"><span className="eds-no tnum">{edNo(e.number)}</span></td>
                      <td className="c-main">
                        <div className="eds-item">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img className="eds-thumb" src={cover(e)} alt="" loading="lazy" />
                          <div className="eds-t"><Link className="eds-link" href={`/app/editions/${e.id}`}><span className="eds-no-m tnum">{edNo(e.number)}</span>{e.content.title || 'Untitled'}</Link><div className="hint">{e.content.kicker || '—'}</div></div>
                        </div>
                      </td>
                      <td className="c-date"><div>{e.status === 'sending' ? <StatusPill status="sending" /> : fmtDay(e.sent_at)}</div><div className="hint">{e.status === 'sent' ? rel(e.sent_at) : ''}</div></td>
                      <td className="num" data-k="Delivered"><span className="eds-v">{s.sent}</span></td>
                      <td className="num" data-k="Readers"><span className="eds-v">{s.views}</span>{s.sent ? <span className="eds-rate"><span className="trk"><i style={{ width: `${Math.min(100, rate)}%` }} /></span>{rate}% opened</span> : null}</td>
                      <td className="num" data-k="Interested"><span className="eds-v">{s.intents ? <span className="eds-hot">{s.intents}</span> : 0}</span></td>
                      <td className="c-act"><div className="eds-acts">
                        <Link className="btn sm" href={`/app/editions/${e.id}/analytics`}>Results</Link>
                        <a className="icon-btn" href={preview(e)} target="_blank" rel="noreferrer" title="View the reader page" aria-label={`View edition ${e.number}`}><I.external size={15} /></a>
                        <span className="eds-chev" aria-hidden><I.chevron size={14} /></span>
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!eds.length && (
        <div className="empty eds-empty">
          <span className="eds-empty-ic" aria-hidden><I.news size={26} /></span>
          <b>No editions yet</b>
          <span>Start with an AI draft from this week’s news. You review everything before it’s sent.</span>
          <NewEditionButton />
        </div>
      )}
    </div>
  );
}
