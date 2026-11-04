import { requireUser } from '@/lib/auth';
import Link from 'next/link';
import { all } from '@/lib/db';
import { smtpReady } from '@/lib/settings';
import { ago } from '@/lib/format';
import { clearOutbox } from '../actions';
import { Confirm } from '@/components/ui';
import { Avatar } from '@/components/bits';
import { Icon } from '@/components/shell/icons';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Email outbox' };

const KIND: Record<string, string> = { edition: 'info', test: '', alert: 'warn', report: 'ok' };

export default async function Outbox() {
  await requireUser();
  const rows = all('SELECT id, to_addr, subject, kind, created_at FROM outbox ORDER BY created_at DESC LIMIT 300');
  const smtp = smtpReady();
  return (
    <div className="stack outbox" style={{ gap: 18 }}>
      <div className="ph">
        <div>
          <h1>Email outbox</h1>
          <p className="sub">{smtp ? 'SMTP is connected, so new emails are really sent. This list only keeps emails saved earlier.' : 'SMTP isn’t connected yet, so every email the app would send is saved here instead. Open one to see exactly what the reader gets.'}</p>
        </div>
        <div className="row">
          {rows.length > 0 && <Confirm action={clearOutbox} label="Clear" className="btn" confirmLabel="Yes, clear all" />}
          {!smtp && <Link className="btn primary" href="/app/settings?tab=email"><Icon name="mail" size={16} />Connect SMTP</Link>}
        </div>
      </div>
      {rows.length ? (
        <div className="tbl-wrap mail-list">
          <table className="tbl">
            <thead><tr><th>To</th><th>Subject</th><th>Type</th><th className="when">When</th></tr></thead>
            <tbody>{rows.map((r) => {
              const to = String(r.to_addr || '');
              const many = to.split(',').filter(Boolean);
              return (
                <tr key={r.id}>
                  <td className="to"><span className="cell"><Avatar name={many[0] || '?'} size={30} /><span className="clip" title={to}>{many[0]}{many.length > 1 && <span className="hint"> +{many.length - 1}</span>}</span></span></td>
                  <td className="subj"><Link href={`/app/outbox/${r.id}`}>{r.subject}</Link></td>
                  <td className="type"><span className={`pill ${KIND[r.kind] ?? ''}`}>{r.kind}</span></td>
                  <td className="when hint"><span className="cell"><time dateTime={r.created_at}>{ago(r.created_at)}</time><Icon name="chevron" size={14} strokeWidth={2} /></span></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      ) : (
        <div className="empty">
          <span className="empty-ic" aria-hidden><Icon name="tray" size={26} /></span>
          <b>Empty</b><span>Send a test from any edition’s Send page to see it here.</span>
        </div>
      )}
    </div>
  );
}
