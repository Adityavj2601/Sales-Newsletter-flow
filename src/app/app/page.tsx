import Link from 'next/link';
import { all, get } from '@/lib/db';
import { requireProduct } from '@/lib/context';
import { requireUser } from '@/lib/auth';
import { getSetting, smtpReady, waReady, baseUrl } from '@/lib/settings';
import { configuredProviders } from '@/lib/ai/providers';
import { listEditions } from '@/lib/editions';
import { flowState } from '@/lib/flow';
import { FlowStepper } from '@/components/FlowStepper';
import { fmtDay, fmtTime, edNo, relDay, todayIn, TZ_DEFAULT, WEEKDAYS } from '@/lib/format';
import { editionMetrics, pct } from '@/lib/metrics';
import { StatusPill, Avatar } from '@/components/bits';
import { Icon, type IconName } from '@/components/shell/icons';
import { KindIcon, cleanTitle, typo } from '@/components/shell/kinds';
import { SeenNumber, Ago } from '@/components/shell/Motion';
import { JOB_INFO } from '@/lib/jobs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Home' };

/** "10:00" (settings) → "10:00 am", matching fmtTime everywhere else. */
const clock = (hhmm: string) => fmtTime(`2000-01-01T${/^\d{1,2}:\d{2}$/.test(hhmm) ? hhmm.padStart(5, '0') : '10:00'}:00Z`, 'UTC');
/** The calendar day of an instant in the app's time zone. */
const zonedDay = (iso: string, tz: string) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
const CHANNEL: Record<string, string> = { email: 'Email', whatsapp: 'WhatsApp API', wa_manual: 'WhatsApp' };

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

/** The Results overview tile, compact: icon, number, label (· share of delivered), one meta line. */
function Stat({ id, icon, value, label, share, meta, tone = '' }: { id: string; icon: IconName; value: number; label: string; share?: string; meta: string; tone?: string }) {
  return (
    <div className="stat-tile">
      <span className={`icon-chip ${tone}`} aria-hidden><Icon name={icon} size={16} /></span>
      <div className="sv"><SeenNumber id={id} value={value} /></div>
      <div className="sk">{label}{share && <span className="k-pct"> · {share}</span>}</div>
      <div className="sm" title={meta}>{meta}</div>
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

  // The last sent edition, measured exactly like its Results overview (same tiles, same “of delivered”).
  const m = editionMetrics(lastSent ? [lastSent.id] : []);
  const sent = m.delivered;
  const hot = all("SELECT * FROM contacts WHERE product_id = ? AND status = 'active' AND score > 0 ORDER BY (last_intent_at IS NOT NULL) DESC, last_intent_at DESC, score DESC LIMIT 5", p.id);
  // One row per edition send: “Sending #5” and “#5 sent” collapse into the latest of the two.
  const seenSend = new Set<string>();
  const notes = all('SELECT * FROM notifications WHERE product_id = ? OR product_id IS NULL ORDER BY created_at DESC, rowid DESC LIMIT 16', p.id)
    .filter((x) => {
      const ed = x.kind === 'send' && /\/app\/editions\/([^/?#]+)/.exec(String(x.link || ''))?.[1];
      if (!ed) return true;
      if (seenSend.has(ed)) return false;
      seenSend.add(ed);
      return true;
    })
    .slice(0, 5);
  const jobs = all('SELECT * FROM jobs WHERE product_id = ? AND enabled = 1 ORDER BY next_run_at LIMIT 4', p.id);
  const ai = configuredProviders();

  const now = new Date();
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).format(now));
  const greet = hour < 5 ? 'Working late' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const today = new Intl.DateTimeFormat('en-IN', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long' }).format(now);
  const first = (user.name || '').split(/\s+/)[0];
  const dayDiff = (d: string) => Math.round((+new Date(d.slice(0, 10) + 'T12:00:00Z') - +new Date(todayIn(tz) + 'T12:00:00Z')) / 86400_000);

  // The ONE flow model (lib/flow.ts): the same title and action the Editions page and the editor show.
  const state = flowState(next, { shortlisted: short });
  const warns = next?.checks ? next.checks.results.filter((r) => r.status === 'warn').length : 0;
  const overdue = !!next?.planned_for && dayDiff(next.planned_for) < 0 && state.current !== 'done' && !state.scheduled;
  /** When the next edition goes out, in words: "tomorrow at 10:00 am", "on Tuesday at 10:00 am". */
  const goesOut = (() => {
    if (!next) return '';
    const at = next.scheduled_at ? fmtTime(next.scheduled_at, tz) : clock(g.sendTime);
    const day = next.scheduled_at ? zonedDay(next.scheduled_at, tz) : next.planned_for?.slice(0, 10);
    if (!day) return `at ${at}`;
    const diff = dayDiff(day);
    const d = diff === 0 ? 'today' : diff === 1 ? 'tomorrow' : diff > 1 && diff < 7 ? `on ${WEEKDAYS[new Date(day + 'T12:00:00Z').getUTCDay()]}` : `on ${fmtDay(day)}`;
    return `${d} at ${at}`;
  })();
  /** The subtitle says where the week stands, in one sentence. */
  const subtitle = (() => {
    if (!next) {
      if (short) return `${short} ${short === 1 ? 'story is' : 'stories are'} shortlisted. Write this week’s draft next.`;
      if (pool) return `${pool} ${pool === 1 ? 'story is' : 'stories are'} waiting in the pool. Pick this week’s next.`;
      return 'The story pool is empty. Fetch this week’s news to get started.';
    }
    const no = edNo(next.number);
    if (next.status === 'sending') return `${no} is going out now.`;
    if (state.scheduled) return `${no} goes out ${goesOut}. Nothing to do until the results come in.`;
    const todo = state.current === 'send' ? 'choose who gets it' : state.current === 'approve' ? 'approve it' : state.blockers ? `fix ${state.blockers} ${state.blockers === 1 ? 'issue' : 'issues'}` : next.checks ? 're-run the checks' : 'run the checks';
    if (overdue) return `${no} was planned for ${fmtDay(next.planned_for)}. ${todo[0].toUpperCase()}${todo.slice(1)}, then send it.`;
    return `${no} goes out ${goesOut}. ${todo[0].toUpperCase()}${todo.slice(1)} first.`;
  })();
  const detail = state.current === 'stories'
    ? (pool ? `${pool} ${pool === 1 ? 'story is' : 'stories are'} waiting in the pool. Shortlist 3–6.` : `The pool is empty. Fetch news from your ${sources} source${sources === 1 ? '' : 's'}, then shortlist 3–6.`)
    : `${state.detail}${next?.checks && (state.current === 'check' || state.current === 'approve') && warns > 0 ? ` ${warns} ${warns === 1 ? 'warning' : 'warnings'} to look at.` : ''}`;
  const quiet = state.scheduled || state.current === 'done';

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

  const hero = (
    <section className="card hero" aria-labelledby="next-h">
      <div className="card-head"><h2 id="next-h">{next ? 'Next edition' : 'This week’s edition'}</h2>{next && <StatusPill status={next.status} />}</div>
      <FlowStepper current={state.current} />
      <div className="hero-body">
        {next && (
          <div className="hero-ed">
            <div className="hero-meta"><Icon name="calendar" size={15} /><span>{edNo(next.number)} · {fmtDay(next.planned_for)}</span>{next.planned_for && <span className={`pill ${overdue ? 'warn' : 'info'}`}>{relDay(next.planned_for, tz)}</span>}</div>
            <div className="hero-title">{typo(next.content.title) || 'Untitled edition'}</div>
            {next.content.dek && <p className="hero-dek">{typo(next.content.dek)}</p>}
          </div>
        )}
        <div className="next-step">
          <span className={`icon-chip${quiet ? ' ok' : ''}`} aria-hidden><Icon name={quiet ? 'check' : 'bolt'} size={16} /></span>
          <div className="next-step-t">
            <span className="eyebrow">Next step</span>
            <b>{state.title}</b>
            <span className="hint">{detail}</span>
          </div>
          <div className="next-step-cta"><Link className={`btn${quiet ? '' : ' primary'}`} href={state.href}>{state.cta}<Icon name="chevron" size={14} strokeWidth={2.2} /></Link></div>
        </div>
        {next && (
          <div className="row hero-actions">
            {state.href !== `/app/editions/${next.id}` && <Link className="btn" href={`/app/editions/${next.id}`}>Open editor</Link>}
            {!state.href.endsWith('/distribute') && <Link className="btn" href={`/app/editions/${next.id}/distribute`}>Send options</Link>}
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
  );

  const sentDay = lastSent?.sent_at ? zonedDay(lastSent.sent_at, tz) : null;
  const byCh = Object.entries(m.byChannel).map(([c, n]) => `${CHANNEL[c] || c}: ${n}`).join(' · ');
  const of = (n: number) => (sent ? pct(n, sent) : undefined);
  const kpis = (
    <section className="card kpis" aria-labelledby="kpi-h">
      <div className="card-head">
        <div className="kpi-h">
          <h2 id="kpi-h">Last edition</h2>
          {lastSent && <span className="hint">{edNo(lastSent.number)}<span className="sep" aria-hidden>·</span>Sent {sentDay ? relDay(sentDay, tz) : fmtDay(lastSent.sent_at, tz)}<span className="k-sh"><span className="sep" aria-hidden>·</span>% of delivered</span></span>}
        </div>
        {lastSent && <Link className="more" href={`/app/editions/${lastSent.id}/analytics`}>Results<Icon name="chevron" size={13} strokeWidth={2.2} /></Link>}
      </div>
      {lastSent ? (
        <div className="kpi-grid">
          <Stat id={`${p.id}:delivered`} icon="send" value={sent} label="Delivered" meta={`${byCh || 'Nothing delivered yet'}${m.failed ? ` · ${m.failed} failed` : ''}`} />
          <Stat id={`${p.id}:readers`} icon="eye" value={m.readers} label="Opened the page" share={of(m.readers)} meta={m.anonViews ? `+${m.anonViews} views via shared link` : `${m.opens} email ${m.opens === 1 ? 'open' : 'opens'} (approximate)`} />
          <Stat id={`${p.id}:halfway`} icon="doc" value={m.halfway} label="Read past halfway" share={of(m.halfway)} meta={`${m.finished} reached the end${m.avgTime ? ` · avg ${m.avgTime}s on page` : ''}`} />
          <Stat id={`${p.id}:intent`} icon="leads" value={m.intentPeople} label="Showed interest" share={of(m.intentPeople)} tone="ok" meta={m.anonIntents ? `+${m.anonIntents} taps via shared link` : 'Interested, booked or tapped Our work'} />
        </div>
      ) : <p className="kpi-empty"><Icon name="chart" size={16} />Nothing sent yet. The numbers for each edition appear here after its first send.</p>}
    </section>
  );

  const leads = (
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
                  <span className="who"><b>{name}</b><small>{c.last_intent ? <>{String(c.last_intent)[0].toUpperCase() + String(c.last_intent).slice(1)} · <Ago iso={c.last_intent_at} /></> : [c.role, c.company].filter(Boolean).join(', ') || c.email}</small></span>
                  <span className="score" title="Lead score"><b>{c.score}</b><span className="meter" aria-hidden><span style={{ width: `${Math.min(100, c.score)}%` }} /></span></span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : <div className="empty"><b>No engagement yet</b><span>When someone opens an edition or taps a button, they show up here.</span></div>}
    </section>
  );

  const activity = (
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
  );

  const system = (
    <section className="card system" aria-labelledby="sys-h">
      <div className="card-head"><h2 id="sys-h">Next automations</h2><Link className="more" href="/app/automations">Automations<Icon name="chevron" size={13} strokeWidth={2.2} /></Link></div>
      {jobs.length ? (
        <ul className="jobs">{jobs.map((j) => (
          <li key={j.id}><Icon name="automations" size={16} /><span>{(JOB_INFO as any)[j.type]?.label || j.name}</span><Ago iso={j.next_run_at} /></li>
        ))}</ul>
      ) : <p className="hint">No automations are switched on. <Link href="/app/automations">Set them up</Link></p>}
      <h3 className="group-title">Connections</h3>
      <ul className="status-list">
        <li><span className={`led ${ai.length ? 'on' : 'off'}`} aria-hidden /><Icon name="sparkle" size={16} /><span>AI</span><Link href="/app/settings?tab=ai">{ai.length ? ai.join(', ') : 'Demo mode (no key yet)'}</Link></li>
        <li><span className={`led ${smtpReady() ? 'on' : 'off'}`} aria-hidden /><Icon name="mail" size={16} /><span>Email</span><Link href="/app/settings?tab=email">{smtpReady() ? 'SMTP connected' : 'Outbox only'}</Link></li>
        <li><span className={`led ${waReady() ? 'on' : 'idle'}`} aria-hidden /><Icon name="whatsapp" size={16} /><span>WhatsApp</span><Link href="/app/settings?tab=whatsapp">{waReady() ? 'Business API' : 'Click-to-chat'}</Link></li>
      </ul>
    </section>
  );

  return (
    <div className="pg home">
      <header className="ph">
        <div>
          <span className="eyebrow">{today}<span className="sep" aria-hidden>·</span>{p.name}</span>
          <h1>{sp.welcome ? 'You’re set up. Here’s your week.' : `${greet}${first ? `, ${first}` : ''}`}</h1>
          <p className="sub">{subtitle}</p>
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
              <Ring done={doneCount} total={steps.length} size={84} />
              <div>
                <h2 id="setup-h">Finish setting up</h2>
                <p className="hint">{steps.length - doneCount} {steps.length - doneCount === 1 ? 'step' : 'steps'} left before your first real send.</p>
                {nextSetup >= 0 && <p className="hint setup-next" title={`Up next: ${steps[nextSetup].label}`}>Up next: <Link href={steps[nextSetup].href}>{steps[nextSetup].label}</Link></p>}
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

      {/* Last edition's numbers as one compact row across the top; below it the work on the left, people and system on the right. */}
      <div className="home-grid">
        <div className="h-kpis">{kpis}</div>
        <div className="home-col">{hero}<div className="h-act">{activity}</div></div>
        <div className="home-col"><div className="h-leads">{leads}</div><div className="h-sys">{system}</div></div>
      </div>
    </div>
  );
}
