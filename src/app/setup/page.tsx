import { redirect } from 'next/navigation';
import { insert, uid, now } from '@/lib/db';
import { hashPassword } from '@/lib/crypto';
import { createSession, hasUsers } from '@/lib/auth';
import { seedProducts } from '@/lib/seed';
import { getSetting, setSetting } from '@/lib/settings';
import { Submit } from '@/components/ui';
import { Icon, type IconName } from '@/components/shell/icons';
import { AuthField } from '@/components/shell/AuthField';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Set up' };

async function setup(fd: FormData) {
  'use server';
  if (hasUsers()) redirect('/login');
  const name = String(fd.get('name') || '').trim();
  const email = String(fd.get('email') || '').trim().toLowerCase();
  const pw = String(fd.get('password') || '');
  if (!name || !/^[^@\s"'<>]+@[^@\s"'<>]+\.[a-z]{2,}$/i.test(email) || pw.length < 8) redirect('/setup?e=1');
  const id = uid('u_');
  insert('users', { id, email, name, pass_hash: hashPassword(pw), role: 'admin', created_at: now() });
  const base = String(fd.get('base') || '').trim().replace(/\/+$/, '');
  const g = getSetting('general');
  if (base && /^https?:\/\/[^\s"'<>]+$/i.test(base)) setSetting('general', { ...g, publicBaseUrl: base });
  setSetting('alerts', { ...getSetting('alerts'), alertEmails: email });
  seedProducts();
  await createSession(id);
  redirect('/app?welcome=1');
}

export default async function Setup({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  if (hasUsers()) redirect('/login');
  const sp = await searchParams;
  const gets: [IconName, string, string][] = [
    ['swap', 'Two products', 'Unada and HeyVeya'], ['sources', 'News sources', 'Scored every morning'],
    ['automations', 'Weekly automations', 'Draft, send, report'], ['editions', 'Four sample editions', 'Your month-1 plan'],
  ];
  return (
    <main className="auth">
      <div className="auth-wrap wide">
        <form className={`card${sp.e ? ' shake' : ''}`} action={setup} aria-labelledby="auth-h">
          <div className="auth-mark" aria-hidden><Icon name="editions" size={26} strokeWidth={1.9} /></div>
          <div className="auth-title">
            <div className="eyebrow">Brief Studio</div>
            <h1 id="auth-h">Set up your studio</h1>
            <p className="hint">Create the admin account. Your two products (Unada and HeyVeya), news sources, weekly automations and the four month-1 sample editions will be set up for you.</p>
          </div>
          <ul className="auth-gets" aria-label="Set up for you">
            {gets.map(([ic, t, s]) => <li key={t}><span className="icon-chip" aria-hidden><Icon name={ic} size={15} /></span><span><b>{t}</b><small>{s}</small></span></li>)}
          </ul>
          {sp.e && <div className="notice bad" role="alert"><span className="ni" aria-hidden>!</span><div>Fill in every field. The password needs at least 8 characters.</div></div>}
          <AuthField label="Your name" name="name" icon="person" required autoComplete="name" autoFocus />
          <AuthField label="Work email" name="email" kind="email" icon="mail" required autoComplete="email" hint="Sales alerts go here until you change it." placeholder="you@company.com" />
          <AuthField label="Password" name="password" kind="new-password" icon="lock" minLength={8} required autoComplete="new-password" />
          <AuthField label="Public address of this app (optional)" name="base" kind="url" icon="globe" placeholder="https://brief.yourdomain.com" hint="Used in every link you send. You can set it later in Settings." />
          <Submit className="btn primary lg" pending="Setting things up…">Create account and start</Submit>
        </form>
      </div>
    </main>
  );
}
