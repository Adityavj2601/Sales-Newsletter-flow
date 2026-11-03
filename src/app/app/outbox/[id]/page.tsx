import { requireUser } from '@/lib/auth';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { get, parse } from '@/lib/db';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function OutboxItem({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const m = get('SELECT * FROM outbox WHERE id = ?', (await params).id);
  if (!m) notFound();
  const h = parse<Record<string, string>>(m.headers, {});
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="crumbs"><Link href="/app/outbox">Outbox</Link> / message</div>
      <div className="card tight"><div><b>{m.subject}</b></div><div className="hint">To {m.to_addr} · {fmtDate(m.created_at, undefined, true)} · {m.kind}</div>{Object.keys(h).length > 0 && <div className="hint mono" style={{ marginTop: 6 }}>{Object.entries(h).map(([k, v]) => <div key={k}>{k}: {v}</div>)}</div>}</div>
      <iframe title="Email" className="preview-frame" srcDoc={m.html} sandbox="allow-popups" />
    </div>
  );
}
