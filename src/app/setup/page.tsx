import { redirect } from 'next/navigation';
import { insert, uid, now } from '@/lib/db';
import { hashPassword } from '@/lib/crypto';
import { createSession, hasUsers } from '@/lib/auth';
import { seedProducts } from '@/lib/seed';
import { getSetting, setSetting } from '@/lib/settings';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Set up' };

async function setup(fd: FormData) {
  'use server';
  if (hasUsers()) redirect('/login');
  const name = String(fd.get('name') || '').trim();
  const email = String(fd.get('email') || '').trim().toLowerCase();
  const pw = String(fd.get('password') || '');
  if (!name || !email || pw.length < 8) redirect('/setup?e=1');
  const id = uid('u_');
  insert('users', { id, email, name, pass_hash: hashPassword(pw), role: 'admin', created_at: now() });
  const base = String(fd.get('base') || '').trim().replace(/\/+$/, '');
  const g = getSetting('general');
  if (base) setSetting('general', { ...g, publicBaseUrl: base });
  setSetting('alerts', { ...getSetting('alerts'), alertEmails: email });
  seedProducts();
  await createSession(id);
  redirect('/app?welcome=1');
}

export default async function Setup({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  if (hasUsers()) redirect('/login');
  const sp = await searchParams;
  return (
    <main className="auth">
      <form className="card" action={setup}>
        <div className="eyebrow">First-time setup</div>
        <h1>Welcome to Brief Studio</h1>
        <p className="hint">Create the admin account. Your two products (Unada and HeyVeya), news sources, weekly automations and the four month-1 sample editions will be set up for you.</p>
        {sp.e && <div className="notice bad">Fill in every field. The password needs at least 8 characters.</div>}
        <label className="f"><span>Your name</span><input className="in" name="name" required autoComplete="name" /></label>
        <label className="f"><span>Work email</span><input className="in" type="email" name="email" required autoComplete="email" /><small>Sales alerts go here until you change it.</small></label>
        <label className="f"><span>Password</span><input className="in" type="password" name="password" minLength={8} required autoComplete="new-password" /></label>
        <label className="f"><span>Public address of this app (optional)</span><input className="in" type="url" name="base" placeholder="https://brief.yourdomain.com" /><small>Used in every link you send. You can set it later in Settings.</small></label>
        <button className="btn primary" type="submit">Create account and start</button>
      </form>
    </main>
  );
}
