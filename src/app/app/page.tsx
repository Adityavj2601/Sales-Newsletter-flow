import Link from 'next/link';
import { all, get } from '@/lib/db';
import { requireProduct } from '@/lib/context';
import { requireUser } from '@/lib/auth';
import { getSetting, smtpReady, waReady, baseUrl } from '@/lib/settings';
import { configuredProviders } from '@/lib/ai/providers';
import { listEditions } from '@/lib/editions';
import { fmtDay, ago, todayIn, TZ_DEFAULT } from '@/lib/format';
import { editionMetrics } from '@/lib/metrics';
import { StatusPill, Avatar } from '@/components/bits';
import { Icon, type IconName } from '@/components/shell/icons';
import { KindIcon, cleanTitle } from '@/components/shell/kinds';
import { CountUp } from '@/components/shell/Motion';
import { JOB_INFO } from '@/lib/jobs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Home' };

function Ring({ done, total }: { done: number; total: number }) {
  const r = 34, c = 2 * Math.PI * r, off = c * (1 - done / total);
  return (
    <div className="ring" role="img" aria-label={`${done} of ${total} setup steps done`}>
      <svg viewBox="0 0 80 80" width="96" height="96" aria-hidden>
        <circle cx="40" cy="40" r={r} className="ring-track" />
        <circle cx="40" cy="40" r={r} className="ring-fill" strokeDasharray={c} strokeDashoffset={off} style={{ ['--len' as string]: c }} transform="rotate(-90 40 40)" />
      </svg>
      <div className="ring-txt" aria-hidden><b>{Math.round((done / total) * 100)}%</b><small>{done}/{total}</small></div>
    </div>
  );
}

function Kpi({ icon, tint, value, label, detail, bar }: { icon: IconName; tint: string; value: number; label: string; detail?: string; bar?: number }) {
  return (
    <div className="kpi tile">
      <span className={`kind kind-${tint}`} aria-hidden><Icon name={icon} size={16} /></span>
      <div className="v"><CountUp value={value} /></div>
      <div className="k">{label}</div>
      {bar !== undefined && <div className="meter" aria-hidden><span style={{ width: `${Math.min(100, Math.max(0, bar))}%` }} /></div>}
      {detail && <div className="d">{detail}</div>}
    </div>
  );
}

export default async function Home({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const p = await requireProduct();
  const user = await requireUser();
  const sp = await searchParams;
  const n = (sql: string, ...a: any[]) => Number(get(sql, ...a)?.n || 0);
  const g = getSetting('general');
  const tz = g.timezone || TZ_DEFAULT;
  const eds = listEditions(p.id);
  const upcoming = eds.filter((e) => e.status !== 'sent').sort((a, b) => (a.planned_for || '').localeCompare(b.planned_for || ''));
  const next = upcoming[0];
  const lastSent = eds.find((e) => e.status === 'sent');
  const contacts = n("SELECT COUNT(*) AS n FROM contacts WHERE product_id = ? AND status = 'active'", p.id);
  const kbActive = n('SELECT COUNT(*) AS n FROM kb_items WHERE product_id = ? AND active = 1', p.id);
  const stories = n("SELECT COUNT(*) AS n FROM stories WHERE product_id = ? AND status IN ('new','shortlisted')", p.id);
  const steps = [
    { done: !!(p.brand.about || p.brand.tagline), label: `Describe ${p.name} (or import it from ${p.website || 'your website'})`, href: '/app/knowledge' },
    { done: configuredProviders().length > 0, label: 'Connect an AI provider (Claude, ChatGPT, Gemini or OpenRouter)', href: '/app/settings?tab=ai' },
    { done: kbActive >= 3, label: `Add at least 3 “Our work” items (${kbActive} so far)`, href: '/app/knowledge' },
    { done: stories > 0, label: 'Fetch this week’s news into the story pool', href: '/app/stories' },
    { done: contacts > 0, label: 'Import contacts who agreed to hear from you', href: '/app/contacts' },
    { done: !!(getSetting('general').publicBaseUrl || process.env.PUBLIC_BASE_URL), label: 'Set the public web address used in links', href: '/app/settings?tab=general' },
    { done: smtpReady(), label: 'Connect email sending (SMTP). Until then, emails land in the Outbox', href: '/app/settings?tab=email' },
    { done: !!p.brand.address, label: 'Add your registered address (shown in every email footer)', href: '/app/settings?tab=products' },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const nextStep = steps.findIndex((s) => !s.done);

  const last4 = eds.filter((e) => e.status === 'sent').slice(0, 4).map((e) => e.id);
  const m = editionMetrics(last4);
  const sent = m.delivered, views = m.readers, intents = m.intentPeople, unsubs = m.unsubscribes;
  const hot = all("SELECT * FROM contacts WHERE product_id = ? AND status = 'active' AND score > 0 ORDER BY (last_intent_at IS NOT NULL) DESC, last_intent_at DESC, score DESC LIMIT 6", p.id);
  const notes = all('SELECT * FROM notifications WHERE product_id = ? OR product_id IS NULL ORDER BY created_at DESC LIMIT 6', p.id);
  const jobs = all('SELECT * FROM jobs WHERE product_id = ? AND enabled = 1 ORDER BY next_run_at LIMIT 4', p.id);
  const ai = configuredProviders();

  const now = new Date();
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).format(now));
  const greet = hour < 5 ? 'Working late' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const today = new Intl.DateTimeFormat('en-IN', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long' }).format(now);
  const first = (user.name || '').split(/\s+/)[0];
  const daysTo = (d?: string | null) => {
    if (!d) return '';
    const diff = Math.round((+new Date(d.slice(0, 10) + 'T12:00:00Z') - +new Date(todayIn(tz) + 'T12:00:00Z')) / 86400_000);
    return diff === 0 ? 'today' : diff === 1 ? 'tomorrow' : diff > 1 ? `in ${diff} days` : `${-diff} days ago`;
  };
  const fails = next?.checks ? next.checks.results.filter((r) => r.status === 'fail').length : 0;
  const warns = next?.checks ? next.checks.results.filter((r) => r.status === 'warn').length : 0;
  const sendDay = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][g.sendDay];

  return (
    <div className="home">
      <header className="ph home-head">
        <div>
          <div className="eyebrow">{today}<span className="sep" aria-hidden>·</span>{p.newsletter_name} by {p.name}</div>
          <h1>{sp.welcome ? 'You’re set up. Here’s your week.' : `${greet}${first ? `, ${first}` : ''}`}</h1>
          <p className="sub">Draft on Monday, review in 15 minutes, send on {sendDay} at {g.sendTime}. Taps on “I’m interested” reach you instantly.</p>
        </div>
        <div className="row">
          <Link className="btn" href="/app/stories"><Icon name="stories" size={16} />Story pool</Link>
          <Link className="btn primary" href="/app/editions?new=1"><Icon name="plus" size={16} strokeWidth={2.2} />New edition</Link>
        </div>
      </header>

      {doneCount < steps.length && (
        <section className="card setup" aria-labelledby="setup-h">
          <div className="setup-side">
            <Ring done={doneCount} total={steps.length} />
            <div>
              <h2 id="setup-h">Finish setting up</h2>
              <span className="pill">{doneCount} of {steps.length} done</span>
              {nextStep >= 0 && <p className="hint setup-next">Up next: <Link href={steps[nextStep].href}>{steps[nextStep].label.split(' (')[0].split('. ')[0]}</Link></p>}
            </div>
          </div>
          <ol className="steps checklist">
            {steps.map((s, i) => (
              <li key={i} className={`${s.done ? 'done' : ''}${i === nextStep ? ' next' : ''}`}>
                <span className="n" aria-hidden>{s.done ? <Icon name="check" size={13} strokeWidth={2.6} /> : i + 1}</span>
                <span className="lbl">{s.done && <span className="sr">Done: </span>}{s.label}</span>
                {!s.done && <Link className="btn sm" href={s.href} aria-label={`Open: ${s.label}`}>Open<Icon name="chevron" size={13} strokeWidth={2.2} /></Link>}
              </li>
            ))}
          </ol>
        </section>
      )}

      <h2 className="section-title">This week</h2>
      <div className="home-grid">
        <section className="card hero" aria-labelledby="next-h">
          <div className="card-head"><h2 id="next-h" className="eyebrow-h">Next edition</h2>{next && <StatusPill status={next.status} />}</div>
          {next ? (
            <div className="hero-body">
              <div className="hero-meta"><Icon name="calendar" size={15} /><span>#{next.number} · planned for {fmtDay(next.planned_for)}</span>{next.planned_for && <span className="pill info">{daysTo(next.planned_for)}</span>}</div>
              <div className="hero-title">{next.content.title || 'Untitled edition'}</div>
              {next.content.dek && <p className="hero-dek">{next.content.dek}</p>}
              {next.checks ? (
                <div className="row">
                  <span className={`pill ${fails ? 'bad' : 'ok'}`}>{fails} failing</span>
                  <span className={`pill ${warns ? 'warn' : ''}`}>{warns} warnings</span>
                  <span className="hint">checked {ago(next.checks.at)}</span>
                </div>
              ) : <div className="hint hero-checks"><Icon name="check" size={14} />Checks not run yet.</div>}
              <div className="row hero-actions">
                <Link className="btn primary" href={`/app/editions/${next.id}`}>Open editor</Link>
                <Link className="btn" href={`/app/editions/${next.id}/distribute`}>Send options</Link>
                <a className="btn ghost" href={`${baseUrl()}/e/${p.slug}/${next.slug}?preview=1`} target="_blank" rel="noreferrer">Preview<Icon name="arrowUpRight" size={14} strokeWidth={2} /><span className="sr"> (opens in a new tab)</span></a>
              </div>
              {upcoming.length > 1 && (
                <div className="hero-later">
                  <span className="hint">Also planned:</span>
                  {upcoming.slice(1, 4).map((e) => <Link key={e.id} className="chip-link" href={`/app/editions/${e.id}`}><b>#{e.number}</b> {fmtDay(e.planned_for)}</Link>)}
                </div>
              )}
            </div>
          ) : (
            <div className="empty"><b>No edition planned</b><span>Draft one from this week’s stories.</span><Link className="btn primary" href="/app/editions?new=1">New edition</Link></div>
          )}
        </section>

        <section className="card kpis" aria-labelledby="kpi-h">
          <div className="card-head"><h2 id="kpi-h" className="eyebrow-h">Last 4 sent editions</h2>{lastSent && <Link className="more" href={`/app/editions/${lastSent.id}/analytics`}>Latest report<Icon name="chevron" size={13} strokeWidth={2.2} /></Link>}</div>
          {last4.length ? (
            <div className="kpi-grid">
              <Kpi icon="send" tint="blue" value={sent} label="Delivered" />
              <Kpi icon="eye" tint="indigo" value={views} label="Opened the page" detail={`${sent ? Math.round((views / sent) * 100) : 0}% of delivered`} bar={sent ? (views / sent) * 100 : 0} />
              <Kpi icon="leads" tint="orange" value={intents} label="People who showed interest" />
              <Kpi icon="signout" tint="gray" value={unsubs} label="Unsubscribes" />
            </div>
          ) : <div className="empty"><b>Nothing sent yet</b><span>Numbers appear here after your first send.</span></div>}
        </section>
      </div>

      <div className="home-grid even">
        <section className="card" aria-labelledby="leads-h">
          <div className="card-head"><h2 id="leads-h">Warmest leads</h2><Link className="more" href="/app/leads">All leads<Icon name="chevron" size={13} strokeWidth={2.2} /></Link></div>
          {hot.length ? (
            <ul className="people">
              {hot.map((c) => {
                const name = `${c.first_name} ${c.last_name}`.trim() || c.email;
                return (
                  <li key={c.id}>
                    <Link href={`/app/contacts/${c.id}`} className="person">
                      <Avatar name={name} />
                      <span className="who"><b>{name}</b><small>{[c.role, c.company].filter(Boolean).join(', ') || c.email}</small></span>
                      {c.last_intent ? <span className="pill ok"><span className="dot" />{c.last_intent} · {ago(c.last_intent_at)}</span> : <span className="hint">engaged {ago(c.last_engaged_at)}</span>}
                      <span className="score" title="Lead score"><b>{c.score}</b><span className="meter" aria-hidden><span style={{ width: `${Math.min(100, c.score)}%` }} /></span></span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : <div className="empty"><b>No engagement yet</b><span>When someone opens an edition or taps a button, they show up here.</span></div>}
        </section>

        <section className="card" aria-labelledby="act-h">
          <div className="card-head"><h2 id="act-h">Latest activity</h2><Link className="more" href="/app/notifications">Notifications<Icon name="chevron" size={13} strokeWidth={2.2} /></Link></div>
          {notes.length ? (
            <ul className="feed">{notes.map((x) => (
              <li key={x.id} className={x.read_at ? '' : 'unread'}>
                <KindIcon kind={x.kind} title={x.title} />
                <div className="feed-body">
                  {x.link ? <Link href={x.link} className="feed-title">{cleanTitle(x.title)}</Link> : <span className="feed-title">{cleanTitle(x.title)}</span>}
                  {x.body && <div className="feed-sub">{x.body}</div>}
                </div>
                <time dateTime={x.created_at}>{ago(x.created_at)}</time>
              </li>
            ))}</ul>
          ) : <div className="empty"><b>Nothing yet</b><span>Interest taps, drafts and sends appear here.</span></div>}
        </section>
      </div>

      <section className="card system" aria-labelledby="sys-h">
        <div className="system-jobs">
          <h2 id="sys-h" className="eyebrow-h">Next automations</h2>
          {jobs.length ? (
            <ul className="jobs">{jobs.map((j) => (
              <li key={j.id}><Icon name="automations" size={16} /><span>{(JOB_INFO as any)[j.type]?.label || j.name}</span><time dateTime={j.next_run_at}>{ago(j.next_run_at)}</time></li>
            ))}</ul>
          ) : <p className="hint">No automations are switched on. <Link href="/app/automations">Set them up</Link></p>}
        </div>
        <div className="system-status">
          <h2 className="eyebrow-h">Connections</h2>
          <ul className="status-list">
            <li><span className={`led ${ai.length ? 'on' : 'off'}`} aria-hidden /><Icon name="sparkle" size={16} /><span>AI</span><Link href="/app/settings?tab=ai">{ai.length ? ai.join(', ') : 'demo mode (no key yet)'}</Link></li>
            <li><span className={`led ${smtpReady() ? 'on' : 'off'}`} aria-hidden /><Icon name="mail" size={16} /><span>Email</span><Link href="/app/settings?tab=email">{smtpReady() ? 'SMTP connected' : 'Outbox only'}</Link></li>
            <li><span className={`led ${waReady() ? 'on' : 'idle'}`} aria-hidden /><Icon name="whatsapp" size={16} /><span>WhatsApp</span><Link href="/app/settings?tab=whatsapp">{waReady() ? 'Business API' : 'click-to-chat'}</Link></li>
          </ul>
        </div>
      </section>
    </div>
  );
}
