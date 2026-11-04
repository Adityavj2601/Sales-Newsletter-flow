import { insert, uid, now } from './db';
import { getSetting, getProduct, baseUrl } from './settings';
import { sendMail } from './mailer';
import { esc } from './render/common';
import { assertPublicUrl } from './web';

const postJSON = async (url: string, body: any) => { await assertPublicUrl(url); return fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); };

export function notify(productId: string | null, kind: string, title: string, body = '', link = '') {
  insert('notifications', { id: uid('n_'), product_id: productId, kind, title, body, link, read_at: null, created_at: now() });
}

/** High-intent signal: in-app notification + email + Slack + webhook (each only if configured). Never throws. */
export async function alertIntent(payload: {
  productId: string; action: string; label: string; contact: any | null; editionTitle: string; editionId: string; note?: string; extra?: string; link?: string;
}) {
  const p = getProduct(payload.productId);
  const who = payload.contact ? `${[payload.contact.first_name, payload.contact.last_name].filter(Boolean).join(' ') || payload.contact.email || payload.contact.phone}${payload.contact.company ? ` (${payload.contact.company})` : ''}` : 'An anonymous reader';
  const title = payload.action === 'note' ? `📝 ${who} left a note` : `🔥 ${who} tapped “${payload.label}”`;
  const body = `${payload.editionTitle}${payload.extra ? ` · ${payload.extra}` : ''}${payload.note ? ` · Note: “${payload.note}”` : ''}`;
  const link = payload.link || (payload.contact ? `/app/contacts/${payload.contact.id}` : `/app/editions/${payload.editionId}/analytics`);
  notify(payload.productId, 'intent', title, body, link);
  const a = getSetting('alerts');
  const to = [p?.brand.alertEmail, ...a.alertEmails.split(',')].map((s) => (s || '').trim()).filter(Boolean);
  const base = baseUrl();
  const contactLines = payload.contact ? [
    payload.contact.email && `Email: ${payload.contact.email}`,
    payload.contact.phone && `Phone / WhatsApp: ${payload.contact.phone}`,
    payload.contact.role && `Role: ${payload.contact.role}`,
    payload.contact.city && `City: ${payload.contact.city}`,
  ].filter(Boolean) as string[] : [];
  const tasks: Promise<any>[] = [];
  if (to.length) {
    const wa = payload.contact?.phone ? `https://wa.me/${String(payload.contact.phone).replace(/\D/g, '')}` : '';
    tasks.push(sendMail({
      to: [...new Set(to)].join(','), kind: 'alert', subject: `${title} · ${p?.name || ''}`,
      html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5"><p style="font-size:18px"><b>${esc(title)}</b></p><p>${esc(body)}</p>${contactLines.map((l) => `<div>${esc(l)}</div>`).join('')}<p>${wa ? `<a href="${wa}">Open WhatsApp chat</a> · ` : ''}<a href="${base}${link}">Open in Brief Studio</a></p><p style="color:#666">Tip: reply within the hour. Interest fades fast.</p></div>`,
      text: `${title}\n${body}\n${contactLines.join('\n')}\n${base}${link}`,
    }).catch(() => null));
  }
  if (a.slackWebhook) tasks.push(postJSON(a.slackWebhook, { text: `${title}\n${body}\n${contactLines.join(' · ')}\n<${base}${link}|Open in Brief Studio>` }).catch(() => null));
  if (a.webhookUrl) tasks.push(postJSON(a.webhookUrl, { event: 'intent', action: payload.action, label: payload.label, note: payload.note || null, product: p ? { id: p.id, name: p.name } : null, edition: { id: payload.editionId, title: payload.editionTitle }, contact: payload.contact ? { id: payload.contact.id, firstName: payload.contact.first_name, lastName: payload.contact.last_name, email: payload.contact.email, phone: payload.contact.phone, company: payload.contact.company, role: payload.contact.role, city: payload.contact.city, score: payload.contact.score } : null, at: now() }).catch(() => null));
  await Promise.all(tasks);
}
