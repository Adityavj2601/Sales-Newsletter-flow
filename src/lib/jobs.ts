import { CronExpressionParser } from 'cron-parser';
import { all, get, insert, update, uid, now, parse } from './db';
import { getSetting, getProduct, listProducts, baseUrl } from './settings';
import { ingestProduct } from './ingest';
import { draftEdition } from './editions';
import { runChecks } from './checks';
import { notify } from './alerts';
import { processQueue, startDueEditions } from './send';
import { sendMail } from './mailer';
import { esc } from './render/common';
import { nextSendDate, fmtDate } from './format';

export type JobType = 'ingest' | 'draft' | 'report' | 'nudge';
export const JOB_INFO: Record<JobType, { label: string; help: string; defaultCron: string }> = {
  ingest: { label: 'Fetch news', help: 'Reads every active source, stores new stories, fetches article text and scores relevance.', defaultCron: '0 6 * * *' },
  draft: { label: 'Draft this week’s edition', help: 'Writes an AI draft from the best stories and the next “Our work” items, runs the checks and tells you it is ready for review. Skips if an edition is already planned for the next send date.', defaultCron: '0 9 * * 1' },
  report: { label: 'Weekly report', help: 'Emails a summary of the last edition and the hottest leads to your alert address.', defaultCron: '30 17 * * 5' },
  nudge: { label: 'Follow-up suggestions', help: 'Finds readers who engaged in the last 3 days without tapping a button and lists them for a personal follow-up.', defaultCron: '0 11 * * *' },
};
export const CRON_PRESETS: { label: string; cron: string }[] = [
  { label: 'Every day, 6:00', cron: '0 6 * * *' },
  { label: 'Every day, 11:00', cron: '0 11 * * *' },
  { label: 'Mondays, 9:00', cron: '0 9 * * 1' },
  { label: 'Tuesdays, 9:00', cron: '0 9 * * 2' },
  { label: 'Fridays, 17:30', cron: '30 17 * * 5' },
  { label: 'Every 6 hours', cron: '0 */6 * * *' },
];

export function nextRun(cron: string, from = new Date()): string | null {
  if (!cron || cron.trim().split(/\s+/).length !== 5) return null; // exactly 5 fields: minute hour day month weekday
  try {
    return CronExpressionParser.parse(cron, { tz: getSetting('general').timezone, currentDate: from }).next().toISOString();
  } catch {
    return null;
  }
}

export function ensureJobs(productId: string) {
  for (const type of Object.keys(JOB_INFO) as JobType[]) {
    if (!get('SELECT id FROM jobs WHERE product_id = ? AND type = ?', productId, type)) {
      const cron = JOB_INFO[type].defaultCron;
      insert('jobs', { id: uid('job_'), product_id: productId, type, name: JOB_INFO[type].label, cron, enabled: type === 'draft' ? 1 : 1, config: '{}', last_run_at: null, last_status: null, next_run_at: nextRun(cron), created_at: now() });
    }
  }
}

async function execute(type: JobType, productId: string, log: (s: string) => void, config: any = {}) {
  const p = getProduct(productId);
  if (!p) throw new Error('Product missing');
  if (type === 'ingest') {
    const r = await ingestProduct(p.id, log);
    if (r.added) notify(p.id, 'stories', `${r.added} new stories in the pool`, 'Shortlist the best ones before Monday’s draft.', '/app/stories');
    return;
  }
  if (type === 'draft') {
    const planned = nextSendDate(getSetting('general'));
    const exists = get('SELECT id, number, status FROM editions WHERE product_id = ? AND planned_for = ?', p.id, planned);
    if (exists && !config.force) { log(`#${exists.number} is already ${exists.status === 'sent' ? 'sent' : 'planned'} for ${planned}. Skipped.`); return; }
    // Run now: draft for the next free send date instead of doubling up a week.
    const target = exists ? nextSendDate(getSetting('general'), all('SELECT planned_for FROM editions WHERE product_id = ?', p.id).map((r) => r.planned_for)) : planned;
    const { edition, mode, model } = await draftEdition(p.id, { plannedFor: target }, 'automation');
    log(`Drafted #${edition.number} (${mode === 'ai' ? model : 'demo mode'})`);
    const checks = await runChecks(edition.id, true);
    const fails = checks.results.filter((r) => r.status === 'fail').length;
    log(`Checks: ${fails} failing, ${checks.results.filter((r) => r.status === 'warn').length} warnings`);
    notify(p.id, 'draft', `Draft #${edition.number} is ready for review`, `“${edition.content.title}”. ${fails ? `${fails} check(s) need attention.` : 'All blocking checks pass.'}`, `/app/editions/${edition.id}`);
    return;
  }
  if (type === 'nudge') {
    const since = new Date(Date.now() - 3 * 86400_000).toISOString();
    const rows = all(`SELECT c.id, c.first_name, c.last_name, c.company, c.score FROM contacts c
      WHERE c.product_id = ? AND c.status = 'active' AND c.last_engaged_at >= ? AND (c.last_intent_at IS NULL OR c.last_intent_at < ?) AND c.stage IN ('new','warm')
      AND EXISTS (SELECT 1 FROM events e WHERE e.contact_id = c.id AND e.type IN ('view','poll','scroll') AND e.created_at >= ?)
      ORDER BY c.score DESC LIMIT 15`, p.id, since, since, since);
    if (rows.length) notify(p.id, 'nudge', `${rows.length} warm ${rows.length === 1 ? 'reader' : 'readers'} to follow up`, rows.slice(0, 5).map((r) => `${r.first_name} ${r.last_name}${r.company ? ` (${r.company})` : ''}`.trim()).join(', ') + (rows.length > 5 ? '…' : ''), '/app/leads?view=warm');
    log(`${rows.length} warm readers found`);
    return;
  }
  if (type === 'report') {
    const to = [p.brand.alertEmail, ...getSetting('alerts').alertEmails.split(',')].map((s) => (s || '').trim()).filter(Boolean);
    const last = get("SELECT * FROM editions WHERE product_id = ? AND status = 'sent' ORDER BY sent_at DESC LIMIT 1", p.id);
    const stats = last ? get(`SELECT
      (SELECT COUNT(*) FROM deliveries WHERE edition_id = ? AND channel <> 'test' AND status NOT IN ('failed','queued','skipped')) AS sent,
      (SELECT COUNT(DISTINCT COALESCE(delivery_id, id)) FROM events WHERE edition_id = ? AND type = 'view') AS views,
      (SELECT COUNT(*) FROM events WHERE edition_id = ? AND type IN ('interested','book','showcase')) AS intents,
      (SELECT COUNT(*) FROM events WHERE edition_id = ? AND type = 'poll') AS polls`, last.id, last.id, last.id, last.id) : null;
    const hot = all("SELECT first_name, last_name, company, score, last_intent FROM contacts WHERE product_id = ? AND status = 'active' ORDER BY score DESC LIMIT 10", p.id).filter((r) => r.score > 0);
    const base = baseUrl();
    const title = parse<any>(last?.content, {}).title || '';
    const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;max-width:560px"><h2 style="margin:0 0 8px">${esc(p.newsletter_name)} · weekly report</h2>
      ${last ? `<p>Last edition: <b>#${last.number} ${esc(title)}</b> (sent ${esc(fmtDate(last.sent_at))})</p><table cellpadding="6" style="border-collapse:collapse"><tr><td>Delivered</td><td><b>${stats?.sent || 0}</b></td></tr><tr><td>Opened the page</td><td><b>${stats?.views || 0}</b></td></tr><tr><td>Interest taps</td><td><b>${stats?.intents || 0}</b></td></tr><tr><td>Poll votes</td><td><b>${stats?.polls || 0}</b></td></tr></table>` : '<p>No edition was sent yet.</p>'}
      <h3>Hottest leads</h3>${hot.length ? `<ol>${hot.map((h) => `<li>${esc(`${h.first_name} ${h.last_name}`.trim())}${h.company ? `, ${esc(h.company)}` : ''}: score ${h.score}${h.last_intent ? ` · last tapped “${esc(({ interested: 'I’m interested', book: 'Book 15 min', showcase: 'an Our-work card', more: 'Send me more' } as any)[h.last_intent] || h.last_intent)}”` : ''}</li>`).join('')}</ol>` : '<p>No engagement yet.</p>'}
      <p><a href="${base}/app/leads">Open leads</a></p></div>`;
    if (to.length) await sendMail({ to: to.join(','), subject: `${p.newsletter_name}: weekly report`, html, kind: 'report' });
    notify(p.id, 'report', 'Weekly report ready', last ? `#${last.number}: ${stats?.views || 0} views, ${stats?.intents || 0} interest taps` : 'No edition sent yet', '/app');
    log(to.length ? `Report emailed to ${to.join(', ')}` : 'No alert email set. Report saved as a notification only.');
  }
}

/** Run a job now and record the run. */
export async function runJob(jobId: string, trigger: 'schedule' | 'manual', config: any = {}) {
  const j = get('SELECT * FROM jobs WHERE id = ?', jobId);
  if (!j) throw new Error('Job not found');
  const runId = uid('run_');
  const lines: string[] = [];
  const log = (s: string) => lines.push(`[${new Date().toISOString().slice(11, 19)}] ${s}`);
  insert('job_runs', { id: runId, job_id: j.id, product_id: j.product_id, type: j.type, trigger, status: 'running', log: '', started_at: now(), finished_at: null });
  update('jobs', j.id, { last_run_at: now(), last_status: 'running', next_run_at: nextRun(j.cron) });
  let status = 'ok';
  try {
    await execute(j.type, j.product_id, log, { ...parse(j.config, {}), ...config });
  } catch (e: any) {
    status = 'error';
    log(`Error: ${e?.message || e}`);
    notify(j.product_id, 'error', `Automation failed: ${j.name}`, String(e?.message || e).slice(0, 300), '/app/automations');
  }
  update('job_runs', runId, { status, log: lines.join('\n'), finished_at: now() });
  update('jobs', j.id, { last_status: status });
  return { status, log: lines };
}

let ticking = false;
/** One scheduler tick: due jobs, scheduled editions, send queue. Safe to call from the in-process timer or /api/cron. */
export async function tick() {
  if (ticking) return { skipped: true };
  ticking = true;
  const out: string[] = [];
  try {
    for (const p of listProducts()) ensureJobs(p.id);
    const due = all('SELECT * FROM jobs WHERE enabled = 1 AND next_run_at IS NOT NULL AND next_run_at <= ?', now());
    for (const j of due) {
      out.push(`job ${j.type}`);
      await runJob(j.id, 'schedule');
    }
    for (const j of all('SELECT id, cron FROM jobs WHERE enabled = 1 AND next_run_at IS NULL')) update('jobs', j.id, { next_run_at: nextRun(j.cron) });
    const qlog: string[] = [];
    startDueEditions((s) => qlog.push(s));
    await processQueue((s) => qlog.push(s));
    if (qlog.length) {
      insert('job_runs', { id: uid('run_'), job_id: null, product_id: null, type: 'send', trigger: 'schedule', status: qlog.some((l) => l.startsWith('✕')) ? 'error' : 'ok', log: qlog.join('\n'), started_at: now(), finished_at: now() });
      out.push(...qlog);
    }
  } finally {
    ticking = false;
  }
  return { ran: out };
}

declare global {
  // eslint-disable-next-line no-var
  var __snfScheduler: NodeJS.Timeout | undefined;
}
export function startScheduler() {
  if (globalThis.__snfScheduler || process.env.DISABLE_SCHEDULER === '1') return;
  const loop = () => tick().catch((e) => console.error('[scheduler]', e));
  globalThis.__snfScheduler = setInterval(loop, 60_000);
  setTimeout(loop, 5_000);
  console.log('[scheduler] started: checks jobs, scheduled sends and the send queue every minute');
}
