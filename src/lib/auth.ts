import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { get, all } from './db';
import { sign, unsign } from './crypto';

export type User = { id: string; email: string; name: string; role: 'admin' | 'editor' };
const COOKIE = 'snf_session';
const DAYS = 14;

export async function createSession(userId: string) {
  const exp = Date.now() + DAYS * 86400_000;
  (await cookies()).set(COOKIE, sign({ uid: userId, exp }), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production' && (process.env.PUBLIC_BASE_URL || '').startsWith('https'),
    path: '/',
    maxAge: DAYS * 86400,
  });
}
export async function destroySession() {
  (await cookies()).delete(COOKIE);
}
export async function currentUser(): Promise<User | null> {
  const s = unsign<{ uid: string; exp: number }>((await cookies()).get(COOKIE)?.value);
  if (!s || s.exp < Date.now()) return null;
  return (get<User>('SELECT id, email, name, role FROM users WHERE id = ?', s.uid) as User) || null;
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
export async function requireAdmin(): Promise<User> {
  const u = await requireUser();
  if (u.role !== 'admin') throw new Error('Only admins can change this.');
  return u;
}
