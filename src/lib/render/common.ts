import type { Product } from '../settings';
import type { Source } from '../types';

export const esc = (s: any) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export const paras = (s: string) => esc(s).split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');

const hex = (v: string, d: string) => (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(v || '') ? v : d);
export function brandVars(p: Product) {
  const b = p.brand;
  return { ink: hex(b.primary, '#1d2340'), acc: hex(b.accent, '#b8862f'), soft: hex(b.soft, '#eef0f6') };
}
const rgb = (hex: string) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const lum = (hex: string) => {
  const [r, g, b] = rgb(hex).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a: string, b: string) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
/** Black or white text, whichever has more contrast on the background (WCAG). */
export function onColor(bg: string) {
  return contrast(bg, '#ffffff') >= contrast(bg, '#141414') ? '#ffffff' : '#141414';
}
/** The brand colour, darkened (or lightened) just enough to be readable as text on `bg` (≥ 4.5:1). */
export function readableOn(color: string, bg: string, target = 4.5) {
  let [r, g, b] = rgb(color);
  const darken = lum(bg) > 0.4;
  for (let i = 0; i < 40 && contrast(`#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`, bg) < target; i++) {
    [r, g, b] = [r, g, b].map((v) => Math.round(darken ? v * 0.92 : v + (255 - v) * 0.12));
  }
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')}`;
}

export function youTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  return m ? m[1] : null;
}
export function vimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? m[1] : null;
}

export function sourceLine(ids: string[], sources: Source[], linkFn: (u: string) => string = (u) => u) {
  const list = ids.map((id) => sources.find((s) => s.id === id)).filter(Boolean) as Source[];
  if (!list.length) return '';
  return `Source: ${list.map((s) => `<a href="${esc(linkFn(s.url))}" target="_blank" rel="noopener">${esc(s.publisher || hostOf(s.url))}</a>`).join(' · ')}`;
}
export const hostOf = (u: string) => {
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; }
};

export function wordmark(p: Product) {
  const n = p.name;
  const cut = Math.ceil(n.length / 2);
  return [n.slice(0, cut), n.slice(cut)];
}
