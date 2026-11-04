import Link from 'next/link';
import { all, get } from '@/lib/db';
import { requireProduct } from '@/lib/context';
import { requireUser } from '@/lib/auth';
import { getSetting, smtpReady, waReady, baseUrl } from '@/lib/settings';
import { configuredProviders } from '@/lib/ai/providers';
import { listEditions, type Edition } from '@/lib/editions';
import { blockingFailures } from '@/lib/checks';
import { fmtDay, fmtTime, edNo, todayIn, TZ_DEFAULT, WEEKDAYS } from '@/lib/format';
import { editionMetrics } from '@/lib/metrics';
import { StatusPill, Avatar } from '@/components/bits';
import { Submit } from '@/components/ui';
import { Icon, type IconName } from '@/components/shell/icons';
import { KindIcon, cleanTitle, typo } from '@/components/shell/kinds';
import { SeenNumber, Ago } from '@/components/shell/Motion';
import { JOB_INFO } from '@/lib/jobs';
import { fetchNewsNow } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Home' };

/** "10:00" (settings) → "10:00 am", matching fmtTime everywhere else. */
const clock = (hhmm: string) => fmtTime(`2000-01-01T${/^\d{1,2}:\d{2}$/.test(hhmm) ? hhmm.padStart(5, '0') : '10:00'}:00Z`, 'UTC');

function Ring({ done, total, size = 96 }: { done: number; total: number; size?: number }) {
  const r = 34, c = 2 * Math.PI * r, off = c * (1 - done / total);
  return (
    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={`${done} of ${total} setup steps done`}>
      <svg viewBox="0 0 80 80" width={size} height={size} aria-hidden>
        <circle cx="40" cy="40" r={r} className="ring-track" />
        <circle cx="40" cy="40" r={r} className="ring-fill" strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 40 40)" />
      </svg>
      {size > 60 && <div className="ring-txt" aria-hidden><b>{done}/{total}</b><small>done</small></div>}
    </div>
  );
}

function Stat({ id, icon, value, label, meta, bar }: { id: string; icon: IconName; value: number; label: string; meta?: string; bar?: number }) {
  return (
    <div className="stat-tile">
      <span className="icon-chip" aria-hidden><Icon name={icon} size={17} /></span>
      <div className="sv"><SeenNumber id={id} value={value} /></div>
      <div className="sk">{label}</div>
      {bar !== undefined && <div className="meter" aria-hidden><span style={{ width: `${Math.min(100, Math.max(0, bar))}%` }} /></div>}
      {meta && <div className="sm">{meta}</div>}
    </div>
  );
}

/* The weekly flow, in order. The Home “Next step” always points at the first unfinished one. */
const FLOW = ['Fetch', 'Shortlist', 'Draft', 'Check', 'Approve', 'Send'] as const;
type Next = { at: number; title: string; why: string; cta: React.ReactNode };

function nextStep(o: { next?: Edition; pool: number; short: number; sources: number; sendDay: string }): Next {
  const { next, pool, short } = o;
  if (!next || next.status === 'sent') {
    if (pool + short === 0) return {
      at: 0, title: 'Fetch this week’s news', why: `The story pool is empty. Fetching reads your ${o.sources} source${o.sources === 1 ? '' : 's'} and scores every story for your readers.`,
      cta: <form action={fetchNewsNow}><Submit className="btn primary" pending="Fetching…"><Icon name="refresh" size={16} />Fetch news now</Submit></form>,
    };
    if (short === 0) return {
      at: 1, title: 'Shortlist 3–6 stories', why: `${pool} ${pool === 1 ? 'story is' : 'stories are'} waiting in the pool. Star the ones worth writing about.`,
      cta: <Link className="btn primary" href="/app/stories">Open Story pool<Icon name="chevron" size={14} strokeWidth={2.2} /></Link>,
    };
    return {
      at: 2, title: 'Draft this week’s edition', why: `${short} ${short === 1 ? 'story is' : 'stories are'} shortlisted. The draft starts from them.`,
      cta: <Link className="btn primary" href="/app/editions?new=1"><Icon name="sparkle" size={16} />Draft from shortlist</Link>,
    };
  }
  const open = <Link className="btn primary" href={`/app/editions/${next.id}`}>Open editor</Link>;
  if (next.status === 'draft' || next.status === 'review') {
    if (!next.checks) return { at: 3, title: `Review ${edNo(next.number)} and run the checks`, why: 'Read it through, ask the copilot for changes, then run all checks.', cta: open };
    const blocking = blockingFailures(next.checks, next.overrides).length;
    if (blocking) return { at: 3, title: `Fix ${blocking} ${blocking === 1 ? 'check that blocks' : 'checks that block'} approval`, why: 'Edit the flagged blocks, or override a check with a written reason.', cta: open };
    return { at: 4, title: `Approve ${edNo(next.number)}`, why: 'Every blocking check passes. Approve it so it can be scheduled.', cta: open };
  }
  if (next.status === 'approved') return {
    at: 5, title: `Schedule ${edNo(next.number)}`, why: `Pick the audience and send time. Your usual slot is ${o.sendDay}.`,
    cta: <Link className="btn primary" href={`/app/editions/${next.id}/distribute`}><Icon name="send" size={16} />Schedule send</Link>,
  };
  return {
    at: 6, title: next.status === 'sending' ? `${edNo(next.number)} is going out now` : `${edNo(next.number)} is scheduled`, why: 'Nothing to do until the results come in.',
    cta: <Link className="btn" href={`/app/editions/${next.id}/distribute`}>View send</Link>,
  };
}

export default async function Home({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const p = await requireProduct();
  const user = await requireUser();
  const sp = await searchParams;
  const n = (sql: string, ...a: any[]) => Number(get(sql, ...a)?.n || 0);
  const g = getSetting('general');
  const tz = g.timezone || TZ_DEFAULT;
  const eds = listEditions(p.id);
  const upcoming = eds.filter((e) => e.status !== 'sent').sort((a, b) => (a.planned_for || '9999').localeCompare(b.planned_for || '9999') || a.number - b.number);
  const next = upcoming[0];
  const lastSent = eds.find((e) => e.status === 'sent');
  const contacts = n("SELECT COUNT(*) AS n FROM contacts WHERE product_id = ? AND status = 'active'", p.id);
  const kbActive = n('SELECT COUNT(*) AS n FROM kb_items WHERE product_id = ? AND active = 1', p.id);
  const pool = n("SELECT COUNT(*) AS n FROM stories WHERE product_id = ? AND status = 'new'", p.id);
  const short = n("SELECT COUNT(*) AS n FROM stories WHERE product_id = ? AND status = 'shortlisted'", p.id);
  const sources = n('SELECT COUNT(*) AS n FROM sources WHERE active = 1 AND (product_id IS NULL OR product_id = ?)', p.id);
  const steps = [
    { done: !!(p.brand.about || p.brand.tagline), label: `Describe ${p.name}`, more: ` (or import it from ${p.website?.replace(/^https?:\/\//, '').replace(/\/$/, '') || 'your website'})`, href: '/app/knowledge' },
    { done: configuredProviders().length > 0, label: 'Connect an AI provider', more: ' (Claude, ChatGPT, Gemini or OpenRouter)', href: '/app/settings?tab=ai' },
    { done: kbActive >= 3, label: 'Add at least 3 “Our work” items', more: ` (${kbActive} so far)`, href: '/app/knowledge' },
    { done: pool + short > 0, label: 'Fetch this week’s news into the story pool', href: '/app/stories' },
    { done: contacts > 0, label: 'Import contacts who agreed to hear from you', href: '/app/contacts' },
    { done: !!(g.publicBaseUrl || process.env.PUBLIC_BASE_URL), label: 'Set the public web address used in links', href: '/app/settings?tab=general' },
    { done: smtpReady(), label: 'Connect email sending (SMTP)', more: '. Until then, emails land in the Outbox', href: '/app/settings?tab=email' },
    { done: !!p.brand.address, label: 'Add your registered address', more: ' (shown in every email footer)', href: '/app/settings?tab=products' },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const nextSetup = steps.findIndex((s) => !s.done);

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
  const sendSlot = `${WEEKDAYS[g.sendDay]} at ${clock(g.sendTime)}`;
  const step = nextStep({ next, pool, short, sources, sendDay: sendSlot });
  const warns = next?.checks ? next.checks.results.filter((r) => r.status === 'warn').length : 0;

  const checklist = (
    <ol className="steps checklist">
      {steps.map((s, i) => (
        <li key={i} className={`${s.done ? 'done' : ''}${i === nextSetup ? ' next' : ''}`}>
          <span className="n" aria-hidden>{s.done ? <Icon name="check" size={13} strokeWidth={2.6} /> : i + 1}</span>
          <span className="lbl">{s.done && <span className="sr">Done: </span>}{s.label}<span className="lbl-more">{s.more}</span></span>
          {!s.done && <Link className="btn sm" href={s.href} aria-label={`Open: ${s.label}`}>Open<Icon name="chevron" size={13} strokeWidth={2.2} /></Link>}
        </li>
      ))}
    </ol>
  );

  return (
    <div className="pg home">
      <header className="ph">
        <div>
          <span className="eyebrow">{today}<span className="sep" aria-hidden>·</span>{p.newsletter_name}</span>
          <h1>{sp.welcome ? 'You’re set up. Here’s your week.' : `${greet}${first ? `, ${first}` : ''}`}</h1>
          <p className="sub">Draft on Monday, review in 15 minutes, send on {sendSlot}. Taps on “I’m interested” reach you instantly.</p>
        </div>
        <div className="row">
          <Link className="btn" href="/app/stories"><Icon name="stories" size={16} />Story pool</Link>
          <Link className="btn" href="/app/editions?new=1"><Icon name="plus" size={16} strokeWidth={2.2} />New edition</Link>
        </div>
      </header>

      {doneCount < steps.length && (
        <>
          <section className="card setup" aria-labelledby="setup-h">
            <div className="setup-side">
              <Ring done={doneCount} total={steps.length} />
              <div>
                <h2 id="setup-h">Finish setting up</h2>
                <p className="hint">{steps.length - doneCount} {steps.length - doneCount === 1 ? 'step' : 'steps'} left before your first real send.</p>
                {nextSetup >= 0 && <p className="hint setup-next">Up next: <Link href={steps[nextSetup].href}>{steps[nextSetup].label}</Link></p>}
              </div>
            </div>
            {checklist}
          </section>
          <details className="card setup-m">
            <summary>
              <Ring done={doneCount} total={steps.length} size={30} />
              <span className="setup-m-t"><b>Setup <span className="tnum">{doneCount}/{steps.length}</span></b>{nextSetup >= 0 && <span> · Next: {steps[nextSetup].label}</span>}</span>
              <Icon name="chevron" size={15} strokeWidth={2.2} className="ico setup-m-chev" />
            </summary>
            {checklist}
          </details>
        </>
      )}

      <h2 className="section-title">This week</h2>
      <div className="home-grid">
        <section className="card hero" aria-labelledby="next-h">
          <div className="card-head"><h2 id="next-h">{next ? 'Next edition' : 'This week’s edition'}</h2>{next && <StatusPill status={next.status} />}</div>
          <ol className="flow" aria-label={`Weekly flow: step ${Math.min(step.at + 1, FLOW.length)} of ${FLOW.length}`}>
            {FLOW.map((f, i) => (
              <li key={f} className={i < step.at ? 'done' : i === step.at ? 'now' : ''} aria-current={i === step.at ? 'step' : undefined}>
                <span className="flow-bar" aria-hidden /><span className="flow-l">{f}</span>
              </li>
            ))}
          </ol>
          <div className="hero-body">
            {next && (
              <>
                <div className="hero-meta"><Icon name="calendar" size={15} /><span>{edNo(next.number)} · {fmtDay(next.planned_for)}</span>{next.planned_for && <span className="pill info">{daysTo(next.planned_for)}</span>}</div>
                <div className="hero-title">{typo(next.content.title) || 'Untitled edition'}</div>
                {next.content.dek && <p className="hero-dek">{typo(next.content.dek)}</p>}
              </>
            )}
            <div className="next-step">
              <span className="icon-chip" aria-hidden><Icon name={step.at >= 6 ? 'check' : 'bolt'} size={16} /></span>
              <div className="next-step-t">
                <span className="eyebrow">Next step</span>
                <b>{step.title}</b>
                <span className="hint">{step.why}{next?.checks && step.at >= 3 && step.at < 6 && warns > 0 ? ` ${warns} ${warns === 1 ? 'warning' : 'warnings'} to look at.` : ''}</span>
              </div>
              <div className="next-step-cta">{step.cta}</div>
            </div>
            {next && (
              <div className="row hero-actions">
                {step.at !== 3 && step.at !== 4 && <Link className="btn" href={`/app/editions/${next.id}`}>Open editor</Link>}
                {step.at !== 5 && step.at !== 6 && <Link className="btn" href={`/app/editions/${next.id}/distribute`}>Send options</Link>}
                <a className="btn ghost" href={`${baseUrl()}/e/${p.slug}/${next.slug}?preview=1`} target="_blank" rel="noreferrer">Preview<Icon name="arrowUpRight" size={14} strokeWidth={2} /><span className="sr"> (opens in a new tab)</span></a>
              </div>
            )}
            {upcoming.length > 1 && (
              <div className="hero-later">
                <span className="hint">Also planned</span>
                {upcoming.slice(1, 4).map((e) => <Link key={e.id} className="chip-link" href={`/app/editions/${e.id}`}><b>{edNo(e.number)}</b> {fmtDay(e.planned_for)}</Link>)}
              </div>
            )}
          </div>
        </section>

        <section className="card kpis" aria-labelledby="kpi-h">
          <div className="card-head"><h2 id="kpi-h">Last {last4.length > 1 ? `${last4.length} editions` : 'edition'}</h2>{lastSent && <Link className="more" href={`/app/editions/${lastSent.id}/analytics`}>Latest report<Icon name="chevron" size={13} strokeWidth={2.2} /></Link>}</div>
          {last4.length ? (
            <div className="kpi-grid">
              <Stat id={`${p.id}:delivered`} icon="send" value={sent} label="Delivered" />
              <Stat id={`${p.id}:readers`} icon="eye" value={views} label="Opened the page" meta={`${sent ? Math.round((views / sent) * 100) : 0}% of delivered`} bar={sent ? (views / sent) * 100 : 0} />
              <Stat id={`${p.id}:intent`} icon="leads" value={intents} label="Showed interest" />
              <Stat id={`${p.id}:unsubs`} icon="signout" value={unsubs} label="Unsubscribed" />
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
                const name = `${c.first_name || ''} ${c.last_name || ''}`.trim() || String(c.email).split('@')[0];
                return (
                  <li key={c.id}>
                    <Link href={`/app/contacts/${c.id}`} className="person">
                      <Avatar name={name} />
                      <span className="who"><b>{name}</b><small>{[c.role, c.company].filter(Boolean).join(', ') || c.email}</small></span>
                      {c.last_intent ? <span className="pill ok"><span className="dot" />{String(c.last_intent)[0].toUpperCase() + String(c.last_intent).slice(1)} · <Ago iso={c.last_intent_at} /></span> : <span className="hint">Engaged <Ago iso={c.last_engaged_at} /></span>}
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
                  {x.body && <div className="feed-sub">{typo(x.body)}</div>}
                </div>
                <Ago iso={x.created_at} />
              </li>
            ))}</ul>
          ) : <div className="empty"><b>Nothing yet</b><span>Interest taps, drafts and sends appear here.</span></div>}
        </section>
      </div>

      <section className="card system" aria-labelledby="sys-h">
        <div className="system-jobs">
          <div className="card-head"><h2 id="sys-h">Next automations</h2><Link className="more" href="/app/automations">Automations<Icon name="chevron" size={13} strokeWidth={2.2} /></Link></div>
          {jobs.length ? (
            <ul className="jobs">{jobs.map((j) => (
              <li key={j.id}><Icon name="automations" size={16} /><span>{(JOB_INFO as any)[j.type]?.label || j.name}</span><Ago iso={j.next_run_at} /></li>
            ))}</ul>
          ) : <p className="hint">No automations are switched on. <Link href="/app/automations">Set them up</Link></p>}
        </div>
        <div className="system-status">
          <div className="card-head"><h2>Connections</h2></div>
          <ul className="status-list">
            <li><span className={`led ${ai.length ? 'on' : 'off'}`} aria-hidden /><Icon name="sparkle" size={16} /><span>AI</span><Link href="/app/settings?tab=ai">{ai.length ? ai.join(', ') : 'Demo mode (no key yet)'}</Link></li>
            <li><span className={`led ${smtpReady() ? 'on' : 'off'}`} aria-hidden /><Icon name="mail" size={16} /><span>Email</span><Link href="/app/settings?tab=email">{smtpReady() ? 'SMTP connected' : 'Outbox only'}</Link></li>
            <li><span className={`led ${waReady() ? 'on' : 'idle'}`} aria-hidden /><Icon name="whatsapp" size={16} /><span>WhatsApp</span><Link href="/app/settings?tab=whatsapp">{waReady() ? 'Business API' : 'Click-to-chat'}</Link></li>
          </ul>
        </div>
      </section>
    </div>
  );
}
