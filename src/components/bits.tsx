/* Small server-safe presentational helpers. */
const STATUS: Record<string, [string, string]> = {
  draft: ['', 'Draft'], review: ['warn', 'In review'], approved: ['info', 'Approved'], scheduled: ['info', 'Scheduled'], sending: ['warn', 'Sending'], sent: ['ok', 'Sent'],
};
export function StatusPill({ status }: { status: string }) {
  const [cls, label] = STATUS[status] || ['', status];
  return <span className={`pill ${cls}`}><span className="dot" />{label}</span>;
}
const MAT: Record<string, string> = { live: 'ok', delivered: 'ok', pilot: 'warn', prototype: 'warn', concept: 'info' };
export function MaturityPill({ status }: { status: string }) {
  return <span className={`pill ${MAT[status] || ''}`}>{status[0].toUpperCase() + status.slice(1)}</span>;
}
const STAGES: Record<string, string> = { new: '', warm: 'warn', contacted: 'info', meeting: 'info', won: 'ok', lost: 'bad', not_interested: 'bad' };
export const STAGE_LABEL: Record<string, string> = { new: 'New', warm: 'Warm', contacted: 'Contacted', meeting: 'Meeting booked', won: 'Won', lost: 'Lost', not_interested: 'Not interested' };
export function StagePill({ stage }: { stage: string }) {
  return <span className={`pill ${STAGES[stage] || ''}`}>{STAGE_LABEL[stage] || stage}</span>;
}
export function Score({ n }: { n: number }) {
  const cls = n >= 50 ? 'ok' : n >= 15 ? 'warn' : '';
  return <span className={`pill ${cls}`} title="Lead score">{n}</span>;
}

/** Initials avatar with a stable, calm tint derived from the name. */
const hue = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 11);
export function initials(name: string) {
  const parts = name.replace(/[^\p{L}\p{N}\s@.]/gu, '').split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] || '?') + (parts.length > 1 ? parts[1][0] : '')).toUpperCase();
}
export function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  return <span className="avatar" aria-hidden style={{ width: size, height: size, fontSize: Math.round(size * 0.38), ['--h' as string]: hue(name || '?') }}>{initials(name || '?')}</span>;
}
