/* The one monogram avatar used everywhere (server-safe). Always pass the person's name; an email is only a fallback. */
export function initials(name: string) {
  let s = String(name || '').trim();
  // An email address: use its local part ("meera.shah@x.in" → "MS").
  if (/^[^\s@]+@[^\s@]+$/.test(s)) s = s.split('@')[0].replace(/[._+-]+/g, ' ');
  const parts = s.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return ((parts[0][0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
/** A calm, stable hue from a curated set that reads well in both themes. */
export function hueOf(name: string) {
  let h = 0;
  for (const ch of String(name || '').trim().toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const set = [211, 231, 262, 286, 330, 8, 24, 38, 152, 172, 192];
  return set[h % set.length];
}
export function Avatar({ name, size = 36, className = '' }: { name: string; size?: number; className?: string }) {
  return (
    <span className={`avatar pav ${className}`.trim()} aria-hidden style={{ width: size, height: size, fontSize: Math.round(size * 0.38), ['--h' as string]: hueOf(name) }}>
      {initials(name)}
    </span>
  );
}
