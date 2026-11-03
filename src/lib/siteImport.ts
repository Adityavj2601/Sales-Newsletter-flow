import { getProduct, type Brand } from './settings';
import { insert, update, uid, now, get } from './db';
import { fetchText, siteDigest, sameSiteLinks, meta, pageTitle } from './web';
import { runJSON } from './ai/providers';

type Suggestion = { pillar: 'feature' | 'delivered' | 'concept'; title: string; summary: string; problem: string };

/**
 * Reads the product website (homepage + a few product pages) and fills the brand profile.
 * Feature ideas found on the site are saved as knowledge-base items that need your review
 * (inactive until you confirm their real status), so nothing is ever claimed automatically.
 */
export async function importFromWebsite(productId: string) {
  const p = getProduct(productId);
  if (!p) throw new Error('Product not found');
  if (!p.website) throw new Error('Add the website address first.');
  const home = await fetchText(p.website, 15000);
  if (home.status >= 400 || !home.text) throw new Error(`Could not open ${p.website} (HTTP ${home.status}).`);
  const pages = [`# ${p.website}\n${siteDigest(home.text, 7000)}`];
  for (const link of sameSiteLinks(home.text, home.finalUrl, 4)) {
    try {
      const r = await fetchText(link, 10000);
      if (r.status < 400) pages.push(`# ${link}\n${siteDigest(r.text, 3500)}`);
    } catch { /* skip */ }
  }
  const digest = pages.join('\n\n').slice(0, 24000);
  const res = await runJSON<{ tagline: string; about: string; icp: string; tone: string; features: Suggestion[] }>('draft',
    'You read a company website and summarise it for a newsletter editor. Be literal: only state what the site says. Return ONLY JSON.',
    `Website content:\n${digest}\n\nReturn JSON: {"tagline": "one line, max 12 words", "about": "3-4 sentences: what the product does, for whom, key capabilities, in plain words", "icp": "who buys it (roles, company types, geography) as stated or clearly implied", "tone": "how the brand speaks, one sentence", "features": [ {"pillar": "feature", "title": "capability name", "summary": "1-2 sentences, as described on the site", "problem": "the problem it solves for the buyer"} ] }  (list up to 8 features; use pillar "delivered" only for named case studies on the site).`,
    { maxTokens: 3000 });
  const brand: Brand = { ...p.brand };
  let added = 0;
  if (res) {
    const d = res.data;
    if (d.tagline) brand.tagline = d.tagline;
    if (d.about) brand.about = d.about;
    if (d.icp && !p.brand.icp) brand.icp = d.icp;
    for (const f of (d.features || []).slice(0, 8)) {
      if (!f?.title || get('SELECT id FROM kb_items WHERE product_id = ? AND lower(title) = lower(?)', p.id, f.title)) continue;
      const pillar = f.pillar === 'delivered' ? 'delivered' : 'feature';
      insert('kb_items', { id: uid('kb_'), product_id: p.id, pillar, status: pillar === 'delivered' ? 'delivered' : 'live', title: f.title, summary: f.summary || '', problem: f.problem || '', result: '', client_name: null, client_permission: 0, approved_numbers: '', media_url: null, link: p.website, active: 0, times_featured: 0, last_featured_at: null, created_at: now() });
      added++;
    }
  } else {
    brand.tagline = brand.tagline || meta(home.text, 'og:description').slice(0, 90) || pageTitle(home.text);
    brand.about = brand.about || [meta(home.text, 'description'), meta(home.text, 'og:description')].filter(Boolean)[0] || '';
  }
  update('products', p.id, { brand: JSON.stringify(brand) });
  return { ai: !!res, added, pages: pages.length };
}
