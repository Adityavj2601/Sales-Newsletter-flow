import { get, run, all, parse } from './db';
import { encrypt, decrypt } from './crypto';

export type Provider = 'anthropic' | 'openai' | 'gemini' | 'openrouter';
export const PROVIDERS: Provider[] = ['anthropic', 'openai', 'gemini', 'openrouter'];
export type Task = 'draft' | 'edit' | 'fast' | 'factcheck';
export type Route = { provider: Provider | 'auto'; model: string };

export type General = {
  appName: string;
  publicBaseUrl: string;
  timezone: string;
  sendDay: number; // 0 = Sunday … 4 = Thursday
  sendTime: string; // HH:MM in timezone
  emailsPerMinute: number;
};
export type AISettings = {
  keys: Partial<Record<Provider, string>>; // encrypted
  routing: Record<Task, Route>;
  monthlyTokenLimit: number; // 0 = no limit
};
export type SMTP = { host: string; port: number; secure: boolean; user: string; pass: string; from: string };
export type WhatsApp = {
  phoneNumberId: string; token: string; wabaId: string; templateName: string; templateLang: string;
  verifyToken: string; apiVersion: string; appSecret: string;
  headerImage: boolean; bodyParams: string; button: 'quick_reply' | 'url' | 'none';
};
export type Alerts = { alertEmails: string; slackWebhook: string; webhookUrl: string };

const DEFAULTS = {
  general: <General>{ appName: 'Brief Studio', publicBaseUrl: '', timezone: 'Asia/Kolkata', sendDay: 4, sendTime: '10:00', emailsPerMinute: 30 },
  ai: <AISettings>{
    keys: {},
    routing: {
      draft: { provider: 'auto', model: '' },
      edit: { provider: 'auto', model: '' },
      fast: { provider: 'auto', model: '' },
      factcheck: { provider: 'auto', model: '' },
    },
    monthlyTokenLimit: 0,
  },
  smtp: <SMTP>{ host: '', port: 587, secure: false, user: '', pass: '', from: '' },
  whatsapp: <WhatsApp>{ phoneNumberId: '', token: '', wabaId: '', templateName: '', templateLang: 'en', verifyToken: '', apiVersion: 'v21.0', appSecret: '', headerImage: true, bodyParams: 'first_name,title', button: 'quick_reply' },
  alerts: <Alerts>{ alertEmails: '', slackWebhook: '', webhookUrl: '' },
};
type Keys = keyof typeof DEFAULTS;

export function getSetting<K extends Keys>(key: K): (typeof DEFAULTS)[K] {
  const row = get('SELECT value FROM settings WHERE key = ?', key);
  const val = parse<any>(row?.value, {});
  const d: any = DEFAULTS[key];
  const merged: any = { ...d, ...val };
  if (key === 'ai') merged.routing = { ...d.routing, ...(val.routing || {}) };
  return merged;
}
export function setSetting<K extends Keys>(key: K, value: (typeof DEFAULTS)[K]) {
  run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, JSON.stringify(value));
}

export function providerKey(p: Provider): string {
  return decrypt(getSetting('ai').keys[p]);
}
export function setProviderKey(p: Provider, plain: string) {
  const ai = getSetting('ai');
  if (plain) ai.keys[p] = encrypt(plain.trim());
  else delete ai.keys[p];
  setSetting('ai', ai);
}
export const smtpPass = () => decrypt(getSetting('smtp').pass);
export const waToken = () => decrypt(getSetting('whatsapp').token);
export const smtpReady = () => {
  const s = getSetting('smtp');
  return !!(s.host && s.from);
};
export const waReady = () => {
  const w = getSetting('whatsapp');
  return !!(w.phoneNumberId && w.token && w.templateName);
};

/** Public base URL without trailing slash. */
export function baseUrl(fallback?: string): string {
  const ok = (v?: string) => !!v && /^https?:\/\/[^\s"'<>]+$/i.test(v);
  const cands = [getSetting('general').publicBaseUrl, process.env.PUBLIC_BASE_URL, fallback, 'http://localhost:3000'];
  return (cands.find(ok) as string).replace(/\/+$/, '');
}

/* ---------- Products ---------- */
export type Brand = {
  primary: string; accent: string; soft: string; logoUrl: string;
  tagline: string; about: string; icp: string; tone: string; bannedWords: string; signOff: string;
  senderName: string; senderEmail: string; replyTo: string; address: string;
  bookingUrl: string; contactWhatsApp: string; alertEmail: string;
};
export type Product = {
  id: string; slug: string; name: string; website: string; newsletter_name: string; brand: Brand; sort: number;
};
export const BRAND_DEFAULT: Brand = {
  primary: '#1d2340', accent: '#b8862f', soft: '#eef0f6', logoUrl: '', tagline: '', about: '', icp: '',
  tone: 'Confident, crisp and useful. Short sentences. Plain English with Indian business context. Never salesy, no hype words.',
  bannedWords: 'revolutionary, best-in-class, game-changer, synergy, leading provider, guaranteed, limited time, act now',
  signOff: '', senderName: '', senderEmail: '', replyTo: '', address: '', bookingUrl: '', contactWhatsApp: '', alertEmail: '',
};
const toProduct = (r: any): Product => ({ ...r, brand: { ...BRAND_DEFAULT, ...parse(r.brand, {}) } });
export const listProducts = (): Product[] => all('SELECT * FROM products ORDER BY sort, name').map(toProduct);
export const getProduct = (id: string): Product | null => {
  const r = get('SELECT * FROM products WHERE id = ? OR slug = ?', id, id);
  return r ? toProduct(r) : null;
};
