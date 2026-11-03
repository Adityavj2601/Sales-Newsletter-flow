import { NextResponse } from 'next/server';
import { tick } from '@/lib/jobs';

export const maxDuration = 300;
export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get('key') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!process.env.CRON_KEY || key !== process.env.CRON_KEY) return NextResponse.json({ error: 'Set CRON_KEY and pass ?key=' }, { status: 401 });
  return NextResponse.json(await tick());
}
export const POST = GET;
