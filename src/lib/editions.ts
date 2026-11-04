import { all, get, insert, update, uid, now, parse, run } from './db';
import { getProduct, getSetting, type Product } from './settings';
import { normalizeContent, emptyContent, type EditionContent, type ChecksRun, PILLARS } from './types';
import { runJSON } from './ai/providers';
import { draftSystem, editSystem, subjectSystem } from './ai/prompts';
import { demoDraft, demoPlaceholderShowcase } from './ai/demo';
import { nextSendDate } from './format';

export type EditionStatus = 'draft' | 'review' | 'approved' | 'scheduled' | 'sending' | 'sent';
export type EditionRow = {
  id: string; product_id: string; number: number; slug: string; status: EditionStatus; content: string; checks: string | null;
  overrides: string | null; planned_for: string | null; scheduled_at: string | null; send_config: string | null; sent_at: string | null;
  approved_by: string | null; approved_at: string | null; created_at: string; updated_at: string;
};
export type Edition = Omit<EditionRow, 'content' | 'checks' | 'overrides'> & { content: EditionContent; checks: ChecksRun | null; overrides: Record<string, string> };

export const toEdition = (r: EditionRow): Edition => ({ ...r, content: normalizeContent(parse(r.content, {})), checks: parse(r.checks, null), overrides: parse(r.overrides, {}) });
export const getEdition = (id: string): Edition | null => {
  const r = get<EditionRow>('SELECT * FROM editions WHERE id = ?', id);
  return r ? toEdition(r) : null;
};
export const listEditions = (productId: string): Edition[] => all<EditionRow>('SELECT * FROM editions WHERE product_id = ? ORDER BY number DESC', productId).map(toEdition);

export function slugify(s: string) {
  return s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_-]+/g, '-').slice(0, 48).replace(/-+$/, '') || 'edition';
}
function nextNumber(productId: string) {
  return Number(get('SELECT COALESCE(MAX(number), 0) + 1 AS n FROM editions WHERE product_id = ?', productId)?.n || 1);
}
function uniqueSlug(productId: string, n: number, title: string) {
  const base = `${String(n).padStart(2, '0')}-${slugify(title || 'edition')}`;
  let s = base, i = 2;
  while (get('SELECT id FROM editions WHERE product_id = ? AND slug = ?', productId, s)) s = `${base}-${i++}`;
  return s;
}

export function snapshot(editionId: string, content: EditionContent, author: string, note: string) {
  insert('edition_versions', { id: uid('v_'), edition_id: editionId, content: JSON.stringify(content), author, note, created_at: now() });
  // keep the last 60 versions
  run(`DELETE FROM edition_versions WHERE edition_id = ? AND id NOT IN (SELECT id FROM edition_versions WHERE edition_id = ? ORDER BY created_at DESC LIMIT 60)`, editionId, editionId);
}

export function createEdition(productId: string, content: EditionContent, author: string, note: string, plannedFor?: string): Edition {
  const n = nextNumber(productId);
  const id = uid('ed_');
  const t = now();
  const planned = plannedFor || nextSendDate(getSetting('general'), all('SELECT planned_for FROM editions WHERE product_id = ?', productId).map((r) => r.planned_for));
  insert('editions', { id, product_id: productId, number: n, slug: uniqueSlug(productId, n, content.title), status: 'draft', content: JSON.stringify(content), checks: null, overrides: '{}', planned_for: planned, scheduled_at: null, send_config: null, sent_at: null, approved_by: null, approved_at: null, created_at: t, updated_at: t });
  snapshot(id, content, author, note);
  return getEdition(id)!;
}

/** Saving content always drops an approval: anything changed must be re-checked. */
export function saveContent(id: string, content: EditionContent, opts: { author?: string; note?: string; version?: boolean } = {}) {
  const e = getEdition(id);
  if (!e) throw new Error('Edition not found');
  if (e.status === 'sent' || e.status === 'sending') throw new Error('This edition has already been sent and can’t be edited. Duplicate it instead.');
  const c = normalizeContent(content);
  const patch: any = { content: JSON.stringify(c), updated_at: now() };
  if (e.status === 'approved' || e.status === 'scheduled') Object.assign(patch, { status: 'review', approved_by: null, approved_at: null, scheduled_at: null });
  if (e.number && e.status === 'draft' && c.title && /^\d+-edition(-\d+)?$/.test(e.slug)) patch.slug = uniqueSlug(e.product_id, e.number, c.title);
  update('editions', id, patch);
  if (opts.version) snapshot(id, c, opts.author || 'you', opts.note || 'Saved');
  return getEdition(id)!;
}

/* ---------- AI drafting ---------- */

export type DraftInput = { storyIds?: string[]; kbIds?: string[]; brief?: string; plannedFor?: string };

export function pickStories(productId: string, ids?: string[]) {
  if (ids) return ids.length ? all(`SELECT * FROM stories WHERE id IN (${ids.map(() => '?').join(',')}) ORDER BY score DESC`, ...ids) : [];
  const shortlisted = all("SELECT * FROM stories WHERE product_id = ? AND status = 'shortlisted' ORDER BY score DESC LIMIT 6", productId);
  if (shortlisted.length >= 3) return shortlisted;
  const fresh = all("SELECT * FROM stories WHERE product_id = ? AND status IN ('new','shortlisted') AND created_at >= ? ORDER BY score DESC LIMIT 6", productId, new Date(Date.now() - 10 * 86400_000).toISOString());
  return fresh.length ? fresh : all("SELECT * FROM stories WHERE product_id = ? AND status IN ('new','shortlisted') ORDER BY score DESC LIMIT 6", productId);
}
/** Rotate "Our work" items: least recently featured first, at most two pillars per edition. */
export function pickKb(productId: string, ids?: string[]) {
  if (ids) return ids.length ? all(`SELECT * FROM kb_items WHERE id IN (${ids.map(() => '?').join(',')}) AND active = 1`, ...ids) : []; // [] = none chosen; undefined = pick automatically
  const items = all('SELECT * FROM kb_items WHERE product_id = ? AND active = 1 ORDER BY COALESCE(last_featured_at, \'\') ASC, times_featured ASC, created_at DESC', productId);
  const lastEd = get('SELECT content FROM editions WHERE product_id = ? ORDER BY number DESC LIMIT 1', productId);
  const lastPillars = new Set(normalizeContent(parse(lastEd?.content, {})).blocks.filter((b) => b.type === 'showcase').map((b: any) => b.pillar));
  const out: any[] = [];
  const pillarsUsed = new Set<string>();
  for (const pass of [0, 1]) {
    for (const it of items) {
      if (out.length >= 2) break;
      if (out.includes(it) || pillarsUsed.has(it.pillar)) continue;
      if (pass === 0 && lastPillars.has(it.pillar)) continue;
      out.push(it);
      pillarsUsed.add(it.pillar);
    }
  }
  return out;
}

export async function draftEdition(productId: string, input: DraftInput, author: string): Promise<{ edition: Edition; mode: 'ai' | 'demo'; model?: string }> {
  const p = getProduct(productId);
  if (!p) throw new Error('Product not found');
  const stories = pickStories(p.id, input.storyIds);
  if (!stories.length) throw new Error('The story pool is empty. Fetch news on the Story pool page (or add a story by URL) first.');
  const kb = pickKb(p.id, input.kbIds);
  const recent = all('SELECT content FROM editions WHERE product_id = ? ORDER BY number DESC LIMIT 4', p.id).map((r) => normalizeContent(parse(r.content, {})).title).filter(Boolean);
  const n = nextNumber(p.id);
  const planned = input.plannedFor || nextSendDate(getSetting('general'), all('SELECT planned_for FROM editions WHERE product_id = ?', p.id).map((r) => r.planned_for));

  const storyText = stories.map((s, i) => `### Story s${i + 1}\nurl: ${s.url}\ntitle: ${s.title}\npublisher: ${s.publisher || ''}\ndate: ${(s.published_at || s.created_at || '').slice(0, 10)}\nsummary: ${s.summary || ''}\ntext: ${(s.content || '').slice(0, 3500)}`).join('\n\n');
  const kbText = kb.length
    ? kb.map((k) => `- kbId: ${k.id}\n  pillar: ${k.pillar}\n  status: ${k.status}\n  title: ${k.title}\n  summary: ${k.summary}\n  problem: ${k.problem || ''}\n  result: ${k.result || ''}\n  client_name: ${k.client_name || ''}\n  client_permission: ${k.client_permission ? 'true' : 'false'}\n  approved_numbers: ${k.approved_numbers || '(none)'}\n  media_url: ${k.media_url || ''}`).join('\n')
    : '(none: omit showcase cards)';
  const user = `Edition #${n}, sending on ${planned}.
${input.brief ? `Editor's brief for this week: ${input.brief}\n` : ''}Recent edition titles (avoid repeating): ${recent.join(' | ') || '(none)'}

STORIES (use only these facts):
${storyText}

KNOWLEDGE BASE ITEMS for "Our work" cards:
${kbText}

Write the edition JSON now.`;

  let content: EditionContent;
  let mode: 'ai' | 'demo' = 'ai';
  let model: string | undefined;
  const res = await runJSON<any>('draft', draftSystem(p), user, { maxTokens: 8000 });
  if (res) {
    content = normalizeContent(res.data);
    model = `${res.meta.provider} · ${res.meta.model}`;
    // Map source ids the model used back to real story URLs when it omitted them.
    const byId = new Map(stories.map((s, i) => [`s${i + 1}`, s]));
    const known = new Set(content.sources.map((s) => s.id));
    for (const b of content.blocks) for (const sid of (b as any).sourceIds || []) {
      if (!known.has(sid) && byId.has(sid)) {
        const s = byId.get(sid)!;
        content.sources.push({ id: sid, url: s.url, title: s.title, publisher: s.publisher || '', date: (s.published_at || '').slice(0, 10) });
        known.add(sid);
      }
    }
  } else {
    content = demoDraft(p, stories as any, kb as any, n);
    mode = 'demo';
  }
  if (!kb.length && !content.blocks.some((b) => b.type === 'showcase')) {
    const at = content.blocks.findIndex((b) => b.type === 'poll');
    content.blocks.splice(at < 0 ? content.blocks.length : at, 0, demoPlaceholderShowcase('feature', p.name));
  }
  const e = createEdition(p.id, content, mode === 'ai' ? 'ai' : 'demo', mode === 'ai' ? `AI draft (${model})` : 'Demo draft (no AI key yet)', planned);
  // Only stories the edition actually cites leave the pool.
  const cited = new Set(e.content.blocks.flatMap((b: any) => b.sourceIds || []).map((sid: string) => e.content.sources.find((x) => x.id === sid)?.url).filter(Boolean));
  for (const s of stories) if (cited.has(s.url)) run("UPDATE stories SET status = 'used', used_in = ? WHERE id = ?", e.id, s.id);
  return { edition: e, mode, model };
}

/* ---------- AI copilot edits ---------- */

export async function aiEdit(id: string, instruction: string, blockId?: string): Promise<{ content: EditionContent; summary: string; model: string }> {
  const e = getEdition(id);
  if (!e) throw new Error('Edition not found');
  const p = getProduct(e.product_id)!;
  const target = blockId ? `\nTarget block id: ${blockId} (change only this block unless the instruction says otherwise).` : '';
  const sourceTexts = e.content.sources.map((s) => {
    const st = get('SELECT summary, content FROM stories WHERE product_id = ? AND url = ?', p.id, s.url);
    return `- ${s.id}: ${s.title || s.url}${st ? `\n  ${(st.summary || '')} ${(st.content || '').slice(0, 1500)}` : ''}`;
  }).join('\n');
  const user = `Current edition JSON:\n${JSON.stringify(e.content)}\n\nSource texts:\n${sourceTexts || '(none)'}\n\nInstruction: ${instruction}${target}`;
  const res = await runJSON<any>('edit', editSystem(p), user, { maxTokens: 9000 });
  if (!res) {
    return { content: e.content, summary: 'Demo mode: no AI provider is connected, so nothing was changed. Add a key in Settings → AI to use the copilot.', model: 'demo' };
  }
  const summary = String(res.data.changeSummary || 'Updated.');
  delete res.data.changeSummary;
  const next = normalizeContent(res.data);
  // never let an edit silently drop sources still referenced
  for (const s of e.content.sources) if (!next.sources.some((x) => x.id === s.id)) next.sources.push(s);
  return { content: next, summary, model: `${res.meta.provider} · ${res.meta.model}` };
}

export async function suggestSubjects(id: string) {
  const e = getEdition(id);
  if (!e) throw new Error('Edition not found');
  const res = await runJSON<{ subjects: string[]; waHooks: string[] }>('fast', subjectSystem, `Edition title: ${e.content.title}\nDek: ${e.content.dek}\nSummary bullets: ${e.content.blocks.filter((b) => b.type === 'tldr').flatMap((b: any) => b.bullets).join(' / ')}\nPersonalisation token available: {first_name}`);
  if (!res) return { subjects: [`{first_name}, ${e.content.title}`, `${e.content.title} (3-min read)`], waHooks: [e.content.dek], demo: true };
  return { subjects: (res.data.subjects || []).slice(0, 6), waHooks: (res.data.waHooks || []).slice(0, 4), demo: false };
}

export function duplicateEdition(id: string, author: string) {
  const e = getEdition(id);
  if (!e) throw new Error('Edition not found');
  const c = { ...e.content, title: `${e.content.title} (copy)` };
  return createEdition(e.product_id, c, author, `Copied from #${e.number}`);
}

export function blankEdition(productId: string, author: string, plannedFor?: string) {
  return createEdition(productId, emptyContent(), author, 'Blank edition', plannedFor || undefined);
}

export const pillarLabel = (k: string) => (PILLARS as any)[k]?.label || k;
