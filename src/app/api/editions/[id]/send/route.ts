import { api } from '@/lib/api';
import { getEdition } from '@/lib/editions';
import { queueEdition, scheduleEdition, unscheduleEdition, sendTestEmail, markSent, canSend, retryFailed } from '@/lib/send';
import { zonedToUtc } from '@/lib/format';
import { getSetting } from '@/lib/settings';
import { tick } from '@/lib/jobs';

export const maxDuration = 120;
export const POST = api<{ id: string }>(async ({ params, body }) => {
  const e = getEdition(params.id);
  if (!e) throw new Error('Edition not found');
  const cfg = { channels: (body.channels?.length ? body.channels : ['email']) as ('email' | 'whatsapp')[], audience: body.audience || {} };
  switch (body.mode) {
    case 'test': {
      const to = String(body.to || '').trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) throw new Error('Enter a valid email address for the test.');
      const r = await sendTestEmail(e.id, to);
      return { message: r.outbox ? 'SMTP is not connected, so the test email was saved to the Outbox.' : `Test sent to ${to}.` };
    }
    case 'now': {
      const n = queueEdition(e.id, cfg);
      if (!n) return { message: 'Everyone in this audience already has it. Nothing new to send.' };
      tick().catch(() => null);
      return { message: `${n} message(s) queued. Sending now at the pace set in Settings.` };
    }
    case 'schedule': {
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(body.at || ''))) throw new Error('Pick a date and time for the send.');
      const at = zonedToUtc(String(body.at), getSetting('general').timezone);
      scheduleEdition(e.id, at, cfg);
      return { message: 'Scheduled.', at };
    }
    case 'unschedule': unscheduleEdition(e.id); return { message: 'Schedule cancelled. The edition is still approved.' };
    case 'retry': {
      const n = retryFailed(e.id);
      tick().catch(() => null);
      return { message: n ? `${n} failed message(s) queued again.` : 'Nothing failed to retry.' };
    }
    case 'markSent': {
      const why = canSend(e);
      if (why) throw new Error(why);
      markSent(e.id);
      return { message: 'Marked as sent. Analytics now count this edition.' };
    }
  }
  throw new Error('Unknown mode');
});
