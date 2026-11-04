/* Content-area icons are the shell's canonical set (24 grid, 1.7 stroke). This module only maps the
   few legacy names the content pages use and adds the macOS-style colour Tile. Server-safe. */
import { Icon as Base, isIcon, type IconName as BaseName } from '@/components/shell/icons';

const ALIAS: Record<string, BaseName> = { x: 'close', sparkles: 'sparkle', envelope: 'mail', people: 'contacts', rss: 'sources' };
export type IconName = BaseName | keyof typeof ALIAS;

export function Icon({ name, size = 18, className, label, strokeWidth = 1.7 }: { name: string; size?: number; className?: string; label?: string; strokeWidth?: number }) {
  const n: BaseName = ALIAS[name] || (isIcon(name) ? name : 'info');
  return (
    <Base name={n} size={size} strokeWidth={strokeWidth} className={`ico cx-ic ${className || ''}`}
      aria-hidden={label ? undefined : true} role={label ? 'img' : undefined} aria-label={label} />
  );
}

/** Rounded-square colour tile with a white glyph: navigation and category only (Settings sections, job types). */
export function Tile({ icon, tone = 'gray', size = 'md' }: { icon: string; tone?: string; size?: 'sm' | 'md' | 'lg' }) {
  const px = size === 'lg' ? 22 : size === 'sm' ? 13 : 16;
  return <span className={`cx-tile t-${tone} s-${size}`} aria-hidden><Icon name={icon} size={px} strokeWidth={2} /></span>;
}
