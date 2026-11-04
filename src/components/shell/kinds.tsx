import { Icon, type IconName } from './icons';

/** Notification kinds → icon + tint. */
const KINDS: Record<string, [IconName, string]> = {
  intent: ['leads', 'orange'], draft: ['editions', 'blue'], send: ['send', 'green'], stories: ['stories', 'indigo'],
  nudge: ['hand', 'yellow'], report: ['chart', 'purple'], error: ['warn', 'red'], note: ['note', 'teal'],
};
export function KindIcon({ kind, title = '', size = 32 }: { kind: string; title?: string; size?: number }) {
  const k = kind === 'intent' && /^📝/u.test(title) ? 'note' : kind;
  const [icon, tint] = KINDS[k] || ['bell', 'gray'];
  return <span className={`kind kind-${tint}`} style={{ width: size, height: size }} aria-hidden><Icon name={icon} size={Math.round(size * 0.53)} /></span>;
}
/** Titles sometimes start with an emoji; the icon tile replaces it visually. */
export const cleanTitle = (t: string) => typo(String(t || '')).replace(/^\s*(\p{Extended_Pictographic}|\p{Emoji_Modifier}|‍|️)+\s*/u, '');
/** Typographic quotes for stored copy shown in the UI: "x" → “x”, it's → it’s. */
export const typo = (t: string | null | undefined) => String(t ?? '')
  .replace(/(^|[\s([{—–-])"/g, '$1“').replace(/"/g, '”')
  .replace(/(^|[\s([{—–-])'/g, '$1‘').replace(/'/g, '’');
