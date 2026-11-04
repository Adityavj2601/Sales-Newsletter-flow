import Link from 'next/link';
import { all, DATA_DIR } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { activeProduct } from '@/lib/context';
import { getSetting, listProducts, providerKey, PROVIDERS, baseUrl } from '@/lib/settings';
import { MODEL_DEFAULTS, PROVIDER_LABEL, tokensThisMonth, routeFor } from '@/lib/ai/providers';
import { mask } from '@/lib/crypto';
import { WEEKDAYS, num, fmtDate, fmtTime } from '@/lib/format';
import { Submit, Copy, Confirm } from '@/components/ui';
import { Avatar } from '@/components/bits';
import { Icon, Tile } from '@/components/content/icons';
import { Group, Row, Callout } from '@/components/content/grouped';
import { SaveBar, SecretField, SettingsNav, BrandColors, MemberRow } from '@/components/content/controls';
import { TestButton } from './Test';
import * as A from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Settings' };

const ALL_TABS = [
  { key: 'general', label: 'General', icon: 'gear', tone: 'gray', desc: 'Your public address, time zone and the default send slot.' },
  { key: 'products', label: 'Products & brand', icon: 'palette', tone: 'pink', desc: 'Each product has its own newsletter, voice, colours and sender.' },
  { key: 'ai', label: 'AI providers', icon: 'sparkles', tone: 'purple', desc: 'Connect one or more AI providers and choose which model does what.' },
  { key: 'email', label: 'Email sending', icon: 'envelope', tone: 'blue', desc: 'Connect an SMTP service. Until then, every email waits safely in the Outbox.' },
  { key: 'whatsapp', label: 'WhatsApp', icon: 'chat', tone: 'green', desc: 'Share by link today, or send through the WhatsApp Business Cloud API.' },
  { key: 'alerts', label: 'Alerts & CRM', icon: 'bell', tone: 'red', desc: 'Who hears about it the moment a reader taps “I’m interested”.' },
  { key: 'team', label: 'Team', icon: 'people', tone: 'indigo', desc: 'Who can sign in, and what they’re allowed to change.' },
  { key: 'data', label: 'Data', icon: 'database', tone: 'graphite', desc: 'Exports, backups and the scheduler.' },
];
const TASKS = [['draft', 'Write editions', 'Your best writing model'], ['edit', 'Copilot edits', 'Usually the same as writing'], ['fast', 'Score stories & subject lines', 'A fast, inexpensive model'], ['factcheck', 'Fact check', 'Auto picks a different company from the writer']] as const;
const PROVIDER_MARK: Record<string, string> = { anthropic: 'A', openai: 'O', gemini: 'G', openrouter: 'OR' };
/** "10:00" → "10:00 am", the way times read everywhere else in the app. */
const clock = (hhmm: string) => fmtTime(`2000-01-01T${hhmm.padStart(5, '0')}:00Z`, 'UTC');
/** Send times on the half hour, plus the saved one if it is off the grid. */
const times = (cur: string) => {
  const list = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);
  return /^\d{2}:\d{2}$/.test(cur) && !list.includes(cur) ? [...list, cur].sort() : list;
};
const KEY_HINT: Record<string, string> = { anthropic: 'sk-ant-…', openai: 'sk-…', gemini: 'AIza…', openrouter: 'sk-or-…' };

export default async function Settings({ searchParams }: { searchParams: Promise<{ tab?: string; p?: string; new?: string }> }) {
  const me = await requireUser();
  const sp = await searchParams;
  const TABS = me.role === 'admin' ? ALL_TABS : ALL_TABS.filter((t) => t.key === 'team');
  const tab = me.role === 'admin' ? (TABS.some((t) => t.key === sp.tab) ? sp.tab! : 'general') : 'team';
  const meta = TABS.find((t) => t.key === tab)!;
  const g = getSetting('general');

  return (
    <div className="pg se">
      <div className="ph">
        <div>
          <span className="eyebrow">{g.appName}</span>
          <h1>Settings</h1>
          <p className="sub">{me.role === 'admin' ? 'Products, connections, alerts and your team. Changes apply to every product unless a section says otherwise.' : 'You’re an editor. Only admins can change products, AI keys, sending and alerts; you can change your own password here.'}</p>
        </div>
      </div>
      <div className="se-shell">
        <SettingsNav items={TABS.map(({ key, label, icon, tone }) => ({ key, label, icon, tone }))} current={tab} />
        <div className="se-pane" key={tab}>
          <header className="se-head">
            <Tile icon={meta.icon} tone={meta.tone} size="lg" />
            <div><h2>{meta.label}</h2><p>{meta.desc}</p></div>
          </header>

          {tab === 'general' && (
            <form action={A.saveGeneral} className="se-form">
              <Group title="App">
                <Row label="App name"><input className="in" name="appName" defaultValue={g.appName} /></Row>
                <Row label="Public web address" sub={<>Every link, preview image and tracking pixel uses this. Now <b className="se-val">{baseUrl()}</b></>}>
                  <input className="in" name="publicBaseUrl" type="url" defaultValue={g.publicBaseUrl} placeholder="https://brief.yourdomain.com" />
                </Row>
              </Group>
              <Group title="Sending" footer="Tuesday to Thursday mornings usually get the best B2B reading. Start at 20–30 emails a minute on a new sending domain.">
                <Row label="Time zone"><select className="in" name="timezone" defaultValue={g.timezone}>{['Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London', 'America/New_York', 'UTC'].map((z) => <option key={z}>{z}</option>)}</select></Row>
                <Row as="div" label="Default send slot" sub="New editions are planned for this day and time.">
                  <span className="se-pair">
                    <select className="in" name="sendDay" aria-label="Default send day" defaultValue={g.sendDay}>{WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select>
                    <select className="in" name="sendTime" aria-label="Default send time" defaultValue={g.sendTime}>{times(g.sendTime).map((t) => <option key={t} value={t}>{clock(t)}</option>)}</select>
                  </span>
                </Row>
                <Row label="Emails per minute" sub="Sending pace, 1–600."><input className="in se-num" name="emailsPerMinute" type="number" min={1} max={600} defaultValue={g.emailsPerMinute} /></Row>
              </Group>
              <SaveBar />
            </form>
          )}

          {tab === 'products' && <ProductsTab sel={sp.p} showNew={!!sp.new} />}
          {tab === 'ai' && <AiTab />}

          {tab === 'email' && (() => {
            const s = getSetting('smtp');
            return (
              <div className="se-stack">
                <Callout icon="info">Use any SMTP service: Amazon SES, Brevo, Resend, Postmark (broadcast stream), Zoho, or Google Workspace for small lists. Send from a sub-domain like <b>news.yourdomain.com</b> with SPF, DKIM and DMARC set up, and warm it up slowly.</Callout>
                <form action={A.saveSMTP} className="se-form">
                  <Group title="Server">
                    <Row label="SMTP host"><input className="in" name="host" defaultValue={s.host} placeholder="email-smtp.ap-south-1.amazonaws.com" /></Row>
                    <Row label="Port" sub="587 for STARTTLS, 465 for SSL."><input className="in se-num" name="port" type="number" defaultValue={s.port} /></Row>
                    <Row label="Use SSL/TLS from the start" sub="Turn on for port 465."><input type="checkbox" role="switch" className="toggle" name="secure" defaultChecked={s.secure} /></Row>
                  </Group>
                  <Group title="Sign in">
                    <Row label="Username"><input className="in" name="user" defaultValue={s.user} autoComplete="off" /></Row>
                    <Row as="div" label="Password" sub={s.pass ? 'Saved and encrypted.' : undefined}><SecretField name="pass" clearName="clear_pass" saved={!!s.pass} label="SMTP password" /></Row>
                  </Group>
                  <Group title="Sender" footer="Each product can override the sender name and address in Products & brand.">
                    <Row label="Default From"><input className="in" name="from" defaultValue={s.from} placeholder={'"Team Unada" <brief@news.unada.io>'} /></Row>
                  </Group>
                  <Group title="Check">
                    <Row as="div" label="Test connection" sub="Signs in with the saved settings. Save first."><TestButton what="smtp" label="Test connection" /></Row>
                  </Group>
                  <SaveBar />
                </form>
              </div>
            );
          })()}

          {tab === 'whatsapp' && (() => {
            const w = getSetting('whatsapp');
            const hook = `${baseUrl()}/api/wa/webhook`;
            return (
              <div className="se-stack">
                <div className="se-ways">
                  {[
                    ['link', 'Copy the link', 'Send the edition link yourself, in any chat.', 'Works today'],
                    ['chat', 'Click-to-chat list', 'On each edition’s Send page, WhatsApp opens with the personal message filled in.', 'Works today'],
                    ['bolt', 'Business Cloud API', 'Send an approved template to everyone with WhatsApp consent, with Interested / Not right now buttons. Needs a Meta Business account; Meta charges per message.', 'Set up below'],
                  ].map(([ic, t, d, s], i) => (
                    <div key={t} className="se-way"><span className="se-way-n">{i + 1}</span><Icon name={ic} size={18} /><b>{t}</b><p>{d}</p><span className={`pill ${i < 2 ? 'ok' : 'info'}`}>{s}</span></div>
                  ))}
                </div>
                <p className="se-fine"><Icon name="warn" size={13} />Never use unofficial bulk-sender tools; they get numbers banned.</p>
                <form action={A.saveWA} className="se-form">
                  <Group title="Business account">
                    <Row label="Phone number ID"><input className="in" name="phoneNumberId" defaultValue={w.phoneNumberId} /></Row>
                    <Row label="Business Account ID" sub="WABA ID"><input className="in" name="wabaId" defaultValue={w.wabaId} /></Row>
                    <Row as="div" label="Permanent access token"><SecretField name="token" clearName="clear_token" saved={!!w.token} label="WhatsApp access token" /></Row>
                    <Row as="div" label="Meta App Secret" sub="From Meta app → Settings → Basic. Checks that webhook calls really come from Meta."><SecretField name="appSecret" saved={!!w.appSecret} label="Meta App Secret" /></Row>
                    <Row label="Graph API version"><input className="in se-num" name="apiVersion" defaultValue={w.apiVersion} /></Row>
                  </Group>
                  <Group title="Message template">
                    <Row label="Template name"><input className="in" name="templateName" defaultValue={w.templateName} placeholder="weekly_brief" /></Row>
                    <Row label="Language"><input className="in se-num" name="templateLang" defaultValue={w.templateLang} placeholder="en" /></Row>
                    <Row label="Body variables, in order" sub={<>From first_name, title, dek, link, newsletter. Must match {'{{1}}, {{2}}…'} in your template.</>}><input className="in" name="bodyParams" defaultValue={w.bodyParams} /></Row>
                    <Row label="Buttons" sub={<>URL buttons: set the template URL to <span className="se-val">{baseUrl()}/e/{'{{1}}'}</span></>}>
                      <select className="in" name="button" defaultValue={w.button}><option value="quick_reply">Interested / Not right now</option><option value="url">One URL button</option><option value="none">No buttons</option></select>
                    </Row>
                    <Row label="Image header" sub="We send the edition’s preview image."><input type="checkbox" role="switch" className="toggle" name="headerImage" defaultChecked={w.headerImage} /></Row>
                  </Group>
                  <Group title="Webhook" footer="In Meta’s app settings, paste these and subscribe to the “messages” field. Used for delivery status and button taps.">
                    <Row as="div" label="Callback URL"><span className="se-copy"><span className="se-code">{hook}</span><Copy text={hook} /></span></Row>
                    <Row as="div" label="Verify token"><span className="se-copy"><span className="se-code">{w.verifyToken || 'Created on first save'}</span>{w.verifyToken && <Copy text={w.verifyToken} />}<input type="hidden" name="verifyToken" value={w.verifyToken} /></span></Row>
                  </Group>
                  <Group title="Check">
                    <Row as="div" label="Send a test message" sub="Uses the saved settings. Save first."><TestButton what="wa" label="Send test" needsInput="+91 98xxx xxxxx" /></Row>
                  </Group>
                  <SaveBar />
                </form>
              </div>
            );
          })()}

          {tab === 'alerts' && (() => {
            const a = getSetting('alerts');
            return (
              <form action={A.saveAlerts} className="se-form">
                <Group title="Email" footer="An email the moment someone taps “I’m interested” or “Book 15 min”, plus the Friday report. Each product can add its own address too.">
                  <Row label="Alert emails" sub="Comma separated."><input className="in" name="alertEmails" defaultValue={a.alertEmails} placeholder="sales@yourdomain.com" /></Row>
                </Group>
                <Group title="Integrations" footer="The CRM webhook receives JSON for every intent tap: contact, edition, action and note. Use it to create deals in HubSpot, Zoho or Apollo.">
                  <Row label={<span className="se-lbl-i"><Icon name="slack" size={15} />Slack incoming webhook</span>} sub="Optional"><input className="in" name="slackWebhook" defaultValue={a.slackWebhook} placeholder="https://hooks.slack.com/services/…" /></Row>
                  <Row label={<span className="se-lbl-i"><Icon name="webhook" size={15} />CRM / automation webhook</span>} sub="Optional. Zapier, Make, n8n or HubSpot."><input className="in" name="webhookUrl" defaultValue={a.webhookUrl} placeholder="https://hooks.zapier.com/…" /></Row>
                </Group>
                <Group title="Check">
                  <Row as="div" label="Send a test alert" sub="Goes to every saved channel. Save first."><TestButton what="alert" label="Send test alert" /></Row>
                </Group>
                <SaveBar />
              </form>
            );
          })()}

          {tab === 'team' && (() => {
            const users = all('SELECT id, email, name, role, created_at FROM users ORDER BY created_at');
            return (
              <div className="se-stack">
                <section className="cx-group">
                  <h3 className="cx-group-h">Members<span className="cx-group-n">{users.length}</span></h3>
                  <ul className="cx-group-box se-members">
                    {users.map((u) => {
                      const manage = u.id !== me.id && me.role === 'admin';
                      return (
                        <MemberRow key={u.id} name={u.name}
                          top={<>
                            <Avatar name={u.name || String(u.email).split('@')[0]} size={36} />
                            <span className="se-member-i"><b>{u.name}{u.id === me.id && <span className="se-you">You</span>}</b><small>{u.email} · added {fmtDate(u.created_at)}</small></span>
                            <span className={`pill ${u.role === 'admin' ? 'info' : ''}`}>{u.role === 'admin' ? 'Admin' : 'Editor'}</span>
                          </>}
                          actions={manage ? <Confirm action={A.deleteUser.bind(null, u.id)} label="Remove" confirmLabel="Remove" className="btn sm ghost cx-danger-text" /> : undefined}
                          reset={manage ? (
                            <form action={A.resetUserPassword} className="se-inline">
                              <input type="hidden" name="id" value={u.id} />
                              <input className="in" name="password" type="password" minLength={8} required placeholder="New password (8+ characters)" aria-label={`New password for ${u.name}`} autoComplete="new-password" autoFocus />
                              <Submit className="btn sm primary" pending="…">Set password</Submit>
                              <small className="hint">They’ll be signed out everywhere.</small>
                            </form>
                          ) : undefined}
                        />
                      );
                    })}
                  </ul>
                </section>
                {me.role === 'admin' && (
                  <form action={A.addUser} className="se-form">
                    <Group title="Add a teammate" footer="Share the temporary password with them privately.">
                      <Row label="Name"><input className="in" name="name" placeholder="Priya Nair" /></Row>
                      <Row label="Email"><input className="in" name="email" type="email" required placeholder="priya@yourdomain.com" /></Row>
                      <Row label="Temporary password" sub="At least 8 characters."><input className="in" name="password" type="password" minLength={8} required autoComplete="new-password" /></Row>
                      <Row label="Role"><select className="in" name="role"><option value="editor">Editor: write, edit, send</option><option value="admin">Admin: also settings & keys</option></select></Row>
                    </Group>
                    <div className="se-actions"><Submit><Icon name="plus" size={15} strokeWidth={2.2} />Add teammate</Submit></div>
                  </form>
                )}
                <form action={A.changeMyPassword} className="se-form">
                  <Group title="Your password" footer="Other devices are signed out when you change it.">
                    <Row label="Current password"><input className="in" name="current" type="password" required autoComplete="current-password" /></Row>
                    <Row label="New password" sub="At least 8 characters."><input className="in" name="password" type="password" minLength={8} required autoComplete="new-password" /></Row>
                  </Group>
                  <div className="se-actions"><Submit className="btn">Change password</Submit></div>
                </form>
              </div>
            );
          })()}

          {tab === 'data' && (
            <div className="se-stack">
              <section className="cx-group">
                <h3 className="cx-group-h">Exports</h3>
                <div className="cx-group-box">
                  {[
                    ['contacts', 'Contacts', 'Everyone, with consent and tags', 'people', 'blue'],
                    ['leads', 'Leads', 'Readers who showed intent, with scores', 'bolt', 'orange'],
                    ['events', 'All events', 'Every open, click and tap', 'chart', 'green'],
                    ['backup', 'Database backup', 'A full SQLite copy', 'database', 'graphite'],
                  ].map(([t, l, s, ic, tone]) => (
                    <a key={t} className="cx-row se-link" href={`/api/export?type=${t}`}>
                      <span className="cx-row-l se-link-l"><Tile icon={ic} tone={tone} size="sm" /><span><span className="cx-row-t">{l}</span><small className="cx-row-s">{s}</small></span></span>
                      <span className="se-link-r">{t === 'backup' ? 'Download' : 'CSV'}<Icon name="download" size={16} /></span>
                    </a>
                  ))}
                </div>
              </section>
              <Group title="Storage" footer={<>The SQLite database, uploads and the encryption key all live here. Back up this folder: without the secret.key file (or APP_SECRET) saved API keys can’t be decrypted.</>}>
                <Row as="div" label="Data folder"><span className="se-copy"><span className="se-code">{DATA_DIR}</span><Copy text={DATA_DIR} /></span></Row>
              </Group>
              <Group title="Scheduler" footer={<>The app checks jobs and the send queue every minute while it runs. If your host sleeps (serverless), set CRON_KEY and call this address every minute from a cron service.</>}>
                <Row as="div" label="External cron URL"><span className="se-copy"><span className="se-code">{baseUrl()}/api/cron?key=YOUR_CRON_KEY</span><Copy text={`${baseUrl()}/api/cron?key=YOUR_CRON_KEY`} /></span></Row>
              </Group>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

async function ProductsTab({ sel, showNew }: { sel?: string; showNew: boolean }) {
  const products = listProducts();
  const active = await activeProduct();
  const p = products.find((x) => x.id === sel) || active || products[0];
  const host = (p?.website || 'yourdomain.com').replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '');
  return (
    <div className="se-stack">
      <nav className="tabs se-prods" aria-label="Products">
        {products.map((x) => <Link key={x.id} href={`/app/settings?tab=products&p=${x.id}`} aria-current={x.id === p?.id ? 'page' : undefined} scroll={false}>{x.name}</Link>)}
        <Link href={`/app/settings?tab=products${p ? `&p=${p.id}` : ''}&new=1#new-product`} className="se-prods-add" aria-label="Add a product"><Icon name="plus" size={14} strokeWidth={2.2} />New</Link>
      </nav>
      {p && (
        <form action={A.saveProduct} className="se-form" key={p.id}>
          <input type="hidden" name="id" value={p.id} />
          <Group title="Identity">
            <Row label="Product name"><input className="in" name="name" defaultValue={p.name} /></Row>
            <Row label="Website"><input className="in" name="website" type="url" defaultValue={p.website} placeholder="https://" /></Row>
            <Row label="Newsletter name"><input className="in" name="newsletter_name" defaultValue={p.newsletter_name} /></Row>
            <Row label="Link name" sub={<span className="se-val">{baseUrl()}/e/{p.slug}/…</span>}><input className="in" name="slug" defaultValue={p.slug} /></Row>
            <Row label="Tagline"><input className="in" name="tagline" defaultValue={p.brand.tagline} placeholder="Weekly briefing for sales teams" /></Row>
          </Group>
          <Group title="Voice" footer="The AI reads all of this before it writes a draft.">
            <Row stack label={`What ${p.name} does`}><textarea className="in" name="about" rows={4} defaultValue={p.brand.about} /></Row>
            <Row stack label="Who the readers are"><textarea className="in" name="icp" rows={3} defaultValue={p.brand.icp} /></Row>
            <Row stack label="Tone of voice"><textarea className="in" name="tone" rows={2} defaultValue={p.brand.tone} /></Row>
            <Row stack label="Banned words" sub="Comma separated. The checks block any draft that uses them."><input className="in" name="bannedWords" defaultValue={p.brand.bannedWords} /></Row>
          </Group>
          <section className="cx-group">
            <h3 className="cx-group-h">Brand colours</h3>
            <BrandColors primary={p.brand.primary} accent={p.brand.accent} soft={p.brand.soft} newsletter={p.newsletter_name} tagline={p.brand.tagline} logo={p.brand.logoUrl} />
          </section>
          <Group title="Logo" footer="A wide logo on a transparent background. Upload it in any editor image field, then paste the link.">
            <Row label="Logo URL"><input className="in" name="logoUrl" defaultValue={p.brand.logoUrl} placeholder="https://…/logo.png" /></Row>
          </Group>
          <Group title="Sender">
            <Row label="Sender name"><input className="in" name="senderName" defaultValue={p.brand.senderName} /></Row>
            <Row label="Sender email"><input className="in" name="senderEmail" type="email" defaultValue={p.brand.senderEmail} placeholder={`brief@news.${host}`} /></Row>
            <Row label="Reply-to email"><input className="in" name="replyTo" type="email" defaultValue={p.brand.replyTo} placeholder="Optional" /></Row>
            <Row label="Sign-off"><input className="in" name="signOff" defaultValue={p.brand.signOff} /></Row>
            <Row stack label="Registered address" sub="Shown in every email footer. Required for sending."><input className="in" name="address" defaultValue={p.brand.address} /></Row>
          </Group>
          <Group title="Sales">
            <Row label="“Book 15 min” link" sub="Name and email are pre-filled for the reader."><input className="in" name="bookingUrl" type="url" defaultValue={p.brand.bookingUrl} placeholder="https://calendly.com/…" /></Row>
            <Row label="Sales alert email" sub="For this product only."><input className="in" name="alertEmail" type="email" defaultValue={p.brand.alertEmail} /></Row>
          </Group>
          <SaveBar scope={`${p.name}’s settings`} />
        </form>
      )}

      <details className="se-more" id="new-product" open={showNew || !p}>
        <summary><Icon name="plus" size={15} strokeWidth={2.2} />Add another product<Icon name="chevron" size={14} className="se-more-chev" strokeWidth={2.2} /></summary>
        <form action={A.addProduct} className="se-form se-more-body">
          <Group footer="It gets its own brand, knowledge, contacts, editions and automations.">
            <Row label="Name"><input className="in" name="name" required placeholder="e.g. HeyVeya" /></Row>
            <Row label="Website"><input className="in" name="website" type="url" placeholder="https://" /></Row>
            <Row label="Newsletter name"><input className="in" name="newsletter_name" placeholder="e.g. The Walkthrough" /></Row>
          </Group>
          <div className="se-actions"><Submit>Add product</Submit></div>
        </form>
      </details>

      {p && products.length > 1 && (
        <form action={A.deleteProduct} className="se-form">
          <input type="hidden" name="id" value={p.id} />
          <Group title="Danger zone" className="se-danger">
            <Row as="div" label={`Delete ${p.name}`} sub="Removes all its editions, contacts and results. This can’t be undone. Type DELETE to confirm.">
              <span className="se-pair"><input className="in" name="confirm" aria-label="Type DELETE to confirm" placeholder="DELETE" autoComplete="off" /><button className="btn danger">Delete product</button></span>
            </Row>
          </Group>
        </form>
      )}
    </div>
  );
}

function AiTab() {
  const ai = getSetting('ai');
  const used = tokensThisMonth();
  const limit = Number(ai.monthlyTokenLimit) || 0;
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const usage = all("SELECT provider, model, task, COUNT(*) AS calls, SUM(input_tokens) AS i, SUM(output_tokens) AS o, SUM(ok = 0) AS errs FROM llm_usage WHERE created_at >= date('now','start of month') GROUP BY provider, model, task ORDER BY i + o DESC");
  return (
    <div className="se-stack">
      <form action={A.saveAI} className="se-form">
        <Group title="API keys" footer="Keys are encrypted on the server and never shown again. With two providers, the fact check uses the other company’s model, because different models tend to make different mistakes.">
          {PROVIDERS.map((pv) => {
            const k = providerKey(pv);
            return (
              <div key={pv} className="cx-row se-prov" role="group" aria-label={PROVIDER_LABEL[pv]}>
                <span className="cx-row-l se-prov-l">
                  <span className={`se-logo l-${pv}`} aria-hidden>{PROVIDER_MARK[pv]}</span>
                  <span><span className="cx-row-t">{PROVIDER_LABEL[pv]}</span><small className={`cx-row-s se-conn ${k ? 'on' : ''}`}><span className="dot" />{k ? 'Connected' : 'Not connected'}</small></span>
                </span>
                <span className="cx-row-c se-prov-c">
                  <SecretField name={`key_${pv}`} clearName={`clear_${pv}`} saved={!!k} masked={mask(k)} placeholder={k ? 'Paste a new key' : KEY_HINT[pv]} label={`${PROVIDER_LABEL[pv]} API key`} />
                  {k && <TestButton what="ai" provider={pv} label="Test" />}
                </span>
              </div>
            );
          })}
        </Group>
        <Group title="Which model does what" footer="Leave a model empty to use that provider’s default.">
          {TASKS.map(([t, l, h]) => {
            const r = ai.routing[t];
            const now = routeFor(t)[0];
            return (
              <div key={t} className="cx-row se-route" role="group" aria-label={l}>
                <span className="cx-row-l"><span className="cx-row-t">{l}</span><small className="cx-row-s">{h}</small><small className="se-now"><span className={`dot ${now ? 'on' : ''}`} />{now ? `${PROVIDER_LABEL[now.provider]} · ${now.model}` : 'Demo mode'}</small></span>
                <span className="cx-row-c se-pair">
                  <select className="in" aria-label={`Provider for ${l}`} name={`route_${t}`} defaultValue={r.provider}><option value="auto">Auto</option>{PROVIDERS.map((pv) => <option key={pv} value={pv}>{PROVIDER_LABEL[pv]}</option>)}</select>
                  <input className="in" aria-label={`Model for ${l}`} name={`model_${t}`} defaultValue={r.model} placeholder="Default model" list={`models-${t}`} />
                  <datalist id={`models-${t}`}>{PROVIDERS.flatMap((pv) => MODEL_DEFAULTS[pv].suggestions).map((m) => <option key={m} value={m} />)}</datalist>
                </span>
              </div>
            );
          })}
        </Group>
        <Group title="Budget" footer="A typical edition uses 30–80k tokens.">
          <Row label="Monthly token limit" sub="0 means no limit."><input className="in se-num" name="monthlyTokenLimit" type="number" min={0} defaultValue={ai.monthlyTokenLimit} /></Row>
          <div className="cx-row se-meter-row">
            <span className="cx-row-l"><span className="cx-row-t">Used this month</span><small className="cx-row-s">{num(used)} tokens{limit ? ` of ${num(limit)}` : ''}</small></span>
            <span className="cx-row-c">{limit ? <span className={`se-meter ${pct >= 90 ? 'bad' : pct >= 70 ? 'warn' : ''}`} role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Share of monthly token limit used"><i style={{ width: `${Math.max(pct, 1)}%` }} /></span> : <span className="hint">No limit set</span>}</span>
          </div>
        </Group>
        <section className="cx-group">
          <h3 className="cx-group-h">This month’s usage</h3>
          {usage.length ? (
            <div className="cx-group-box se-usage"><table className="tbl"><thead><tr><th>Provider</th><th>Model</th><th>Task</th><th className="num">Calls</th><th className="num">Input</th><th className="num">Output</th><th className="num">Errors</th></tr></thead>
              <tbody>{usage.map((u, i) => <tr key={i}><td>{PROVIDER_LABEL[u.provider as keyof typeof PROVIDER_LABEL] || u.provider}</td><td>{u.model}</td><td>{u.task}</td><td className="num">{u.calls}</td><td className="num">{num(u.i || 0)}</td><td className="num">{num(u.o || 0)}</td><td className="num">{u.errs || ''}</td></tr>)}</tbody></table></div>
          ) : <div className="cx-group-box"><div className="cx-row"><span className="cx-row-l"><span className="cx-row-s">No AI calls yet this month. Drafts run in demo mode until a key is connected.</span></span></div></div>}
        </section>
        <SaveBar />
      </form>
    </div>
  );
}
