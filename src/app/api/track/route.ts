import { track } from '@/lib/tracking';

/** Public beacon endpoint used by edition pages (views, scroll depth, polls, shares). */
export async function POST(req: Request) {
  try {
    const b = await req.json();
    const type = String(b.type || '');
    if (!['view', 'scroll', 'time', 'poll', 'share'].includes(type)) return new Response(null, { status: 204 });
    await track({ token: b.t ? String(b.t).slice(0, 20) : null, editionId: b.e ? String(b.e).slice(0, 40) : null, type, value: b.value == null ? null : String(b.value).slice(0, 200), meta: b.meta && typeof b.meta === 'object' ? b.meta : null });
  } catch { /* never break the reader's page */ }
  return new Response(null, { status: 204 });
}
