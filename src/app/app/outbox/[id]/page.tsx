import { requireUser } from '@/lib/auth';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { get, parse } from '@/lib/db';
import { fmtDate, fmtTime } from '@/lib/format';
import { Avatar } from '@/components/bits';
import { Icon } from '@/components/shell/icons';
import { namesFor } from '@/components/shell/names';
import { typo } from '@/components/shell/kinds';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Email' };

const KIND: Record<string, [string, string]> = { edition: ['info', 'Edition'], test: ['', 'Test'], alert: ['warn', 'Sales alert'], report: ['ok', 'Report'] };

export default async function OutboxItem({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const m = get('SELECT * FROM outbox WHERE id = ?', (await params).id);
  if (!m) notFound();
  const h = parse<Record<string, string>>(m.headers, {});
  const from = h.From || h.from || '';
  const to = String(m.to_addr || '');
  const first = to.split(',')[0]?.trim() || '';
  const name = namesFor([first]).get(first.toLowerCase());
  const [tone, label] = KIND[m.kind] || ['', String(m.kind || 'Email').replace(/^\w/, (c) => c.toUpperCase())];
  return (
    <div className="pg message">
      <div className="ph">
        <div>
          <nav className="crumbs back" aria-label="Breadcrumb"><Link href="/app/outbox"><Icon name="chevronLeft" size={15} strokeWidth={2.2} />Email outbox</Link></nav>
          <h1 className="msg-subject">{typo(m.subject)}</h1>
        </div>
      </div>
      <header className="card msg-head">
        <div className="msg-meta">
          <Avatar name={name || first.split('@')[0] || '?'} size={40} />
          <div className="msg-who">
            <div><span className="hint">To</span> <b>{name || to}</b>{name && <span className="hint"> · {to}</span>}</div>
            {from && <div className="hint">From {from}</div>}
          </div>
          <div className="msg-when">
            <span className={`pill ${tone}`}>{label}</span>
            <time className="hint" dateTime={m.created_at}>{fmtDate(m.created_at)}, {fmtTime(m.created_at)}</time>
          </div>
        </div>
        {Object.keys(h).length > 0 && (
          <details className="more msg-headers">
            <summary><Icon name="chevron" size={13} strokeWidth={2.2} />Headers ({Object.keys(h).length})</summary>
            <dl>{Object.entries(h).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          </details>
        )}
      </header>
      <div className="paper">
        <iframe title="Email" className="preview-frame" srcDoc={String(m.html).replace(/<img[^>]+\/t\/o\/[^>]+>/g, '')} sandbox="allow-popups" />
      </div>
    </div>
  );
}
