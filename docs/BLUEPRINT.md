# Sales Newsletter Flow: Product Blueprint

> A weekly, AI-curated, premium-looking industry briefing that lives at **one link**,
> is shared over **WhatsApp** and **email**, and turns passive prospects into
> **one-tap "I'm interested"** signals for the sales team.

---

## 1. The idea in one paragraph

Every week the system collects what is happening in your prospects' industry, picks
the 3–5 stories that matter, and writes them up as a short, beautiful one-page
"edition". The edition has charts, a key number, and sometimes a short video. You
review it in a dashboard and ask the AI to change anything you don't like. Automated
checks catch errors. Then you press **Approve** and get back:

1. a **web link** with a WhatsApp/LinkedIn preview card,
2. an **email** version with the same content, and
3. a **ready-to-send WhatsApp message**.

Prospects read it in under 3 minutes. Each one can tap **Interested**,
**Book a call**, or **Not now** without typing anything. Every tap shows up in your
dashboard as a warm lead.

The point is to give prospects something useful each week so your brand stays in
their mind, and to notice who starts paying attention.

---

## 2. End-to-end flow

```
 ┌────────────────────────── WEEKLY CYCLE (all jobs editable in the dashboard) ─────────────────────────┐
 │                                                                                                      │
 │  [1] INGEST (daily)      RSS feeds, news APIs, Google News queries, competitor blogs,                │
 │                          govt/regulator sites, your own product updates & case studies               │
 │          │                                                                                           │
 │          ▼                                                                                           │
 │  [2] STORY POOL          dedupe → summarise → score each item for "relevance to our ICP"             │
 │          │               (cheap/fast model)                                                          │
 │          ▼                                                                                           │
 │  [3] DRAFT (weekly)      pick top 3–5 stories → write edition as STRUCTURED BLOCKS (JSON)            │
 │          │               headline · 30-sec summary · number of the week · stories · chart ·          │
 │          │               "why it matters for you" · poll · CTA                                       │
 │          ▼               (best writing model)                                                        │
 │  [4] QUALITY GATE        fact cross-check (different model) · every claim has a source ·             │
 │          │               links alive · brand voice · banned words · spam words · image rights ·      │
 │          │               email size · preview card renders                                           │
 │          ▼                                                                                           │
 │  [5] YOU REVIEW          side-by-side Web / Email / WhatsApp preview                                 │
 │          │               AI copilot: "make story 2 punchier", "swap the chart to a bar chart",       │
 │          │               "add a line about the RBI circular" → shows a diff, you accept/reject       │
 │          ▼                                                                                           │
 │  [6] APPROVE ─────────►  RENDER: web page (+ OG preview image) · email HTML · WhatsApp text          │
 │          │                                                                                           │
 │          ▼                                                                                           │
 │  [7] DISTRIBUTE          Copy link · Click-to-WhatsApp list · Email via ESP · (later) WA Business API│
 │          │                                                                                           │
 │          ▼                                                                                           │
 │  [8] PROSPECT            opens link (phone, in WhatsApp's browser) → reads → taps a CTA              │
 │          │                                                                                           │
 │          ▼                                                                                           │
 │  [9] INTENT CAPTURED     instant alert to you (WhatsApp/Slack/email) · lead score ↑ · CRM update     │
 │          │                                                                                           │
 │          ▼                                                                                           │
 │  [10] WEEKLY REPORT      who read, who tapped, hot-lead list, which topics worked                    │
 │                          └──► feeds topic choice for next week's edition                             │
 └──────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Suggested weekly rhythm (defaults, all configurable)

| Day | Job | Who |
|---|---|---|
| Daily, 06:00 | Ingest sources, refresh story pool | Automatic |
| Mon 09:00 | Generate draft edition + run quality gate | Automatic |
| Mon–Tue | Review, AI edits, approve | You (15–30 min) |
| Wed or Thu 10:00 | Send (email scheduled; WhatsApp list ready) | Automatic + one click |
| +48 h | Nudge job: people who clicked but didn't tap a CTA get a soft follow-up suggestion | Automatic suggestion, you decide |
| Fri 17:00 | Weekly report + hot leads to your inbox/WhatsApp | Automatic |

---

## 3. What the prospect sees

### 3.1 WhatsApp message

```
Hi Rohan 👋
This week in Fintech, 3 shifts in 3 minutes:
• UPI credit lines go live — what it means for lenders
• 1 number that surprised us: 41%
• A 2-min take from our team

👉 https://brief.yourbrand.com/w/2026-45?r=k7f2
```

The link shows a branded preview card in WhatsApp: title, one-line description and
a 1200×630 image showing edition #, headline and your logo. The **preview card does
most of the work**, so it gets the same design attention as the page.

### 3.2 The one-pager (web link): structure of a premium edition

Mobile first. Most opens happen inside WhatsApp's in-app browser on a mid-range
Android phone, so the page must load in under 2 seconds.

| # | Block | Purpose |
|---|---|---|
| 1 | **Hero**: brand, Edition #45, date, big headline, 1-line dek, "3 min read" | Looks like a magazine, not a sales flyer |
| 2 | **The 30-second version**: 3 bullets | Respects their time; many people stop here |
| 3 | **Number of the week**: large animated stat + source | Easy to remember and to share |
| 4 | **Stories (3–5)**: headline, ~80 words, **"Why it matters for you"** box, source link | This is where the value is. The "why it matters" box connects the news to the problem you solve |
| 5 | **Interactive chart**: hover/tap values, 1 insight sentence above it | Makes the page feel premium; static PNG in the email |
| 6 | **Video (optional)**: 45–90 s, founder take or animated data story | Builds trust; never autoplay with sound |
| 7 | **One-tap poll**: "Is this on your 2027 roadmap? Yes / Exploring / No" | Engagement **and** a soft intent signal |
| 8 | **Our work (1–2 cards)**: a live feature, a delivered project glimpse, or a concept (see §4) | Shows what you build without pitching. Each card has its own soft CTA |
| 9 | **CTA bar**: ✅ Interested · 📅 Book 15 min · ➕ Send me more on this · 📤 Share with a colleague · 🙅 Not now | One or two taps, nothing to type |
| 10 | **Footer**: archive of past editions, preferences, unsubscribe | Builds trust and is a legal requirement |

A **sticky bottom CTA** ("Talk to us →") stays on screen on mobile after 50% scroll.

### 3.3 Email version

Same edition, rendered for email clients:
- table-based layout with inline CSS (Outlook and Gmail safe), dark-mode tested
- chart as a static PNG; video as a thumbnail with a ▶ overlay that links to the web page
- CTA buttons are plain links (email cannot run forms or JavaScript)
- "View the interactive version →" at the top
- total HTML **under 100 KB** so Gmail doesn't clip it; plain-text alternative included
- personal subject line and pre-header, e.g. *"Rohan, 3 shifts in fintech this week (3 min)"*

### 3.4 How the one-tap CTAs work

Every recipient gets a **signed, personal token** in their link (`?r=k7f2`).

```
Tap "Interested"  →  GET /a/k7f2/interested
                  →  record intent (contact, edition, action, timestamp)
                  →  show a thank-you page: "Got it! Someone from our team will reach out
                     within 1 business day." + optional one-line box: "Anything specific?"
                  →  instant alert to you: "🔥 Rohan (Acme Corp) tapped Interested on Ed #45"
                  →  lead score +50, CRM updated
```

- **Book 15 min** opens your Calendly/Cal.com with name and email pre-filled.
- **Send me more on this** tags the contact with a topic interest, which later drives segmentation.
- **Not now** lowers the send frequency for that contact. Respecting it reduces unsubscribes and spam reports.
- On **WhatsApp Business API** (Phase 3) the buttons sit **inside the WhatsApp message**
  as quick-reply buttons ("Interested" / "Not now"), so the prospect never leaves WhatsApp.

---

## 4. What goes in each edition: content pillars & wording

The newsletter has two jobs. It is an industry briefing (the reason people open it)
and a quiet showcase of what you build (the reason they reach out). The prospect
should come away thinking *"these people are doing interesting things, maybe I
should talk to them,"* without anyone asking them to.

### 4.1 The four pillars

| Pillar | Section name readers see (rotate these) | What it contains | Gets them to reach out because… |
|---|---|---|---|
| **A. Industry pulse** (the hook) | "This week in [industry]" · "The 30-second version" · "Worth knowing" | 2–3 news items + "why it matters for you" | It's useful, so they keep opening |
| **B. Feature showcase** (live, available today) | "Fresh off the build" · "New in our toolkit" · "Now live" | One new capability: 1 GIF/short clip + the problem it solves in 2 lines | "We have that problem too" → **See it in action** |
| **C. Work we delivered** (real projects) | "Recently shipped" · "Behind the build" · "From the field" | A glimpse: blurred screenshot / 20-s screen recording + challenge → what we did → result | "They've done this for someone like us" → **Want something similar?** |
| **D. Concepts not built yet** (honest ideas) | "On the drawing board" · "Ideas we're exploring" · "What if…" | A concept sketch/mock-up + "here's what this could do for a [role]" | "I want to shape that" → **Get early access / build it with us** |

**Default mix per edition:** 1 × A (2–3 short items) + **two** of B / C / D, rotated
so it doesn't feel repetitive. Roughly half the edition is industry insight and half
is your work. Your work is still written as **useful content** ("here's how a lender
cut onboarding time from 3 days to 4 hours"), never as an advert.

### 4.2 Staying honest: every item has a maturity status

Each item in the **Knowledge base** is tagged with **one** status. The AI is only
allowed the vocabulary for that status, and a pre-flight check blocks anything
that claims more than the status says.

| Status | Words the AI **may** use | Words the AI **must not** use | Default CTA |
|---|---|---|---|
| **Live**: available to customers today | "now live", "available", "you can", "here's how it works" | n/a | 👀 *See it in action* (15-min walkthrough) |
| **Delivered**: built for a real client | "we built", "we delivered", "for a leading [industry] company", real numbers the client approved | client name/logo **without written permission**; numbers not approved | 🛠 *Want something similar?* |
| **Pilot**: running with a few users | "in pilot", "early results", "being tested with" | "proven", "trusted by many", "available to all" | 🧪 *Join the pilot* |
| **Prototype**: working demo, not a product | "we've prototyped", "working demo", "early version" | "launched", "available", "customers use" | 👀 *See the prototype* |
| **Concept**: idea only | "we're exploring", "imagine if", "here's how this could work", "on our drawing board" | "we offer", "our solution", "customers", any result numbers | 🤝 *Build this with us* / *Get early access* |

This gives you the casual "we're doing interesting things" impression without
saying anything untrue. A concept is presented as an **invitation to co-create**,
which is often the strongest hook for a demo call.

### 4.3 Voice & word choices

- **Tone:** a knowledgeable friend sharing what they're working on. Confident, curious, short sentences. Not a brochure.
- **Prefer:** *"Here's something we've been building"*, *"A quick peek at…"*, *"We tried this for a client and it worked surprisingly well"*, *"Curious? One tap and we'll show you around."*
- **Avoid:** *"Revolutionary"*, *"best-in-class"*, *"leading provider"*, *"limited time"*, *"Book a demo NOW"*, ALL CAPS, more than one exclamation mark.
- **Soft CTA wording** (pick per item):
  *See it in action* · *Show me how* · *Want something similar?* · *I'd like early access* · *Let's explore this together* · *Not for me right now*
- **The word "demo"** appears only on the thank-you page after they tap ("Great, we'll set up a quick 15-min walkthrough"), never as the headline ask.

### 4.4 Rules for showing client work ("glimpses")

- Get written OK from the client for anything identifiable. Otherwise anonymise ("a 200-branch NBFC").
- Blur or replace real data in screenshots; never show personal data.
- Only use numbers the client has approved; store the approval in the knowledge item.
- Short is better: one image or a 15–30 s clip, 3 lines of text, then "see more" on the web page.

### 4.5 Example edition (Fintech, Edition #45)

```
HERO       Credit on UPI is here. Lenders, take note.
PULSE      3 bullets + "Number of the week: 41%"
SHIPPED    "Recently shipped: an onboarding flow for a 200-branch lender —
            3 days → 4 hours."  [20-s clip]          → Want something similar?
DRAWING    "On the drawing board: what if collections calls summarised
BOARD       themselves and suggested the next best action?"  [concept sketch]
                                                      → Let's explore this together
POLL       "Is AI in collections on your 2027 roadmap?  Yes · Exploring · No"
CTA BAR    See it in action · I'd like early access · Share · Not now
```

---

## 5. The dashboard ("Studio")

### 5.1 Screens

| Screen | What you do there |
|---|---|
| **Home** | This week's edition status, next scheduled job, hot leads, last edition's stats |
| **Editions** | List of all editions (Draft → In review → Approved → Scheduled → Sent) |
| **Editor** | 3 panes: **block list** · **live preview** (Web / Email / WhatsApp / preview-card toggle) · **AI copilot + pre-flight checks** |
| **Sources & Beats** | RSS/URLs/keywords, industries, competitors to watch, and your **ICP description** |
| **Knowledge base** | Your features, delivered projects and concepts, each tagged **Live / Delivered / Pilot / Prototype / Concept** (see §4.2), with media (clips, screenshots, sketches), approved numbers and client-permission flag. The AI uses only these for the "Our work" cards |
| **Audience** | Import CSV / sync CRM, per-channel consent (email ✓, WhatsApp ✓), segments (industry, role, city), tags |
| **Automations / Jobs** | Every scheduled job (ingest, draft, send, nudge, report): cron schedule, on/off, run history, logs, retry, "run now" |
| **Distribute** | Copy link · copy WhatsApp text · click-to-WhatsApp list · send/schedule email · (later) WA API broadcast |
| **Leads & Analytics** | Per edition: delivered, opened, read depth, CTA taps. Per contact: engagement timeline, lead score. **Hot list** |
| **Settings** | Brand kit · AI providers & keys · sending domains · WhatsApp setup · team members |

### 5.2 AI providers screen

- Separate key fields for **Anthropic (Claude)**, **OpenAI**, **Google (Gemini)** and **OpenRouter**.
  The **Test** button makes a tiny call to confirm the key works.
- **Model per task** (dropdowns), so cost and quality can be tuned:

  | Task | Suggested model class | Why |
  |---|---|---|
  | Summarise / score story pool | Fast, cheap model (e.g. Claude Haiku, Gemini Flash, GPT mini) | High volume, simple work |
  | Write the edition | Strongest writing model (e.g. Claude Sonnet/Opus) | Quality is the product |
  | Fact cross-check | **A different vendor** from the writer | Different models tend to make different mistakes, so a second vendor catches more |
  | AI edits (copilot) | Same model as the writer | Keeps the voice consistent |
  | Images / hero art | Image model via OpenRouter or direct | Abstract or illustrative art only |

- **Fallback order**: if a provider errors or is rate-limited, the job moves to the next one.
- **Monthly spend cap** plus a per-edition cost display. One edition should cost a few dollars at most.
- Keys are **encrypted at rest** and never sent back to the browser after you save them (only `sk-…a9F2` is shown).

### 5.3 Brand kit

Logo, colours, fonts, tone of voice ("confident, crisp, no jargon, never salesy"),
banned words, words you always use, sign-off line, newsletter name, and a sender
persona (e.g. "Aditya from YourBrand"). Every prompt and every rendered page reads from this kit.

### 5.4 Pre-flight checklist (the "filter checks and cross-checks")

**Send** stays disabled until every check is green. You can override a check, but
you have to give a reason, and the reason is logged.

- ✅ Every factual sentence has at least 1 source citation
- ✅ Second-model fact check: no unsupported claims or mismatched numbers
- ✅ All links return 200 and none are paywalled or broken
- ✅ Every chart number traces back to a source
- ✅ Brand voice score ≥ threshold; no banned words; competitor-mention rules respected
- ✅ Spam-trigger words in subject line / email body
- ✅ Images: licensed or generated; no AI image shows real people or real events
- ✅ Email HTML < 100 KB, all images have alt text, dark-mode render OK
- ✅ Preview card renders (title ≤ 60 chars, description ≤ 110, image ≤ 300 KB)
- ✅ Page loads < 2 s on simulated 4G
- ✅ Every "Our work" claim matches its maturity status (no "launched" for a concept, no unapproved client names or numbers)
- ✅ Content mix: at least one industry-pulse block; no more than 2 "Our work" cards
- ✅ Unsubscribe and preferences links present

---

## 6. Key design decisions

### 6.1 The AI writes structured content, not HTML

The AI fills a fixed **schema of blocks**. Our own templates turn those blocks into
web, email and WhatsApp output. This one decision gives you:
- the same premium design every week, because the LLM never touches the design
- all three formats generated from a single source of truth
- safe AI edits, because the AI changes one block and shows you the diff
- citations attached to the specific claims they support

```json
{
  "edition": 45,
  "slug": "2026-45",
  "title": "Credit on UPI is here. Lenders, take note.",
  "dek": "Three shifts in fintech this week, and what they mean for you.",
  "preview": { "title": "...", "description": "...", "image_prompt": "..." },
  "blocks": [
    { "type": "tldr", "bullets": ["...", "...", "..."] },
    { "type": "stat", "value": "41%", "label": "...", "source_id": "s3" },
    { "type": "story", "headline": "...", "body": "...", "why_it_matters": "...", "source_ids": ["s1","s2"] },
    { "type": "chart", "kind": "bar", "title": "...", "data": [...], "insight": "...", "source_id": "s4" },
    { "type": "video", "provider": "youtube", "id": "...", "caption": "..." },
    { "type": "poll", "question": "...", "options": ["Yes", "Exploring", "No"] },
    { "type": "showcase", "pillar": "delivered", "kb_item_id": "onboarding-nbfc", "cta": "similar" },
    { "type": "showcase", "pillar": "concept", "kb_item_id": "collections-copilot", "cta": "cocreate" },
    { "type": "cta", "actions": ["interested", "book", "more", "share", "not_now"] }
  ],
  "sources": [ { "id": "s1", "url": "...", "publisher": "...", "date": "..." } ]
}
```

### 6.2 One link, three renderings

| Output | Built from | Notes |
|---|---|---|
| Web page | Edition JSON + web template | Static-generated for speed; interactive charts load lazily |
| Preview card image | Edition JSON + OG template | Generated automatically, 1200×630 |
| Email HTML | Edition JSON + email template (MJML / React Email) | Charts rendered to PNG at build time |
| WhatsApp text | Edition JSON + short template | Personalised per contact with `{first_name}` and a tracking token |

### 6.3 WhatsApp sending in three levels (start safe, scale later)

| Level | How | Risk | When |
|---|---|---|---|
| **1. Copy & paste** | Copy link + message, send yourself | None | Day 1 |
| **2. Click-to-WhatsApp list** | Dashboard lists each contact with a `wa.me/<number>?text=<personalised message>` button. One click opens WhatsApp with the message pre-filled; you press send | Very low, because you send manually at human pace | MVP |
| **3. WhatsApp Business Cloud API** | Approved *Marketing* template with header image + quick-reply buttons, sent from a business number via Meta directly or a provider (Gupshup, Interakt, AiSensy, Twilio, etc.) | Low **if** contacts opted in; there is a per-message cost (check Meta's current rate card for your country) | When the list grows beyond ~100 and has opt-ins |

---

## 7. What we SHOULD do ✅

1. **Value first, pitch never.** Industry insight is the hook, and your features, delivered work and concepts are written as useful stories, not ads (see §4). People keep opening it because it helps them.
2. **Keep it short.** 3 minutes to read, 3–5 stories, one chart, one key number.
3. **Human approval before every send.** AI drafts, checks and edits, but you press the button.
4. **Every fact has a source.** Show sources discreetly on the page; it builds credibility.
5. **Write for the phone first.** The link is opened inside WhatsApp on a phone.
6. **Design the preview card carefully.** It is the first thing prospects see.
7. **Use personal tracking tokens** so you know who engaged, not just how many.
8. **Alert sales immediately** on "Interested". Follow up within the same day.
9. **Use segments** (industry or role) so each group gets a more relevant "why it matters" angle. Start with 2–3 segments, not one per person.
10. **Send from a separate domain/subdomain** for email (e.g. `brief.yourbrand.com`) with SPF, DKIM and DMARC set up. Warm it up gradually.
11. **One-click unsubscribe** in every email (required by Gmail/Yahoo for bulk senders) and a "Stop" option on WhatsApp.
12. **Keep an archive page** of past editions. It shows you're consistent and is good for SEO.
13. **Measure taps, not opens.** Email open rates are unreliable because of Apple Mail privacy; CTA taps and read depth are the signals to trust.

## 8. What we should NOT do ❌

1. **Don't use unofficial WhatsApp bulk senders** (WhatsApp Web automation, "bulk sender" extensions). Numbers get banned, sometimes permanently.
2. **Don't send WhatsApp messages to cold contacts who haven't agreed to receive them.** People report or block them, the number's quality rating drops, and Meta restricts it. For truly cold prospects, start with email or ask for the WhatsApp opt-in in person or on a call.
3. **Don't let the AI generate raw HTML/CSS or publish without review.**
4. **Don't invent or round numbers.** If the source doesn't say it, it doesn't go in.
5. **Don't copy full articles or hotlink news images.** Summarise, attribute and link. Use your own charts and generated abstract art.
6. **Don't use AI images that look like real people or real events.**
7. **Don't make it read like a sales pitch**, and never describe a concept or prototype as if it were a live product. Unsubscribes and distrust rise quickly.
8. **Don't make the page heavy** (huge JS bundles, autoplay video, big unoptimised images). WhatsApp's in-app browser on a budget phone will struggle.
9. **Don't ask for typing or logins** to express interest. One tap is enough.
10. **Don't send cold bulk email from your main company domain**, and don't buy email lists.
11. **Don't store API keys in the browser** (localStorage) or in the code repository.
12. **Don't overbuild v1.** No drag-and-drop page builder, no multi-tenant SaaS, no custom CRM. A fixed set of beautiful blocks is enough.

---

## 9. Compliance checklist (applies to every send)

- **Consent per channel**: store how and when each contact agreed (email / WhatsApp).
- **India DPDP Act 2023**: notice and consent, purpose limitation, honour withdrawal requests.
- **GDPR / ePrivacy** (EU contacts) and **CAN-SPAM** (US contacts): identify the sender, include a physical address, honour opt-outs quickly.
- **Gmail / Yahoo bulk sender rules**: SPF, DKIM and DMARC aligned; one-click `List-Unsubscribe`; spam complaint rate < 0.3%.
- **Meta WhatsApp Business policy**: opt-in required, approved templates for business-initiated messages, honour "STOP".

*(This is a product checklist, not legal advice. Have someone confirm it for the countries you send to.)*

---

## 10. Recommended tech stack

| Layer | Choice | Why |
|---|---|---|
| App (dashboard + public pages) | **Next.js** (App Router, TypeScript) on Vercel | Dashboard and fast public pages in one codebase; built-in OG image generation |
| UI | Tailwind + shadcn/ui; charts with ECharts or Recharts | Premium look with little effort |
| Database | **Postgres** (Supabase or Neon) + Drizzle/Prisma | Simple and reliable |
| Jobs & scheduling | **Inngest** or **Trigger.dev** | Cron, retries, step-by-step workflows, run logs; the "Automations" screen sits on top of this |
| LLM access | Direct SDKs (Anthropic, OpenAI, Google) + **OpenRouter** as a single gateway/fallback | Matches the "bring your own key" requirement |
| Email rendering | **React Email** or MJML | Email-safe HTML from the same components |
| Email sending | Amazon SES / Resend / Brevo | Cheap, good deliverability, webhooks for bounces and complaints |
| WhatsApp | `wa.me` links (MVP) → Meta WhatsApp Cloud API or an Indian BSP (Phase 3) | Start safe, scale later |
| Media storage | Cloudflare R2 / S3 | Images, chart PNGs, OG images |
| Chart → PNG for email | Headless render at build time (Playwright) or server-side ECharts SVG→PNG | Email can't run JS |
| Video (Phase 3) | Upload / YouTube / Mux; generated data videos with **Remotion** | Optional, high impact |
| Auth | Auth.js or Clerk (just you + team) | Simple |
| Secrets | AES-GCM encryption with a master key in env/KMS | API keys safe at rest |

### Core data model

```
Workspace ─┬─ BrandKit
           ├─ ProviderKey (provider, encrypted_key, last4, status)
           ├─ ModelAssignment (task → provider/model, fallback order)
           ├─ Source (type: rss|url|query, beat, active)
           ├─ StoryItem (source, url, title, summary, relevance_score, used_in_edition)
           ├─ KnowledgeItem (pillar: feature|delivered|concept, status: live|delivered|pilot|prototype|concept,
           │                 text, media[], approved_numbers, client_permission, last_featured_at)
           ├─ Edition (number, slug, status, json, scheduled_at, sent_at, cost)
           │     └─ EditionVersion (json, author: ai|human, diff, note)
           ├─ Contact (name, company, role, email, phone, consents{email,wa}, segment, tags, score)
           ├─ Segment (rules)
           ├─ Delivery (edition, contact, channel, token, status, sent_at)
           ├─ Event (token, type: view|scroll|click|poll|cta, value, at)
           └─ Job (type, cron, enabled, last_run, status, logs)
```

---

## 11. Build plan (phased)

### Phase 0: Prove it by hand (week 1)
- Design **one** edition template (web + email + preview card) to a premium standard.
- Produce 1–2 editions with AI help, mostly by hand, and send them to 20–30 friendly prospects.
- Learn which topics and CTAs get taps. **Don't build the full engine before this.**

### Phase 1: MVP Studio (weeks 2–4)
- Settings: brand kit, API keys (encrypted), model-per-task
- Sources & beats, ICP description, knowledge base
- Ingest job → story pool → AI draft into the block schema
- Editor with 3-pane preview + AI copilot edits with diffs + versions
- Pre-flight checklist
- Public edition page + auto OG image + archive
- Email HTML (copy/download, or send a test to yourself)
- Personal tokens, one-tap CTA endpoints, instant "Interested" alert
- Distribute screen: copy link, copy WhatsApp text, **click-to-WhatsApp list**
- Basic analytics: views, CTA taps, per-contact timeline

### Phase 2: Automate (weeks 5–7)
- Email sending through an ESP with scheduling, bounce/complaint handling, one-click unsubscribe
- Automations screen: all cron jobs editable, run logs, retries
- Segments + segment-specific "why it matters" angles
- Lead scoring + hot list + weekly report
- CRM sync (HubSpot / Apollo / Zoho / Sheets)
- Nudge job suggestions (clicked but didn't tap)

### Phase 3: Scale & wow (week 8+)
- WhatsApp Business Cloud API with approved template + in-chat quick-reply buttons
- Short videos: founder takes or Remotion-generated animated chart stories
- Personalised preview card ("Prepared for Acme Corp")
- A/B testing for subject lines and WhatsApp hooks
- Multi-language editions (e.g. Hindi + English)
- LinkedIn post and carousel generated from the same edition

---

## 12. Success metrics

| Metric | Healthy target (B2B, early) |
|---|---|
| Link open rate (WhatsApp) | 30–50% |
| Email click-through | 3–8% |
| Read past 50% of page | > 40% of openers |
| Any CTA tap per edition | 2–5% of recipients |
| "Interested" → meeting booked | > 30% (depends on follow-up speed) |
| Unsubscribe / "Not now" per send | < 1% / < 3% |
| Time you spend per edition | < 30 minutes |

---

## 13. Open questions to settle before building

1. **Industry / ICP**: which industry (or industries) and which roles are we writing for?
2. **List size and source**: how many contacts, and have they agreed to WhatsApp / email?
3. **Geography**: India only, or also US/EU? This affects compliance and send times.
4. **Brand**: name, logo, colours, and a newsletter name (e.g. "The [Industry] Brief").
5. **Reference style**: "Unada content", or which newsletters you consider the bar for "premium"?
8. **Content backlog**: list 5–10 features, delivered projects and concepts (with their honest status) to seed the knowledge base; that's roughly two months of editions.
6. **CRM**: where should leads go (HubSpot, Apollo, Zoho, Google Sheets)?
7. **Hosting / domain**: which domain should the links live on?
