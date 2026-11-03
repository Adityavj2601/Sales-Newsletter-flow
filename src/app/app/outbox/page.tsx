import { requireUser } from '@/lib/auth';
import Link from 'next/link';
import { all } from '@/lib/db';
import { smtpReady } from '@/lib/settings';
import { ago } from '@/lib/format';
import { clearOutbox } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Email outbox' };

export default async function Outbox() {
  await requireUser();
  const rows = all('SELECT id, to_addr, subject, kind, created_at FROM outbox ORDER BY created_at DESC LIMIT 300');
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="ph"><div><h1>Email outbox</h1><p className="sub">{smtpReady() ? 'SMTP is connected, so new emails are really sent. This list only keeps emails saved earlier.' : 'SMTP isn’t connected yet, so every email the app would send is saved here instead. Open one to see exactly what the reader gets.'}</p></div>
        <div className="row">{!smtpReady() && <Link className="btn primary" href="/app/settings?tab=email">Connect SMTP</Link>}{rows.length > 0 && <form action={clearOutbox}><button className="btn">Clear</button></form>}</div></div>
      {rows.length ? <div className="tbl-wrap"><table className="tbl"><thead><tr><th>To</th><th>Subject</th><th>Type</th><th>When</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.id}><td>{r.to_addr}</td><td><Link href={`/app/outbox/${r.id}`}>{r.subject}</Link></td><td><span className="pill">{r.kind}</span></td><td className="hint">{ago(r.created_at)}</td></tr>)}</tbody></table></div>
        : <div className="empty"><b>Empty</b><span>Send a test from any edition’s Send page to see it here.</span></div>}
    </div>
  );
}
