import Link from 'next/link';
import { all } from '@/lib/db';
import { requireProduct } from '@/lib/context';
import { ago } from '@/lib/format';
import { markAllRead } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Notifications' };

const ICON: Record<string, string> = { intent: '🔥', draft: '📝', send: '📤', stories: '📰', nudge: '👋', report: '📊', error: '⚠️' };

export default async function Notifications() {
  const p = await requireProduct();
  const rows = all('SELECT * FROM notifications WHERE product_id = ? OR product_id IS NULL ORDER BY created_at DESC LIMIT 200', p.id);
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="ph"><div><h1>Notifications</h1><p className="sub">Interest taps, drafts ready for review, sends and automation problems. Interest taps are also emailed to your alert address.</p></div><form action={markAllRead}><button className="btn">Mark all read</button></form></div>
      {rows.length ? <div className="card"><ul className="tl">{rows.map((n) => (
        <li key={n.id} style={{ opacity: n.read_at ? 0.65 : 1 }}><time>{ago(n.created_at)}</time><div><span aria-hidden>{ICON[n.kind] || '•'} </span>{n.link ? <Link href={n.link}><b>{n.title}</b></Link> : <b>{n.title}</b>}{n.body && <div className="hint">{n.body}</div>}</div></li>
      ))}</ul></div> : <div className="empty"><b>All quiet</b><span>Notifications appear here as the week runs.</span></div>}
    </div>
  );
}
