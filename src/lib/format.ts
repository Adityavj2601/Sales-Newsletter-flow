import type { General } from './settings';

export const TZ_DEFAULT = 'Asia/Kolkata';

export const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
export const num = (n: number) => Math.round(n).toLocaleString('en-IN');
export const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '–');

export function fmtDate(iso: string | null | undefined, tz = TZ_DEFAULT, withTime = false) {
  if (!iso) return '–';
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00Z' : iso);
  if (isNaN(+d)) return '–';
  return d.toLocaleString('en-IN', { timeZone: tz, day: 'numeric', month: 'short', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit', hour12: true } : {}) });
}
export function fmtDay(iso: string | null | undefined, tz = TZ_DEFAULT) {
  if (!iso) return '–';
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00Z' : iso);
  return d.toLocaleDateString('en-IN', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short' });
}
export function ago(iso: string | null | undefined) {
  if (!iso) return 'never';
  const s = (Date.now() - +new Date(iso)) / 1000;
  if (s < 0) {
    const f = -s;
    if (f < 3600) return `in ${Math.max(1, Math.round(f / 60))} min`;
    if (f < 86400) return `in ${Math.round(f / 3600)} h`;
    { const n = Math.round(f / 86400); return `in ${n} day${n === 1 ? '' : 's'}`; }
  }
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  { const n = Math.round(s / 86400); return `${n} day${n === 1 ? '' : 's'} ago`; }
}

/** Minutes offset of a time zone from UTC at a given instant. */
function tzOffsetMin(tz: string, at: Date) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(at);
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second'));
  return (asUtc - +at) / 60000;
}
/** "2026-11-12T10:00" in tz → UTC ISO string. */
export function zonedToUtc(local: string, tz = TZ_DEFAULT): string {
  const [d, t = '00:00'] = local.split('T');
  const [y, m, day] = d.split('-').map(Number);
  const [hh, mm] = t.split(':').map(Number);
  const guess = new Date(Date.UTC(y, m - 1, day, hh, mm));
  const off = tzOffsetMin(tz, guess);
  return new Date(+guess - off * 60000).toISOString();
}
/** UTC ISO → "YYYY-MM-DDTHH:MM" in tz (for datetime-local inputs). */
export function utcToZonedInput(iso: string, tz = TZ_DEFAULT): string {
  const d = new Date(iso);
  const off = tzOffsetMin(tz, d);
  return new Date(+d + off * 60000).toISOString().slice(0, 16);
}
export function todayIn(tz = TZ_DEFAULT) {
  return utcToZonedInput(new Date().toISOString(), tz).slice(0, 10);
}

/** Next date (YYYY-MM-DD) on the configured send weekday that isn't already planned. */
export function nextSendDate(g: General, taken: (string | null)[] = []): string {
  const tz = g.timezone || TZ_DEFAULT;
  const today = todayIn(tz);
  const d = new Date(today + 'T12:00:00Z');
  const set = new Set(taken.filter(Boolean));
  for (let i = 0; i < 120; i++) {
    const iso = d.toISOString().slice(0, 10);
    if (d.getUTCDay() === g.sendDay && iso > today && !set.has(iso)) return iso;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return today;
}
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function personalize(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)).replace(/^,\s*/, '').replace(/^\s*([a-z])/, (s) => s.toUpperCase());
}

/** "+919811111111" → "+91 98111 11111" (other countries: "+CC rest" grouped). */
export function fmtPhone(p: string | null | undefined): string {
  if (!p) return '';
  const d = String(p).replace(/[^\d+]/g, '');
  const m = d.match(/^\+91(\d{5})(\d{5})$/);
  if (m) return `+91 ${m[1]} ${m[2]}`;
  const g = d.match(/^\+(\d{1,3})(\d+)$/);
  return g ? `+${g[1]} ${g[2].replace(/(\d{3,4})(?=\d{3,4}$)/, '$1 ')}` : String(p);
}
/** Edition number everywhere: "#2". */
export const edNo = (n: number) => `#${n}`;
/** "9:01 pm" in the app's time zone (en-IN, 12-hour). */
export function fmtTime(iso: string | null | undefined, tz = TZ_DEFAULT) {
  if (!iso) return '–';
  return new Date(iso).toLocaleTimeString('en-IN', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true }).replace(/\s?(am|pm)$/i, (x) => ` ${x.trim().toLowerCase()}`);
}

/**
 * Relative words for a planned DAY (send dates): "today", "tomorrow", "in 3 days", "yesterday", "4 days ago".
 * Use this for edition dates everywhere; use ago() for exact instants (job runs, events).
 */
export function relDay(day: string | null | undefined, tz = TZ_DEFAULT): string {
  if (!day) return '';
  const diff = Math.round((+new Date(day.slice(0, 10) + 'T12:00:00Z') - +new Date(todayIn(tz) + 'T12:00:00Z')) / 86400_000);
  return diff === 0 ? 'today' : diff === 1 ? 'tomorrow' : diff > 1 ? `in ${diff} days` : diff === -1 ? 'yesterday' : `${-diff} days ago`;
}
