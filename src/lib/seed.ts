import { all, get, insert, uid, now } from './db';
import { BRAND_DEFAULT, getSetting, setSetting, listProducts } from './settings';
import { ensureJobs } from './jobs';
import { createEdition } from './editions';
import { normalizeContent } from './types';
import { demoPlaceholderShowcase } from './ai/demo';
import { nextSendDate } from './format';

const ICP = 'Marketing heads, sales heads, CMOs and founders at real-estate developers in India (residential and commercial), from mid-size regional developers to listed companies. They own site-visit targets, campaign budgets, channel-partner programmes and launch calendars.';

export const DEFAULT_SOURCES: { kind: 'gnews' | 'rss'; name: string; url: string }[] = [
  { kind: 'gnews', name: 'Google News: India housing sales', url: 'India housing sales Anarock OR PropEquity OR "Knight Frank" OR PropTiger' },
  { kind: 'gnews', name: 'Google News: developers & launches', url: 'real estate developer India launch OR bookings OR pre-sales' },
  { kind: 'gnews', name: 'Google News: RERA orders', url: 'RERA order developers OR MahaRERA OR "UP RERA" OR K-RERA' },
  { kind: 'gnews', name: 'Google News: home loans & RBI', url: 'home loan rates RBI repo housing demand India' },
  { kind: 'gnews', name: 'Google News: real-estate marketing & tech', url: 'real estate marketing India leads OR proptech OR "site visits" OR CRM' },
  { kind: 'rss', name: 'ET Realty top stories', url: 'https://realty.economictimes.indiatimes.com/rss/topstories' },
  { kind: 'rss', name: 'Housing.com News', url: 'https://housing.com/news/feed/' },
];

export function seedProducts() {
  if (listProducts().length) return;
  const t = now();
  const products = [
    { slug: 'unada', name: 'Unada', website: 'https://unada.io', newsletter_name: 'The Site Visit', brand: { ...BRAND_DEFAULT, primary: '#1d2340', accent: '#c08b2e', soft: '#eef0f6', icp: ICP, senderName: 'Team Unada', signOff: '— Team Unada' } },
    { slug: 'heyveya', name: 'HeyVeya', website: 'https://heyveya.ai', newsletter_name: 'The Walkthrough', brand: { ...BRAND_DEFAULT, primary: '#163a31', accent: '#d4573f', soft: '#ebf3ef', icp: ICP, senderName: 'Team HeyVeya', signOff: '— Team HeyVeya' } },
  ];
  products.forEach((p, i) => {
    const id = uid('p_');
    insert('products', { id, slug: p.slug, name: p.name, website: p.website, newsletter_name: p.newsletter_name, brand: JSON.stringify(p.brand), sort: i, created_at: t });
    ensureJobs(id);
  });
  for (const s of DEFAULT_SOURCES) insert('sources', { id: uid('src_'), product_id: null, kind: s.kind, name: s.name, url: s.url, active: 1, last_fetched_at: null, last_error: null, last_count: null, created_at: t });
  const g = getSetting('general');
  if (!g.publicBaseUrl && process.env.PUBLIC_BASE_URL) setSetting('general', { ...g, publicBaseUrl: process.env.PUBLIC_BASE_URL });
  for (const p of listProducts()) seedMonthOne(p.id, p.name);
}

/* The four month-1 editions from the planning mock-up (industry news is real and sourced). */
const S = {
  anarock_bs: { url: 'https://www.business-standard.com/industry/news/housing-sales-rise-3-per-cent-in-q3-office-leasing-up-9-per-cent-ananrock-126092800624_1.html', title: 'Housing sales rise 3% in Q3; office leasing up 9%: Anarock', publisher: 'Business Standard' },
  anarock_cw: { url: 'https://www.constructionweekonline.in/business/housing-sales-rise-3-yoy-in-top-seven-cities-new-launches-up-18-in-q3-26', title: "Housing sales rise 3% YoY in top seven cities, new launches up 18% in Q3 '26", publisher: 'Construction Week India' },
  kf_bs: { url: 'https://www.business-standard.com/industry/news/industry-news-festive-housing-demand-to-stay-healthy-but-growth-may-moderate-126092000348_1.html', title: 'Festive housing demand to remain healthy, but growth may moderate', publisher: 'Business Standard' },
  rbi_bt: { url: 'https://www.businesstoday.in/real-estate/story/domestic-housing-market-gets-festive-boost-as-demand-rises-7-will-rbi-repo-rate-hike-put-buyers-on-alert-560154-2026-10-07', title: 'Will RBI repo rate hike put buyers on alert?', publisher: 'Business Today' },
  rbi_cc: { url: 'https://www.thecreditcompass.in/blog/rbi-repo-rate-hike-october-2026-what-changed-and-why', title: 'RBI repo rate hike to 5.50% (October 2026): what changed and why', publisher: 'The Credit Compass' },
  mrera_h: { url: 'https://housing.com/news/maharera-fines-628-projects-for-not-displaying-qr-code-registration-number/', title: 'MahaRERA fines 628 projects for not displaying QR code, registration number', publisher: 'Housing.com News' },
  mrera_rb: { url: 'https://www.realtybuzz.in/maharera-tightens-rules-on-display-standards-in-real-estate-ads', title: 'MahaRERA tightens rules on display standards in real estate ads', publisher: 'RealtyBuzz' },
  mrera_asci: { url: 'https://www.freepressjournal.in/amp/mumbai/maharashtra-maharera-partners-with-asci-to-spot-non-compliant-real-estate-developers', title: 'MahaRERA partners with ASCI to spot non-compliant developers', publisher: 'Free Press Journal' },
  gujrera: { url: 'https://propnewstime.com/getdetailsStories/MTg3NzU=/developers-face-penalties-for-non-compliant-ads-under-gujarat-rera-rules', title: 'Developers face penalties for non-compliant ads under Gujarat RERA rules', publisher: 'PropNewsTime' },
  cbre_bt: { url: 'https://www.businesstoday.in/personal-finance/real-estate/story/bigger-homes-bigger-budgets-high-end-housing-dominates-indias-2025-sales-finds-cbre-report-511528-2026-01-19', title: "Bigger homes, bigger budgets: high-end housing dominates India's 2025 sales, finds CBRE", publisher: 'Business Today' },
};
type K = keyof typeof S;
const srcs = (...k: K[]) => k.map((id) => ({ id, ...S[id] }));
const cta = { type: 'cta', heading: 'Curious?', body: 'One tap is enough. Nobody will spam you.', actions: ['interested', 'book', 'more', 'share', 'notnow'] };

function monthOne(): any[] {
  return [
    {
      kicker: 'Q3 in numbers', title: 'Q3 launched more homes than it sold', dek: "Anarock's Q3 numbers, read for the people who have to fill the site-visit calendar.",
      subject: '{first_name}, Q3 launched more homes than it sold (3-min read)', preheader: 'What 18% more launches means for your site-visit calendar.',
      waText: 'Hi {first_name} 👋\nQ3 numbers are out: 18% more launches, only 3% more sales.\nHere’s what that means for your next launch, in 3 minutes:\n👉 {link}',
      preview: { title: 'Q3 launched more homes than it sold', description: '18% more launches, 3% more sales. What it means for your next launch.' },
      sources: srcs('anarock_bs', 'anarock_cw'), pillars: ['feature', 'delivered'],
      blocks: [
        { type: 'tldr', bullets: ["Sales in India's top 7 cities rose 3% year on year to about 1,00,220 homes (Anarock).", 'Launches grew much faster, up 18% to about 1,14,320 homes. Unsold inventory rose 12% to about 6.31 lakh.', 'Average prices are up 7%. Buyers have more choice and less urgency, so every site visit is harder to win.'] },
        { type: 'stat', value: '1.14 lakh', caption: 'homes launched in Q3 2026 across the top 7 cities, against about 1.00 lakh sold', sourceIds: ['anarock_bs'] },
        { type: 'story', headline: 'Supply is outrunning demand', body: 'Developers launched about 1,14,320 homes between July and September, 18% more than a year earlier. Sales grew 3%, to about 1,00,220. Unsold stock across the seven cities now stands at around 6.31 lakh homes, up 12%.', why: 'When more projects chase the same buyer, each site visit costs more to win. The teams that come out ahead respond first and follow up best. Ad spend alone won’t do it.', sourceIds: ['anarock_bs', 'anarock_cw'] },
        { type: 'chart', kind: 'bar', title: 'Q3 2026 vs Q3 2025, top 7 cities (year-on-year change)', insight: 'Launches grew six times faster than sales.', unit: '%', data: [{ label: 'New launches', value: 18 }, { label: 'Unsold inventory', value: 12 }, { label: 'Average price', value: 7 }, { label: 'Homes sold', value: 3 }, { label: 'Sales value', value: 2 }], sourceIds: ['anarock_bs', 'anarock_cw'] },
        { type: 'story', headline: 'MMR and Bengaluru are half the market', body: 'MMR sold about 31,750 homes and Bengaluru about 16,670, together 48% of all sales in the top 7 cities. Hyderabad grew fastest, up 15% to about 12,950 homes.', why: 'If you sell outside these two cities, national headlines can mislead you. Track absorption in your own micro-market, not the top-7 average.', sourceIds: ['anarock_cw'] },
        { type: 'poll', question: 'Are you launching a new project in the next 6 months?', options: ["Yes, it's planned", 'Considering it', 'Not this year'] },
        cta,
      ],
    },
    {
      kicker: 'The rate hike', title: 'The first rate hike since 2023 reaches your buyers', dek: 'What a 0.25% move does to a home loan, and how sales teams can answer "let’s wait and see".',
      subject: '{first_name}, what the rate hike really does to an EMI', preheader: 'A 0.25% move, in rupees per month.',
      waText: 'Hi {first_name} 👋\nThe RBI’s first rate hike since 2023 is reaching home-loan EMIs.\nWe worked out what it means in rupees per month. It’s smaller than most buyers think:\n👉 {link}',
      preview: { title: 'What the rate hike really does to an EMI', description: 'A 0.25% move in rupees per month, and how to answer “let’s wait and see”.' },
      sources: srcs('rbi_bt', 'rbi_cc', 'kf_bs'), pillars: ['delivered', 'concept'],
      blocks: [
        { type: 'tldr', bullets: ['The RBI raised the repo rate from 5.25% to 5.50% on 7 October, its first hike since February 2023.', 'Repo-linked home loans reset at least once every three months, so many buyers will see a higher EMI soon.', 'Knight Frank expects festive sales to beat 2025 but grow more slowly, and says developers may need payment plans and incentives.'] },
        { type: 'stat', value: '5.50%', caption: 'RBI repo rate after the 7 October 2026 hike, up from 5.25%', sourceIds: ['rbi_bt', 'rbi_cc'] },
        { type: 'story', headline: 'What changed', body: 'The RBI lifted the repo rate by 25 basis points on 7 October. Repo-linked home loans pass this on at their next reset, which must happen at least once every three months. Fixed-rate loans are unaffected for now.', why: 'Your sales team will hear "let’s wait and see" more often. Have an answer ready: in rupees per month the change is small.', sourceIds: ['rbi_bt', 'rbi_cc'] },
        { type: 'chart', kind: 'column', title: 'EMI on a ₹75 lakh, 20-year loan', insight: 'Illustrative: if the full 0.25% is passed on, the EMI rises by about ₹1,150 a month.', unit: '₹', data: [{ label: 'At 7.50%', value: 60420 }, { label: 'At 7.75%', value: 61571 }], sourceIds: ['rbi_cc'] },
        { type: 'story', headline: 'Developers are leaning on payment plans', body: 'Knight Frank expects festive-season sales to beat last year but grow more slowly than in past years. Its research director said payment plans and fiscal incentives from developers may be needed to support sales.', why: 'If you’re designing an offer, test it on your warmest leads first. A payment plan your team can explain in one sentence beats a clever one.', sourceIds: ['kf_bs'] },
        { type: 'poll', question: 'Are you changing your payment plans this quarter?', options: ['Yes, already done', 'Considering it', 'No'] },
        cta,
      ],
    },
    {
      kicker: 'Ad compliance', title: 'The top-right corner of your ad now matters', dek: 'RERA rules on registration numbers and QR codes, plus a 5-point check before any creative goes live.',
      subject: '{first_name}, is the QR code in the top-right corner?', preheader: 'RERA ad rules in 2 minutes, with a 5-point checklist.',
      waText: 'Hi {first_name} 👋\nOne missing QR code on an ad can now mean a RERA fine.\nHere’s a 5-point check to run before any creative goes live:\n👉 {link}',
      preview: { title: 'The top-right corner of your ad now matters', description: 'RERA ad rules in 2 minutes, with a 5-point checklist for your creatives.' },
      sources: srcs('mrera_h', 'mrera_rb', 'mrera_asci', 'gujrera'), pillars: ['feature', 'concept'],
      blocks: [
        { type: 'tldr', bullets: ['MahaRERA requires the registration number, website and project QR code on ads, in the top-right quadrant, in a colour that stands out.', 'Fines in Maharashtra go up to ₹50,000. In Gujarat, penalties can reach 5% of a project’s estimated construction cost.', 'MahaRERA works with the ad regulator ASCI and has said it will use AI to spot non-compliant ads.'] },
        { type: 'stat', value: '628', caption: 'projects fined by MahaRERA in one enforcement drive for ads missing a QR code or registration number', sourceIds: ['mrera_h'] },
        { type: 'story', headline: 'Maharashtra spells out exactly where the QR code goes', body: 'A MahaRERA circular requires the registration number, the RERA website and the project QR code on ads, placed in the top-right quadrant in a colour that is clearly visible. Developers who don’t comply can be fined up to ₹50,000.', why: 'This is a creative-process problem as much as a legal one. One missed reel or portal banner can trigger a notice, so make the check part of creative sign-off.', sourceIds: ['mrera_rb', 'mrera_asci'] },
        { type: 'text', heading: 'Before any creative goes live: a 5-point check', body: '1. RERA registration number on the creative\n2. Project QR code from the RERA certificate\n3. RERA website address\n4. All three in the top-right quadrant\n5. Colour and size readable on a phone\n\nRules vary by state. Check the current order for each state you market in.' },
        { type: 'story', headline: 'Gujarat’s penalty is far bigger', body: 'GujRERA requires the registration number and the QR code from the RERA certificate on brochures, print, digital and video ads. Penalties can go up to 5% of the project’s estimated construction cost.', why: 'Rules differ by state. If you market in more than one, give your agency a one-page rule sheet per state.', sourceIds: ['gujrera'] },
        { type: 'poll', question: 'Who checks RERA compliance on your ads today?', options: ['Marketing team', 'Legal team', 'Our agency', 'No one formally'] },
        cta,
      ],
    },
    {
      kicker: 'Measure the visit', title: 'Stop judging campaigns by cost per lead', dek: 'Why cost per site visit is the number that matters, and how to work out yours.',
      subject: '{first_name}, what does a site visit really cost you?', preheader: 'Why cost per lead misleads, and the one weekly table to ask for.',
      waText: 'Hi {first_name} 👋\nA cheap lead that never visits isn’t cheap.\nThis week: how to find your real cost per site visit:\n👉 {link}',
      preview: { title: 'Stop judging campaigns by cost per lead', description: 'Why cost per site visit is the number that matters, and how to work out yours.' },
      sources: srcs('cbre_bt'), pillars: ['delivered', 'feature'],
      blocks: [
        { type: 'tldr', bullets: ['High-end homes were nearly 27% of residential sales in 2025, the largest segment for the first time (CBRE).', 'Bigger tickets mean fewer, more valuable buyers. A cheap lead that never visits isn’t cheap.', 'Track cost per site visit and cost per booking by campaign.'] },
        { type: 'stat', value: '27%', caption: "share of India's 2025 residential sales from high-end homes, more than double their 2022 share", sourceIds: ['cbre_bt'] },
        { type: 'story', headline: 'The market moved up the price ladder', body: 'CBRE found that high-end homes made up nearly 27% of residential sales in 2025, more than double their 2022 share, making them the largest segment by sales for the first time. It credits rising incomes and steady NRI demand.', why: 'Premium buyers research longer and visit fewer projects. Each enquiry is worth more, so the speed and quality of follow-up matter more than volume.', sourceIds: ['cbre_bt'] },
        { type: 'story', opinion: true, headline: 'Cost per lead flatters the wrong campaigns', body: 'A lead-form campaign can bring in enquiries cheaply and still produce very few site visits. A search campaign can cost several times more per lead and still be cheaper per visit. Ad platforms optimise for whatever event you report to them, so if visits and bookings never flow back, they keep chasing cheap enquiries.', why: 'Ask your agency for one weekly table: spend, leads, site visits and bookings, by campaign. It takes an hour to set up and changes budget decisions.', sourceIds: [] },
        { type: 'text', heading: 'Work out your cost per site visit', body: 'Cost per site visit = cost per lead ÷ share of leads that visit.\n\nExample: a ₹150 lead where 2 in 100 visit costs ₹7,500 per visit. A ₹1,000 lead where 15 in 100 visit costs about ₹6,667 per visit. The "expensive" campaign is cheaper.' },
        { type: 'poll', question: 'What does your team review every week?', options: ['Cost per lead', 'Cost per site visit', 'Cost per booking', 'We don’t review it weekly'] },
        cta,
      ],
    },
  ];
}

export function seedMonthOne(productId: string, productName: string) {
  if (get('SELECT id FROM editions WHERE product_id = ? LIMIT 1', productId)) return;
  const taken: string[] = [];
  for (const raw of monthOne()) {
    const planned = nextSendDate(getSetting('general'), taken);
    taken.push(planned);
    const content = normalizeContent(raw);
    const at = content.blocks.findIndex((b) => b.type === 'poll');
    content.blocks.splice(at, 0, ...raw.pillars.map((pl: any) => demoPlaceholderShowcase(pl, productName)));
    createEdition(productId, content, 'system', 'Month-1 plan (sample)', planned);
  }
}

export function sampleContacts(productId: string) {
  const t = now();
  const rows = [
    ['Rohan', 'Mehta', 'rohan.mehta@example.com', '+919800000001', 'Skyline Developers', 'Head of Sales', 'Pune'],
    ['Priya', 'Nair', 'priya.nair@example.com', '+919800000002', 'Coastline Realty', 'Marketing Head', 'Mumbai'],
    ['Arjun', 'Rao', 'arjun.rao@example.com', '+919800000003', 'Greenfield Homes', 'CMO', 'Bengaluru'],
  ];
  let n = 0;
  for (const [f, l, e, ph, co, role, city] of rows) {
    if (get('SELECT id FROM contacts WHERE product_id = ? AND email = ?', productId, e)) continue;
    insert('contacts', { id: uid('c_'), product_id: productId, first_name: f, last_name: l, email: e, phone: ph, company: co, role, city, tags: 'sample', email_consent: 1, wa_consent: 1, consent_source: 'Sample data (delete before real sends)', consent_at: t, status: 'active', frequency: 'weekly', stage: 'new', score: 0, last_engaged_at: null, last_intent: null, last_intent_at: null, notes: null, created_at: t });
    n++;
  }
  return n;
}

export const productCount = () => all('SELECT id FROM products').length;
