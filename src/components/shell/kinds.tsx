import { Icon, type IconName } from './icons';

/** Notification kinds → icon + tint. */
const KINDS: Record<string, [IconName, string]> = {
  intent: ['leads', 'green'], draft: ['editions', 'blue'], send: ['send', 'green'], stories: ['stories', 'indigo'],
  nudge: ['hand', 'yellow'], report: ['chart', 'purple'], error: ['warn', 'red'], note: ['note', 'teal'],
};
export function KindIcon({ kind, title = '', size = 32 }: { kind: string; title?: string; size?: number }) {
  const k = kind === 'intent' && /^📝/u.test(title) ? 'note' : kind;
  const [icon, tint] = KINDS[k] || ['bell', 'gray'];
  return <span className={`kind kind-${tint}`} style={{ width: size, height: size }} aria-hidden><Icon name={icon} size={Math.round(size * 0.53)} /></span>;
}
/** Titles sometimes start with an emoji; the icon tile replaces it visually. Stored titles predate the label
 *  rule, so “Edition #5 sent” / “Sending edition #5” read as “#5 sent” / “Sending #5”, like the rest of the UI. */
export const cleanTitle = (t: string) => typo(String(t || ''))
  .replace(/^\s*(\p{Extended_Pictographic}|\p{Emoji_Modifier}|‍|️)+\s*/u, '')
  .replace(/\b[Ee]dition #(\d+)/g, '#$1');
/** Typographic quotes for stored copy shown in the UI: "x" → “x”, it's → it’s. */
export const typo = (t: string | null | undefined) => String(t ?? '')
  .replace(/(^|[\s([{—–-])"/g, '$1“').replace(/"/g, '”')
  .replace(/(^|[\s([{—–-])'/g, '$1‘').replace(/'/g, '’');
