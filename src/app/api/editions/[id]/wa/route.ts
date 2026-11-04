import { api } from '@/lib/api';
import { manualWhatsApp, markManualSent } from '@/lib/send';

export const POST = api<{ id: string }>(async ({ params, body }) => {
  if (body.deliveryId) { markManualSent(params.id, String(body.deliveryId)); return { ok: true }; }
  const r = manualWhatsApp(params.id, body.contactId);
  return { url: r.url, text: r.text, deliveryId: r.delivery.id };
});
