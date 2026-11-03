import { api } from '@/lib/api';
import { getEdition, snapshot } from '@/lib/editions';
import { blockingFailures } from '@/lib/checks';
import { update, now } from '@/lib/db';

export const POST = api<{ id: string }>(async ({ params, body, user }) => {
  const e = getEdition(params.id);
  if (!e) throw new Error('Edition not found');
  if (body.action === 'override') {
    const reason = String(body.reason || '').trim();
    const o = { ...e.overrides };
    if (reason) o[body.checkId] = `${reason} (${user.name}, ${now().slice(0, 10)})`;
    else delete o[body.checkId];
    update('editions', e.id, { overrides: JSON.stringify(o) });
    return { overrides: o };
  }
  if (body.action === 'approve') {
    if (e.status === 'sent' || e.status === 'sending') throw new Error('Already sent.');
    const fails = blockingFailures(e.checks, e.overrides);
    if (fails.length) throw new Error(`Can’t approve yet: ${fails.length} blocking check(s) fail. Fix them or override with a reason.`);
    update('editions', e.id, { status: 'approved', approved_by: user.name, approved_at: now() });
    snapshot(e.id, e.content, user.name, 'Approved');
    return { status: 'approved' };
  }
  if (body.action === 'unapprove') {
    if (e.status === 'sent' || e.status === 'sending') throw new Error('Already sent.');
    update('editions', e.id, { status: 'review', approved_by: null, approved_at: null, scheduled_at: null });
    return { status: 'review' };
  }
  throw new Error('Unknown action');
});
