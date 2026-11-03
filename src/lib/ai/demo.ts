/* Demo mode: deterministic stand-ins used when no AI key is configured, so the full workflow still runs. */
import type { Product } from '../settings';
import { newBlock, PILLARS, MATURITY, type EditionContent, type Block } from '../types';

type StoryIn = { id: string; title: string; summary: string; publisher: string; url: string; published_at: string | null };
type KbIn = { id: string; pillar: string; status: string; title: string; summary: string; problem: string | null; result: string | null };

const KEYWORDS: [RegExp, number][] = [
  [/housing|residential|homes?|apartment|flat/i, 18], [/developer|builder|launch/i, 16], [/rera|regulat|compliance|order/i, 14],
  [/sales|demand|absorption|inventory|unsold/i, 16], [/price|rate|repo|loan|emi/i, 10], [/marketing|lead|digital|campaign|portal|crm/i, 14],
  [/india|mumbai|pune|bengaluru|bangalore|hyderabad|delhi|ncr|gurugram|noida|chennai|kolkata|ahmedabad/i, 10],
  [/anarock|knight frank|propequity|jll|cbre|colliers|proptiger/i, 12], [/nri|luxury|premium/i, 6],
];
export function heuristicScore(title: string, summary = ''): { score: number; reason: string } {
  const text = `${title} ${summary}`;
  let s = 10;
  const hits: string[] = [];
  for (const [re, w] of KEYWORDS) {
    const m = text.match(re);
    if (m) { s += w; hits.push(m[0].toLowerCase()); }
  }
  return { score: Math.min(95, s), reason: hits.length ? `Keyword match: ${hits.slice(0, 4).join(', ')}` : 'Few relevant keywords' };
}

const firstSentence = (t: string) => (t.split(/(?<=[.!?])\s/)[0] || t).trim();
const clip = (t: string, n: number) => (t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t);

export function demoDraft(p: Product, stories: StoryIn[], kb: KbIn[], editionNo: number): EditionContent {
  const s = stories.slice(0, 4);
  const sources = s.map((st, i) => ({ id: `s${i + 1}`, url: st.url, title: st.title, publisher: st.publisher, date: (st.published_at || '').slice(0, 10) }));
  const blocks: Block[] = [];
  const tl = newBlock('tldr') as Extract<Block, { type: 'tldr' }>;
  tl.bullets = s.slice(0, 3).map((st) => clip(firstSentence(st.summary || st.title), 160));
  blocks.push(tl);
  const num = s.map((st) => (st.title + ' ' + st.summary).match(/(₹\s?[\d,.]+\s?(lakh|crore|cr)?|\d[\d,.]*\s?(%|per cent|lakh|crore|units))/i)).find(Boolean);
  const stat = newBlock('stat') as Extract<Block, { type: 'stat' }>;
  stat.value = num ? num[0] : `${s.length}`;
  stat.caption = num ? clip(s.find((st) => (st.title + ' ' + st.summary).includes(num[0]))?.title || '', 120) : 'stories worth your time this week';
  stat.sourceIds = num ? [sources[s.findIndex((st) => (st.title + ' ' + st.summary).includes(num[0]))]?.id].filter(Boolean) as string[] : [];
  blocks.push(stat);
  s.slice(0, 2).forEach((st, i) => {
    const b = newBlock('story') as Extract<Block, { type: 'story' }>;
    b.headline = clip(st.title, 90);
    b.body = clip(st.summary || st.title, 520);
    b.why = 'Demo mode wrote this placeholder. Connect an AI provider in Settings → AI and redraft to get a real "why it matters" angle.';
    b.sourceIds = [sources[i].id];
    blocks.push(b);
  });
  const usedPillars = new Set<string>();
  for (const k of kb) {
    if (usedPillars.size >= 2 || usedPillars.has(k.pillar)) continue;
    usedPillars.add(k.pillar);
    const st = (k.status as keyof typeof MATURITY) in MATURITY ? (k.status as keyof typeof MATURITY) : 'live';
    blocks.push({ id: Math.random().toString(36).slice(2, 9), type: 'showcase', pillar: k.pillar as any, kbId: k.id, status: st, title: k.title, body: [k.problem, k.summary, k.result].filter(Boolean).join(' '), cta: MATURITY[st].cta });
  }
  const poll = newBlock('poll') as Extract<Block, { type: 'poll' }>;
  poll.question = 'Is this on your team’s agenda for the next quarter?';
  poll.options = ['Yes, already', 'Exploring it', 'Not yet'];
  blocks.push(poll, newBlock('cta'));
  const lead = s[0];
  const title = clip(lead ? lead.title.replace(/\s+-\s+[^-]+$/, '') : `${p.newsletter_name} #${editionNo}`, 60);
  return {
    kicker: 'This week',
    title,
    dek: `${s.length === 1 ? 'The story' : `The ${s.length} stories`} that matter${s.length === 1 ? 's' : ''} this week, read for sales and marketing teams.`,
    readMinutes: 3,
    subject: clip(`{first_name}, ${title}`, 70),
    preheader: 'Three minutes, the numbers that matter, and what to do about them.',
    waText: `Hi {first_name} 👋\nThis week in real estate: ${clip(title, 80)}\nThe 3-minute version:\n👉 {link}`,
    preview: { title, description: `${p.newsletter_name} by ${p.name}. 3-minute read.` },
    blocks,
    sources,
  };
}

export function demoPlaceholderShowcase(pillar: keyof typeof PILLARS, name: string): Block {
  return { id: Math.random().toString(36).slice(2, 9), type: 'showcase', pillar, status: PILLARS[pillar].defaultStatus, title: `[Add a ${PILLARS[pillar].label.toLowerCase()} item for ${name}]`, body: 'Fill this from the knowledge base, or remove the card.', cta: PILLARS[pillar].cta, placeholder: true };
}
