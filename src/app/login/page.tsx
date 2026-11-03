import { redirect } from 'next/navigation';
import { get } from '@/lib/db';
import { verifyPassword } from '@/lib/crypto';
import { createSession, currentUser, hasUsers } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sign in' };

async function login(fd: FormData) {
  'use server';
  const email = String(fd.get('email') || '').trim().toLowerCase();
  const pw = String(fd.get('password') || '');
  const u = get('SELECT * FROM users WHERE email = ?', email);
  if (!u || !verifyPassword(pw, u.pass_hash)) redirect('/login?e=1');
  await createSession(u.id);
  redirect('/app');
}

export default async function Login({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  if (!hasUsers()) redirect('/setup');
  if (await currentUser()) redirect('/app');
  const sp = await searchParams;
  return (
    <main className="auth">
      <form className="card" action={login}>
        <div className="eyebrow">Brief Studio</div>
        <h1>Sign in</h1>
        {sp.e && <div className="notice bad">That email and password don’t match. Try again.</div>}
        <label className="f"><span>Email</span><input className="in" type="email" name="email" required autoComplete="email" /></label>
        <label className="f"><span>Password</span><input className="in" type="password" name="password" required autoComplete="current-password" /></label>
        <button className="btn primary" type="submit">Sign in</button>
        <p className="hint">Forgot it? An admin can reset passwords under Settings → Team.</p>
      </form>
    </main>
  );
}
