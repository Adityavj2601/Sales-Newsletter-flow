import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { decrypt } from '@/lib/crypto';
import { getSetting } from '@/lib/settings';
import { get, all, update } from '@/lib/db';
import { track } from '@/lib/tracking';

/** Meta webhook verification. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const w = getSetting('whatsapp');
  if (u.searchParams.get('hub.mode') === 'subscribe' && w.verifyToken && u.searchParams.get('hub.verify_token') === w.verifyToken) return new Response(u.searchParams.get('hub.challenge') || '', { status: 200 });
  return new Response('Forbidden', { status: 403 });
}

/** Map a free-text WhatsApp reply to an action. Negatives are checked first; unclear replies are just "replied". */
function classifyReply(text: string): string {
  const t = text.toLowerCase().trim();
  if (/^(stop|unsubscribe|opt ?out|remove me)\b/.test(t)) return 'unsubscribe';
  if (/\b(not|no|don'?t|do not|never)\b.{0,20}\b(interest|interested|now|today|thanks|need)/.test(t) || /^(no|nope|not now|later)\b/.test(t)) return 'notnow';
  if (/^(yes|yeah|yep|interested|sure|ok(ay)?)\b/.test(t) || /\b(i am|i'm|we are|we're) interested\b|\b(book|schedule) a (call|demo)\b|\bcall me\b(?! later)|\bsend (me )?(the )?details\b/.test(t)) return 'interested';
  return 'wa_reply';
}

/** Delivery statuses and replies (quick-reply buttons, STOP, free text). */
export async function POST(req: Request) {
  // Only Meta may post here: verify X-Hub-Signature-256 (HMAC-SHA256 of the raw body with the App Secret).
  const raw = await req.text();
  const secret = decrypt(getSetting('whatsapp').appSecret);
  if (!secret) return NextResponse.json({ error: 'Set the Meta App Secret in Settings → WhatsApp first.' }, { status: 403 });
  const sig = (req.headers.get('x-hub-signature-256') || '').replace(/^sha256=/, '');
  const want = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  if (sig.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return NextResponse.json({ error: 'Bad signature' }, { status: 401 });
  let body: any = {};
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Bad JSON' }, { status: 400 }); }
  for (const entry of body.entry || []) for (const ch of entry.changes || []) {
    const v = ch.value || {};
    for (const st of v.statuses || []) {
      const d = get('SELECT id, status FROM deliveries WHERE provider_id = ?', st.id);
      if (!d) continue;
      if (st.status === 'failed' && ['queued', 'sent'].includes(d.status)) update('deliveries', d.id, { status: 'failed', error: st.errors?.[0]?.title || 'Failed' });
      else if (st.status === 'delivered' && d.status === 'sent') update('deliveries', d.id, { status: 'delivered' });
      else if (st.status === 'read' && ['sent', 'delivered'].includes(d.status)) update('deliveries', d.id, { status: 'opened' });
    }
    for (const m of v.messages || []) {
      const from = String(m.from || '').replace(/\D/g, '');
      const payload: string = m.button?.payload || m.interactive?.button_reply?.id || '';
      const text: string = (m.button?.text || m.text?.body || m.interactive?.button_reply?.title || '').trim();
      const contacts = all("SELECT id, phone FROM contacts").filter((c) => String(c.phone || '').replace(/\D/g, '') === from);
      let action = payload.includes(':') ? payload.split(':')[0] : '';
      if (!action) action = classifyReply(text);
      // STOP always works, even for someone we never messaged on WhatsApp.
      if (action === 'unsubscribe') for (const c of contacts) update('contacts', c.id, { wa_consent: 0 });
      let tok: string | null = payload.includes(':') ? payload.split(':')[1] : null;
      if (!tok && contacts.length) {
        const d = get(`SELECT token FROM deliveries WHERE contact_id IN (${contacts.map(() => '?').join(',')}) AND channel IN ('whatsapp','wa_manual') ORDER BY created_at DESC LIMIT 1`, ...contacts.map((x) => x.id));
        tok = d?.token || null;
      }
      if (!tok) continue;
      await track({ token: tok, type: action, value: text.slice(0, 200), meta: { channel: 'whatsapp', text: text.slice(0, 500) } });
    }
  }
  return NextResponse.json({ ok: true });
}
