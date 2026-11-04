import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './db';

let cached: Buffer | null = null;

/** 32-byte app secret: APP_SECRET env, else generated once into DATA_DIR/secret.key. */
export function appSecret(): Buffer {
  if (cached) return cached;
  const env = process.env.APP_SECRET;
  if (env && env.length >= 16) {
    cached = crypto.createHash('sha256').update(env).digest();
    return cached;
  }
  const file = path.join(DATA_DIR, 'secret.key');
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
  cached = crypto.createHash('sha256').update(fs.readFileSync(file, 'utf8').trim()).digest();
  return cached;
}

/** AES-256-GCM. Output: v1.<iv>.<tag>.<ciphertext> (base64url). */
export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', appSecret(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), enc.toString('base64url')].join('.');
}
export function decrypt(blob: string | null | undefined): string {
  if (!blob) return '';
  const [v, iv, tag, data] = blob.split('.');
  if (v !== 'v1') return '';
  try {
    const d = crypto.createDecipheriv('aes-256-gcm', appSecret(), Buffer.from(iv, 'base64url'));
    d.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([d.update(Buffer.from(data, 'base64url')), d.final()]).toString('utf8');
  } catch {
    return '';
  }
}
export const mask = (s: string) => (!s ? '' : s.length <= 12 ? '••••••••' : `${s.slice(0, 4)}…${s.slice(-4)}`);

export function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(pw, salt, 32);
  return `s1$${salt.toString('base64url')}$${key.toString('base64url')}`;
}
export function verifyPassword(pw: string, stored: string): boolean {
  const [v, salt, key] = stored.split('$');
  if (v !== 's1') return false;
  const k = crypto.scryptSync(pw, Buffer.from(salt || '', 'base64url'), 32);
  const want = Buffer.from(key || '', 'base64url');
  return k.length === want.length && crypto.timingSafeEqual(k, want);
}

export function sign(payload: object): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', appSecret()).update(body).digest('base64url');
  return `${body}.${mac}`;
}
export function unsign<T = any>(tok: string | undefined): T | null {
  if (!tok) return null;
  const [body, mac] = tok.split('.');
  if (!body || !mac) return null;
  const want = crypto.createHmac('sha256', appSecret()).update(body).digest('base64url');
  if (want.length !== mac.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(mac))) return null;
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}
export const sha1 = (s: string) => crypto.createHash('sha1').update(s).digest('hex');

/** Short signature binding a tracked-click URL to a delivery token (prevents open redirects). */
export function linkSig(tok: string, url: string): string {
  return crypto.createHmac('sha256', appSecret()).update(`${tok}|${url}`).digest('base64url').slice(0, 16);
}

/** Key that lets image routes render an unsent edition (preview cards, email charts in test sends). */
export const imgKey = (editionId: string) => linkSig('img', editionId);
