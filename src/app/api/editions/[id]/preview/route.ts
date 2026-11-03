import { api } from '@/lib/api';
import { getEdition } from '@/lib/editions';
import { getProduct, baseUrl, getSetting } from '@/lib/settings';
import { normalizeContent } from '@/lib/types';
import { renderWeb } from '@/lib/render/web';
import { renderEmail, renderWhatsApp } from '@/lib/render/email';

export const POST = api<{ id: string }>(async ({ params, body, req }) => {
  const e = getEdition(params.id);
  if (!e) throw new Error('Edition not found');
  const p = getProduct(e.product_id)!;
  const draft = { ...e, content: body.content ? normalizeContent(body.content) : e.content };
  const base = baseUrl(new URL(req.url).origin);
  const tz = getSetting('general').timezone;
  if (body.view === 'email') return new Response(renderEmail(draft, p, null, { base, tz }), { headers: { 'content-type': 'text/html; charset=utf-8' } });
  if (body.view === 'wa') return { text: renderWhatsApp(draft, p, `${base}/e/${p.slug}/${e.slug}?r=abc123`, 'Rohan'), og: `${base}/og/${e.id}.png?v=${Date.now()}`, title: draft.content.preview.title, description: draft.content.preview.description, host: base.replace(/^https?:\/\//, '') };
  return new Response(renderWeb(draft, p, { base, preview: true, firstName: 'Rohan', tz }), { headers: { 'content-type': 'text/html; charset=utf-8' } });
});
