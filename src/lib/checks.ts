import { get, update, now } from './db';
import { getEdition } from './editions';
import { getProduct } from './settings';
import { MATURITY, type CheckResult, type ChecksRun, type Block } from './types';
import { runJSON, routeFor } from './ai/providers';
import { factcheckSystem } from './ai/prompts';
import { fetchText } from './web';
import { renderEmail } from './render/email';

const SPAM = ['free!!!', '100% free', 'act now', 'guaranteed', 'winner', 'urgent', 'limited time', 'click here', 'risk-free', 'cash bonus', '$$$', 'buy now', 'double your'];

async function linkOk(url: string): Promise<{ ok: boolean; code: string }> {
  try {
    const r = await fetchText(url, 9000);
    return { ok: r.status < 400 || r.status === 403 || r.status === 429, code: String(r.status) };
  } catch (e: any) {
    return { ok: false, code: e?.name === 'AbortError' ? 'timeout' : 'unreachable' };
  }
}

/** All pre-flight checks. Deterministic checks always run; link and AI fact checks run when `deep` is true. */
export async function runChecks(editionId: string, deep = true): Promise<ChecksRun> {
  const e = getEdition(editionId);
  if (!e) throw new Error('Edition not found');
  const p = getProduct(e.product_id)!;
  const c = e.content;
  const R: CheckResult[] = [];
  const add = (r: CheckResult) => R.push(r);
  const blocks = c.blocks;
  const srcIds = new Set(c.sources.map((s) => s.id));

  // Structure
  add({ id: 'title', label: 'Headline written', status: c.title.trim() ? 'ok' : 'fail', blocking: true, detail: c.title ? undefined : 'Add a headline.' });
  add({ id: 'preview-title', label: `Preview title ${c.preview.title.length}/60 characters`, status: c.preview.title.length && c.preview.title.length <= 60 ? 'ok' : c.preview.title.length ? 'warn' : 'fail', blocking: !c.preview.title.length, detail: c.preview.title.length > 60 ? 'WhatsApp and LinkedIn cut long titles. Shorten it.' : undefined });
  add({ id: 'preview-desc', label: `Preview description ${c.preview.description.length}/110 characters`, status: c.preview.description.length && c.preview.description.length <= 110 ? 'ok' : 'warn' });
  add({ id: 'subject', label: 'Email subject and preview text', status: !c.subject ? 'fail' : c.preheader && c.subject.replace('{first_name}', 'Rohan').length <= 70 ? 'ok' : 'warn', blocking: !c.subject, detail: !c.preheader ? 'Add preview text; otherwise inboxes show the first line of the email.' : undefined });
  add({ id: 'wa', label: 'WhatsApp message has the link', status: c.waText.includes('{link}') ? (c.waText.length <= 400 ? 'ok' : 'warn') : 'fail', blocking: true, detail: c.waText.includes('{link}') ? (c.waText.length > 400 ? 'Long WhatsApp messages get skimmed. Keep it under 400 characters.' : undefined) : 'Put {link} in the WhatsApp text so each person gets their own tracked link.' });
  const stories = blocks.filter((b) => b.type === 'story');
  add({ id: 'industry', label: 'At least one industry story', status: stories.length ? 'ok' : 'fail', blocking: true });
  const show = blocks.filter((b) => b.type === 'showcase') as Extract<Block, { type: 'showcase' }>[];
  add({ id: 'mix', label: `"Our work" cards: ${show.length} (max 2)`, status: show.length <= 2 ? 'ok' : 'warn', detail: show.length > 2 ? 'More than two cards starts to read like an advert.' : undefined });
  add({ id: 'cta', label: 'One-tap call to action present', status: blocks.some((b) => b.type === 'cta') ? 'ok' : 'warn', detail: blocks.some((b) => b.type === 'cta') ? undefined : 'Add a "Call to action" block so readers can say they are interested.' });

  // Empty fields
  for (const b of blocks) {
    const empty =
      (b.type === 'story' && (!b.headline.trim() || !b.body.trim())) ||
      (b.type === 'stat' && (!b.value.trim() || !b.caption.trim())) ||
      (b.type === 'tldr' && b.bullets.filter((x) => x.trim()).length === 0) ||
      (b.type === 'chart' && b.data.length < 2) ||
      (b.type === 'poll' && (!b.question.trim() || b.options.filter(Boolean).length < 2)) ||
      ((b.type === 'video' || b.type === 'image') && !b.url.trim()) ||
      (b.type === 'cta' && !b.actions.length);
    if (empty) add({ id: `empty-${b.id}`, label: `Unfinished ${b.type} block`, status: 'fail', blocking: true, blockId: b.id, detail: 'Fill it in or delete it.' });
  }

  // Sources (skipped for blocks already flagged as unfinished)
  const unfinished = new Set(R.filter((r) => r.id.startsWith('empty-')).map((r) => r.blockId));
  for (const b of blocks) {
    if (unfinished.has(b.id)) continue;
    if (b.type === 'stat' || b.type === 'chart' || (b.type === 'story' && !b.opinion)) {
      const ids = b.sourceIds.filter((s) => srcIds.has(s));
      const name = b.type === 'story' ? `"${b.headline.slice(0, 50)}"` : b.type === 'stat' ? `Number "${b.value}"` : `Chart "${b.title.slice(0, 40)}"`;
      if (!ids.length) add({ id: `src-${b.id}`, label: `${name} has no source`, status: 'fail', blocking: true, blockId: b.id, detail: 'Every fact needs a source. Link one in the block, or mark a story as opinion.' });
    }
    if (b.type === 'story' && b.opinion && /\d/.test(b.body.replace(/\b(20\d\d|19\d\d)\b/g, ''))) add({ id: `op-${b.id}`, label: 'Opinion story contains numbers', status: 'warn', blockId: b.id, detail: 'Opinion pieces should not quote statistics. Move numbers into a sourced story.' });
  }
  if (!R.some((r) => r.id.startsWith('src-'))) add({ id: 'sources', label: 'Every fact has a linked source', status: 'ok' });

  // Maturity wording and client permission
  const banned = (p.brand.bannedWords || '').split(',').map((w) => w.trim().toLowerCase()).filter(Boolean);
  let maturityIssues = 0;
  for (const s of show) {
    if (s.placeholder || /^\[.*\]$/.test(s.title.trim())) {
      add({ id: `ph-${s.id}`, label: `"Our work" card is still a placeholder`, status: 'fail', blocking: true, blockId: s.id, detail: 'Pick an item from the knowledge base or delete the card.' });
      continue;
    }
    const text = `${s.title} ${s.body}`.toLowerCase();
    const hits = MATURITY[s.status].banned.filter((w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text));
    if (hits.length) {
      maturityIssues++;
      add({ id: `mat-${s.id}`, label: `"${s.title.slice(0, 40)}" claims more than its status (${MATURITY[s.status].label})`, status: 'fail', blocking: true, blockId: s.id, detail: `Remove: ${hits.map((h) => `"${h}"`).join(', ')}. Allowed wording: ${MATURITY[s.status].allowed}.` });
    }
    if (s.kbId) {
      const kb = get('SELECT * FROM kb_items WHERE id = ?', s.kbId);
      if (!kb) add({ id: `kb-${s.id}`, label: `"${s.title.slice(0, 40)}" links to a deleted knowledge item`, status: 'warn', blockId: s.id });
      else {
        if (kb.status !== s.status) add({ id: `kbs-${s.id}`, label: `"${s.title.slice(0, 40)}" status differs from the knowledge base`, status: 'fail', blocking: true, blockId: s.id, detail: `Knowledge base says ${kb.status}; card says ${s.status}.` });
        if (kb.client_name && !kb.client_permission && text.includes(String(kb.client_name).toLowerCase())) add({ id: `perm-${s.id}`, label: `Client "${kb.client_name}" named without permission`, status: 'fail', blocking: true, blockId: s.id, detail: 'Describe them generically, or record written permission in the knowledge base.' });
      }
    }
  }
  if (show.length && !maturityIssues) add({ id: 'maturity', label: '"Our work" wording matches each item’s status', status: 'ok' });

  // Brand / spam words
  // Only text readers see; source titles and URLs are other people's words.
  const readerText = [c.kicker, c.title, c.dek, c.subject, c.preheader, c.waText, c.preview.title, c.preview.description, ...blocks.map((b: any) => [b.heading, b.bullets, b.value, b.caption, b.headline, b.body, b.why, b.title, b.insight, b.text, b.question, b.options, b.cta, b.alt].flat().filter(Boolean).join(' '))].join(' ').toLowerCase();
  const bw = banned.filter((w) => new RegExp(`(?<![\\w])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w])`).test(readerText));
  add({ id: 'banned', label: bw.length ? `Banned words used: ${bw.join(', ')}` : 'No banned words', status: bw.length ? 'fail' : 'ok', blocking: bw.length > 0 });
  const subj = `${c.subject} ${c.preheader}`.toLowerCase();
  const sp = SPAM.filter((w) => subj.includes(w));
  // Acronyms like RERA, CBRE, NBFC are normal; only long shouted words count.
  const caps = (c.subject.match(/\b[A-Z]{7,}\b/g) || []).length;
  add({ id: 'spam', label: sp.length || caps ? 'Subject line may trigger spam filters' : 'Subject line passes spam-word check', status: sp.length || caps ? 'warn' : 'ok', detail: sp.length ? `Avoid: ${sp.join(', ')}` : caps ? 'Avoid ALL-CAPS words.' : undefined });

  // Images / media
  for (const b of blocks) if (b.type === 'image' && b.url.trim() && !b.alt.trim()) add({ id: `alt-${b.id}`, label: 'Image without alt text', status: 'warn', blockId: b.id });

  // Email size
  const html = renderEmail(e, p, null);
  const kb = Math.round(Buffer.byteLength(html, 'utf8') / 1024);
  add({ id: 'email-size', label: `Email size ${kb} KB (Gmail clips above ~100 KB)`, status: kb < 95 ? 'ok' : 'fail', blocking: kb >= 95 });
  add({ id: 'unsub', label: 'One-click unsubscribe and preferences links', status: 'ok' });
  add({ id: 'address', label: 'Sender address in footer', status: p.brand.address ? 'ok' : 'warn', detail: p.brand.address ? undefined : 'Add a registered address in Settings → Products (needed for most email laws).' });

  let factMeta: ChecksRun['factcheck'] = null;
  if (deep) {
    // Links
    const urls = [...new Set(c.sources.map((s) => s.url).concat(blocks.flatMap((b) => ('url' in b && (b as any).url ? [(b as any).url] : []))))].filter((u) => /^https?:/.test(u));
    const results = await Promise.all(urls.map(async (u) => ({ u, ...(await linkOk(u)) })));
    const bad = results.filter((r) => !r.ok);
    add({ id: 'links', label: bad.length ? `${bad.length} of ${urls.length} links failed` : `All ${urls.length} links open`, status: bad.length ? 'warn' : 'ok', detail: bad.length ? bad.map((b) => `${b.u} (${b.code})`).join('\n') : undefined });

    // AI fact check against cited source texts
    const claims = blocks.flatMap((b) => {
      if (b.type === 'stat') return [{ blockId: b.id, claim: `${b.value}: ${b.caption}`, src: b.sourceIds }];
      if (b.type === 'story' && !b.opinion) return [{ blockId: b.id, claim: `${b.headline}. ${b.body}`, src: b.sourceIds }];
      if (b.type === 'chart') return [{ blockId: b.id, claim: `${b.title}: ${b.data.map((d) => `${d.label} ${d.value}${b.unit}`).join(', ')}`, src: b.sourceIds }];
      if (b.type === 'tldr') return b.bullets.map((x) => ({ blockId: b.id, claim: x, src: c.sources.map((s) => s.id) }));
      return [];
    });
    const srcText = (id: string) => {
      const s = c.sources.find((x) => x.id === id);
      if (!s) return '';
      const st = get('SELECT title, summary, content FROM stories WHERE product_id = ? AND url = ?', p.id, s.url);
      return `[${id}] ${s.title || ''} — ${st ? `${st.summary || ''}\n${(st.content || '').slice(0, 3000)}` : '(only the headline is stored)'}`;
    };
    try {
      const writer = routeFor('draft')[0]?.provider;
      const res = await runJSON<{ items: { blockId: string; claim: string; verdict: string; note: string }[] }>('factcheck', factcheckSystem,
        `CLAIMS:\n${claims.map((cl, i) => `${i + 1}. blockId=${cl.blockId} sources=${cl.src.join(',')}\n   ${cl.claim}`).join('\n')}\n\nSOURCE TEXTS:\n${[...new Set(claims.flatMap((cl) => cl.src))].map(srcText).join('\n\n')}`,
        { maxTokens: 4000, avoid: writer });
      if (!res) add({ id: 'factcheck', label: 'AI fact check not run', status: 'skip', detail: 'Connect an AI provider in Settings → AI. Until then, check numbers against the linked sources yourself.' });
      else {
        factMeta = { provider: res.meta.provider, model: res.meta.model };
        const items = res.data.items || [];
        const badItems = items.filter((i) => i.verdict === 'contradicted' || i.verdict === 'unsupported');
        const unver = items.filter((i) => i.verdict === 'unverifiable');
        for (const i of badItems) add({ id: `fc-${i.blockId}-${Math.random().toString(36).slice(2, 6)}`, label: `Fact check: ${i.verdict} — "${String(i.claim).slice(0, 70)}"`, status: i.verdict === 'contradicted' ? 'fail' : 'warn', blocking: i.verdict === 'contradicted', blockId: i.blockId, detail: i.note });
        add({ id: 'factcheck', label: `AI fact check (${res.meta.model}): ${items.length - badItems.length - unver.length} supported, ${badItems.length} flagged, ${unver.length} unverifiable`, status: badItems.length ? 'warn' : unver.length ? 'warn' : 'ok', detail: unver.length ? 'Unverifiable usually means only the headline was stored. Open the source and confirm the number.' : undefined });
      }
    } catch (err: any) {
      add({ id: 'factcheck', label: 'AI fact check failed', status: 'warn', detail: String(err?.message || err) });
    }
  } else {
    add({ id: 'links', label: 'Link check and AI fact check not run yet', status: 'skip', detail: 'Click "Run all checks".' });
  }

  const order = { fail: 0, warn: 1, skip: 2, ok: 3 } as const;
  R.sort((a, b) => order[a.status] - order[b.status]);
  const run: ChecksRun = { at: now(), results: R, factcheck: factMeta };
  const patch: any = { checks: JSON.stringify(run) };
  if (e.status === 'draft') patch.status = 'review';
  update('editions', e.id, patch);
  return run;
}

export function blockingFailures(run: ChecksRun | null, overrides: Record<string, string>) {
  if (!run) return [{ id: 'not-run', label: 'Checks have not been run', status: 'fail' as const, blocking: true }];
  return run.results.filter((r) => r.status === 'fail' && r.blocking && !overrides[r.id]);
}
