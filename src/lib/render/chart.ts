import type { Block } from '../types';
import { esc } from './common';

type Chart = Extract<Block, { type: 'chart' }>;
const fmt = (v: number, unit: string) => {
  const s = Math.abs(v) >= 1000 ? v.toLocaleString('en-IN') : String(Math.round(v * 100) / 100);
  return unit === '%' ? `${s}%` : unit && unit.length <= 3 ? `${unit === '₹' ? '₹' : ''}${s}${unit !== '₹' ? unit : ''}` : s;
};
function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

/** Inline SVG chart for the web page (scales to width, hover titles). */
export function chartSVG(b: Chart, col: { ink: string; acc: string }): string {
  const d = b.data;
  if (!d.length) return '';
  const max = niceMax(Math.max(...d.map((x) => x.value), 0));
  const min = Math.min(0, ...d.map((x) => x.value));
  const span = max - min || 1;
  const top = d.reduce((m, x, i) => (x.value > d[m].value ? i : m), 0);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => min + span * t);
  if (b.kind === 'bar') {
    const W = 600, L = 170, R = 70, rowH = 40, H = d.length * rowH + 30;
    const x = (v: number) => L + ((v - min) / span) * (W - L - R);
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(b.title)}">`;
    for (const t of ticks) s += `<line x1="${x(t)}" x2="${x(t)}" y1="0" y2="${H - 24}" stroke="#e3e6eb"/><text x="${x(t)}" y="${H - 6}" font-size="12" text-anchor="middle" fill="#626a76">${esc(fmt(t, b.unit))}</text>`;
    d.forEach((r, i) => {
      const y = i * rowH + 8;
      const x0 = x(Math.min(0, r.value)), w = Math.max(2, Math.abs(x(r.value) - x(0)));
      const hi = i === top;
      s += `<g><title>${esc(r.label)}: ${esc(fmt(r.value, b.unit))}</title><text x="${L - 10}" y="${y + 18}" font-size="14" text-anchor="end" fill="#20232a">${esc(r.label.length > 22 ? r.label.slice(0, 21) + '…' : r.label)}</text><rect class="bar" x="${x0}" y="${y}" width="${w}" height="26" rx="4" style="fill:${hi ? col.acc : col.ink}" opacity="${hi ? 1 : 0.4}"/><text x="${x(Math.max(0, r.value)) + 8}" y="${y + 18}" font-size="14" font-weight="600" fill="#20232a">${esc(fmt(r.value, b.unit))}</text></g>`;
    });
    return s + '</svg>';
  }
  const W = 600, H = 300, L = 50, R = 16, T = 24, B = 56;
  const y = (v: number) => T + (1 - (v - min) / span) * (H - T - B);
  const step = (W - L - R) / d.length;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(b.title)}">`;
  for (const t of ticks) s += `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" stroke="#e3e6eb"/><text x="${L - 8}" y="${y(t) + 4}" font-size="12" text-anchor="end" fill="#626a76">${esc(fmt(t, b.unit))}</text>`;
  const label = (r: { label: string }, i: number) => `<text x="${L + step * i + step / 2}" y="${H - B + 20}" font-size="12.5" text-anchor="middle" fill="#20232a">${esc(r.label.length > 12 ? r.label.slice(0, 11) + '…' : r.label)}</text>`;
  if (b.kind === 'column') {
    d.forEach((r, i) => {
      const hi = i === top;
      const bw = Math.min(56, step * 0.6), cx = L + step * i + step / 2;
      const y0 = y(Math.max(0, r.value)), h = Math.max(2, Math.abs(y(r.value) - y(0)));
      s += `<g><title>${esc(r.label)}: ${esc(fmt(r.value, b.unit))}</title><rect class="bar" x="${cx - bw / 2}" y="${y0}" width="${bw}" height="${h}" rx="4" style="fill:${hi ? col.acc : col.ink}" opacity="${hi ? 1 : 0.4}"/><text x="${cx}" y="${y0 - 7}" font-size="13" font-weight="600" text-anchor="middle" fill="#20232a">${esc(fmt(r.value, b.unit))}</text>${label(r, i)}</g>`;
    });
    return s + '</svg>';
  }
  const pts = d.map((r, i) => [L + step * i + step / 2, y(r.value)] as const);
  s += `<path d="M${pts.map((p) => p.join(',')).join(' L')} L${pts[pts.length - 1][0]},${y(min)} L${pts[0][0]},${y(min)} Z" style="fill:${col.ink}" opacity="0.08"/>`;
  s += `<polyline points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" style="stroke:${col.ink}" stroke-width="3" stroke-linejoin="round"/>`;
  d.forEach((r, i) => {
    const last = i === d.length - 1;
    s += `<g><title>${esc(r.label)}: ${esc(fmt(r.value, b.unit))}</title><circle cx="${pts[i][0]}" cy="${pts[i][1]}" r="${last ? 6 : 4}" style="fill:${last ? col.acc : col.ink}"/>${last || i === top ? `<text x="${pts[i][0]}" y="${pts[i][1] - 12}" font-size="13" font-weight="600" text-anchor="middle" fill="#20232a">${esc(fmt(r.value, b.unit))}</text>` : ''}${label(r, i)}</g>`;
  });
  return s + '</svg>';
}
