import { all } from '@/lib/db';
import { requireProduct } from '@/lib/context';
import { JOB_INFO, CRON_PRESETS, ensureJobs } from '@/lib/jobs';
import { getSetting } from '@/lib/settings';
import { ago, fmtDate } from '@/lib/format';
import { Submit } from '@/components/ui';
import { saveJob, runJobNow } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Automations' };

export default async function Automations() {
  const p = await requireProduct();
  ensureJobs(p.id);
  const g = getSetting('general');
  const jobs = all('SELECT * FROM jobs WHERE product_id = ? ORDER BY CASE type WHEN \'ingest\' THEN 1 WHEN \'draft\' THEN 2 WHEN \'nudge\' THEN 3 ELSE 4 END', p.id);
  const runs = all('SELECT r.*, j.name FROM job_runs r LEFT JOIN jobs j ON j.id = r.job_id WHERE r.product_id = ? OR r.product_id IS NULL ORDER BY r.started_at DESC LIMIT 40', p.id);
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="ph"><div><div className="eyebrow">Runs by itself every week</div><h1>Automations</h1><p className="sub">Times are in {g.timezone}. Scheduled sends and the email queue are checked every minute while the app is running. Nothing is ever sent without your approval.</p></div></div>
      <div className="grid2">
        {jobs.map((j) => {
          const info = (JOB_INFO as any)[j.type];
          const preset = CRON_PRESETS.find((x) => x.cron === j.cron);
          return (
            <form key={j.id} action={saveJob} className="card" style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
              <input type="hidden" name="id" value={j.id} />
              <div className="row"><h2 style={{ margin: 0 }}>{info?.label || j.name}</h2><span className="spacer" />{j.last_status && <span className={`pill ${j.last_status === 'ok' ? 'ok' : j.last_status === 'error' ? 'bad' : 'warn'}`}>{j.last_status}</span>}</div>
              <p className="hint" style={{ margin: 0 }}>{info?.help}</p>
              <div className="form-grid">
                <label className="f"><span>When</span><select className="in" name="cron" defaultValue={preset ? j.cron : ''}>{CRON_PRESETS.map((c) => <option key={c.cron} value={c.cron}>{c.label}</option>)}<option value="">Custom (below)</option></select></label>
                <label className="f"><span>Custom cron</span><input className="in mono" name="cron_custom" defaultValue={preset ? '' : j.cron} placeholder="min hour day month weekday" /></label>
              </div>
              <label className="check"><input type="checkbox" name="enabled" defaultChecked={!!j.enabled} /><span>On</span></label>
              <div className="hint">Next run: {j.enabled ? `${fmtDate(j.next_run_at, g.timezone, true)} (${ago(j.next_run_at)})` : 'off'} · Last: {ago(j.last_run_at)}</div>
              <div className="row"><Submit className="btn sm">Save</Submit><button className="btn sm primary" formAction={runJobNow.bind(null, j.id)}>Run now</button></div>
            </form>
          );
        })}
      </div>
      <section className="card">
        <h2>Run history</h2>
        {runs.length ? <div className="stack" style={{ gap: 8, marginTop: 10 }}>{runs.map((r) => (
          <details key={r.id} className="more" style={{ borderBottom: '1px solid var(--line-2)', paddingBottom: 8 }}>
            <summary><span className={`pill ${r.status === 'ok' ? 'ok' : r.status === 'error' ? 'bad' : 'warn'}`}>{r.status}</span> <b style={{ color: 'var(--ink)' }}>{r.name || (r.type === 'send' ? 'Send queue' : r.type)}</b> · {r.trigger} · {ago(r.started_at)}</summary>
            <pre className="mono" style={{ whiteSpace: 'pre-wrap', fontSize: 12, background: 'var(--surface-2)', padding: 10, borderRadius: 8, marginTop: 8 }}>{r.log || '(no output)'}</pre>
          </details>
        ))}</div> : <p className="hint">No runs yet.</p>}
      </section>
    </div>
  );
}
