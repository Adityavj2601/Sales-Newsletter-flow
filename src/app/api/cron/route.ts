import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { tick } from '@/lib/jobs';

export const maxDuration = 300;
export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get('key') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const want = process.env.CRON_KEY || '';
  const ok = !!want && !!key && key.length === want.length && crypto.timingSafeEqual(Buffer.from(key), Buffer.from(want));
  if (!ok) return NextResponse.json({ error: 'Set CRON_KEY and pass ?key=' }, { status: 401 });
  return NextResponse.json(await tick());
}
export const POST = GET;
