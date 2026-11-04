import { get } from '@/lib/db';
import { track, isBot } from '@/lib/tracking';
import { linkSig } from '@/lib/crypto';
import { baseUrl } from '@/lib/settings';

/** Tracked click. Redirects only to signed URLs, or to URLs that appear in the delivery's edition. */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const tok = (await params).token;
  const sp = new URL(req.url).searchParams;
  const u = sp.get('u') || '';
  if (!/^https?:\/\//i.test(u)) return new Response('Bad link', { status: 400 });
  const d = get('SELECT edition_id FROM deliveries WHERE token = ?', tok);
  let allowed = !!d && sp.get('s') === linkSig(tok, u);
  if (!allowed && d) {
    const e = get('SELECT e.content, e.slug, p.slug AS ps FROM editions e JOIN products p ON p.id = e.product_id WHERE e.id = ?', d.edition_id);
    const base = baseUrl(new URL(req.url).origin);
    let urls: string[] = [];
    try {
      const c = JSON.parse(e?.content || '{}');
      urls = [...(c.sources || []).map((s: any) => s.url), ...(c.blocks || []).flatMap((b: any) => [b.url, b.mediaUrl])].filter(Boolean);
    } catch { /* ignore */ }
    allowed = !!e && (urls.includes(u) || u.startsWith(`${base}/e/${e.ps}/`) || u === `${base}/e/${e.ps}`);
  }
  if (!allowed) {
    const safe = u.replace(/[<>"&]/g, '');
    return new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Leaving</title><body style="font:16px system-ui;margin:40px auto;max-width:520px;padding:0 16px"><p>This link points outside the newsletter:</p><p style="word-break:break-all"><b>${safe}</b></p><p><a href="${safe}" rel="noopener noreferrer nofollow">Continue</a></p></body>`, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
  }
  if (req.method !== 'HEAD' && !isBot(req.headers.get('user-agent'))) await track({ token: tok, type: 'click', value: u.slice(0, 300) }).catch(() => null);
  return Response.redirect(u, 302);
}
