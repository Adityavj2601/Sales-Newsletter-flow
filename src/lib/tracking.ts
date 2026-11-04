import { get, insert, run, uid, now, update } from './db';
import { getEdition } from './editions';
import { alertIntent } from './alerts';
import { CTA_LABELS } from './types';

/** Points added to a contact's lead score the first time they do something for an edition. */
export const SCORE: Record<string, number> = {
  open: 1, click: 3, view: 5, 'scroll:75': 5, poll: 10, share: 15, more: 15, showcase: 30, book: 40, interested: 50, notnow: -10, unsubscribe: -100, wa_reply: 20,
};
export const INTENTS = new Set(['interested', 'book', 'showcase', 'more']);
/** Strength of an intent, so a weaker later tap never hides a stronger earlier one. */
export const INTENT_RANK: Record<string, number> = { more: 1, showcase: 2, book: 3, interested: 4 };
export const HOT_SCORE = 50;

export type Resolved = { delivery: any | null; contact: any | null; editionId: string | null; productId: string | null };

export function resolveToken(token: string | null | undefined, editionId?: string | null): Resolved {
  if (token && token !== '_') {
    const d = get('SELECT * FROM deliveries WHERE token = ?', token);
    if (d) {
      const contact = d.contact_id ? get('SELECT * FROM contacts WHERE id = ?', d.contact_id) : null;
      const ed = get('SELECT product_id FROM editions WHERE id = ?', d.edition_id);
      return { delivery: d, contact, editionId: d.edition_id, productId: ed?.product_id || null };
    }
  }
  if (editionId) {
    const ed = get('SELECT id, product_id FROM editions WHERE id = ?', editionId);
    if (ed) return { delivery: null, contact: null, editionId: ed.id, productId: ed.product_id };
  }
  return { delivery: null, contact: null, editionId: null, productId: null };
}

/** Link scanners and preview bots (corporate mail gateways pre-fetch every link). Their requests must not count. */
export function isBot(ua: string | null | undefined): boolean {
  if (!ua) return true;
  return /bot\b|crawler|spider|slurp|preview|scanner|proofpoint|mimecast|barracuda|safelinks|urldefense|google-?inspectiontool|facebookexternalhit|whatsapp|linkedinbot|slackbot|twitterbot|skypeuripreview|curl\/|wget\/|python-requests|python-urllib|go-http-client|java\/|okhttp|libwww|httpclient/i.test(ua);
}

const ALLOWED = new Set(['open', 'click', 'view', 'scroll', 'time', 'poll', 'share', 'interested', 'book', 'more', 'notnow', 'showcase', 'unsubscribe', 'resubscribe', 'note', 'wa_reply']);
/** Types whose value distinguishes separate "first" occurrences (each scroll milestone, each Our-work card). */
const PER_VALUE = new Set(['scroll', 'showcase']);

/** Record an event; updates delivery status, lead score, stage and fires alerts for intent. */
export async function track(opts: { token?: string | null; editionId?: string | null; type: string; value?: string | null; meta?: any }) {
  if (!ALLOWED.has(opts.type)) return null;
  const r = resolveToken(opts.token, opts.editionId);
  if (!r.editionId) return null;
  if (r.delivery?.channel === 'test') return null; // test sends never count
  if (opts.type === 'poll' && !opts.value) return null;
  const t = now();
  const scoreKey = opts.type === 'scroll' ? `scroll:${opts.value}` : opts.type;
  // Only the first occurrence per delivery and type (per value for scroll/showcase) counts for scoring and alerts.
  const firstTime = r.delivery
    ? !get(
        PER_VALUE.has(opts.type)
          ? "SELECT id FROM events WHERE delivery_id = ? AND type = ? AND COALESCE(value, '') = COALESCE(?, '') LIMIT 1"
          : 'SELECT id FROM events WHERE delivery_id = ? AND type = ? LIMIT 1',
        ...(PER_VALUE.has(opts.type) ? [r.delivery.id, opts.type, opts.value ?? null] : [r.delivery.id, opts.type]),
      )
    : true;
  // Anonymous (shared-link) intent: alert at most once per edition and action per hour.
  const anonRecent = !r.delivery && INTENTS.has(opts.type)
    ? !!get('SELECT id FROM events WHERE edition_id = ? AND delivery_id IS NULL AND type = ? AND created_at >= ? LIMIT 1', r.editionId, opts.type, new Date(Date.now() - 3600_000).toISOString())
    : false;
  const id = uid('ev_');
  insert('events', { id, product_id: r.productId, edition_id: r.editionId, contact_id: r.contact?.id || null, delivery_id: r.delivery?.id || null, type: opts.type, value: opts.value ?? null, meta: opts.meta ? JSON.stringify(opts.meta).slice(0, 2000) : null, created_at: t });

  if (r.delivery) {
    const rank: Record<string, number> = { queued: 0, failed: 0, sent: 1, delivered: 2, opened: 3, clicked: 4 };
    const next = opts.type === 'open' ? 'opened' : ['click', 'view', 'scroll', 'poll', 'interested', 'book', 'more', 'showcase', 'share'].includes(opts.type) ? 'clicked' : null;
    if (next && (rank[next] ?? 0) > (rank[r.delivery.status] ?? 0)) update('deliveries', r.delivery.id, { status: next });
  }
  if (r.contact) {
    const patch: any = { last_engaged_at: t };
    if (firstTime) {
      const pts = SCORE[scoreKey] ?? 0;
      if (pts) patch.score = Math.max(0, (r.contact.score || 0) + pts);
      if (INTENTS.has(opts.type)) {
        const cur = INTENT_RANK[r.contact.last_intent] || 0;
        // Keep the strongest intent; refresh its time when the same or stronger.
        if ((INTENT_RANK[opts.type] || 0) >= cur) Object.assign(patch, { last_intent: opts.type, last_intent_at: t });
        if (r.contact.stage === 'new') patch.stage = 'warm';
      }
    }
    // Preference changes always apply, however often they're requested.
    if (opts.type === 'notnow') patch.frequency = 'less';
    if (opts.type === 'unsubscribe') {
      // WhatsApp "STOP" only ends WhatsApp; the email footer link ends everything.
      if (opts.meta?.channel === 'whatsapp') patch.wa_consent = 0;
      else Object.assign(patch, { status: 'unsubscribed', email_consent: 0, wa_consent: 0 });
    }
    update('contacts', r.contact.id, patch);
  }
  if (INTENTS.has(opts.type) && firstTime && !anonRecent && opts.type !== 'more') {
    const e = getEdition(r.editionId);
    let extra = '';
    if (opts.type === 'showcase' && opts.value) {
      const kb = get('SELECT title FROM kb_items WHERE id = ?', opts.value);
      extra = kb ? `About: ${kb.title}` : '';
    }
    const contact = r.contact ? get('SELECT * FROM contacts WHERE id = ?', r.contact.id) : null;
    await alertIntent({ productId: r.productId!, action: opts.type, label: opts.type === 'showcase' ? 'Show me this' : (CTA_LABELS as any)[opts.type] || opts.type, contact, editionTitle: e?.content.title || '', editionId: r.editionId, extra });
  }
  return { id, ...r };
}

/** Save a reader's note on their intent event, then forward it to the sales team. */
export async function addNote(eventId: string, token: string, note: string): Promise<boolean> {
  const ev = get('SELECT * FROM events WHERE id = ?', eventId);
  const d = get('SELECT id FROM deliveries WHERE token = ?', token);
  if (!ev || !d || ev.delivery_id !== d.id) return false;
  const text = note.trim().slice(0, 1000);
  if (!text) return false;
  if (ev.meta && JSON.parse(ev.meta).note) return true; // one note per tap; re-posts don't alert again
  run('UPDATE events SET meta = ? WHERE id = ?', JSON.stringify({ ...(ev.meta ? JSON.parse(ev.meta) : {}), note: text }), eventId);
  let contact: any = null;
  if (ev.contact_id) {
    contact = get('SELECT * FROM contacts WHERE id = ?', ev.contact_id);
    update('contacts', ev.contact_id, { notes: `${contact?.notes ? contact.notes + '\n' : ''}[${new Date().toISOString().slice(0, 10)}] Reader note: ${text}` });
  }
  const e = getEdition(ev.edition_id);
  await alertIntent({ productId: ev.product_id, action: 'note', label: 'Left a note', contact, editionTitle: e?.content.title || '', editionId: ev.edition_id, note: text });
  return true;
}
