/* SF Symbols–style line icons (24px grid, 1.7 stroke). Server-safe, decorative by default. */
const P: Record<string, React.ReactNode> = {
  star: <path d="M12 3.6l2.55 5.2 5.75.84-4.16 4.05.98 5.72L12 16.7l-5.12 2.7.98-5.72L3.7 9.64l5.75-.84z" />,
  x: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  link: <><path d="M10.2 13.8a3.9 3.9 0 0 0 5.5 0l3-3a3.9 3.9 0 0 0-5.5-5.5l-1.1 1.1" /><path d="M13.8 10.2a3.9 3.9 0 0 0-5.5 0l-3 3a3.9 3.9 0 0 0 5.5 5.5l1.1-1.1" /></>,
  search: <><circle cx="11" cy="11" r="6.3" /><path d="M15.7 15.7l4.6 4.6" /></>,
  refresh: <><path d="M19.4 12.6a7.5 7.5 0 1 1-2.1-6.1" /><path d="M19.5 4.2v4.6h-4.6" /></>,
  arrowUpRight: <path d="M8 16L16 8M9.5 8H16v6.5" />,
  trash: <><path d="M4.5 7h15M9.5 7V5.2c0-.4.3-.7.7-.7h3.6c.4 0 .7.3.7.7V7" /><path d="M6.6 7l.9 11.4c.1 1 .9 1.6 1.8 1.6h5.4c.9 0 1.7-.6 1.8-1.6L17.4 7" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2L5.5 5.5" /></>,
  palette: <><path d="M12 3.2a8.8 8.8 0 1 0 0 17.6c1 0 1.6-.7 1.6-1.6 0-1.1-.9-1.4-.9-2.4 0-.9.7-1.6 1.6-1.6h2.1a4 4 0 0 0 4-4c0-4.4-3.9-8-8.4-8z" /><circle cx="7.6" cy="11.4" r="1" fill="currentColor" /><circle cx="10.2" cy="7.4" r="1" fill="currentColor" /><circle cx="14.8" cy="7.6" r="1" fill="currentColor" /></>,
  sparkles: <><path d="M10.5 3.5l1.7 4.8 4.8 1.7-4.8 1.7-1.7 4.8-1.7-4.8L4 10l4.8-1.7z" /><path d="M18 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" /></>,
  envelope: <><rect x="3" y="5.5" width="18" height="13" rx="2.6" /><path d="M3.8 7.2l8.2 6 8.2-6" /></>,
  chat: <path d="M12 4c4.6 0 8.2 3.1 8.2 7s-3.6 7-8.2 7c-1 0-1.9-.1-2.8-.4L5 19.5l1-3.6C4.6 14.6 3.8 12.9 3.8 11 3.8 7.1 7.4 4 12 4z" />,
  bell: <><path d="M6.2 16.2V11a5.8 5.8 0 1 1 11.6 0v5.2l1.6 2H4.6z" /><path d="M10 20.4a2.1 2.1 0 0 0 4 0" /></>,
  people: <><circle cx="9" cy="8.2" r="3.2" /><path d="M3.2 19c.8-3.2 3-4.9 5.8-4.9s5 1.7 5.8 4.9" /><circle cx="17" cy="9.2" r="2.4" /><path d="M16.6 14.1c2.2.1 3.7 1.4 4.3 3.6" /></>,
  database: <><ellipse cx="12" cy="6" rx="7" ry="2.8" /><path d="M5 6v12c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V6" /><path d="M5 12c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8" /></>,
  newspaper: <><rect x="3.8" y="4.2" width="13" height="15.6" rx="2" /><path d="M16.8 8.2h2.6c.4 0 .8.4.8.8v8.6a2.2 2.2 0 0 1-2.2 2.2H6" /><path d="M7.4 8.4h6M7.4 11.8h6M7.4 15.2h3.6" /></>,
  pencil: <><path d="M4.5 19.5l.9-3.9L15.8 5.2a1.9 1.9 0 0 1 2.7 0l.3.3a1.9 1.9 0 0 1 0 2.7L8.4 18.6z" /><path d="M14 7l3 3" /></>,
  send: <><path d="M20.5 3.5L10.2 13.8" /><path d="M20.5 3.5l-6.3 17-4-6.7-6.7-4z" /></>,
  chart: <path d="M5 20v-8M10 20V5M15 20v-6M20 20V9" />,
  globe: <><circle cx="12" cy="12" r="8.6" /><path d="M3.6 12h16.8M12 3.4c2.3 2.5 3.5 5.4 3.5 8.6s-1.2 6.1-3.5 8.6c-2.3-2.5-3.5-5.4-3.5-8.6S9.7 5.9 12 3.4z" /></>,
  plus: <path d="M12 5.5v13M5.5 12h13" />,
  check: <path d="M5.5 12.6l4.2 4.2 8.8-9.4" />,
  clock: <><circle cx="12" cy="12" r="8.4" /><path d="M12 7.6V12l2.9 1.9" /></>,
  rss: <><path d="M5.5 4.8A13.7 13.7 0 0 1 19.2 18.5M5.5 10.6a7.9 7.9 0 0 1 7.9 7.9" /><circle cx="6.5" cy="17.5" r="1.3" fill="currentColor" stroke="none" /></>,
  key: <><circle cx="8" cy="15" r="3.8" /><path d="M10.8 12.3l8-8M16 7l2.4 2.4M13.8 9.2l1.8 1.8" /></>,
  lock: <><rect x="5" y="10.5" width="14" height="9.8" rx="2.4" /><path d="M8.3 10.5V8a3.7 3.7 0 0 1 7.4 0v2.5" /></>,
  bolt: <path d="M13.2 3L5.5 13.6h6l-1 7.4 7.8-10.7h-6z" />,
  play: <path d="M8 5.6v12.8a.6.6 0 0 0 .9.5l10.3-6.4a.6.6 0 0 0 0-1L8.9 5.1a.6.6 0 0 0-.9.5z" fill="currentColor" stroke="none" />,
  download: <path d="M12 4v11M7.6 10.8L12 15.2l4.4-4.4M5 19.6h14" />,
  doc: <><path d="M7 3.5h6.5L18 8v11.2c0 .7-.6 1.3-1.3 1.3H7c-.7 0-1.3-.6-1.3-1.3V4.8c0-.7.6-1.3 1.3-1.3z" /><path d="M13.3 3.6V8H18M9 12.5h6M9 16h4" /></>,
  building: <><path d="M4.5 20.5V6.2L12 3.5v17" /><path d="M12 9h7.5v11.5M3 20.5h18M7.5 8.5h1.5M7.5 12h1.5M7.5 15.5h1.5M15 12.5h1.5M15 16h1.5" /></>,
  box: <><path d="M12 3.3l8 4.4v8.6l-8 4.4-8-4.4V7.7z" /><path d="M4.3 7.9L12 12.2l7.7-4.3M12 12.2v8.4" /></>,
  bulb: <><path d="M9.2 17.6h5.6M10.2 20.8h3.6" /><path d="M12 3.2a6 6 0 0 0-3.6 10.8c.6.5 1 1.3 1 2.1v.4h5.2v-.4c0-.8.4-1.6 1-2.1A6 6 0 0 0 12 3.2z" /></>,
  chevron: <path d="M9.5 6l6 6-6 6" />,
  info: <><circle cx="12" cy="12" r="8.6" /><path d="M12 11v5.2" /><circle cx="12" cy="7.9" r=".6" fill="currentColor" /></>,
  warn: <><path d="M10.4 4.4L3.2 17.2c-.7 1.2.2 2.7 1.6 2.7h14.4c1.4 0 2.3-1.5 1.6-2.7L13.6 4.4c-.7-1.2-2.5-1.2-3.2 0z" /><path d="M12 9.5v4.2" /><circle cx="12" cy="16.7" r=".6" fill="currentColor" /></>,
  copy: <><rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2.4" /><path d="M15.5 8.5V6.4c0-1.3-1.1-2.4-2.4-2.4H6.4C5.1 4 4 5.1 4 6.4v6.7c0 1.3 1.1 2.4 2.4 2.4h2.1" /></>,
  phone: <><rect x="7" y="3" width="10" height="18" rx="2.6" /><path d="M10.8 18h2.4" /></>,
  slack: <path d="M9.5 3.5v7M14.5 13.5v7M3.5 14.5h7M13.5 9.5h7" />,
  webhook: <><circle cx="6.5" cy="17" r="2.2" /><circle cx="17.5" cy="17" r="2.2" /><circle cx="12" cy="7" r="2.2" /><path d="M8.7 17h6.6M11 9l-3.4 6.1M13 9l3.4 6.1" /></>,
};
export type IconName = keyof typeof P;

export function Icon({ name, size = 18, className, label, strokeWidth = 1.7 }: { name: string; size?: number; className?: string; label?: string; strokeWidth?: number }) {
  return (
    <svg className={`cx-ic ${className || ''}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden={label ? undefined : true} role={label ? 'img' : undefined} aria-label={label}>
      {P[name] || P.info}
    </svg>
  );
}

/** Rounded-square colour tile with a white glyph, like macOS System Settings. */
export function Tile({ icon, tone = 'gray', size = 'md' }: { icon: string; tone?: string; size?: 'sm' | 'md' | 'lg' }) {
  const px = size === 'lg' ? 22 : size === 'sm' ? 13 : 16;
  return <span className={`cx-tile t-${tone} s-${size}`} aria-hidden><Icon name={icon} size={px} strokeWidth={2} /></span>;
}
