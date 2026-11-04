import Link from 'next/link';
import { all, DATA_DIR } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { activeProduct } from '@/lib/context';
import { getSetting, listProducts, providerKey, PROVIDERS, smtpPass, waToken, baseUrl } from '@/lib/settings';
import { MODEL_DEFAULTS, PROVIDER_LABEL, tokensThisMonth, routeFor } from '@/lib/ai/providers';
import { mask } from '@/lib/crypto';
import { WEEKDAYS, num, fmtDate } from '@/lib/format';
import { Submit, Copy, Confirm } from '@/components/ui';
import { TestButton } from './Test';
import * as A from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Settings' };

const ALL_TABS = [['general', 'General'], ['products', 'Products & brand'], ['ai', 'AI providers'], ['email', 'Email sending'], ['whatsapp', 'WhatsApp'], ['alerts', 'Alerts & CRM'], ['team', 'Team'], ['data', 'Data']] as const;
const TASKS = [['draft', 'Write editions', 'Your best writing model'], ['edit', 'Copilot edits', 'Usually the same as writing'], ['fast', 'Score stories & subject lines', 'A fast, cheap model'], ['factcheck', 'Fact check', 'Auto picks a different company from the writer']] as const;

export default async function Settings({ searchParams }: { searchParams: Promise<{ tab?: string; p?: string }> }) {
  const me = await requireUser();
  const sp = await searchParams;
  const TABS = me.role === 'admin' ? ALL_TABS : ALL_TABS.filter(([k]) => k === 'team');
  const tab = me.role === 'admin' ? sp.tab || 'general' : 'team';
  const g = getSetting('general');
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="ph"><div><h1>Settings</h1>{me.role !== 'admin' && <p className="sub">You’re an editor. Only admins can change products, AI keys, sending and alerts; you can change your own password here.</p>}</div></div>
      <div className="tabs">{TABS.map(([k, l]) => <Link key={k} href={`/app/settings?tab=${k}`} aria-current={tab === k ? 'page' : undefined}>{l}</Link>)}</div>

      {tab === 'general' && (
        <form action={A.saveGeneral} className="card form-grid">
          <label className="f"><span>App name</span><input className="in" name="appName" defaultValue={g.appName} /></label>
          <label className="f"><span>Public web address</span><input className="in" name="publicBaseUrl" type="url" defaultValue={g.publicBaseUrl} placeholder="https://brief.yourdomain.com" /><small>Every link, preview image and tracking pixel uses this. Now: {baseUrl()}</small></label>
          <label className="f"><span>Time zone</span><select className="in" name="timezone" defaultValue={g.timezone}>{['Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London', 'America/New_York', 'UTC'].map((z) => <option key={z}>{z}</option>)}</select></label>
          <label className="f"><span>Default send day</span><select className="in" name="sendDay" defaultValue={g.sendDay}>{WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></label>
          <label className="f"><span>Default send time</span><input className="in" name="sendTime" type="time" defaultValue={g.sendTime} /><small>Tue–Thu mornings usually get the best B2B reading.</small></label>
          <label className="f"><span>Emails per minute</span><input className="in" name="emailsPerMinute" type="number" min={1} max={600} defaultValue={g.emailsPerMinute} /><small>Start low (20–30) on a new sending domain.</small></label>
          <div className="full"><Submit>Save</Submit></div>
        </form>
      )}

      {tab === 'products' && <ProductsTab sel={sp.p} />}
      {tab === 'ai' && <AiTab />}

      {tab === 'email' && (() => {
        const s = getSetting('smtp');
        return (
          <div className="stack">
            <div className="notice">Use any SMTP service: Amazon SES, Brevo, Resend, Postmark (broadcast stream), Zoho, or Google Workspace for small lists. Send from a sub-domain like <code>news.yourdomain.com</code> with SPF, DKIM and DMARC set up, and warm it up slowly. Until SMTP is connected, emails go to the Outbox.</div>
            <form action={A.saveSMTP} className="card form-grid">
              <label className="f"><span>SMTP host</span><input className="in" name="host" defaultValue={s.host} placeholder="email-smtp.ap-south-1.amazonaws.com" /></label>
              <label className="f"><span>Port</span><input className="in" name="port" type="number" defaultValue={s.port} /></label>
              <label className="f"><span>Username</span><input className="in" name="user" defaultValue={s.user} autoComplete="off" /></label>
              <label className="f"><span>Password {s.pass ? `(saved: ••••••••)` : ''}</span><input className="in" name="pass" type="password" autoComplete="new-password" placeholder={s.pass ? 'Leave empty to keep' : ''} /></label>
              <label className="f full"><span>Default From</span><input className="in" name="from" defaultValue={s.from} placeholder={'"Team Unada" <brief@news.unada.io>'} /><small>Each product can override the sender name and address in Products & brand.</small></label>
              <label className="check"><input type="checkbox" name="secure" defaultChecked={s.secure} /><span>Use SSL/TLS from the start (port 465)</span></label>
              {s.pass && <label className="check"><input type="checkbox" name="clear_pass" /><span>Remove saved password</span></label>}
              <div className="full row"><Submit>Save</Submit><TestButton what="smtp" label="Test connection" /></div>
            </form>
          </div>
        );
      })()}

      {tab === 'whatsapp' && (() => {
        const w = getSetting('whatsapp');
        return (
          <div className="stack">
            <div className="card prose">
              <h2 style={{ marginTop: 0 }}>Three ways to send on WhatsApp</h2>
              <ol>
                <li><b>Copy the link</b> and send it yourself. Works today.</li>
                <li><b>Click-to-chat list</b> on each edition’s Send page: WhatsApp opens with the personal message filled in. Works today, no setup.</li>
                <li><b>WhatsApp Business Cloud API</b> (below): send an approved Marketing template to everyone with WhatsApp consent, with “Interested” / “Not right now” buttons inside WhatsApp. Needs a Meta Business account, a dedicated number and an approved template. Meta charges per marketing message.</li>
              </ol>
              <p className="hint">Never use unofficial bulk-sender tools; they get numbers banned.</p>
            </div>
            <form action={A.saveWA} className="card form-grid">
              <label className="f"><span>Phone number ID</span><input className="in" name="phoneNumberId" defaultValue={w.phoneNumberId} /></label>
              <label className="f"><span>WhatsApp Business Account ID</span><input className="in" name="wabaId" defaultValue={w.wabaId} /></label>
              <label className="f"><span>Permanent access token {w.token ? `(saved: ••••••••)` : ''}</span><input className="in" name="token" type="password" autoComplete="new-password" placeholder={w.token ? 'Leave empty to keep' : ''} /></label>
              <label className="f"><span>Meta App Secret {w.appSecret ? '(saved)' : ''}</span><input className="in" name="appSecret" type="password" autoComplete="new-password" placeholder={w.appSecret ? 'Leave empty to keep' : 'From Meta app → Settings → Basic'} /><small>Used to check that webhook calls really come from Meta.</small></label>
              <label className="f"><span>Graph API version</span><input className="in" name="apiVersion" defaultValue={w.apiVersion} /></label>
              <label className="f"><span>Template name</span><input className="in" name="templateName" defaultValue={w.templateName} placeholder="weekly_brief" /></label>
              <label className="f"><span>Template language</span><input className="in" name="templateLang" defaultValue={w.templateLang} placeholder="en" /></label>
              <label className="f"><span>Body variables, in order</span><input className="in" name="bodyParams" defaultValue={w.bodyParams} /><small>Comma list from: first_name, title, dek, link, newsletter. Must match {'{{1}}, {{2}}…'} in your template.</small></label>
              <label className="f"><span>Buttons in the template</span><select className="in" name="button" defaultValue={w.button}><option value="quick_reply">Two quick replies: Interested / Not right now</option><option value="url">One URL button with dynamic suffix</option><option value="none">No buttons</option></select><small>URL buttons: set the template URL to {baseUrl()}/e/{'{{1}}'}.</small></label>
              <label className="check"><input type="checkbox" name="headerImage" defaultChecked={w.headerImage} /><span>Template has an image header (we send the edition’s preview image)</span></label>
              {w.token && <label className="check"><input type="checkbox" name="clear_token" /><span>Remove saved token</span></label>}
              <div className="full"><hr /><b>Webhook</b> (for delivery status and button taps). In Meta’s app settings use:
                <div className="row" style={{ marginTop: 6 }}><code>{baseUrl()}/api/wa/webhook</code><Copy text={`${baseUrl()}/api/wa/webhook`} /></div>
                <div className="row" style={{ marginTop: 6 }}>Verify token: <code>{w.verifyToken || '(saved on first save)'}</code><input type="hidden" name="verifyToken" value={w.verifyToken} /></div>
                <div className="hint">Subscribe to the “messages” field.</div></div>
              <div className="full row"><Submit>Save</Submit><TestButton what="wa" label="Send test to…" needsInput="Phone with country code" /></div>
            </form>
          </div>
        );
      })()}

      {tab === 'alerts' && (() => {
        const a = getSetting('alerts');
        return (
          <form action={A.saveAlerts} className="card form-grid">
            <label className="f full"><span>Alert emails (comma separated)</span><input className="in" name="alertEmails" defaultValue={a.alertEmails} /><small>Get an email the moment someone taps “I’m interested” or “Book 15 min”, plus the Friday report. Each product can add its own address too.</small></label>
            <label className="f full"><span>Slack incoming webhook (optional)</span><input className="in" name="slackWebhook" defaultValue={a.slackWebhook} placeholder="https://hooks.slack.com/services/…" /></label>
            <label className="f full"><span>CRM / automation webhook (optional)</span><input className="in" name="webhookUrl" defaultValue={a.webhookUrl} placeholder="https://hooks.zapier.com/… or a Make / n8n / HubSpot workflow URL" /><small>Receives JSON for every intent tap: contact, edition, action, note. Use it to create deals in HubSpot, Zoho or Apollo.</small></label>
            <div className="full row"><Submit>Save</Submit><TestButton what="alert" label="Send a test alert" /></div>
          </form>
        );
      })()}

      {tab === 'team' && (() => {
        const users = all('SELECT id, email, name, role, created_at FROM users ORDER BY created_at');
        return (
          <div className="stack">
            <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Added</th><th></th></tr></thead>
              <tbody>{users.map((u) => <tr key={u.id}><td>{u.name}{u.id === me.id ? ' (you)' : ''}</td><td>{u.email}</td><td>{u.role}</td><td className="hint">{fmtDate(u.created_at)}</td><td>{u.id !== me.id && me.role === 'admin' && <div className="row end">
                <form action={A.resetUserPassword} className="row"><input type="hidden" name="id" value={u.id} /><input className="in" name="password" type="password" placeholder="New password" aria-label={`New password for ${u.name}`} style={{ width: 150 }} autoComplete="new-password" /><button className="btn sm">Reset</button></form>
                <Confirm action={A.deleteUser.bind(null, u.id)} label="Remove" className="btn sm ghost" /></div>}</td></tr>)}</tbody></table></div>
            {me.role === 'admin' && <form action={A.addUser} className="card form-grid"><h2 className="full">Add a teammate</h2>
              <label className="f"><span>Name</span><input className="in" name="name" /></label><label className="f"><span>Email</span><input className="in" name="email" type="email" required /></label>
              <label className="f"><span>Temporary password</span><input className="in" name="password" type="password" minLength={8} required autoComplete="new-password" /></label>
              <label className="f"><span>Role</span><select className="in" name="role"><option value="editor">Editor: write, edit, send</option><option value="admin">Admin: also settings & keys</option></select></label>
              <div className="full"><Submit>Add teammate</Submit></div></form>}
            <form action={A.changeMyPassword} className="card form-grid"><h2 className="full">Change your password</h2>
              <label className="f"><span>Current password</span><input className="in" name="current" type="password" required autoComplete="current-password" /></label>
              <label className="f"><span>New password</span><input className="in" name="password" type="password" minLength={8} required autoComplete="new-password" /></label>
              <div className="full"><Submit>Change password</Submit></div></form>
          </div>
        );
      })()}

      {tab === 'data' && (
        <div className="grid2">
          <section className="card stack"><h2>Exports</h2>
            <div className="row"><a className="btn" href="/api/export?type=contacts">Contacts CSV</a><a className="btn" href="/api/export?type=leads">Leads CSV</a><a className="btn" href="/api/export?type=events">All events CSV</a><a className="btn" href="/api/export?type=backup">Database backup</a></div>
            <p className="hint">Everything lives in <code>{DATA_DIR}</code>: the SQLite database, uploads and the encryption key. Back up that folder; without <code>secret.key</code> (or APP_SECRET) saved API keys can’t be decrypted.</p></section>
          <section className="card stack"><h2>Scheduler</h2>
            <p className="hint">The app checks jobs and the send queue every minute while it runs. If you host it somewhere that sleeps (serverless), set <code>CRON_KEY</code> and call this URL every minute from a cron service:</p>
            <code style={{ wordBreak: 'break-all' }}>{baseUrl()}/api/cron?key=YOUR_CRON_KEY</code></section>
        </div>
      )}
    </div>
  );
}

async function ProductsTab({ sel }: { sel?: string }) {
  const products = listProducts();
  const active = await activeProduct();
  const p = products.find((x) => x.id === sel) || active || products[0];
  return (
    <div className="stack">
      <div className="row">{products.map((x) => <Link key={x.id} className={`btn sm ${x.id === p?.id ? 'primary' : ''}`} href={`/app/settings?tab=products&p=${x.id}`}>{x.name}</Link>)}</div>
      {p && (
        <form action={A.saveProduct} className="card form-grid">
          <input type="hidden" name="id" value={p.id} />
          <h2 className="full">{p.name}</h2>
          <label className="f"><span>Product name</span><input className="in" name="name" defaultValue={p.name} /></label>
          <label className="f"><span>Website</span><input className="in" name="website" type="url" defaultValue={p.website} /></label>
          <label className="f"><span>Newsletter name</span><input className="in" name="newsletter_name" defaultValue={p.newsletter_name} /></label>
          <label className="f"><span>Link name</span><input className="in" name="slug" defaultValue={p.slug} /><small>{baseUrl()}/e/{p.slug}/…</small></label>
          <label className="f full"><span>Tagline</span><input className="in" name="tagline" defaultValue={p.brand.tagline} /></label>
          <label className="f full"><span>What {p.name} does (the AI reads this)</span><textarea className="in" name="about" rows={4} defaultValue={p.brand.about} /></label>
          <label className="f full"><span>Who the readers are</span><textarea className="in" name="icp" rows={3} defaultValue={p.brand.icp} /></label>
          <label className="f full"><span>Tone of voice</span><textarea className="in" name="tone" rows={2} defaultValue={p.brand.tone} /></label>
          <label className="f full"><span>Banned words (comma separated)</span><input className="in" name="bannedWords" defaultValue={p.brand.bannedWords} /></label>
          <div className="full row" style={{ gap: 18 }}>
            <label className="f"><span>Primary</span><input type="color" name="primary" defaultValue={p.brand.primary} /></label>
            <label className="f"><span>Accent</span><input type="color" name="accent" defaultValue={p.brand.accent} /></label>
            <label className="f"><span>Soft background</span><input type="color" name="soft" defaultValue={p.brand.soft} /></label>
            <label className="f" style={{ flex: 1 }}><span>Logo URL (wide logo on a transparent background)</span><input className="in" name="logoUrl" defaultValue={p.brand.logoUrl} placeholder="Upload in any editor image field, then paste the link" /></label>
          </div>
          <label className="f"><span>Sender name</span><input className="in" name="senderName" defaultValue={p.brand.senderName} /></label>
          <label className="f"><span>Sender email</span><input className="in" name="senderEmail" type="email" defaultValue={p.brand.senderEmail} placeholder={`brief@news.${(p.website || 'yourdomain.com').replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '')}`} /></label>
          <label className="f"><span>Reply-to email</span><input className="in" name="replyTo" type="email" defaultValue={p.brand.replyTo} /></label>
          <label className="f"><span>Sign-off</span><input className="in" name="signOff" defaultValue={p.brand.signOff} /></label>
          <label className="f full"><span>Registered address (email footer)</span><input className="in" name="address" defaultValue={p.brand.address} /></label>
          <label className="f"><span>“Book 15 min” link</span><input className="in" name="bookingUrl" type="url" defaultValue={p.brand.bookingUrl} placeholder="https://calendly.com/…" /><small>Name and email are pre-filled for the reader.</small></label>
          <label className="f"><span>Sales alert email for this product</span><input className="in" name="alertEmail" type="email" defaultValue={p.brand.alertEmail} /></label>
          <div className="full row"><Submit>Save {p.name}</Submit></div>
        </form>
      )}
      <form action={A.addProduct} className="card form-grid">
        <h2 className="full">Add another product</h2>
        <label className="f"><span>Name</span><input className="in" name="name" required /></label>
        <label className="f"><span>Website</span><input className="in" name="website" type="url" /></label>
        <label className="f"><span>Newsletter name</span><input className="in" name="newsletter_name" /></label>
        <div className="full"><Submit>Add product</Submit></div>
      </form>
      {p && products.length > 1 && (
        <form action={A.deleteProduct} className="card row"><input type="hidden" name="id" value={p.id} /><span>Delete {p.name} and all its editions, contacts and results. Type DELETE:</span><input className="in" name="confirm" style={{ width: 120 }} /><button className="btn danger">Delete product</button></form>
      )}
    </div>
  );
}

function AiTab() {
  const ai = getSetting('ai');
  const used = tokensThisMonth();
  const usage = all("SELECT provider, model, task, COUNT(*) AS calls, SUM(input_tokens) AS i, SUM(output_tokens) AS o, SUM(ok = 0) AS errs FROM llm_usage WHERE created_at >= date('now','start of month') GROUP BY provider, model, task ORDER BY i + o DESC");
  return (
    <div className="stack">
      <form action={A.saveAI} className="card stack">
        <h2>API keys</h2>
        <p className="hint">Add one or more. Keys are encrypted on the server and never shown again. With two providers, the fact check automatically uses the other company’s model, because different models tend to make different mistakes.</p>
        {PROVIDERS.map((pv) => {
          const k = providerKey(pv);
          return (
            <div key={pv} className="row" style={{ alignItems: 'flex-end' }}>
              <label className="f" style={{ flex: 1, minWidth: 240 }}><span>{PROVIDER_LABEL[pv]} {k ? <span className="pill ok">saved · {mask(k)}</span> : <span className="pill">not set</span>}</span><input className="in" name={`key_${pv}`} type="password" autoComplete="off" placeholder={k ? 'Paste a new key to replace' : { anthropic: 'sk-ant-…', openai: 'sk-…', gemini: 'AIza…', openrouter: 'sk-or-…' }[pv]} /></label>
              {k && <label className="check"><input type="checkbox" name={`clear_${pv}`} /><span>Remove</span></label>}
              {k && <TestButton what="ai" provider={pv} label="Test" />}
            </div>
          );
        })}
        <hr />
        <h2>Which model does what</h2>
        <div className="tbl-wrap"><table className="tbl"><thead><tr><th>Task</th><th>Provider</th><th>Model</th><th>Now using</th></tr></thead><tbody>
          {TASKS.map(([t, l, h]) => {
            const r = ai.routing[t];
            const now = routeFor(t)[0];
            return <tr key={t}><td><b>{l}</b><div className="hint">{h}</div></td>
              <td><select className="in" aria-label={`Provider for ${l}`} name={`route_${t}`} defaultValue={r.provider}><option value="auto">Auto</option>{PROVIDERS.map((pv) => <option key={pv} value={pv}>{PROVIDER_LABEL[pv]}</option>)}</select></td>
              <td><input className="in mono" aria-label={`Model for ${l}`} name={`model_${t}`} defaultValue={r.model} placeholder="default" list={`models-${t}`} /><datalist id={`models-${t}`}>{PROVIDERS.flatMap((pv) => MODEL_DEFAULTS[pv].suggestions).map((m) => <option key={m} value={m} />)}</datalist></td>
              <td className="hint">{now ? `${PROVIDER_LABEL[now.provider]} · ${now.model}` : 'Demo mode'}</td></tr>;
          })}
        </tbody></table></div>
        <label className="f" style={{ maxWidth: 320 }}><span>Monthly token limit (0 = no limit)</span><input className="in" name="monthlyTokenLimit" type="number" min={0} defaultValue={ai.monthlyTokenLimit} /><small>Used this month: {num(used)} tokens. A typical edition uses 30–80k.</small></label>
        <div><Submit>Save AI settings</Submit></div>
      </form>
      <section className="card"><h2>This month’s usage</h2>
        {usage.length ? <div className="tbl-wrap" style={{ marginTop: 10 }}><table className="tbl"><thead><tr><th>Provider</th><th>Model</th><th>Task</th><th className="num">Calls</th><th className="num">Input</th><th className="num">Output</th><th className="num">Errors</th></tr></thead>
          <tbody>{usage.map((u, i) => <tr key={i}><td>{u.provider}</td><td className="mono">{u.model}</td><td>{u.task}</td><td className="num">{u.calls}</td><td className="num">{num(u.i || 0)}</td><td className="num">{num(u.o || 0)}</td><td className="num">{u.errs || ''}</td></tr>)}</tbody></table></div> : <p className="hint">No AI calls yet this month.</p>}
      </section>
    </div>
  );
}

