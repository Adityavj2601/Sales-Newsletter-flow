import { api } from '@/lib/api';
import { getEdition, snapshot } from '@/lib/editions';
import { blockingFailures, runChecks } from '@/lib/checks';
import { update, now } from '@/lib/db';

export const POST = api<{ id: string }>(async ({ params, body, user }) => {
  const e = getEdition(params.id);
  if (!e) throw new Error('Edition not found');
  if (body.action === 'override') {
    if (e.status === 'sent' || e.status === 'sending') throw new Error('This edition was already sent.');
    const reason = String(body.reason || '').trim();
    if (reason && reason.length < 5) throw new Error('Give a short reason (at least 5 characters).');
    if (reason && !e.checks?.results.some((r) => r.id === body.checkId && r.status === 'fail')) throw new Error('That check isn’t failing any more. Run the checks again.');
    const o = { ...e.overrides };
    if (reason) o[body.checkId] = `${reason} (${user.name}, ${now().slice(0, 10)})`;
    else delete o[body.checkId];
    update('editions', e.id, { overrides: JSON.stringify(o) });
    return { overrides: o };
  }
  if (body.action === 'approve') {
    if (e.status === 'sent' || e.status === 'sending') throw new Error('Already sent.');
    // Checks must describe the content being approved: re-run them if anything changed since the last run.
    let checks = e.checks;
    const stale = !checks || checks.at < e.updated_at || checks.results.some((r) => r.id === 'links' && r.status === 'skip');
    if (stale) checks = await runChecks(e.id, true);
    const fails = blockingFailures(checks, e.overrides);
    if (fails.length) return new Response(JSON.stringify({ error: `Can’t approve yet: ${fails.length} blocking check(s) fail. Fix them or override with a reason.`, checks }), { status: 400 });
    update('editions', e.id, { status: 'approved', approved_by: user.name, approved_at: now() });
    snapshot(e.id, e.content, user.name, 'Approved');
    return { status: 'approved', checks };
  }
  if (body.action === 'unapprove') {
    if (e.status === 'sent' || e.status === 'sending') throw new Error('Already sent.');
    update('editions', e.id, { status: 'review', approved_by: null, approved_at: null, scheduled_at: null });
    return { status: 'review' };
  }
  throw new Error('Unknown action');
});
