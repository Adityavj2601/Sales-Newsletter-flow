import { get, insert, run, uid, now, update } from './db';
import { getEdition } from './editions';
import { alertIntent } from './alerts';
import { CTA_LABELS } from './types';

/** Points added to a contact's lead score the first time they do something for an edition. */
export const SCORE: Record<string, number> = {
  open: 1, click: 3, view: 5, 'scroll:75': 5, poll: 10, share: 15, more: 15, showcase: 30, book: 40, interested: 50, notnow: -10, unsubscribe: -100, wa_reply: 20,
};
export const INTENTS = new Set(['interested', 'book', 'showcase', 'more']);
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

const ALLOWED = new Set(['open', 'click', 'view', 'scroll', 'time', 'poll', 'share', 'interested', 'book', 'more', 'notnow', 'showcase', 'unsubscribe', 'resubscribe', 'note', 'wa_reply']);

/** Record an event; updates delivery status, lead score, stage and fires alerts for intent. */
export async function track(opts: { token?: string | null; editionId?: string | null; type: string; value?: string | null; meta?: any }) {
  if (!ALLOWED.has(opts.type)) return null;
  const r = resolveToken(opts.token, opts.editionId);
  if (!r.editionId) return null;
  const t = now();
  const scoreKey = opts.type === 'scroll' ? `scroll:${opts.value}` : opts.type;
  // Only the first occurrence per delivery and type counts for scoring and alerts.
  const firstTime = r.delivery
    ? !get('SELECT id FROM events WHERE delivery_id = ? AND type = ? AND COALESCE(value, \'\') = COALESCE(?, \'\') LIMIT 1', r.delivery.id, opts.type, opts.type === 'scroll' || opts.type === 'showcase' ? opts.value ?? null : null)
    : true;
  const id = uid('ev_');
  insert('events', { id, product_id: r.productId, edition_id: r.editionId, contact_id: r.contact?.id || null, delivery_id: r.delivery?.id || null, type: opts.type, value: opts.value ?? null, meta: opts.meta ? JSON.stringify(opts.meta).slice(0, 2000) : null, created_at: t });

  if (r.delivery) {
    const rank: Record<string, number> = { queued: 0, failed: 0, sent: 1, delivered: 2, opened: 3, clicked: 4 };
    const next = opts.type === 'open' ? 'opened' : ['click', 'view', 'scroll', 'poll', 'interested', 'book', 'more', 'showcase', 'share'].includes(opts.type) ? 'clicked' : null;
    if (next && (rank[next] ?? 0) > (rank[r.delivery.status] ?? 0)) update('deliveries', r.delivery.id, { status: next });
  }
  if (r.contact && firstTime) {
    const pts = SCORE[scoreKey] ?? 0;
    const patch: any = { last_engaged_at: t };
    if (pts) patch.score = Math.max(0, (r.contact.score || 0) + pts);
    if (INTENTS.has(opts.type)) {
      patch.last_intent = opts.type;
      patch.last_intent_at = t;
      if (r.contact.stage === 'new') patch.stage = 'warm';
    }
    if (opts.type === 'notnow') patch.frequency = 'less';
    if (opts.type === 'unsubscribe') {
      // WhatsApp "STOP" only ends WhatsApp; the email footer link ends everything.
      if (opts.meta?.channel === 'whatsapp') patch.wa_consent = 0;
      else Object.assign(patch, { status: 'unsubscribed', email_consent: 0, wa_consent: 0 });
    }
    update('contacts', r.contact.id, patch);
  }
  if (INTENTS.has(opts.type) && firstTime && opts.type !== 'more') {
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

export function addNote(eventId: string, token: string, note: string) {
  const ev = get('SELECT * FROM events WHERE id = ?', eventId);
  const d = get('SELECT id FROM deliveries WHERE token = ?', token);
  if (!ev || (ev.delivery_id && ev.delivery_id !== d?.id)) return false;
  run('UPDATE events SET meta = ? WHERE id = ?', JSON.stringify({ ...(ev.meta ? JSON.parse(ev.meta) : {}), note: note.slice(0, 1000) }), eventId);
  if (ev.contact_id) {
    const c = get('SELECT notes FROM contacts WHERE id = ?', ev.contact_id);
    update('contacts', ev.contact_id, { notes: `${c?.notes ? c.notes + '\n' : ''}[${new Date().toISOString().slice(0, 10)}] Reader note: ${note.slice(0, 1000)}` });
  }
  return true;
}
