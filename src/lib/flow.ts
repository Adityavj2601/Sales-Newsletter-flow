/**
 * The ONE model of the weekly flow, used by Home, Editions and the editor.
 * Stages are what the team does, in order. `current` is the next thing to do.
 */
export type FlowStage = 'stories' | 'draft' | 'check' | 'approve' | 'send';
export const FLOW: { key: FlowStage; label: string; verb: string }[] = [
  { key: 'stories', label: 'Stories', verb: 'Pick this week’s stories' },
  { key: 'draft', label: 'Draft', verb: 'Write the draft' },
  { key: 'check', label: 'Check', verb: 'Run the checks' },
  { key: 'approve', label: 'Approve', verb: 'Approve it' },
  { key: 'send', label: 'Send', verb: 'Send or schedule it' },
];

type Ed = { id: string; status: string; updated_at: string; checks: { at: string; results: { status: string; blocking?: boolean; id: string; label: string; detail?: string }[] } | null; overrides?: Record<string, string> } | null | undefined;

export type FlowState = { current: FlowStage | 'done'; blockers: number; scheduled: boolean; title: string; detail: string; href: string; cta: string };

/** Where an edition is in the flow, and the single next action. */
export function flowState(e: Ed, opts: { shortlisted?: number } = {}): FlowState {
  if (!e) {
    const s = opts.shortlisted || 0;
    return s > 0
      ? { current: 'draft', blockers: 0, scheduled: false, title: 'Write this week’s draft', detail: `${s} ${s === 1 ? 'story' : 'stories'} shortlisted.`, href: '/app/editions?new=1', cta: 'New edition' }
      : { current: 'stories', blockers: 0, scheduled: false, title: 'Pick this week’s stories', detail: 'Shortlist 3–6 stories from the pool.', href: '/app/stories', cta: 'Open Story pool' };
  }
  if (e.status === 'sent' || e.status === 'sending') return { current: 'done', blockers: 0, scheduled: false, title: e.status === 'sent' ? 'Sent' : 'Sending', detail: 'See who read it and who tapped.', href: `/app/editions/${e.id}/analytics`, cta: 'View results' };
  if (e.status === 'scheduled') return { current: 'send', blockers: 0, scheduled: true, title: 'Scheduled', detail: 'It goes out automatically.', href: `/app/editions/${e.id}/distribute`, cta: 'View schedule' };
  if (e.status === 'approved') return { current: 'send', blockers: 0, scheduled: false, title: 'Choose who gets it', detail: 'Approved and ready to send.', href: `/app/editions/${e.id}/distribute`, cta: 'Send or schedule' };
  const ov = e.overrides || {};
  const key = (r: { id: string; label: string; detail?: string }) => `${r.id}|${r.label}|${r.detail || ''}`;
  const stale = !e.checks || e.checks.at < e.updated_at;
  const blockers = e.checks ? e.checks.results.filter((r) => r.status === 'fail' && r.blocking && !ov[key(r)]).length : 0;
  if (stale) return { current: 'check', blockers, scheduled: false, title: e.checks ? 'Re-run the checks' : 'Run the checks', detail: e.checks ? 'You edited it since the last check.' : 'Sources, links, wording and facts.', href: `/app/editions/${e.id}`, cta: 'Open editor' };
  if (blockers) return { current: 'check', blockers, scheduled: false, title: `Fix ${blockers} ${blockers === 1 ? 'issue' : 'issues'}`, detail: 'Blocking checks must pass or be overridden with a reason.', href: `/app/editions/${e.id}`, cta: 'Open editor' };
  return { current: 'approve', blockers: 0, scheduled: false, title: 'Approve it', detail: 'All blocking checks pass.', href: `/app/editions/${e.id}`, cta: 'Review and approve' };
}

export const stageIndex = (s: FlowStage | 'done') => (s === 'done' ? FLOW.length : FLOW.findIndex((f) => f.key === s));
