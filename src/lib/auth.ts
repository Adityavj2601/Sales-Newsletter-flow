import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { get, all, run } from './db';
import { sign, unsign } from './crypto';
import { baseUrl } from './settings';

export type User = { id: string; email: string; name: string; role: 'admin' | 'editor' };
const COOKIE = 'snf_session';
const DAYS = 14;

function secureCookie() {
  const base = baseUrl();
  return process.env.NODE_ENV === 'production' && base.startsWith('https');
}

export async function createSession(userId: string) {
  const exp = Date.now() + DAYS * 86400_000;
  const u = get('SELECT session_version FROM users WHERE id = ?', userId);
  (await cookies()).set(COOKIE, sign({ uid: userId, exp, v: u?.session_version || 0 }), {
    httpOnly: true, sameSite: 'lax', secure: secureCookie(), path: '/', maxAge: DAYS * 86400,
  });
}
/** Ends this session and every other session of the user (logout is "sign out everywhere"). */
export async function destroySession() {
  const u = await currentUser();
  if (u) revokeSessions(u.id);
  (await cookies()).delete(COOKIE);
}
export function revokeSessions(userId: string) {
  run('UPDATE users SET session_version = session_version + 1 WHERE id = ?', userId);
}
export async function currentUser(): Promise<User | null> {
  const s = unsign<{ uid: string; exp: number; v?: number }>((await cookies()).get(COOKIE)?.value);
  if (!s || s.exp < Date.now()) return null;
  const u = get('SELECT id, email, name, role, session_version FROM users WHERE id = ?', s.uid);
  if (!u || (u.session_version || 0) !== (s.v || 0)) return null;
  return { id: u.id, email: u.email, name: u.name, role: u.role };
}
export const hasUsers = () => all('SELECT id FROM users LIMIT 1').length > 0;

/** For pages: redirects to login/setup when not signed in. */
export async function requireUser(): Promise<User> {
  const u = await currentUser();
  if (!u) redirect(hasUsers() ? '/login' : '/setup');
  return u;
}
/** For API routes: throws a Response the handler should return. */
export async function apiUser(): Promise<User> {
  const u = await currentUser();
  if (!u) throw new Response(JSON.stringify({ error: 'Please sign in again.' }), { status: 401 });
  return u;
}
/** For admin-only server actions: editors are sent back with a clear message instead of an error page. */
export async function requireAdmin(): Promise<User> {
  const u = await requireUser();
  if (u.role !== 'admin') redirect('/app/settings?tab=team&msg=' + encodeURIComponent('Only admins can change settings. Ask an admin to make this change.'));
  return u;
}

/* ---------- Login throttling (in memory, per email and per IP) ---------- */
const fails = new Map<string, { n: number; until: number; first: number }>();
export function loginBlocked(keys: string[]): number {
  const now = Date.now();
  let wait = 0;
  for (const k of keys) { const f = fails.get(k); if (f && f.until > now) wait = Math.max(wait, f.until - now); }
  return wait;
}
export function loginFailed(keys: string[]) {
  const now = Date.now();
  for (const k of keys) {
    const f = fails.get(k) && now - fails.get(k)!.first < 15 * 60_000 ? fails.get(k)! : { n: 0, until: 0, first: now };
    f.n++;
    // Per-IP: lock after 5 failures. Per-account: only after 10, and briefly, so strangers can't lock a real user out for long.
    const limit = k.startsWith('e:') ? 10 : 5;
    if (f.n >= limit) f.until = now + Math.min(k.startsWith('e:') ? 2 * 60_000 : 15 * 60_000, 30_000 * 2 ** (f.n - limit));
    fails.set(k, f);
  }
}
export function loginOk(keys: string[]) { for (const k of keys) fails.delete(k); }
