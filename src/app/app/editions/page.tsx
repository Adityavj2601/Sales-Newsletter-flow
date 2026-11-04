import Link from 'next/link';
import { all, get } from '@/lib/db';
import { requireProduct } from '@/lib/context';
import { listEditions, pickKb, pickStories } from '@/lib/editions';
import { baseUrl, getSetting } from '@/lib/settings';
import { configuredProviders } from '@/lib/ai/providers';
import { fmtDay, ago, nextSendDate } from '@/lib/format';
import { editionMetrics } from '@/lib/metrics';
import { StatusPill } from '@/components/bits';
import { NewEdition } from './NewEdition';

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
  const planned = nextSendDate(getSetting('general'), eds.map((e) => e.planned_for));
  const stat = (id: string) => { const m = editionMetrics([id]); return { sent: m.delivered, views: m.readers, intents: m.intentPeople }; };
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="ph">
        <div><div className="eyebrow">{p.newsletter_name}</div><h1>Editions</h1><p className="sub">Every edition moves Draft → In review → Approved → Scheduled → Sent. Editing an approved edition sends it back to review.</p></div>
        <NewEdition open={!!sp.new} stories={stories as any} preStories={preStories} kb={kb as any} preKb={preKb} planned={planned} aiReady={configuredProviders().length > 0} />
      </div>
      {eds.length ? (
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>#</th><th>Edition</th><th>Status</th><th>Send date</th><th className="num">Delivered</th><th className="num">Views</th><th className="num">Interest</th><th></th></tr></thead>
          <tbody>
            {eds.map((e) => {
              const s: any = e.status === 'sent' || e.status === 'sending' ? stat(e.id) : null;
              const fails = e.checks?.results.filter((r) => r.status === 'fail').length || 0;
              return (
                <tr key={e.id}>
                  <td className="mono">{String(e.number).padStart(2, '0')}</td>
                  <td style={{ minWidth: 260 }}><Link href={`/app/editions/${e.id}`}><b>{e.content.title || 'Untitled'}</b></Link><div className="hint">{[e.content.kicker, e.checks && e.status !== 'sent' ? (fails ? `${fails} failing check${fails > 1 ? 's' : ''}` : 'checks pass') : '', `edited ${ago(e.updated_at)}`].filter(Boolean).join(' · ')}</div></td>
                  <td><StatusPill status={e.status} /></td>
                  <td>{e.status === 'sent' ? fmtDay(e.sent_at) : e.scheduled_at ? fmtDay(e.scheduled_at) : fmtDay(e.planned_for)}</td>
                  <td className="num">{s ? s.sent : '–'}</td><td className="num">{s ? s.views : '–'}</td><td className="num">{s ? s.intents : '–'}</td>
                  <td><div className="row end">
                    {e.status === 'sent' ? <Link className="btn sm" href={`/app/editions/${e.id}/analytics`}>Results</Link> : <Link className="btn sm" href={`/app/editions/${e.id}/distribute`}>Send</Link>}
                    <a className="btn sm ghost" href={`${baseUrl()}/e/${p.slug}/${e.slug}${e.status === 'sent' ? '' : '?preview=1'}`} target="_blank" rel="noreferrer">View ↗</a>
                  </div></td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
      ) : <div className="empty"><b>No editions yet</b><span>Start with an AI draft from this week’s news.</span></div>}
    </div>
  );
}
