import type { Product } from '../settings';
import type { Source } from '../types';

export const esc = (s: any) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export const paras = (s: string) => esc(s).split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');

export function brandVars(p: Product) {
  const b = p.brand;
  return { ink: b.primary || '#1d2340', acc: b.accent || '#b8862f', soft: b.soft || '#eef0f6' };
}
/** Readable text colour on a background hex. */
export function onColor(hex: string) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#141414' : '#ffffff';
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
