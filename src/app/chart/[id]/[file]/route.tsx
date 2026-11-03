import { ImageResponse } from 'next/og';
import { getEdition } from '@/lib/editions';
import { getProduct } from '@/lib/settings';
import { brandVars } from '@/lib/render/common';

export const dynamic = 'force-dynamic';
const fmt = (v: number, unit: string) => {
  const s = Math.abs(v) >= 1000 ? v.toLocaleString('en-IN') : String(Math.round(v * 100) / 100);
  return unit === '%' ? `${s}%` : unit === '₹' ? `Rs ${s}` : s;
};

/** Static PNG of a chart block for email clients (which can't run SVG/JS). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string; file: string }> }) {
  const { id, file } = await params;
  const e = getEdition(id);
  const b: any = e?.content.blocks.find((x) => x.id === file.replace(/\.png$/, '') && x.type === 'chart');
  if (!e || !b) return new Response('Not found', { status: 404 });
  const v = brandVars(getProduct(e.product_id)!);
  const max = Math.max(...b.data.map((d: any) => Math.abs(d.value)), 1);
  const top = b.data.reduce((m: number, x: any, i: number) => (x.value > b.data[m].value ? i : m), 0);
  const W = 1088;
  const vertical = b.kind !== 'bar';
  return new ImageResponse(
    vertical ? (
      <div style={{ width: '100%', height: '100%', background: '#fff', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', padding: '40px 30px 20px' }}>
        {b.data.map((d: any, i: number) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, width: `${90 / b.data.length}%` }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#20232a' }}>{fmt(d.value, b.unit)}</div>
            <div style={{ width: '70%', height: Math.max(6, (Math.abs(d.value) / max) * 340), background: i === top ? v.acc : v.ink, opacity: i === top ? 1 : 0.45, borderRadius: 8 }} />
            <div style={{ fontSize: 22, color: '#20232a', textAlign: 'center' }}>{String(d.label).replace(/₹/g, 'Rs ')}</div>
          </div>
        ))}
      </div>
    ) : (
      <div style={{ width: '100%', height: '100%', background: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 18, padding: '30px 40px' }}>
        {b.data.map((d: any, i: number) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{ width: 300, fontSize: 26, color: '#20232a', display: 'flex', justifyContent: 'flex-end' }}>{String(d.label).replace(/₹/g, 'Rs ')}</div>
            <div style={{ width: Math.max(8, (Math.abs(d.value) / max) * (W - 520)), height: 40, background: i === top ? v.acc : v.ink, opacity: i === top ? 1 : 0.45, borderRadius: 8 }} />
            <div style={{ fontSize: 26, fontWeight: 700, color: '#20232a' }}>{fmt(d.value, b.unit)}</div>
          </div>
        ))}
      </div>
    ),
    { width: W, height: vertical ? 520 : Math.max(240, b.data.length * 58 + 60), headers: { 'cache-control': 'public, max-age=3600' } },
  );
}
