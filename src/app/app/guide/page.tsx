import { requireUser } from '@/lib/auth';
import Link from 'next/link';
import { MATURITY, PILLARS } from '@/lib/types';
import { getSetting } from '@/lib/settings';
import { WEEKDAYS, fmtTime } from '@/lib/format';
import { Icon, type IconName } from '@/components/shell/icons';
import { TocSpy } from '@/components/shell/TocSpy';
import { typo } from '@/components/shell/kinds';

export const metadata = { title: 'How it works' };

const TOC: [string, string][] = [
  ['rhythm', 'The weekly rhythm'], ['edition', 'What goes in an edition'], ['honest', 'Staying honest'],
  ['checks', 'The checks before sending'], ['sending', 'Sending, safely'], ['score', 'Lead score'], ['ready', 'Before your first send'],
];

export default async function Guide() {
  await requireUser();
  const g = getSetting('general');
  const clock = (hhmm: string) => fmtTime(`2000-01-01T${hhmm.padStart(5, '0')}:00Z`, 'UTC');
  const sendDay = `${WEEKDAYS[g.sendDay]} ${clock(g.sendTime)}`;
  const rhythm: [IconName, string, React.ReactNode][] = [
    ['stories', 'Every morning:', <>“Fetch news” reads your sources and scores each story for your readers. <Link href="/app/stories">Story pool</Link></>],
    ['sparkle', `Monday ${clock('09:00')} (default):`, <>“Draft this week’s edition” writes a draft from the best (or shortlisted) stories and the next “Our work” items, runs the checks and notifies you.</>],
    ['editions', 'Monday–Tuesday (15–30 min):', <>review in the editor. Ask the copilot for changes; you see a diff before anything is applied. Run all checks, then approve.</>],
    ['send', `${sendDay} (your send time):`, <>scheduled email goes out; work through the WhatsApp list (or the Business API sends it).</>],
    ['leads', 'Whenever someone taps “I’m interested”:', <>you get an email (and Slack/webhook if set), and they appear under <Link href="/app/leads">Leads</Link>. Reply the same day.</>],
    ['chart', `Friday ${clock('17:30')}:`, <>weekly report by email.</>],
  ];
  const score: [string, string][] = [['opened the page', '+5'], ['read 75%', '+5'], ['voted', '+10'], ['shared or “send me more”', '+15'], ['tapped an “Our work” card', '+30'], ['book', '+40'], ['interested', '+50'], ['not now', '−10']];
  return (
    <div className="guide">
      <article className="prose guide-body">
        <div className="ph">
          <div>
            <span className="eyebrow">Guide</span>
            <h1>How Brief Studio works</h1>
            <p className="sub">One weekly edition per product. It lives at one link, goes out by WhatsApp and email, and every tap tells you who’s warming up.</p>
          </div>
        </div>

        <section id="rhythm">
          <h2>The weekly rhythm</h2>
          <ol className="rhythm">
            {rhythm.map(([icon, when, what], i) => (
              <li key={i}><span className="rh-ic" aria-hidden><Icon name={icon} size={17} /></span><div><b>{when}</b> {what}</div></li>
            ))}
          </ol>
        </section>

        <section id="edition">
          <h2>What goes in an edition</h2>
          <ul className="blocks">
            <li><b>Industry pulse</b> (the hook): 30-second summary, number of the week, 2 stories with “why it matters for you”, an optional chart.</li>
            {Object.values(PILLARS).map((p) => <li key={p.label}><b>{p.label}</b>: {p.hint}. Button: “{typo(p.cta)}”.</li>)}
            <li><b>One-tap poll</b> and the <b>call-to-action bar</b>: I’m interested · Book 15 min · Send me more · Share · Not right now.</li>
          </ul>
        </section>

        <section id="honest">
          <h2>Staying honest</h2>
          <p>Every “Our work” item has a status. The checks block wording that claims more than the status allows.</p>
          <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Status</th><th>May say</th><th>Never says</th></tr></thead>
            <tbody>{Object.values(MATURITY).map((m) => <tr key={m.label}><td><b>{m.label}</b></td><td>{typo(m.allowed)}</td><td className="hint">{m.banned.map((b) => `“${typo(b)}”`).join(", ") || "–"}</td></tr>)}</tbody></table></div>
        </section>

        <section id="checks">
          <h2>The checks before sending</h2>
          <ul className="ticks">
            <li>Every number and story has a linked source; opinion is labelled “Our view” and has no statistics.</li>
            <li>A second AI (from a different company when you have two keys) fact-checks claims against the stored article text.</li>
            <li>All links open; banned words and spam words; preview title ≤ 60 and description ≤ 110 characters; email under 100 KB; footer address.</li>
            <li>Client names only with recorded permission; placeholders filled.</li>
            <li>You can override a failing check, but only with a written reason. The reason is saved with the edition.</li>
          </ul>
        </section>

        <section id="sending">
          <h2>Sending, safely</h2>
          <div className="callouts">
            <div className="callout"><span className="kind kind-green" aria-hidden><Icon name="whatsapp" size={17} /></span><p><b>WhatsApp:</b> only to people who agreed. Start with the click-to-chat list on each edition’s Send page; move to the official Business API for larger lists. Never use bulk-sender tools.</p></div>
            <div className="callout"><span className="kind kind-blue" aria-hidden><Icon name="mail" size={17} /></span><p><b>Email:</b> send from a sub-domain (e.g. news.yourdomain.com) with SPF, DKIM and DMARC. Every email has one-click unsubscribe (Gmail and Yahoo require it).</p></div>
            <div className="callout"><span className="kind kind-purple" aria-hidden><Icon name="lock" size={17} /></span><p><b>Consent:</b> stored per contact and channel, with where it came from (India’s DPDP Act, GDPR, CAN-SPAM). “Not right now” halves their frequency automatically.</p></div>
          </div>
        </section>

        <section id="score">
          <h2>Lead score</h2>
          <p className="sr">Points count once per edition: opened the page +5 · read 75% +5 · voted +10 · shared or “send me more” +15 · tapped an “Our work” card +30 · book +40 · interested +50 · not now −10.</p>
          <p aria-hidden>Points count once per edition.</p>
          <ul className="score-grid" aria-hidden>
            {score.map(([k, v]) => <li key={k} className={v.startsWith('−') ? 'neg' : ''}><b>{v}</b><span>{k}</span></li>)}
          </ul>
        </section>

        <section id="ready">
          <h2>Before your first send</h2>
          <ul className="ticks">
            <li>Set the public address in <Link href="/app/settings?tab=general">Settings → General</Link> so links and preview images work for readers.</li>
            <li>Without AI keys, drafts are assembled in demo mode. Without SMTP, emails land in the <Link href="/app/outbox">Outbox</Link>. Both still let you try the whole flow.</li>
          </ul>
        </section>
      </article>
      <aside className="toc" aria-label="On this page">
        <div className="toc-h">On this page</div>
        <ul>{TOC.map(([id, l]) => <li key={id}><a href={`#${id}`}>{l}</a></li>)}</ul>
        <TocSpy ids={TOC.map(([id]) => id)} />
        <p className="toc-tip"><Icon name="command" size={14} />Press <kbd className="kbd">⌘K</kbd> or <kbd className="kbd">Ctrl K</kbd> to jump anywhere.</p>
      </aside>
    </div>
  );
}
