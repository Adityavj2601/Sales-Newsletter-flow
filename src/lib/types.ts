/* Edition content: the single source of truth that every renderer (web, email, WhatsApp, preview card) reads. */

export type Pillar = 'feature' | 'delivered' | 'concept';
export type Maturity = 'live' | 'delivered' | 'pilot' | 'prototype' | 'concept';
export type CtaAction = 'interested' | 'book' | 'more' | 'share' | 'notnow';

export type Source = { id: string; url: string; title?: string; publisher?: string; date?: string };

type Base = { id: string };
export type Block =
  | (Base & { type: 'tldr'; heading?: string; bullets: string[] })
  | (Base & { type: 'stat'; value: string; caption: string; sourceIds: string[] })
  | (Base & { type: 'story'; headline: string; body: string; why: string; sourceIds: string[]; opinion?: boolean })
  | (Base & { type: 'chart'; kind: 'bar' | 'column' | 'line'; title: string; insight: string; unit: string; data: { label: string; value: number }[]; sourceIds: string[] })
  | (Base & { type: 'showcase'; pillar: Pillar; kbId?: string; status: Maturity; title: string; body: string; mediaUrl?: string; cta: string; placeholder?: boolean })
  | (Base & { type: 'video'; url: string; caption: string })
  | (Base & { type: 'image'; url: string; alt: string; caption: string })
  | (Base & { type: 'quote'; text: string; author: string })
  | (Base & { type: 'text'; heading: string; body: string })
  | (Base & { type: 'poll'; question: string; options: string[] })
  | (Base & { type: 'cta'; heading: string; body: string; actions: CtaAction[] });

export type BlockType = Block['type'];

export type EditionContent = {
  kicker: string;
  title: string;
  dek: string;
  readMinutes: number;
  subject: string;
  preheader: string;
  waText: string;
  preview: { title: string; description: string };
  blocks: Block[];
  sources: Source[];
};

export type CheckStatus = 'ok' | 'warn' | 'fail' | 'skip';
export type CheckResult = { id: string; label: string; status: CheckStatus; detail?: string; blocking?: boolean; blockId?: string };
export type ChecksRun = { at: string; results: CheckResult[]; factcheck?: { provider: string; model: string } | null };

export const PILLARS: Record<Pillar, { label: string; defaultStatus: Maturity; cta: string; hint: string }> = {
  feature: { label: 'Fresh off the build', defaultStatus: 'live', cta: 'See it in action', hint: 'A capability customers can use today' },
  delivered: { label: 'Recently shipped', defaultStatus: 'delivered', cta: 'Want something similar?', hint: 'Real work done for a client' },
  concept: { label: 'On the drawing board', defaultStatus: 'concept', cta: "Let's explore this together", hint: 'An idea you could build, not built yet' },
};

/** Honest vocabulary per maturity status. `banned` phrases fail the pre-flight check. */
export const MATURITY: Record<Maturity, { label: string; allowed: string; banned: string[]; cta: string }> = {
  live: { label: 'Live', allowed: '"now live", "available", "you can", "here\'s how it works"', banned: [], cta: 'See it in action' },
  delivered: { label: 'Delivered', allowed: '"we built", "we delivered", "for a leading [industry] company", client-approved numbers', banned: ['available to all', 'off the shelf'], cta: 'Want something similar?' },
  pilot: { label: 'Pilot', allowed: '"in pilot", "early results", "being tested with"', banned: ['proven', 'trusted by', 'available now', 'available to all', 'widely used', 'launched'], cta: 'Join the pilot' },
  prototype: { label: 'Prototype', allowed: '"we\'ve prototyped", "working demo", "early version"', banned: ['launched', 'available now', 'customers use', 'our customers', 'trusted by', 'proven', 'in production'], cta: 'See the prototype' },
  concept: { label: 'Concept', allowed: '"we\'re exploring", "imagine if", "here\'s how this could work", "on our drawing board"', banned: ['launched', 'available', 'we offer', 'our solution', 'customers use', 'our customers', 'trusted by', 'proven', 'in production', 'delivered', 'results show'], cta: "Let's explore this together" },
};

export const CTA_LABELS: Record<CtaAction, string> = {
  interested: "I'm interested",
  book: 'Book 15 min',
  more: 'Send me more on this',
  share: 'Share with a colleague',
  notnow: 'Not right now',
};

export const BLOCK_LABELS: Record<BlockType, string> = {
  tldr: '30-second summary', stat: 'Number of the week', story: 'Story', chart: 'Chart', showcase: 'Our work card',
  video: 'Video', image: 'Image', quote: 'Quote', text: 'Text', poll: 'One-tap poll', cta: 'Call to action',
};

const rid = () => Math.random().toString(36).slice(2, 9);
const str = (v: any, d = '') => (typeof v === 'string' ? v : v == null ? d : String(v));
const arr = <T>(v: any): T[] => (Array.isArray(v) ? v : []);
const strs = (v: any) => arr<any>(v).map((x) => str(x)).filter(Boolean);

export function newBlock(type: BlockType): Block {
  const id = rid();
  switch (type) {
    case 'tldr': return { id, type, heading: 'The 30-second version', bullets: ['', '', ''] };
    case 'stat': return { id, type, value: '', caption: '', sourceIds: [] };
    case 'story': return { id, type, headline: '', body: '', why: '', sourceIds: [] };
    case 'chart': return { id, type, kind: 'bar', title: '', insight: '', unit: '%', data: [{ label: '', value: 0 }], sourceIds: [] };
    case 'showcase': return { id, type, pillar: 'feature', status: 'live', title: '', body: '', cta: PILLARS.feature.cta };
    case 'video': return { id, type, url: '', caption: '' };
    case 'image': return { id, type, url: '', alt: '', caption: '' };
    case 'quote': return { id, type, text: '', author: '' };
    case 'text': return { id, type, heading: '', body: '' };
    case 'poll': return { id, type, question: '', options: ['Yes', 'Not sure', 'No'] };
    case 'cta': return { id, type, heading: 'Curious?', body: 'One tap is enough. Nobody will spam you.', actions: ['interested', 'book', 'more', 'share', 'notnow'] };
  }
}

/** Defensive normaliser: AI output and saved JSON both pass through here. */
export function normalizeContent(raw: any): EditionContent {
  const r = raw && typeof raw === 'object' ? raw : {};
  const sources: Source[] = arr<any>(r.sources)
    .map((s) => ({ id: str(s.id) || rid(), url: str(s.url), title: str(s.title), publisher: str(s.publisher), date: str(s.date) }))
    .filter((s) => s.url);
  const seen = new Set<string>();
  const blocks: Block[] = arr<any>(r.blocks)
    .map((b) => normalizeBlock(b))
    .filter((b): b is Block => !!b)
    .map((b) => {
      if (seen.has(b.id)) b.id = rid();
      seen.add(b.id);
      return b;
    });
  const title = str(r.title);
  return {
    kicker: str(r.kicker),
    title,
    dek: str(r.dek),
    readMinutes: Math.max(1, Math.min(15, Number(r.readMinutes) || 3)),
    subject: str(r.subject) || title,
    preheader: str(r.preheader),
    waText: str(r.waText),
    preview: { title: str(r.preview?.title) || title, description: str(r.preview?.description) || str(r.dek) },
    blocks,
    sources,
  };
}

function normalizeBlock(b: any): Block | null {
  if (!b || typeof b !== 'object') return null;
  const id = str(b.id) || rid();
  const sourceIds = strs(b.sourceIds);
  switch (b.type) {
    case 'tldr': return { id, type: 'tldr', heading: str(b.heading, 'The 30-second version'), bullets: strs(b.bullets) };
    case 'stat': return { id, type: 'stat', value: str(b.value), caption: str(b.caption), sourceIds };
    case 'story': return { id, type: 'story', headline: str(b.headline), body: str(b.body), why: str(b.why), sourceIds, opinion: !!b.opinion };
    case 'chart': {
      const kind = ['bar', 'column', 'line'].includes(b.kind) ? b.kind : 'bar';
      const data = arr<any>(b.data).map((d) => ({ label: str(d?.label), value: Number(d?.value) || 0 })).filter((d) => d.label).slice(0, 12);
      return { id, type: 'chart', kind, title: str(b.title), insight: str(b.insight), unit: str(b.unit), data, sourceIds };
    }
    case 'showcase': {
      const pillar: Pillar = ['feature', 'delivered', 'concept'].includes(b.pillar) ? b.pillar : 'feature';
      const status: Maturity = ['live', 'delivered', 'pilot', 'prototype', 'concept'].includes(b.status) ? b.status : PILLARS[pillar].defaultStatus;
      return { id, type: 'showcase', pillar, status, kbId: str(b.kbId) || undefined, title: str(b.title), body: str(b.body), mediaUrl: str(b.mediaUrl) || undefined, cta: str(b.cta) || MATURITY[status].cta, placeholder: !!b.placeholder };
    }
    case 'video': return { id, type: 'video', url: str(b.url), caption: str(b.caption) };
    case 'image': return { id, type: 'image', url: str(b.url), alt: str(b.alt), caption: str(b.caption) };
    case 'quote': return { id, type: 'quote', text: str(b.text), author: str(b.author) };
    case 'text': return { id, type: 'text', heading: str(b.heading), body: str(b.body) };
    case 'poll': return { id, type: 'poll', question: str(b.question), options: strs(b.options).slice(0, 5) };
    case 'cta': {
      const valid: CtaAction[] = ['interested', 'book', 'more', 'share', 'notnow'];
      const actions = strs(b.actions).filter((a): a is CtaAction => (valid as string[]).includes(a));
      return { id, type: 'cta', heading: str(b.heading, 'Curious?'), body: str(b.body), actions: actions.length ? actions : valid };
    }
  }
  return null;
}

export function emptyContent(): EditionContent {
  return normalizeContent({ title: '', blocks: [newBlock('tldr'), newBlock('stat'), newBlock('story'), newBlock('poll'), newBlock('cta')] });
}
