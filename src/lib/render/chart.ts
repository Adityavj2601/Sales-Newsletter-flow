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
const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Responsive chart for the web page. Bars and columns are HTML (crisp, real font sizes on any
 * phone); the line is an SVG path with HTML points and labels. Values are labelled directly,
 * the highest (or latest, for lines) is highlighted in the brand accent, and the whole figure
 * has a text alternative. Animation hooks: the page adds `.in` when the figure scrolls into view.
 */
export function chartHTML(b: Chart): string {
  const d = b.data;
  if (!d.length) return '';
  const max = niceMax(Math.max(...d.map((x) => x.value), 0));
  const min = Math.min(0, ...d.map((x) => x.value));
  const span = max - min || 1;
  const top = d.reduce((m, x, i) => (x.value > d[m].value ? i : m), 0);
  const pct = (v: number) => ((v - min) / span) * 100;
  const z = pct(0);
  const aria = `${b.title}. ${d.map((r) => `${r.label}: ${fmt(r.value, b.unit)}`).join('; ')}`;
  const open = (cls: string, style = '') => `<figure class="plot ${cls}" role="img" aria-label="${esc(aria)}"${style ? ` style="${style}"` : ''}>`;

  if (b.kind === 'bar') {
    const rows = d.map((r, i) => {
      const lo = pct(Math.min(0, r.value)), w = Math.max(0.8, Math.abs(pct(r.value) - z));
      return `<div class="hb${i === top ? ' hi' : ''}" style="--i:${i}"><div class="hb-h"><span class="hb-l">${esc(r.label)}</span><span class="hb-v">${esc(fmt(r.value, b.unit))}</span></div><div class="hb-t"><i${r.value < 0 ? ' class="neg"' : ''} style="left:${r2(lo)}%;width:${r2(w)}%"></i>${min < 0 ? `<b style="left:${r2(z)}%"></b>` : ''}</div></div>`;
    }).join('');
    return `${open('bars')}${rows}</figure>`;
  }

  if (b.kind === 'column') {
    const cols = d.map((r, i) => {
      const lo = pct(Math.min(0, r.value)), h = Math.max(0.8, Math.abs(pct(r.value) - z));
      const neg = r.value < 0;
      const pos = neg ? `top:calc(${r2(100 - lo)}% + 6px)` : `bottom:calc(${r2(lo + h)}% + 6px)`;
      return `<div class="cl${i === top ? ' hi' : ''}" style="--i:${i}"><div class="cl-p"><i${neg ? ' class="neg"' : ''} style="bottom:${r2(lo)}%;height:${r2(h)}%"></i><span class="cl-v" style="${pos}">${esc(fmt(r.value, b.unit))}</span></div><span class="cl-l">${esc(r.label)}</span></div>`;
    }).join('');
    return `${open(`cols${d.length > 6 ? ' dense' : ''}`, `--z:${r2(z)}%`)}<div class="cl-w">${cols}</div></figure>`;
  }

  // Line: x at the centre of each label column, y in % of the plot height.
  const n = d.length, step = 100 / n;
  const pts = d.map((r, i) => [r2(step * i + step / 2), r2(8 + (1 - (r.value - min) / span) * 84)] as const);
  const line = `M${pts.map((p) => p.join(',')).join(' L')}`;
  const area = `${line} L${pts[n - 1][0]},100 L${pts[0][0]},100 Z`;
  const gid = `lg-${String(b.id).replace(/[^\w-]/g, '')}`;
  let s = `${open(`ln${n > 7 ? ' dense' : ''}`)}<div class="ln-p"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--chart-hi);stop-opacity:.26"/><stop offset="1" style="stop-color:var(--chart-hi);stop-opacity:0"/></linearGradient></defs><path class="ln-a" d="${area}" fill="url(#${gid})"/><path class="ln-l" d="${line}" vector-effect="non-scaling-stroke"/></svg>`;
  d.forEach((r, i) => {
    const last = i === n - 1;
    s += `<span class="ln-d${last ? ' hi' : ''}" style="left:${pts[i][0]}%;top:${pts[i][1]}%;--i:${i}"></span>`;
    if (last || i === top) s += `<span class="ln-v${last ? ' hi' : ''}" style="left:${pts[i][0]}%;top:${pts[i][1]}%">${esc(fmt(r.value, b.unit))}</span>`;
  });
  s += `</div><div class="ln-x">${d.map((r) => `<span>${esc(r.label)}</span>`).join('')}</div></figure>`;
  return s;
}

/** @deprecated kept for older imports; the web chart is now HTML + SVG. */
export const chartSVG = (b: Chart, _col?: { ink: string; acc: string }) => chartHTML(b);
