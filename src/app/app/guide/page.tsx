import { requireUser } from '@/lib/auth';
import Link from 'next/link';
import { MATURITY, PILLARS } from '@/lib/types';

export const metadata = { title: 'How it works' };

export default async function Guide() {
  await requireUser();
  return (
    <div className="stack prose" style={{ gap: 6 }}>
      <div className="eyebrow">Guide</div>
      <h1 style={{ font: '600 30px var(--f-display)' }}>How Brief Studio works</h1>
      <p className="hint">One weekly edition per product. It lives at one link, goes out by WhatsApp and email, and every tap tells you who’s warming up.</p>

      <h2>The weekly rhythm</h2>
      <ol>
        <li><b>Every morning:</b> “Fetch news” reads your sources and scores each story for your readers. <Link href="/app/stories">Story pool</Link></li>
        <li><b>Monday 9:00:</b> “Draft this week’s edition” writes a draft from the best (or shortlisted) stories and the next “Our work” items, runs the checks and notifies you.</li>
        <li><b>Monday–Tuesday (15–30 min):</b> review in the editor. Ask the copilot for changes; you see a diff before anything is applied. Run all checks, then approve.</li>
        <li><b>Thursday 10:00:</b> scheduled email goes out; work through the WhatsApp list (or the Business API sends it).</li>
        <li><b>Whenever someone taps “I’m interested”:</b> you get an email (and Slack/webhook if set), and they appear under <Link href="/app/leads">Leads</Link>. Reply the same day.</li>
        <li><b>Friday 17:30:</b> weekly report by email.</li>
      </ol>

      <h2>What goes in an edition</h2>
      <ul>
        <li><b>Industry pulse</b> (the hook): 30-second summary, number of the week, 2 stories with “why it matters for you”, an optional chart.</li>
        {Object.values(PILLARS).map((p) => <li key={p.label}><b>{p.label}</b>: {p.hint}. Button: “{p.cta}”.</li>)}
        <li><b>One-tap poll</b> and the <b>call-to-action bar</b>: I’m interested · Book 15 min · Send me more · Share · Not right now.</li>
      </ul>

      <h2>Staying honest</h2>
      <p>Every “Our work” item has a status. The checks block wording that claims more than the status allows.</p>
      <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Status</th><th>May say</th><th>Never says</th></tr></thead>
        <tbody>{Object.values(MATURITY).map((m) => <tr key={m.label}><td><b>{m.label}</b></td><td>{m.allowed}</td><td className="hint">{m.banned.join(', ') || '–'}</td></tr>)}</tbody></table></div>

      <h2>The checks before sending</h2>
      <ul>
        <li>Every number and story has a linked source; opinion is labelled “Our view” and has no statistics.</li>
        <li>A second AI (from a different company when you have two keys) fact-checks claims against the stored article text.</li>
        <li>All links open; banned words and spam words; preview title ≤ 60 and description ≤ 110 characters; email under 100 KB; footer address.</li>
        <li>Client names only with recorded permission; placeholders filled.</li>
        <li>You can override a failing check, but only with a written reason. The reason is saved with the edition.</li>
      </ul>

      <h2>Sending, safely</h2>
      <ul>
        <li><b>WhatsApp:</b> only to people who agreed. Start with the click-to-chat list on each edition’s Send page; move to the official Business API for larger lists. Never use bulk-sender tools.</li>
        <li><b>Email:</b> send from a sub-domain (e.g. news.yourdomain.com) with SPF, DKIM and DMARC. Every email has one-click unsubscribe (Gmail and Yahoo require it).</li>
        <li><b>Consent:</b> stored per contact and channel, with where it came from (India’s DPDP Act, GDPR, CAN-SPAM). “Not right now” halves their frequency automatically.</li>
      </ul>

      <h2>Lead score</h2>
      <p>Points count once per edition: opened the page +5 · read 75% +5 · voted +10 · shared or “send me more” +15 · tapped an “Our work” card +30 · book +40 · interested +50 · not now −10.</p>

      <h2>Running it</h2>
      <ul>
        <li>The app needs Node 22.13+ and runs as one process (<code>npm run build && npm start</code>, or Docker). Data lives in the <code>data/</code> folder; back it up.</li>
        <li>Set the public address in <Link href="/app/settings?tab=general">Settings → General</Link> so links and preview images work for readers.</li>
        <li>Without AI keys, drafts are assembled in demo mode. Without SMTP, emails land in the <Link href="/app/outbox">Outbox</Link>. Both still let you try the whole flow.</li>
      </ul>
    </div>
  );
}
