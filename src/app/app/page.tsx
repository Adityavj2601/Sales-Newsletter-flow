import Link from 'next/link';
import { all, get } from '@/lib/db';
import { requireProduct } from '@/lib/context';
import { getSetting, smtpReady, waReady, baseUrl } from '@/lib/settings';
import { configuredProviders } from '@/lib/ai/providers';
import { listEditions } from '@/lib/editions';
import { fmtDay, ago, num } from '@/lib/format';
import { editionMetrics } from '@/lib/metrics';
import { StatusPill } from '@/components/bits';
import { JOB_INFO } from '@/lib/jobs';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Home' };

export default async function Home({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const p = await requireProduct();
  const sp = await searchParams;
  const n = (sql: string, ...a: any[]) => Number(get(sql, ...a)?.n || 0);
  const g = getSetting('general');
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

  const last4 = eds.filter((e) => e.status === 'sent').slice(0, 4).map((e) => e.id);
  const m = editionMetrics(last4);
  const sent = m.delivered, views = m.readers, intents = m.intentPeople, unsubs = m.unsubscribes;
  const hot = all("SELECT * FROM contacts WHERE product_id = ? AND status = 'active' AND score > 0 ORDER BY (last_intent_at IS NOT NULL) DESC, last_intent_at DESC, score DESC LIMIT 6", p.id);
  const notes = all('SELECT * FROM notifications WHERE product_id = ? OR product_id IS NULL ORDER BY created_at DESC LIMIT 6', p.id);
  const jobs = all('SELECT * FROM jobs WHERE product_id = ? AND enabled = 1 ORDER BY next_run_at LIMIT 4', p.id);

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="ph">
        <div>
          <div className="eyebrow">{p.newsletter_name} · by {p.name}</div>
          <h1>{sp.welcome ? 'You’re set up. Here’s your week.' : 'This week'}</h1>
          <p className="sub">Draft on Monday, review in 15 minutes, send on {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][g.sendDay]} at {g.sendTime}. Taps on “I’m interested” reach you instantly.</p>
        </div>
        <div className="row">
          <Link className="btn" href="/app/stories">Story pool</Link>
          <Link className="btn primary" href="/app/editions?new=1">New edition</Link>
        </div>
      </div>

      {doneCount < steps.length && (
        <section className="card">
          <div className="card-head"><h2>Finish setting up</h2><span className="pill">{doneCount} of {steps.length} done</span></div>
          <ol className="steps">
            {steps.map((s, i) => (
              <li key={i} className={s.done ? 'done' : ''}><span className="n">{s.done ? '✓' : i + 1}</span><span className="lbl">{s.label}</span>{!s.done && <Link className="btn sm" href={s.href}>Open</Link>}</li>
            ))}
          </ol>
        </section>
      )}

      <div className="grid2">
        <section className="card">
          <div className="card-head"><h2>Next edition</h2>{next && <StatusPill status={next.status} />}</div>
          {next ? (
            <div className="stack" style={{ gap: 10 }}>
              <div className="hint">#{next.number} · planned for {fmtDay(next.planned_for)}</div>
              <div style={{ font: '600 22px/1.2 var(--f-display)' }}>{next.content.title || 'Untitled edition'}</div>
              <div className="hint">{next.content.dek}</div>
              {next.checks ? (
                <div className="row">
                  <span className="pill bad">{next.checks.results.filter((r) => r.status === 'fail').length} failing</span>
                  <span className="pill warn">{next.checks.results.filter((r) => r.status === 'warn').length} warnings</span>
                  <span className="hint">checked {ago(next.checks.at)}</span>
                </div>
              ) : <div className="hint">Checks not run yet.</div>}
              <div className="row">
                <Link className="btn primary" href={`/app/editions/${next.id}`}>Open editor</Link>
                <Link className="btn" href={`/app/editions/${next.id}/distribute`}>Send options</Link>
                <a className="btn ghost" href={`${baseUrl()}/e/${p.slug}/${next.slug}?preview=1`} target="_blank" rel="noreferrer">Preview ↗</a>
              </div>
              {upcoming.length > 1 && <div className="hint">Also planned: {upcoming.slice(1, 4).map((e) => `#${e.number} (${fmtDay(e.planned_for)})`).join(', ')}</div>}
            </div>
          ) : (
            <div className="empty"><b>No edition planned</b><span>Draft one from this week’s stories.</span><Link className="btn primary" href="/app/editions?new=1">New edition</Link></div>
          )}
        </section>

        <section className="card">
          <div className="card-head"><h2>Last 4 sent editions</h2>{lastSent && <Link href={`/app/editions/${lastSent.id}/analytics`}>Latest report →</Link>}</div>
          {last4.length ? (
            <div className="grid2">
              <div className="kpi"><div className="v">{num(sent)}</div><div className="k">Delivered</div></div>
              <div className="kpi"><div className="v">{num(views)}</div><div className="k">Opened the page</div><div className="d">{sent ? Math.round((views / sent) * 100) : 0}% of delivered</div></div>
              <div className="kpi"><div className="v">{num(intents)}</div><div className="k">People who showed interest</div></div>
              <div className="kpi"><div className="v">{num(unsubs)}</div><div className="k">Unsubscribes</div></div>
            </div>
          ) : <div className="empty"><b>Nothing sent yet</b><span>Numbers appear here after your first send.</span></div>}
        </section>
      </div>

      <div className="grid2">
        <section className="card">
          <div className="card-head"><h2>Warmest leads</h2><Link href="/app/leads">All leads →</Link></div>
          {hot.length ? (
            <table className="tbl"><tbody>
              {hot.map((c) => (
                <tr key={c.id}><td><Link href={`/app/contacts/${c.id}`}><b>{`${c.first_name} ${c.last_name}`.trim() || c.email}</b></Link><div className="hint">{[c.role, c.company].filter(Boolean).join(', ')}</div></td>
                  <td>{c.last_intent ? <span className="pill ok">{c.last_intent} · {ago(c.last_intent_at)}</span> : <span className="hint">engaged {ago(c.last_engaged_at)}</span>}</td><td className="num"><b>{c.score}</b></td></tr>
              ))}
            </tbody></table>
          ) : <div className="empty"><b>No engagement yet</b><span>When someone opens an edition or taps a button, they show up here.</span></div>}
        </section>
        <section className="card">
          <div className="card-head"><h2>Latest activity</h2><Link href="/app/notifications">Notifications →</Link></div>
          {notes.length ? (
            <ul className="tl">{notes.map((x) => <li key={x.id}><time>{ago(x.created_at)}</time><div>{x.link ? <Link href={x.link}><b>{x.title}</b></Link> : <b>{x.title}</b>}{x.body && <div className="hint">{x.body}</div>}</div></li>)}</ul>
          ) : <div className="hint">Nothing yet.</div>}
          <hr />
          <div className="eyebrow" style={{ marginBottom: 8 }}>Next automations</div>
          <ul className="tl">{jobs.map((j) => <li key={j.id}><time>{ago(j.next_run_at)}</time><div>{(JOB_INFO as any)[j.type]?.label || j.name}</div></li>)}</ul>
          <div className="hint" style={{ marginTop: 8 }}>{configuredProviders().length ? `AI: ${configuredProviders().join(', ')}` : 'AI: demo mode (no key yet)'} · Email: {smtpReady() ? 'SMTP connected' : 'Outbox only'} · WhatsApp: {waReady() ? 'Business API' : 'click-to-chat'}</div>
        </section>
      </div>
    </div>
  );
}
