/* Monogram avatar with a calm, name-derived tint (server-safe). */
export function initials(name: string) {
  const parts = String(name || '').replace(/[^\p{L}\p{N}\s@.]/gu, ' ').trim().split(/[\s@.]+/).filter(Boolean);
  if (!parts.length) return '?';
  return ((parts[0][0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
export function hueOf(name: string) {
  let h = 0;
  for (const ch of String(name || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  // A curated set of hues that look good as gradients in both themes.
  const set = [211, 231, 262, 286, 330, 8, 24, 38, 152, 172, 192];
  return set[h % set.length];
}
export function Avatar({ name, size = 36, className = '' }: { name: string; size?: number; className?: string }) {
  const h = hueOf(name);
  return (
    <span className={`pav ${className}`} aria-hidden style={{ width: size, height: size, fontSize: Math.round(size * 0.38), ['--h' as any]: h }}>
      {initials(name)}
    </span>
  );
}
