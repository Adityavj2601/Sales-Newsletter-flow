import { api } from '@/lib/api';
import { callProvider, MODEL_DEFAULTS } from '@/lib/ai/providers';
import { verifySmtp } from '@/lib/mailer';
import { testWhatsApp } from '@/lib/send';
import { alertIntent } from '@/lib/alerts';
import { listProducts, type Provider } from '@/lib/settings';

export const POST = api(async ({ body }) => {
  if (body.what === 'ai') {
    const p = body.provider as Provider;
    const r = await callProvider(p, MODEL_DEFAULTS[p].fast, 'Reply with exactly: OK', [{ role: 'user', content: 'Say OK' }], { maxTokens: 20 });
    return { message: `Works · ${r.model} replied “${r.text.trim().slice(0, 20)}”` };
  }
  if (body.what === 'smtp') return { message: await verifySmtp() };
  if (body.what === 'wa') return { message: await testWhatsApp(String(body.to || '')) };
  if (body.what === 'alert') {
    const p = listProducts()[0];
    await alertIntent({ productId: p.id, action: 'interested', label: 'I’m interested (test)', contact: { id: 'test', first_name: 'Test', last_name: 'Reader', company: 'Sample Developers', email: 'test@example.com', phone: '+919800000000' }, editionTitle: 'Test alert', editionId: '' });
    return { message: 'Test alert sent to every configured channel (check the Outbox if SMTP is off).' };
  }
  throw new Error('Unknown test');
});
