import { all } from '@/lib/db';
import { requireProduct } from '@/lib/context';
import { JOB_INFO, CRON_PRESETS, ensureJobs } from '@/lib/jobs';
import { getSetting } from '@/lib/settings';
import { ago, fmtTime, fmtDay } from '@/lib/format';
import { Icon } from '@/components/content/icons';
import { JobCard, type JobView } from '@/components/content/jobs';
import { saveJob, runJobNow } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Automations' };

const JOB_UI: Record<string, { icon: string; tone: string }> = {
  ingest: { icon: 'newspaper', tone: 'blue' },
  draft: { icon: 'pencil', tone: 'purple' },
  nudge: { icon: 'send', tone: 'orange' },
  report: { icon: 'chart', tone: 'green' },
  send: { icon: 'envelope', tone: 'teal' },
};
const STATUS_LABEL: Record<string, string> = { ok: 'Succeeded', error: 'Failed', running: 'Running' };

const when = (iso: string, tz: string, opts: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleString('en-IN', { timeZone: tz, ...opts });
/** Old run logs can mention raw record IDs (“Edition ed_L0yi… finished”); readers never need those. */
const tidy = (line: string) => line.replace(/\s*\b(ed|st|c|ct|u|p|kb|j|jr|src|s)_[A-Za-z0-9_-]{5,}\b/g, '').replace(/\s{2,}/g, ' ').trim();
const dayKey = (iso: string, tz: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: tz });

function duration(a: string, b?: string | null) {
  if (!b) return '';
  const s = Math.max(0, Math.round((+new Date(b) - +new Date(a)) / 1000));
  return s < 1 ? 'under 1 s' : s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
}

export default async function Automations() {
  const p = await requireProduct();
  ensureJobs(p.id);
  const g = getSetting('general');
  const tz = g.timezone;
  const jobs = all('SELECT * FROM jobs WHERE product_id = ? ORDER BY CASE type WHEN \'ingest\' THEN 1 WHEN \'draft\' THEN 2 WHEN \'nudge\' THEN 3 ELSE 4 END', p.id);
  const runs = all('SELECT r.*, j.name FROM job_runs r LEFT JOIN jobs j ON j.id = r.job_id WHERE r.product_id = ? OR r.product_id IS NULL ORDER BY r.started_at DESC LIMIT 40', p.id);

  const views: JobView[] = jobs.map((j) => {
    const info = (JOB_INFO as any)[j.type] || {};
    const ui = JOB_UI[j.type] || { icon: 'bolt', tone: 'gray' };
    return {
      id: j.id, label: info.label || j.name, help: info.help || '', icon: ui.icon, tone: ui.tone, cron: j.cron, enabled: !!j.enabled,
      nextIso: j.next_run_at, nextLabel: j.next_run_at ? `${fmtDay(j.next_run_at, tz)}, ${fmtTime(j.next_run_at, tz)}` : '–',
      lastAgo: ago(j.last_run_at), lastStatus: j.last_status,
      lastLabel: j.last_run_at ? `${STATUS_LABEL[j.last_status] || 'Ran'} ${ago(j.last_run_at)}` : 'Never run',
    };
  });

  const today = dayKey(new Date().toISOString(), tz);
  const yesterday = dayKey(new Date(Date.now() - 86400_000).toISOString(), tz);
  const days: { key: string; label: string; items: any[] }[] = [];
  for (const r of runs) {
    const k = dayKey(r.started_at, tz);
    let d = days.find((x) => x.key === k);
    if (!d) days.push((d = { key: k, label: k === today ? 'Today' : k === yesterday ? 'Yesterday' : when(r.started_at, tz, { weekday: 'long', day: 'numeric', month: 'long' }), items: [] }));
    d.items.push(r);
  }

  return (
    <div className="pg au">
      <div className="ph">
        <div><span className="eyebrow">Runs by itself every week</span><h1>Automations</h1><p className="sub">Each job runs on its own schedule in {tz.replace('_', ' ')} time. Scheduled sends and the email queue are checked every minute while the app is running. Nothing is ever sent without your approval.</p></div>
      </div>

      <div className="au-grid">
        {views.map((v) => <JobCard key={v.id} job={v} presets={CRON_PRESETS} save={saveJob} run={runJobNow.bind(null, v.id)} />)}
      </div>

      <section className="au-hist" aria-labelledby="au-hist-h">
        <div className="au-hist-h"><h2 id="au-hist-h" className="section-title">Run history</h2><span className="hint">Last {runs.length} run{runs.length === 1 ? '' : 's'}. Tap one to see its log.</span></div>
        {days.length ? days.map((d) => (
          <div key={d.key} className="au-day">
            <h3 className="cx-group-h">{d.label}</h3>
            <ol className="au-tl">
              {d.items.map((r) => {
                const ui = JOB_UI[r.type] || { icon: 'bolt', tone: 'gray' };
                const name = r.name || (r.type === 'send' ? 'Send queue' : r.type);
                const dur = duration(r.started_at, r.finished_at);
                const lines = String(r.log || '').split('\n').filter(Boolean);
                const lastLine = tidy((lines[lines.length - 1] || '').replace(/^\[[\d:]+\]\s*/, ''));
                return (
                  <li key={r.id} className={`au-tl-i ${r.status}`}>
                    <span className={`au-tl-dot ${r.status}`} aria-hidden>{r.status === 'ok' ? <Icon name="check" size={11} strokeWidth={3} /> : r.status === 'error' ? <Icon name="x" size={10} strokeWidth={3} /> : null}</span>
                    <details>
                      <summary>
                        <span className="au-tl-main">
                          <span className={`cx-tile t-${ui.tone} s-sm`} aria-hidden><Icon name={ui.icon} size={12} strokeWidth={2.2} /></span>
                          <b>{name}</b>
                          <span className="au-chip">{r.trigger === 'manual' ? 'Run now' : 'Scheduled'}</span>
                          <span className={`au-st ${r.status}`}>{STATUS_LABEL[r.status] || r.status}</span>
                        </span>
                        <span className="au-tl-meta">
                          <time dateTime={r.started_at}>{fmtTime(r.started_at, tz)}</time>
                          {dur && <span> · {dur}</span>}
                          {lastLine && <span className="au-tl-last"> · {lastLine.slice(0, 90)}</span>}
                        </span>
                        <Icon name="chevron" size={14} className="au-chev" strokeWidth={2.2} />
                      </summary>
                      <pre className="au-log">{r.log || '(no output)'}</pre>
                    </details>
                  </li>
                );
              })}
            </ol>
          </div>
        )) : <div className="empty cx-empty"><span className="cx-empty-i"><Icon name="clock" size={26} /></span><b>No runs yet</b><span>Runs appear here as each job fires, or when you tap Run now.</span></div>}
      </section>
    </div>
  );
}
