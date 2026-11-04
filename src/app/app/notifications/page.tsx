import Link from 'next/link';
import { all } from '@/lib/db';
import { requireProduct } from '@/lib/context';
import { getSetting } from '@/lib/settings';
import { todayIn, utcToZonedInput, fmtTime, TZ_DEFAULT } from '@/lib/format';
import { Submit } from '@/components/ui';
import { Icon } from '@/components/shell/icons';
import { KindIcon, cleanTitle, typo } from '@/components/shell/kinds';
import { Ago } from '@/components/shell/Motion';
import { markAllRead } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Notifications' };

export default async function Notifications() {
  const p = await requireProduct();
  const rows = all('SELECT * FROM notifications WHERE product_id = ? OR product_id IS NULL ORDER BY created_at DESC LIMIT 200', p.id);
  const tz = getSetting('general').timezone || TZ_DEFAULT;
  const today = todayIn(tz);
  const yesterday = new Date(+new Date(today + 'T12:00:00Z') - 86400_000).toISOString().slice(0, 10);
  const groups: { label: string; rows: any[] }[] = [];
  for (const r of rows) {
    const d = utcToZonedInput(r.created_at, tz).slice(0, 10);
    const label = d === today ? 'Today' : d === yesterday ? 'Yesterday' : 'Earlier';
    const g = groups.find((x) => x.label === label) || (groups.push({ label, rows: [] }), groups[groups.length - 1]);
    g.rows.push(r);
  }
  const unread = rows.filter((r) => !r.read_at).length;
  const date = new Intl.DateTimeFormat('en-IN', { timeZone: tz, day: 'numeric', month: 'short' });
  return (
    <div className="pg notif-page">
      <div className="ph">
        <div>
          <span className="eyebrow">{unread > 0 ? `${unread} unread` : 'Activity'}</span>
          <h1>Notifications</h1>
          <p className="sub">Interest taps, drafts ready for review, sends and automation problems. Interest taps are also emailed to your alert address.</p>
        </div>
        {unread > 0 ? (
          <form action={markAllRead} className="row">
            <Submit className="btn" pending="Marking…"><Icon name="check" size={15} strokeWidth={2.2} />Mark all read</Submit>
          </form>
        ) : rows.length > 0 && <span className="pill ok"><Icon name="check" size={13} strokeWidth={2.4} />All caught up</span>}
      </div>
      {rows.length ? groups.map((g) => (
        <section key={g.label} className="ngroup" aria-labelledby={`ng-${g.label}`}>
          <h2 id={`ng-${g.label}`} className="ngroup-h">{g.label}<span>{g.rows.length}</span></h2>
          <ul className="tl nlist card">{g.rows.map((n) => {
            const title = cleanTitle(n.title);
            return (
              <li key={n.id} className={n.read_at ? 'read' : 'unread'}>
                <KindIcon kind={n.kind} title={n.title} size={36} />
                <div className="nbody">
                  {n.link ? <Link href={n.link} className="ntitle">{title}</Link> : <span className="ntitle">{title}</span>}
                  {n.body && <div className="nsub">{typo(n.body)}</div>}
                </div>
                {g.label === 'Today' && Date.now() - +new Date(n.created_at) < 3600_000
                  ? <Ago iso={n.created_at} title={`${date.format(new Date(n.created_at))}, ${fmtTime(n.created_at, tz)}`} />
                  : <time dateTime={n.created_at} title={`${date.format(new Date(n.created_at))}, ${fmtTime(n.created_at, tz)}`}>{g.label === 'Earlier' ? date.format(new Date(n.created_at)) : fmtTime(n.created_at, tz)}</time>}
                {!n.read_at && <span className="unread-dot"><span className="sr">Unread</span></span>}
              </li>
            );
          })}</ul>
        </section>
      )) : (
        <div className="empty">
          <span className="empty-ic" aria-hidden><Icon name="bell" size={26} /></span>
          <b>All quiet</b><span>Notifications appear here as the week runs.</span>
        </div>
      )}
    </div>
  );
}
