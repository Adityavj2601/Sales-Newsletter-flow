import { track } from '@/lib/tracking';

const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
export async function GET(_: Request, { params }: { params: Promise<{ file: string }> }) {
  const tok = (await params).file.replace(/\.gif$/, '');
  track({ token: tok, type: 'open' }).catch(() => null);
  return new Response(GIF, { headers: { 'content-type': 'image/gif', 'cache-control': 'no-store, max-age=0' } });
}
