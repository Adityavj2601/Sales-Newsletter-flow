import { requireUser } from '@/lib/auth';
import Link from 'next/link';
import { all } from '@/lib/db';
import { namesFor } from '@/components/shell/names';
import { typo } from '@/components/shell/kinds';
import { smtpReady, getSetting } from '@/lib/settings';
import { fmtTime, todayIn, utcToZonedInput, TZ_DEFAULT } from '@/lib/format';
import { clearOutbox } from '../actions';
import { Confirm } from '@/components/ui';
import { Avatar } from '@/components/bits';
import { Icon } from '@/components/shell/icons';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Email outbox' };

const KIND: Record<string, [string, string]> = { edition: ['info', 'Edition'], test: ['', 'Test'], alert: ['warn', 'Sales alert'], report: ['ok', 'Report'] };

export default async function Outbox() {
  await requireUser();
  const rows = all('SELECT id, to_addr, subject, kind, created_at FROM outbox ORDER BY created_at DESC LIMIT 300');
  const smtp = smtpReady();
  const tz = getSetting('general').timezone || TZ_DEFAULT;
  const today = todayIn(tz);
  const day = new Intl.DateTimeFormat('en-IN', { timeZone: tz, day: 'numeric', month: 'short' });
  const firsts = rows.map((r) => String(r.to_addr || '').split(',')[0] || '');
  const names = namesFor(firsts);
  return (
    <div className="pg outbox">
      <div className="ph">
        <div>
          <span className="eyebrow">{smtp ? 'Saved copies' : `${rows.length} saved ${rows.length === 1 ? 'email' : 'emails'}`}</span>
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
            <tbody>{rows.map((r, i) => {
              const to = String(r.to_addr || '');
              const many = to.split(',').map((x) => x.trim()).filter(Boolean);
              const email = many[0] || '';
              const name = names.get(email.toLowerCase());
              const [tone, label] = KIND[r.kind] || ['', String(r.kind || 'Email').replace(/^\w/, (c) => c.toUpperCase())];
              const isToday = utcToZonedInput(r.created_at, tz).slice(0, 10) === today;
              return (
                <tr key={r.id}>
                  <td className="to">
                    <span className="cell">
                      <Avatar name={name || firsts[i].split('@')[0] || '?'} size={30} />
                      <span className="who" title={to}>
                        <b className="clip">{name || email}{many.length > 1 && <span className="hint"> +{many.length - 1}</span>}</b>
                        {name && <small className="clip">{email}</small>}
                      </span>
                    </span>
                  </td>
                  <td className="subj"><Link href={`/app/outbox/${r.id}`}>{typo(r.subject)}</Link></td>
                  <td className="type"><span className={`pill ${tone}`}>{label}</span></td>
                  <td className="when hint"><span className="cell"><time dateTime={r.created_at} title={`${day.format(new Date(r.created_at))}, ${fmtTime(r.created_at, tz)}`}>{isToday ? fmtTime(r.created_at, tz) : day.format(new Date(r.created_at))}</time><Icon name="chevron" size={14} strokeWidth={2} /></span></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      ) : (
        <div className="empty">
          <span className="empty-ic" aria-hidden><Icon name="tray" size={26} /></span>
          <b>Nothing saved</b><span>Send a test from any edition’s Send page to see it here.</span>
        </div>
      )}
    </div>
  );
}
