import nodemailer from 'nodemailer';
import { getSetting, smtpPass, smtpReady } from './settings';
import { insert, uid, now } from './db';

export type Mail = { to: string; subject: string; html: string; text?: string; from?: string; replyTo?: string; headers?: Record<string, string>; kind: 'edition' | 'test' | 'alert' | 'report' };

let transport: nodemailer.Transporter | null = null;
let transportKey = '';
function getTransport() {
  const s = getSetting('smtp');
  const key = JSON.stringify([s.host, s.port, s.secure, s.user, s.pass]);
  if (!transport || key !== transportKey) {
    transport = nodemailer.createTransport({ host: s.host, port: Number(s.port) || 587, secure: !!s.secure, auth: s.user ? { user: s.user, pass: smtpPass() } : undefined, pool: true, maxConnections: 3 });
    transportKey = key;
  }
  return transport;
}

/** Sends through SMTP when configured; otherwise stores the message in the in-app Outbox so the flow still works end to end. */
export async function sendMail(m: Mail): Promise<{ id: string; outbox: boolean }> {
  const s = getSetting('smtp');
  if (!smtpReady()) {
    const id = uid('ob_');
    insert('outbox', { id, to_addr: m.to, subject: m.subject, html: m.html, text: m.text || '', headers: JSON.stringify(m.headers || {}), kind: m.kind, created_at: now() });
    return { id, outbox: true };
  }
  const info = await getTransport().sendMail({ from: m.from || s.from, to: m.to, subject: m.subject, html: m.html, text: m.text, replyTo: m.replyTo, headers: m.headers });
  return { id: String(info.messageId || ''), outbox: false };
}

export async function verifySmtp(): Promise<string> {
  if (!smtpReady()) throw new Error('Add the SMTP host and From address first.');
  await getTransport().verify();
  return getSetting('smtp').user ? 'Connected. The server accepted the login.' : 'Connected (no login used).';
}
