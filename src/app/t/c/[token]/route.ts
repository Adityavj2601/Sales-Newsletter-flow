import { track } from '@/lib/tracking';

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const tok = (await params).token;
  const u = new URL(req.url).searchParams.get('u') || '';
  if (!/^https?:\/\//i.test(u)) return new Response('Bad link', { status: 400 });
  await track({ token: tok, type: 'click', value: u.slice(0, 300) }).catch(() => null);
  return Response.redirect(u, 302);
}
