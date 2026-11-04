/* SF Symbols–style line icons (20×20, currentColor) and per-block metadata for the editor. */
import type { BlockType } from '@/lib/types';

type P = { size?: number; className?: string };
const S = ({ size = 18, className, children, sw = 1.6 }: P & { children: React.ReactNode; sw?: number }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden focusable="false">{children}</svg>
);

export const I = {
  list: (p: P) => <S {...p}><circle cx="4" cy="5.5" r="1" fill="currentColor" stroke="none" /><circle cx="4" cy="10" r="1" fill="currentColor" stroke="none" /><circle cx="4" cy="14.5" r="1" fill="currentColor" stroke="none" /><path d="M7.5 5.5h9M7.5 10h9M7.5 14.5h6" /></S>,
  number: (p: P) => <S {...p}><path d="M8 3.5 6.5 16.5M13.5 3.5 12 16.5M4 7.5h12.5M3.5 12.5H16" /></S>,
  news: (p: P) => <S {...p}><rect x="3" y="3.5" width="14" height="13" rx="2.2" /><path d="M6 7h8M6 10h8M6 13h5" /></S>,
  chart: (p: P) => <S {...p}><path d="M3.5 16.5h13" /><rect x="5" y="9" width="2.4" height="5.5" rx=".8" /><rect x="8.8" y="5.5" width="2.4" height="9" rx=".8" /><rect x="12.6" y="11" width="2.4" height="3.5" rx=".8" /></S>,
  star: (p: P) => <S {...p}><path d="m10 3 2.1 4.4 4.7.6-3.4 3.3.8 4.7L10 13.8 5.8 16l.8-4.7L3.2 8l4.7-.6L10 3Z" /></S>,
  play: (p: P) => <S {...p}><rect x="2.5" y="4" width="15" height="12" rx="2.6" /><path d="m8.5 7.6 4 2.4-4 2.4V7.6Z" fill="currentColor" /></S>,
  photo: (p: P) => <S {...p}><rect x="2.5" y="4" width="15" height="12" rx="2.4" /><circle cx="7" cy="8" r="1.4" /><path d="m3 14.5 4.2-3.8 3 2.6 2.6-2.2 4.2 3.6" /></S>,
  quote: (p: P) => <S {...p}><path d="M4 10.5c0-3 1.6-5 4-5.5M4 10.5h3.4v4H4v-4ZM11.5 10.5c0-3 1.6-5 4-5.5M11.5 10.5h3.4v4h-3.4v-4Z" /></S>,
  text: (p: P) => <S {...p}><path d="M3.5 5h13M3.5 8.5h13M3.5 12h13M3.5 15.5h8" /></S>,
  poll: (p: P) => <S {...p}><rect x="3" y="3.5" width="14" height="13" rx="2.4" /><path d="M6 7.5h5M6 10h8M6 12.5h3" /></S>,
  tap: (p: P) => <S {...p}><path d="M8 9V4.6a1.4 1.4 0 0 1 2.8 0V9l3.3.6c1 .2 1.7 1.1 1.6 2.1l-.4 3.4a2 2 0 0 1-2 1.8H9.6a2 2 0 0 1-1.6-.8l-2.6-3.4a1.3 1.3 0 0 1 1.9-1.8L8 11.6" /></S>,
  doc: (p: P) => <S {...p}><path d="M5 2.8h6.5L15 6.3V16a1.2 1.2 0 0 1-1.2 1.2H5A1.2 1.2 0 0 1 3.8 16V4A1.2 1.2 0 0 1 5 2.8Z" /><path d="M11.2 3v3.5H15M6.5 10h6M6.5 13h4" /></S>,
  link: (p: P) => <S {...p}><path d="M8.6 11.4a3 3 0 0 0 4.3 0l2.4-2.4a3 3 0 0 0-4.3-4.3l-.9.9" /><path d="M11.4 8.6a3 3 0 0 0-4.3 0L4.7 11a3 3 0 0 0 4.3 4.3l.9-.9" /></S>,
  sparkle: (p: P) => <S {...p}><path d="M10 2.8c.5 3.6 1.7 4.8 5.2 5.3-3.5.5-4.7 1.7-5.2 5.3-.5-3.6-1.7-4.8-5.2-5.3 3.5-.5 4.7-1.7 5.2-5.3Z" fill="currentColor" stroke="none" /><path d="M15.5 12.8c.2 1.4.7 1.9 2 2.1-1.3.2-1.8.7-2 2.1-.2-1.4-.7-1.9-2-2.1 1.3-.2 1.8-.7 2-2.1Z" fill="currentColor" stroke="none" /></S>,
  up: (p: P) => <S {...p}><path d="M10 15.5v-11M5.5 9 10 4.5 14.5 9" /></S>,
  down: (p: P) => <S {...p}><path d="M10 4.5v11M5.5 11l4.5 4.5 4.5-4.5" /></S>,
  trash: (p: P) => <S {...p}><path d="M3.8 5.5h12.4M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M5.4 5.5l.7 10.3a1.3 1.3 0 0 0 1.3 1.2h5.2a1.3 1.3 0 0 0 1.3-1.2l.7-10.3" /></S>,
  close: (p: P) => <S {...p}><path d="m5.5 5.5 9 9M14.5 5.5l-9 9" /></S>,
  chevron: (p: P) => <S {...p}><path d="m7.5 4.5 5.5 5.5-5.5 5.5" /></S>,
  back: (p: P) => <S {...p}><path d="M12.5 4.5 7 10l5.5 5.5" /></S>,
  grip: (p: P) => <S {...p} sw={0}>{[6, 10, 14].flatMap((y) => [7.5, 12.5].map((x) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.25" fill="currentColor" />))}</S>,
  plus: (p: P) => <S {...p}><path d="M10 4v12M4 10h12" /></S>,
  check: (p: P) => <S {...p} sw={2}><path d="m4.5 10.5 3.5 3.5 7.5-8" /></S>,
  more: (p: P) => <S {...p} sw={0}><circle cx="4.5" cy="10" r="1.5" fill="currentColor" /><circle cx="10" cy="10" r="1.5" fill="currentColor" /><circle cx="15.5" cy="10" r="1.5" fill="currentColor" /></S>,
  external: (p: P) => <S {...p}><path d="M11 3.5h5.5V9M16.3 3.7 9 11M14 12v3a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 15V7.5A1.5 1.5 0 0 1 5 6h3" /></S>,
  sidebar: (p: P) => <S {...p}><rect x="2.5" y="3.5" width="15" height="13" rx="2.4" /><path d="M12.5 3.8v12.4" /></S>,
  send: (p: P) => <S {...p} sw={2}><path d="M10 15.5V4.5M5.5 9 10 4.5 14.5 9" /></S>,
  clock: (p: P) => <S {...p}><circle cx="10" cy="10" r="7" /><path d="M10 6v4l2.6 1.6" /></S>,
  shield: (p: P) => <S {...p}><path d="M10 2.8 4 5v4.6c0 3.6 2.6 6.4 6 7.6 3.4-1.2 6-4 6-7.6V5l-6-2.2Z" /><path d="m7.4 10 1.9 1.9 3.4-3.6" /></S>,
  history: (p: P) => <S {...p}><path d="M3.6 10a6.4 6.4 0 1 0 1.9-4.6M3.4 3.6v2.6H6" /><path d="M10 6.6V10l2.4 1.5" /></S>,
  copy: (p: P) => <S {...p}><rect x="6.5" y="6.5" width="10" height="10" rx="2" /><path d="M13.5 6.5V5a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 5v7A1.5 1.5 0 0 0 5 13.5h1.5" /></S>,
  save: (p: P) => <S {...p}><path d="M4.8 3h8.4L17 6.8v8.4a1.8 1.8 0 0 1-1.8 1.8H4.8A1.8 1.8 0 0 1 3 15.2V4.8A1.8 1.8 0 0 1 4.8 3Z" /><path d="M6.5 3v4h6V3M6.5 17v-5h7v5" /></S>,
  keyboard: (p: P) => <S {...p}><rect x="2.5" y="5" width="15" height="10" rx="2" /><path d="M5.5 8h.01M8.5 8h.01M11.5 8h.01M14.5 8h.01M6.5 12h7" /></S>,
  collapse: (p: P) => <S {...p}><path d="m6 4 4 3.5L14 4M6 16l4-3.5 4 3.5" /></S>,
  calendar: (p: P) => <S {...p}><rect x="3" y="4" width="14" height="13" rx="2.4" /><path d="M3 8h14M7 2.5v3M13 2.5v3" /></S>,
  search: (p: P) => <S {...p}><circle cx="8.8" cy="8.8" r="5.3" /><path d="m12.8 12.8 3.7 3.7" /></S>,
  warn: (p: P) => <S {...p}><path d="M10 3.2 2.8 16h14.4L10 3.2Z" /><path d="M10 8.2v3.6M10 14h.01" /></S>,
  refresh: (p: P) => <S {...p}><path d="M16 10a6 6 0 1 1-1.8-4.3M16 3.5v3.2h-3.2" /></S>,
  mail: (p: P) => <S {...p}><rect x="2.5" y="4.5" width="15" height="11" rx="2.2" /><path d="m3 5.5 7 5.5 7-5.5" /></S>,
};

export const BLOCK_META: Record<BlockType, { icon: (p: P) => React.ReactElement; tint: string; desc: string }> = {
  tldr: { icon: I.list, tint: 'blue', desc: 'Three bullets for the skimmers' },
  stat: { icon: I.number, tint: 'orange', desc: 'One big number with context' },
  story: { icon: I.news, tint: 'indigo', desc: 'News + why it matters for sales' },
  chart: { icon: I.chart, tint: 'green', desc: 'Bars, columns or a trend line' },
  showcase: { icon: I.star, tint: 'pink', desc: 'A feature or project from Our work' },
  video: { icon: I.play, tint: 'red', desc: 'YouTube, Vimeo or an .mp4' },
  image: { icon: I.photo, tint: 'teal', desc: 'Your own image or chart' },
  quote: { icon: I.quote, tint: 'purple', desc: 'A line from a person or source' },
  text: { icon: I.text, tint: 'gray', desc: 'Heading and free text' },
  poll: { icon: I.poll, tint: 'yellow', desc: 'One tap reveals intent' },
  cta: { icon: I.tap, tint: 'accent', desc: 'Interested · Book 15 min · More' },
};

export function BlockIcon({ type, size = 16 }: { type: BlockType; size?: number }) {
  const m = BLOCK_META[type];
  const Ico = m.icon;
  return <span className={`bi t-${m.tint}`} aria-hidden><Ico size={size} /></span>;
}
