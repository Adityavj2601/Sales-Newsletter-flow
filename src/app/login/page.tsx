import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { get } from '@/lib/db';
import { verifyPassword } from '@/lib/crypto';
import { createSession, currentUser, hasUsers, loginBlocked, loginFailed, loginOk } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sign in' };

// Same cost for unknown emails, so response time doesn't reveal which accounts exist.
const DUMMY = 's1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

async function login(fd: FormData) {
  'use server';
  const email = String(fd.get('email') || '').trim().toLowerCase();
  const pw = String(fd.get('password') || '');
  const h = await headers();
  // Only trust proxy headers when told the app runs behind one (otherwise anyone can fake their IP).
  const ip = process.env.TRUST_PROXY === '1' ? (h.get('x-forwarded-for') || '').split(',')[0].trim() || h.get('x-real-ip') || 'proxy' : 'direct';
  const keys = [`e:${email}`, `ip:${ip}`];
  const wait = loginBlocked(keys);
  if (wait) redirect(`/login?e=wait&s=${Math.ceil(wait / 1000)}`);
  const u = get('SELECT * FROM users WHERE email = ?', email);
  const ok = verifyPassword(pw, u?.pass_hash || DUMMY) && !!u;
  if (!ok) { loginFailed(keys); redirect('/login?e=1'); }
  loginOk(keys);
  await createSession(u!.id);
  redirect('/app');
}

export default async function Login({ searchParams }: { searchParams: Promise<{ e?: string; s?: string }> }) {
  if (!hasUsers()) redirect('/setup');
  if (await currentUser()) redirect('/app');
  const sp = await searchParams;
  return (
    <main className="auth">
      <form className="card" action={login}>
        <div className="eyebrow">Brief Studio</div>
        <h1>Sign in</h1>
        {sp.e === 'wait' ? <div className="notice bad">Too many attempts. Try again in {sp.s || 'a few'} seconds.</div>
          : sp.e ? <div className="notice bad">That email and password don’t match. Try again.</div> : null}
        <label className="f"><span>Email</span><input className="in" type="email" name="email" required autoComplete="email" /></label>
        <label className="f"><span>Password</span><input className="in" type="password" name="password" required autoComplete="current-password" /></label>
        <button className="btn primary" type="submit">Sign in</button>
        <p className="hint">Forgot it? An admin can reset passwords under Settings → Team.</p>
      </form>
    </main>
  );
}
