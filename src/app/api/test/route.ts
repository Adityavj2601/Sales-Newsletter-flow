import { api } from '@/lib/api';
import { callProvider, MODEL_DEFAULTS } from '@/lib/ai/providers';
import { verifySmtp } from '@/lib/mailer';
import { testWhatsApp } from '@/lib/send';
import { alertIntent } from '@/lib/alerts';
import { type Provider } from '@/lib/settings';
import { activeProduct } from '@/lib/context';

const friendly = (e: any) => {
  const m = String(e?.message || e);
  if (/401|invalid.*key|unauthori[sz]ed|incorrect api key/i.test(m)) return 'The key was rejected. Check you copied the whole key and that it’s active.';
  if (/ENOTFOUND|getaddrinfo/i.test(m)) return 'Couldn’t find that server. Check the host name.';
  if (/ECONNREFUSED/i.test(m)) return 'The server refused the connection. Check the host and port.';
  if (/ETIMEDOUT|timeout/i.test(m)) return 'The server didn’t answer in time. Check the port and your firewall.';
  if (/fetch failed/i.test(m)) return 'Couldn’t reach the service from this server. Check its internet access.';
  if (/535|auth/i.test(m)) return 'The username or password was rejected.';
  return m;
};
export const POST = api(async ({ body }) => { try {
  if (body.what === 'ai') {
    const p = body.provider as Provider;
    const r = await callProvider(p, MODEL_DEFAULTS[p].fast, 'Reply with exactly: OK', [{ role: 'user', content: 'Say OK' }], { maxTokens: 20 });
    return { message: `Works · ${r.model} replied “${r.text.trim().slice(0, 20)}”` };
  }
  if (body.what === 'smtp') return { message: await verifySmtp() };
  if (body.what === 'wa') return { message: await testWhatsApp(String(body.to || '')) };
  if (body.what === 'alert') {
    const p = (await activeProduct())!;
    await alertIntent({ productId: p.id, action: 'interested', label: 'I’m interested (test)', link: '/app/leads', contact: { id: 'test', first_name: 'Test', last_name: 'Reader', company: 'Sample Developers', email: 'test@example.com', phone: '+919800000000' }, editionTitle: 'Test alert', editionId: '' });
    return { message: 'Test alert sent to every configured channel (check the Outbox if SMTP is off).' };
  }
  throw new Error('Unknown test');
} catch (e: any) { throw new Error(friendly(e)); } });
