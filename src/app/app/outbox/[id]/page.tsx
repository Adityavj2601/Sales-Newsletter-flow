import { requireUser } from '@/lib/auth';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { get, parse } from '@/lib/db';
import { fmtDate } from '@/lib/format';
import { Avatar } from '@/components/bits';
import { Icon } from '@/components/shell/icons';

export const dynamic = 'force-dynamic';

export default async function OutboxItem({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const m = get('SELECT * FROM outbox WHERE id = ?', (await params).id);
  if (!m) notFound();
  const h = parse<Record<string, string>>(m.headers, {});
  const from = h.From || h.from || '';
  return (
    <div className="stack message" style={{ gap: 14 }}>
      <nav className="crumbs back" aria-label="Breadcrumb"><Link href="/app/outbox"><Icon name="chevronLeft" size={15} strokeWidth={2.2} />Outbox</Link><span aria-hidden>/</span><span aria-current="page">message</span></nav>
      <header className="card msg-head">
        <h1 className="msg-subject">{m.subject}</h1>
        <div className="msg-meta">
          <Avatar name={String(m.to_addr).split(',')[0]} size={40} />
          <div className="msg-who">
            <div><span className="hint">To</span> <b>{m.to_addr}</b></div>
            {from && <div className="hint">From {from}</div>}
          </div>
          <div className="msg-when">
            <span className="pill">{m.kind}</span>
            <time className="hint" dateTime={m.created_at}>{fmtDate(m.created_at, undefined, true)}</time>
          </div>
        </div>
        {Object.keys(h).length > 0 && (
          <details className="more msg-headers">
            <summary><Icon name="chevron" size={13} strokeWidth={2.2} />Headers ({Object.keys(h).length})</summary>
            <dl className="mono">{Object.entries(h).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          </details>
        )}
      </header>
      <div className="paper">
        <iframe title="Email" className="preview-frame" srcDoc={String(m.html).replace(/<img[^>]+\/t\/o\/[^>]+>/g, '')} sandbox="allow-popups" />
      </div>
    </div>
  );
}
