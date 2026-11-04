import { imgKey } from '@/lib/crypto';
import { currentUser } from '@/lib/auth';
import { ImageResponse } from 'next/og';
import { getEdition } from '@/lib/editions';
import { getProduct } from '@/lib/settings';
import { brandVars, onColor } from '@/lib/render/common';

export const dynamic = 'force-dynamic';
const clean = (s: string) => s.replace(/₹/g, 'Rs ').replace(/[\u{1F300}-\u{1FAFF}]/gu, '');

/** 1200×630 link-preview image for WhatsApp, LinkedIn, Slack and email clients. */

async function visible(e: { id: string; status: string }, req: Request) {
  if (e.status === 'sent' || e.status === 'sending') return true;
  if (new URL(req.url).searchParams.get('k') === imgKey(e.id)) return true;
  return !!(await currentUser());
}
export async function GET(req: Request, { params }: { params: Promise<{ file: string }> }) {
  const id = (await params).file.replace(/\.png$/, '');
  const e = getEdition(id);
  if (!e || !(await visible(e, req))) return new Response('Not found', { status: 404 });
  const p = getProduct(e.product_id)!;
  const v = brandVars(p);
  const fg = onColor(v.ink);
  const title = clean(e.content.preview.title || e.content.title || p.newsletter_name);
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: v.ink, color: fg, padding: '64px 72px', fontFamily: 'serif' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 26, letterSpacing: 4, textTransform: 'uppercase', opacity: 0.85 }}>
          <span style={{ color: v.acc }}>{clean(p.newsletter_name)}</span><span>#{e.number}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {e.content.kicker ? <div style={{ fontSize: 28, color: v.acc, textTransform: 'uppercase', letterSpacing: 3 }}>{clean(e.content.kicker)}</div> : null}
          <div style={{ fontSize: title.length > 48 ? 64 : 76, lineHeight: 1.08, fontWeight: 700 }}>{title}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 26, opacity: 0.85 }}>
          <span style={{ fontWeight: 700 }}>{clean(p.name)}</span><span>{e.content.readMinutes} min read</span>
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 12, background: v.acc, display: 'flex' }} />
      </div>
    ),
    { width: 1200, height: 630, headers: { 'cache-control': 'public, max-age=300' } },
  );
}
