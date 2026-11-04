import { XMLParser } from 'fast-xml-parser';
import { all, get, insert, update, uid, now, run } from './db';
import { sha1 } from './crypto';
import { getProduct, type Product } from './settings';
import { fetchText, stripTags, decodeEntities, readableText, pageTitle, meta } from './web';
import { runJSON } from './ai/providers';
import { scoreSystem } from './ai/prompts';
import { heuristicScore } from './ai/demo';

export type SourceRow = { id: string; product_id: string | null; kind: 'rss' | 'gnews'; name: string; url: string; active: number; last_fetched_at: string | null; last_error: string | null; last_count: number | null };

export function gnewsUrl(query: string) {
  const q = /when:\d+[dh]/.test(query) ? query : `${query} when:7d`;
  return `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-IN&gl=IN&ceid=IN:en`;
}

type Item = { url: string; title: string; summary: string; publisher: string; published: string | null };
const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@', textNodeName: '#text', processEntities: true });
const txt = (v: any): string => (v == null ? '' : typeof v === 'string' ? v : typeof v === 'number' ? String(v) : v['#text'] ? String(v['#text']) : '');

export function parseFeed(body: string, isGnews = false): Item[] {
  const doc = xml.parse(body);
  const rssItems = doc?.rss?.channel?.item ?? doc?.['rdf:RDF']?.item;
  const atomItems = doc?.feed?.entry;
  const list: any[] = Array.isArray(rssItems) ? rssItems : rssItems ? [rssItems] : Array.isArray(atomItems) ? atomItems : atomItems ? [atomItems] : [];
  return list.map((it) => {
    let url = txt(it.link);
    if (!url && it.link) {
      const links = Array.isArray(it.link) ? it.link : [it.link];
      url = links.find((l: any) => !l['@rel'] || l['@rel'] === 'alternate')?.['@href'] || links[0]?.['@href'] || '';
    }
    const title = decodeEntities(stripTags(txt(it.title)));
    const rawSummary = txt(it.description) || txt(it.summary) || txt(it['content:encoded']) || txt(it.content);
    let publisher = txt(it.source) || txt(it['dc:creator']) || '';
    let cleanTitle = title;
    // Google News titles end with " - Publisher"
    // Split "Title - Publisher" only for Google News, or when the suffix is the item's <source>.
    const cut = title.lastIndexOf(' - ');
    if (cut > 0) {
      const suffix = title.slice(cut + 3).trim();
      if ((isGnews && suffix.length <= 60) || (publisher && publisher === suffix)) { cleanTitle = title.slice(0, cut); publisher = publisher || suffix; }
    }
    let summary = stripTags(rawSummary);
    if (summary.startsWith(cleanTitle)) summary = summary.slice(cleanTitle.length).replace(/^\s*[-–—.:|]+\s*/, '');
    if (summary.length < 30 || summary === publisher) summary = '';
    const pub = txt(it.pubDate) || txt(it.published) || txt(it.updated) || txt(it['dc:date']);
    const d = pub ? new Date(pub) : null;
    return { url: url.trim(), title: cleanTitle.trim(), summary: summary.slice(0, 1200), publisher: publisher.trim(), published: d && !isNaN(+d) ? d.toISOString() : null };
  }).filter((i) => i.url && i.title);
}

/** Fetch every active source for a product, store new stories, enrich and score them. */
export async function ingestProduct(productId: string, log: (s: string) => void = () => {}) {
  const p = getProduct(productId);
  if (!p) throw new Error('Product not found');
  const sources = all<SourceRow>('SELECT * FROM sources WHERE active = 1 AND (product_id = ? OR product_id IS NULL)', p.id);
  let added = 0;
  for (const s of sources) {
    const url = s.kind === 'gnews' ? gnewsUrl(s.url) : s.url;
    try {
      const res = await fetchText(url, 15000);
      if (res.status >= 400) throw new Error(`HTTP ${res.status}`);
      const items = parseFeed(res.text, s.kind === 'gnews').slice(0, 40);
      if (!items.length && !/<(rss|feed|rdf:RDF)[\s>]/i.test(res.text)) throw new Error('Not a valid RSS or Atom feed');
      let n = 0;
      const cutoff = Date.now() - 21 * 86400_000;
      for (const it of items) {
        if (it.published && +new Date(it.published) < cutoff) continue;
        const hash = sha1(it.url.replace(/[?#].*$/, '') + '|' + it.title.toLowerCase().slice(0, 80));
        const titleHash = sha1(it.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim());
        if (get('SELECT id FROM stories WHERE product_id = ? AND (url_hash = ? OR url_hash = ?)', p.id, hash, titleHash)) continue;
        if (get('SELECT id FROM stories WHERE product_id = ? AND lower(title) = lower(?)', p.id, it.title)) continue;
        insert('stories', { id: uid('st_'), product_id: p.id, source_id: s.id, url: it.url, url_hash: hash, title: it.title, summary: it.summary, content: null, publisher: it.publisher || s.name, published_at: it.published, score: null, score_reason: null, status: 'new', used_in: null, created_at: now() });
        n++;
      }
      added += n;
      update('sources', s.id, { last_fetched_at: now(), last_error: null, last_count: n });
      log(`✓ ${s.name}: ${items.length} items, ${n} new`);
    } catch (e: any) {
      const code = e?.cause?.code ? ` (${e.cause.code})` : '';
      const msg = e?.name === 'AbortError' ? 'Timed out' : `${String(e?.message || e)}${code}`;
      update('sources', s.id, { last_fetched_at: now(), last_error: msg });
      log(`✕ ${s.name}: ${msg}`);
    }
  }
  await enrichStories(p.id, log);
  await scoreStories(p, log);
  return { added };
}

/** Best-effort: fetch article text for unscored stories so drafting and fact-checks have more than a headline. */
export async function enrichStories(productId: string, log: (s: string) => void = () => {}, limit = 15) {
  const rows = all('SELECT id, url FROM stories WHERE product_id = ? AND content IS NULL ORDER BY created_at DESC LIMIT ?', productId, limit);
  let ok = 0;
  await Promise.all(rows.map(async (r) => {
    if (/news\.google\.com/.test(r.url)) { update('stories', r.id, { content: '' }); return; }
    try {
      const res = await fetchText(r.url, 10000);
      const text = res.status < 400 ? readableText(res.text, 6000) : '';
      update('stories', r.id, { content: text });
      if (text) ok++;
    } catch {
      update('stories', r.id, { content: '' });
    }
  }));
  if (rows.length) log(`Fetched article text for ${ok} of ${rows.length} stories`);
}

export async function scoreStories(p: Product, log: (s: string) => void = () => {}) {
  const rows = all('SELECT id, title, summary, publisher FROM stories WHERE product_id = ? AND score IS NULL ORDER BY created_at DESC LIMIT 60', p.id);
  if (!rows.length) return;
  let scored = false;
  try {
    const list = rows.map((r) => `- id: ${r.id}\n  title: ${r.title}\n  publisher: ${r.publisher || ''}\n  summary: ${(r.summary || '').slice(0, 300)}`).join('\n');
    const res = await runJSON<{ scores: { id: string; score: number; reason: string }[] }>('fast', scoreSystem(p), `Stories:\n${list}`, { maxTokens: 4000 });
    if (res) {
      for (const s of res.data.scores || []) {
        if (rows.some((r) => r.id === s.id)) update('stories', s.id, { score: Math.max(0, Math.min(100, Math.round(Number(s.score) || 0))), score_reason: String(s.reason || '').slice(0, 120) });
      }
      scored = true;
      log(`AI scored ${res.data.scores?.length || 0} stories (${res.meta.provider} · ${res.meta.model})`);
    }
  } catch (e: any) {
    log(`AI scoring failed, using keyword scoring: ${e?.message || e}`);
  }
  for (const r of all('SELECT id, title, summary FROM stories WHERE product_id = ? AND score IS NULL', p.id)) {
    const h = heuristicScore(r.title, r.summary || '');
    update('stories', r.id, { score: h.score, score_reason: h.reason });
  }
  if (!scored) log('Scored stories with keyword rules (no AI provider configured)');
}

/** Add one story by URL (manual). */
const normUrl = (u: string) => {
  try {
    const x = new URL(u);
    for (const k of [...x.searchParams.keys()]) if (/^(utm_|fbclid|gclid|mc_|ref$|ref_)/i.test(k)) x.searchParams.delete(k);
    x.hash = '';
    return x.toString().replace(/\/$/, '');
  } catch { return u; }
};

/** Add one story by URL (manual). Re-adding a story that's already in the pool just shortlists it. */
export async function addStoryByUrl(productId: string, url: string) {
  const clean = normUrl(url.trim());
  const bare = clean.replace(/[?#].*$/, '');
  const dupe = get('SELECT id FROM stories WHERE product_id = ? AND (url = ? OR url = ? OR url LIKE ?)', productId, clean, bare, `${bare}?%`);
  if (dupe) { run("UPDATE stories SET status = 'shortlisted' WHERE id = ? AND status <> 'used'", dupe.id); return dupe.id as string; }
  const res = await fetchText(clean, 12000);
  if (res.status >= 400) throw new Error(`Could not open that page (HTTP ${res.status}).`);
  const finalUrl = normUrl(res.finalUrl);
  const title = pageTitle(res.text) || finalUrl;
  const summary = meta(res.text, 'description') || meta(res.text, 'og:description');
  const content = readableText(res.text, 6000);
  const hash = sha1(finalUrl.replace(/[?#].*$/, '') + '|' + title.toLowerCase().slice(0, 80));
  const existing = get('SELECT id FROM stories WHERE product_id = ? AND (url_hash = ? OR url = ? OR lower(title) = lower(?))', productId, hash, finalUrl, title);
  if (existing) { run("UPDATE stories SET status = 'shortlisted' WHERE id = ? AND status <> 'used'", existing.id); return existing.id as string; }
  const id = uid('st_');
  const h = heuristicScore(title, summary);
  const host = new URL(finalUrl).hostname.replace(/^www\./, '');
  insert('stories', { id, product_id: productId, source_id: null, url: finalUrl, url_hash: hash, title, summary, content, publisher: meta(res.text, 'og:site_name') || host, published_at: meta(res.text, 'article:published_time') || null, score: Math.max(h.score, 60), score_reason: 'Added by you', status: 'shortlisted', used_in: null, created_at: now() });
  return id;
}
