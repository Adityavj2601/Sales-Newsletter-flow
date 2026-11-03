import { NextResponse } from 'next/server';
import { apiUser, type User } from './auth';

/** Wrap an authenticated JSON API handler: auth, JSON body, error → {error}. */
export function api<P = any>(fn: (ctx: { user: User; body: any; params: P; req: Request }) => Promise<any>) {
  return async (req: Request, ctx: { params: Promise<P> }) => {
    try {
      const user = await apiUser();
      let body: any = {};
      if (req.method !== 'GET' && (req.headers.get('content-type') || '').includes('json')) body = await req.json().catch(() => ({}));
      const out = await fn({ user, body, params: await ctx.params, req });
      return out instanceof Response ? out : NextResponse.json(out ?? { ok: true });
    } catch (e: any) {
      if (e instanceof Response) return e;
      console.error('[api]', e);
      return NextResponse.json({ error: String(e?.message || e) }, { status: 400 });
    }
  };
}
