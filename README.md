# Brief Studio: sales newsletter flow

A weekly, AI-curated industry briefing for **real-estate developers’ marketing and sales teams in India**. It is sent as **one link** (with a proper WhatsApp/LinkedIn preview card) plus a matching **email**. Every reader gets **one-tap buttons** (“I’m interested”, “Book 15 min”, “Send me more”, “Not right now”) that alert your sales team instantly.

It is built for two products, **Unada** (*The Site Visit*) and **HeyVeya** (*The Walkthrough*), and you can add more products.

- 📘 Product thinking: [docs/BLUEPRINT.md](docs/BLUEPRINT.md)
- 🗓 Month-1 plan: [docs/MONTH-1-CONTENT-PLAN.md](docs/MONTH-1-CONTENT-PLAN.md) (the four editions are pre-loaded as drafts)
- 🖼 Original mock-up: [mockups/edition-mockup.html](mockups/edition-mockup.html)

---

## Run it (5 minutes)

Needs **Node.js 22.13 or newer**. There is no database server to install: it uses Node’s built-in SQLite.

```bash
npm install
```

```bash
npm run build
```

```bash
npm start
```

Open http://localhost:3000. The first visit asks you to create the admin account, then sets up both products, news sources, weekly automations and the four month-1 editions.

For development with hot reload:

```bash
npm run dev
```

### With Docker

```bash
PUBLIC_BASE_URL=https://brief.yourdomain.com docker compose up -d --build
```

Data (database, uploads, encryption key) lives in `./data`. **Back up that folder.**

### Running it day to day

- The app runs as **one Node process** (`npm run build && npm start`, or Docker). It needs Node 22.13 or newer.
- Everything it stores lives in the `data/` folder (or `DATA_DIR`): the SQLite database, uploads and the encryption key. Back that folder up.
- Set the public address (Settings → General, or `PUBLIC_BASE_URL`) so links and preview images work for readers.
- Without AI keys, drafts are assembled in demo mode. Without SMTP, emails land in the in-app Outbox. Both still let you try the whole weekly flow.

### Environment variables (all optional)

| Variable | What it does |
|---|---|
| `PUBLIC_BASE_URL` | The address readers open, e.g. `https://brief.unada.io`. You can also set it in Settings → General. |
| `DATA_DIR` | Where data lives (default `./data`). |
| `APP_SECRET` | Encrypts API keys and signs sessions. If empty, one is generated into `DATA_DIR/secret.key`. |
| `CRON_KEY` | Lets an external scheduler call `/api/cron?key=…` every minute (for hosts that sleep). |
| `DISABLE_SCHEDULER=1` | Turns off the built-in every-minute scheduler (use with `CRON_KEY`). |
| `ALLOW_PRIVATE_FETCH=1` | Lets news sources and “Add story by URL” read addresses on your own network (blocked by default for safety). Only for testing. |

**Where to host:** anything that runs a long-lived Node process with a disk, e.g. a small VPS (DigitalOcean, Lightsail, Hetzner), Railway, Render or Fly.io with a volume. Put it on a sub-domain such as `brief.unada.io`. Serverless hosts (Vercel) need a persistent database and `CRON_KEY`; they are not the default here.

---

## The weekly flow

```
Every morning  Fetch news ─► Story pool (scored for your readers; you shortlist)
Monday 9:00    AI draft ─► automatic checks ─► notification “Draft ready”
Mon–Tue        You review in the editor ─► AI copilot edits (shown as a diff) ─► Run all checks ─► Approve
Thursday 10:00 Scheduled email + WhatsApp list/API ─► each reader gets a personal tracked link
Any time       Reader taps “I’m interested” ─► alert email/Slack/webhook ─► Leads page
Friday 17:30   Weekly report email
```

All times are editable in **Automations**. Nothing is ever sent without your approval.

## What’s inside

**Studio (dashboard)**
- **Home:** setup checklist, next edition, last-4-editions numbers, warmest leads, activity, next automations.
- **Product switcher:** Unada / HeyVeya (or any product you add). Each has its own brand, knowledge base, contacts, editions and jobs.
- **Story pool:** Google News (India) and RSS sources, article text extraction, AI or keyword relevance scores, shortlist/dismiss, and add any article by URL.
- **Editions:** list with status (Draft → In review → Approved → Scheduled → Sending → Sent) and results.
- **Editor:**
  - Blocks: 30-second summary, number of the week, stories with “Why it matters for you”, charts (bar/column/line), “Our work” cards, video, image, quote, text, one-tap poll and call to action.
  - Live preview as phone, desktop, email and WhatsApp (with the link-preview card).
  - AI copilot with quick prompts; every change is shown as a diff before it is applied.
  - Subject-line suggestions, version history with restore, and autosave.
- **Checks before sending:**
  - Every fact has a source, and opinion pieces carry no numbers.
  - The AI fact check uses a *different* provider from the one that wrote the draft.
  - Link check; banned words, spam words, preview lengths and email size (Gmail clipping).
  - Honest wording per maturity status (Live / Delivered / Pilot / Prototype / Concept) and client-name permission.
  - Footer address.
  - A failing check can be overridden only with a written reason.
- **Send:**
  - Copy the link and the WhatsApp text, or export the email HTML for other tools (Mailchimp, Brevo, Apollo).
  - Send a test email.
  - Email to all or filtered contacts, now or scheduled, paced per minute.
  - **WhatsApp click-to-chat list**: WhatsApp opens with each person’s message filled in.
  - **WhatsApp Business Cloud API** template sends with quick-reply buttons.
  - Delivery log.
- **Results:** delivered, opened, read depth, time on page, every button, poll results, reader notes, who engaged, CSV export.
- **Leads:** asked-for-contact / warming-up / in-conversation views, lead score, stage, and one-tap WhatsApp/email follow-up.
- **Our work (knowledge base):** features, delivered projects and concepts, each with an honest status, client permission and approved numbers. The draft rotates them automatically. **Import from website** reads your site and suggests items for you to confirm.
- **Contacts:**
  - CSV import with column mapping and a consent confirmation; Indian mobile numbers are normalised to +91.
  - Per-channel consent and where it came from, tags, stage, notes and activity timeline.
  - Bulk tag/unsubscribe/delete and export.
- **Automations:** fetch news, draft, follow-up suggestions and weekly report, with cron presets, “Run now” and run logs.
- **Notifications, Email outbox** (every email is saved here until SMTP is connected), **How it works** guide.
- **Settings:** general (address, time zone, send day/time, pace), products & brand (colours, logo, tone, banned words, sender, address, booking link), AI providers, email (SMTP), WhatsApp, alerts & CRM webhook, team (admin/editor), data (exports, database backup).

**What readers see**
- A fast, mobile-first edition page with interactive charts, video, poll and buttons, plus a sticky “Talk to us” bar.
- A 1200×630 link-preview image, generated automatically.
- A table-based email that is Gmail/Outlook safe, with charts rendered as images, one-tap poll links, a plain-text version, an open pixel and click tracking.
- A thank-you page with an optional note, a “Book 15 min” link to your calendar (name and email pre-filled), and a preferences page (weekly or less often, per channel).
- RFC 8058 one-click unsubscribe, an archive of past editions, and `noindex` on personal links.

**AI providers:** Claude, ChatGPT, Gemini and OpenRouter. Keys are encrypted (AES-256-GCM). You can pick a model for each task, keys fall back to each other, usage is tracked and there is a monthly token limit. **Without any key everything still works in demo mode.**

## First steps after setup

1. **Settings → AI providers:** add at least one key. Two different providers give you an independent fact check.
2. **Our work → Import from unada.io** (then switch product and import heyveya.ai). Confirm each suggested item’s real status.
3. **Settings → Products & brand:** colours, logo, registered address, sender, “Book 15 min” link and alert email.
4. **Contacts → Import CSV** from your CRM or Apollo. Only include people who agreed to hear from you.
5. **Settings → Email sending:** connect SMTP (Amazon SES, Brevo, Resend…), sending from a sub-domain with SPF, DKIM and DMARC set up.
6. Open edition #1, fill the “Our work” cards, **Run all checks**, **Approve**, then **Send**.

## Tech

- **App:** Next.js 15 (App Router, React 19, TypeScript). Server actions and route handlers.
- **Database:** Node’s built-in SQLite (`node:sqlite`).
- **Libraries:** nodemailer (SMTP), fast-xml-parser (RSS), cron-parser (schedules).
- **Images:** `next/og` for link-preview images and email chart images.
- **AI:** direct HTTPS calls to each provider; no AI SDKs.
- **Scheduler:** an in-process scheduler started from `instrumentation.ts` (every minute), or `/api/cron` for external schedulers.

```
src/lib/          db, auth, settings, AI (providers, prompts, demo), ingest, editions, checks,
                  render (web, email, chart, page), send, tracking, alerts, jobs, seed
src/app/app/      the studio (dashboard) pages
src/app/api/      JSON APIs for the editor, uploads, tracking beacon, cron, WhatsApp webhook, exports
src/app/e, a, u, t, og, chart, uploads   public reader-facing routes
```
