import { NextResponse } from 'next/server';
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

/** Delivery statuses and replies (quick-reply buttons, STOP, free text). */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  for (const entry of body.entry || []) for (const ch of entry.changes || []) {
    const v = ch.value || {};
    for (const st of v.statuses || []) {
      const d = get('SELECT id, status FROM deliveries WHERE provider_id = ?', st.id);
      if (!d) continue;
      if (st.status === 'failed') update('deliveries', d.id, { status: 'failed', error: st.errors?.[0]?.title || 'Failed' });
      else if (st.status === 'delivered' && d.status === 'sent') update('deliveries', d.id, { status: 'delivered' });
      else if (st.status === 'read' && ['sent', 'delivered'].includes(d.status)) { update('deliveries', d.id, { status: 'opened' }); }
    }
    for (const m of v.messages || []) {
      const from = String(m.from || '').replace(/\D/g, '');
      const payload: string = m.button?.payload || m.interactive?.button_reply?.id || '';
      const text: string = (m.button?.text || m.text?.body || m.interactive?.button_reply?.title || '').trim();
      let tok = payload.includes(':') ? payload.split(':')[1] : null;
      let action = payload.split(':')[0] || '';
      if (!tok) {
        // fall back to the latest WhatsApp delivery to this number
        const c = all("SELECT id FROM contacts WHERE replace(replace(phone, '+', ''), ' ', '') = ?", from);
        const d = c.length ? get(`SELECT token FROM deliveries WHERE contact_id IN (${c.map(() => '?').join(',')}) AND channel IN ('whatsapp','wa_manual') ORDER BY created_at DESC LIMIT 1`, ...c.map((x) => x.id)) : null;
        tok = d?.token || null;
      }
      if (!tok) continue;
      if (!action) action = /^(stop|unsubscribe)\b/i.test(text) ? 'unsubscribe' : /interest|yes|demo|call|tell me/i.test(text) ? 'interested' : /not now|later|no\b/i.test(text) ? 'notnow' : 'wa_reply';
      await track({ token: tok, type: action, value: text.slice(0, 200), meta: { channel: 'whatsapp', text: text.slice(0, 500) } });
    }
  }
  return NextResponse.json({ ok: true });
}
