import { all } from '@/lib/db';

/** Contact (or teammate) names for the addresses in view, so avatars and labels use real names, never email initials. */
export function namesFor(emails: string[]) {
  const list = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  const map = new Map<string, string>();
  if (!list.length) return map;
  const q = list.map(() => '?').join(',');
  for (const u of all(`SELECT lower(email) AS e, name FROM users WHERE lower(email) IN (${q})`, ...list)) if (u.name) map.set(u.e, String(u.name));
  for (const c of all(`SELECT lower(email) AS e, first_name, last_name FROM contacts WHERE lower(email) IN (${q})`, ...list)) {
    const n = `${c.first_name || ''} ${c.last_name || ''}`.trim();
    if (n) map.set(c.e, n);
  }
  return map;
}
