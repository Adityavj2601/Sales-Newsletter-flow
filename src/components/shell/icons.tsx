/* The app's one icon set. SF-Symbols-style line icons: 24-unit grid, 1.7 stroke, round caps. Server-safe.
   Area icon modules (e.g. components/content/icons) re-export these so every glyph shares one geometry. */
import type { SVGProps } from 'react';

const PATHS = {
  home: <><path d="M4 10.5 12 4l8 6.5" /><path d="M6 9v9.5a1.5 1.5 0 0 0 1.5 1.5H10v-5.5h4V20h2.5a1.5 1.5 0 0 0 1.5-1.5V9" /></>,
  stories: <><rect x="4" y="4.5" width="16" height="15" rx="2.5" /><path d="M8 9h8M8 12.5h8M8 16h5" /></>,
  editions: <><path d="M7 3.8h7.2L19 8.6V18a2.2 2.2 0 0 1-2.2 2.2H7A2.2 2.2 0 0 1 4.8 18V6A2.2 2.2 0 0 1 7 3.8Z" /><path d="M14 4v4.8h4.8" /><path d="M8.5 13h7M8.5 16.5h4.5" /></>,
  leads: <><path d="M12 3c.4 3.4 5.8 5.6 5.8 11a5.8 5.8 0 0 1-11.6 0c0-2.8 1.5-4.5 2.6-5.7.2 1.6.9 2.6 2 3.1C10.6 8.6 11 5.9 12 3Z" /><path d="M12 20a2.3 2.3 0 0 1-2.3-2.3c0-1.5 1.2-2.3 2.3-3.7 1.1 1.4 2.3 2.2 2.3 3.7A2.3 2.3 0 0 1 12 20Z" /></>,
  knowledge: <><path d="M12 6.5c-1.8-1.4-4.2-2-7.5-2v13c3.3 0 5.7.6 7.5 2 1.8-1.4 4.2-2 7.5-2v-13c-3.3 0-5.7.6-7.5 2Z" /><path d="M12 6.5v13" /></>,
  contacts: <><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19.5c.6-3 2.8-4.8 5.5-4.8s4.9 1.8 5.5 4.8" /><path d="M15.5 5.6a3 3 0 0 1 0 5.8M17.5 14.9c1.6.6 2.7 2.2 3 4.6" /></>,
  sources: <><path d="M5 5a14 14 0 0 1 14 14" /><path d="M5 10.5a8.5 8.5 0 0 1 8.5 8.5" /><circle cx="6" cy="18" r="1.4" fill="currentColor" stroke="none" /></>,
  automations: <><circle cx="12" cy="12" r="8.2" /><path d="M12 7.5V12l3 2" /></>,
  bell: <><path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.8H5l1.5-1.8Z" /><path d="M10 20.5a2.2 2.2 0 0 0 4 0" /></>,
  tray: <><path d="M4 13.5 6.4 6a1.5 1.5 0 0 1 1.4-1h8.4a1.5 1.5 0 0 1 1.4 1L20 13.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4.5Z" /><path d="M4 13.5h4.5a3.5 3.5 0 0 0 7 0H20" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18 6l-1.6 1.6M7.6 16.4 6 18M18 18l-1.6-1.6M7.6 7.6 6 6" /></>,
  help: <><circle cx="12" cy="12" r="8.2" /><path d="M9.6 9.6a2.5 2.5 0 0 1 4.9.7c0 1.7-2.5 2.1-2.5 3.7" /><circle cx="12" cy="16.9" r=".9" fill="currentColor" stroke="none" /></>,
  search: <><circle cx="10.8" cy="10.8" r="6" /><path d="m15.4 15.4 4.4 4.4" /></>,
  menu: <><path d="M4.5 7h15M4.5 12h15M4.5 17h15" /></>,
  close: <><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  chevron: <><path d="m9.5 6 6 6-6 6" /></>,
  chevronDown: <><path d="m6.5 9.5 5.5 5.5 5.5-5.5" /></>,
  chevronLeft: <><path d="m14.5 6-6 6 6 6" /></>,
  updown: <><path d="m8 9.5 4-4 4 4M8 14.5l4 4 4-4" /></>,
  arrowUpRight: <><path d="M8 16 16 8M9.5 8H16v6.5" /></>,
  check: <><path d="m5.5 12.5 4 4 9-9.5" /></>,
  signout: <><path d="M14 4.5H7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h7" /><path d="M10.5 12H20M16.8 8.5 20.3 12l-3.5 3.5" /></>,
  upload: <><path d="M12 15.5V4.5M7.5 9 12 4.5 16.5 9" /><path d="M4.5 14.5V18a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3.5" /></>,
  sparkle: <><path d="M12 3.5c.6 4.3 2.2 5.9 6.5 6.5-4.3.6-5.9 2.2-6.5 6.5-.6-4.3-2.2-5.9-6.5-6.5 4.3-.6 5.9-2.2 6.5-6.5Z" /><path d="M18.5 15.5c.2 1.6.9 2.3 2.5 2.5-1.6.2-2.3.9-2.5 2.5-.2-1.6-.9-2.3-2.5-2.5 1.6-.2 2.3-.9 2.5-2.5Z" /></>,
  send: <><path d="M20 4 10.5 13.5" /><path d="M20 4 14 20.5l-3.5-7-7-3.5L20 4Z" /></>,
  chart: <><path d="M4.5 4.5v15h15" /><path d="M8.5 15v-3.5M12.5 15V8M16.5 15v-5.5" /></>,
  warn: <><path d="M10.4 4.8a1.8 1.8 0 0 1 3.2 0l6.7 12.3a1.8 1.8 0 0 1-1.6 2.7H5.3a1.8 1.8 0 0 1-1.6-2.7l6.7-12.3Z" /><path d="M12 9.5v4" /><circle cx="12" cy="16.6" r=".9" fill="currentColor" stroke="none" /></>,
  hand: <><path d="M8 12.5V6.8a1.4 1.4 0 0 1 2.8 0v4.7M10.8 11V5.3a1.4 1.4 0 0 1 2.8 0V11M13.6 11V6.3a1.4 1.4 0 0 1 2.8 0v6.2M16.4 10.5a1.4 1.4 0 0 1 2.8 0v3.6a6.4 6.4 0 0 1-6.4 6.4h-.6a6 6 0 0 1-4.6-2.2L4.8 14.9a1.4 1.4 0 0 1 2.1-1.8L8 14.3" /></>,
  note: <><path d="M5 5.5A1.5 1.5 0 0 1 6.5 4h11A1.5 1.5 0 0 1 19 5.5v9L14.5 19h-8A1.5 1.5 0 0 1 5 17.5v-12Z" /><path d="M14.5 19v-3a1.5 1.5 0 0 1 1.5-1.5h3M8.5 8.5h7M8.5 11.5h5" /></>,
  mail: <><rect x="3.5" y="5.5" width="17" height="13" rx="2.5" /><path d="m4.5 7 7.5 6 7.5-6" /></>,
  calendar: <><rect x="4" y="5.5" width="16" height="14.5" rx="2.5" /><path d="M4 10h16M8.5 3.5v3.5M15.5 3.5v3.5" /></>,
  eye: <><path d="M2.8 12S6 5.8 12 5.8 21.2 12 21.2 12 18 18.2 12 18.2 2.8 12 2.8 12Z" /><circle cx="12" cy="12" r="2.8" /></>,
  eyeOff: <><path d="M4 4l16 16" /><path d="M9.9 6.1A9 9 0 0 1 12 5.8c6 0 9.2 6.2 9.2 6.2a15 15 0 0 1-2.6 3.4M6.4 7.6A15 15 0 0 0 2.8 12S6 18.2 12 18.2c1.5 0 2.8-.4 4-1" /><path d="M10 10a2.8 2.8 0 0 0 4 4" /></>,
  lock: <><rect x="5" y="10.5" width="14" height="9.5" rx="2.2" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></>,
  person: <><circle cx="12" cy="8.5" r="3.6" /><path d="M5 20c.8-3.6 3.6-5.6 7-5.6s6.2 2 7 5.6" /></>,
  globe: <><circle cx="12" cy="12" r="8.2" /><path d="M3.8 12h16.4M12 3.8c2.2 2.3 3.3 5 3.3 8.2s-1.1 5.9-3.3 8.2c-2.2-2.3-3.3-5-3.3-8.2s1.1-5.9 3.3-8.2Z" /></>,
  bolt: <><path d="M13 3.5 5.5 13.5H12l-1 7 7.5-10H12l1-7Z" /></>,
  whatsapp: <><path d="M4.5 19.5 5.6 16A8 8 0 1 1 8.4 18.6l-3.9.9Z" /><path d="M9.2 8.7c.2-.4.6-.5.9-.4l.6 1.4c.1.2 0 .4-.1.6l-.4.5c.5 1.1 1.4 2 2.6 2.6l.5-.4c.2-.1.4-.2.6-.1l1.4.6c.2.1.3.5 0 .9-.4.7-1.2 1-2 .7-2.1-.8-3.6-2.3-4.4-4.4-.2-.4-.1-1 .3-2Z" /></>,
  doc: <><path d="M7 3.8h7.2L19 8.6V18a2.2 2.2 0 0 1-2.2 2.2H7A2.2 2.2 0 0 1 4.8 18V6A2.2 2.2 0 0 1 7 3.8Z" /><path d="M14 4v4.8h4.8" /></>,
  command: <><path d="M9 9V6.5A2.5 2.5 0 1 0 6.5 9H9Zm0 0h6m-6 0v6m6-6V6.5A2.5 2.5 0 1 1 17.5 9H15Zm0 0v6m0 0h-6m6 0v2.5a2.5 2.5 0 1 0 2.5-2.5H15Zm-6 0v2.5A2.5 2.5 0 1 1 6.5 15H9Z" /></>,
  swap: <><path d="M7 7.5h12M15.5 4 19 7.5 15.5 11M17 16.5H5M8.5 13 5 16.5 8.5 20" /></>,
  inbox: <><path d="M4 13.5 6.4 6a1.5 1.5 0 0 1 1.4-1h8.4a1.5 1.5 0 0 1 1.4 1L20 13.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4.5Z" /><path d="M4 13.5h4.5a3.5 3.5 0 0 0 7 0H20" /></>,
  star: <><path d="M12 3.6l2.55 5.2 5.75.84-4.16 4.05.98 5.72L12 16.7l-5.12 2.7.98-5.72L3.7 9.64l5.75-.84z" /></>,
  link: <><path d="M10.2 13.8a3.9 3.9 0 0 0 5.5 0l3-3a3.9 3.9 0 0 0-5.5-5.5l-1.1 1.1" /><path d="M13.8 10.2a3.9 3.9 0 0 0-5.5 0l-3 3a3.9 3.9 0 0 0 5.5 5.5l1.1-1.1" /></>,
  refresh: <><path d="M19.4 12.6a7.5 7.5 0 1 1-2.1-6.1" /><path d="M19.5 4.2v4.6h-4.6" /></>,
  trash: <><path d="M4.5 7h15M9.5 7V5.2c0-.4.3-.7.7-.7h3.6c.4 0 .7.3.7.7V7" /><path d="M6.6 7l.9 11.4c.1 1 .9 1.6 1.8 1.6h5.4c.9 0 1.7-.6 1.8-1.6L17.4 7" /></>,
  palette: <><path d="M12 3.8a8.2 8.2 0 1 0 0 16.4c1 0 1.6-.7 1.6-1.6 0-1.1-.9-1.4-.9-2.4 0-.9.7-1.6 1.6-1.6h2.1a3.8 3.8 0 0 0 3.8-3.8c0-4.1-3.7-7-8.2-7Z" /><circle cx="7.9" cy="11.4" r="1" fill="currentColor" stroke="none" /><circle cx="10.4" cy="7.7" r="1" fill="currentColor" stroke="none" /><circle cx="14.8" cy="7.9" r="1" fill="currentColor" stroke="none" /></>,
  chat: <><path d="M12 4.5c4.4 0 8 3 8 6.7s-3.6 6.7-8 6.7c-1 0-1.9-.1-2.8-.4L5 19.3l1-3.5c-1.3-1.2-2-2.8-2-4.6 0-3.7 3.6-6.7 8-6.7Z" /></>,
  database: <><ellipse cx="12" cy="6.3" rx="6.8" ry="2.6" /><path d="M5.2 6.3v11.4c0 1.4 3 2.6 6.8 2.6s6.8-1.2 6.8-2.6V6.3" /><path d="M5.2 12c0 1.4 3 2.6 6.8 2.6s6.8-1.2 6.8-2.6" /></>,
  newspaper: <><rect x="4" y="4.5" width="12.5" height="15" rx="2" /><path d="M16.5 8.5H19a1 1 0 0 1 1 1v8a2 2 0 0 1-2 2H6" /><path d="M7.5 8.5h5.5M7.5 12h5.5M7.5 15.5h3.5" /></>,
  pencil: <><path d="M4.8 19.2l.9-3.8L15.8 5.3a1.9 1.9 0 0 1 2.7 0l.2.2a1.9 1.9 0 0 1 0 2.7L8.6 18.3l-3.8.9Z" /><path d="M14 7.1l2.9 2.9" /></>,
  clock: <><circle cx="12" cy="12" r="8.2" /><path d="M12 7.6V12l3 2" /></>,
  key: <><circle cx="8.2" cy="15" r="3.6" /><path d="M10.8 12.4 18.5 4.7M16 7.2l2.3 2.3M13.8 9.4l1.7 1.7" /></>,
  play: <><path d="M8 5.8v12.4a.6.6 0 0 0 .9.5l10-6.2a.6.6 0 0 0 0-1l-10-6.2a.6.6 0 0 0-.9.5Z" fill="currentColor" stroke="none" /></>,
  download: <><path d="M12 4.5v10.5M7.5 10.5 12 15l4.5-4.5" /><path d="M4.5 14.5V18a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3.5" /></>,
  building: <><path d="M5 20V6.3L12 4v16" /><path d="M12 9h7v11M3.5 20h17M8 8.5h1.2M8 12h1.2M8 15.5h1.2M15 12.5h1.2M15 16h1.2" /></>,
  box: <><path d="M12 3.6l7.8 4.3v8.2L12 20.4l-7.8-4.3V7.9L12 3.6Z" /><path d="M4.5 8.1 12 12.3l7.5-4.2M12 12.3v8" /></>,
  bulb: <><path d="M9.3 17.4h5.4M10.3 20.4h3.4" /><path d="M12 3.6a5.8 5.8 0 0 0-3.5 10.4c.6.5 1 1.2 1 2v.4h5v-.4c0-.8.4-1.5 1-2A5.8 5.8 0 0 0 12 3.6Z" /></>,
  info: <><circle cx="12" cy="12" r="8.2" /><path d="M12 11v5" /><circle cx="12" cy="7.9" r=".9" fill="currentColor" stroke="none" /></>,
  copy: <><rect x="8.5" y="8.5" width="11" height="11" rx="2.3" /><path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" /></>,
  phone: <><rect x="7" y="3.5" width="10" height="17" rx="2.5" /><path d="M10.8 17.5h2.4" /></>,
  slack: <><path d="M9.5 4v7M14.5 13v7M4 14.5h7M13 9.5h7" /></>,
  webhook: <><circle cx="6.5" cy="17" r="2.2" /><circle cx="17.5" cy="17" r="2.2" /><circle cx="12" cy="7" r="2.2" /><path d="M8.7 17h6.6M11 9l-3.4 6.1M13 9l3.4 6.1" /></>,
  more: <><circle cx="6" cy="12" r="1.5" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" /><circle cx="18" cy="12" r="1.5" fill="currentColor" stroke="none" /></>,
} as const;

export type IconName = keyof typeof PATHS;

export const isIcon = (n: string): n is IconName => Object.prototype.hasOwnProperty.call(PATHS, n);

export function Icon({ name, size = 18, strokeWidth = 1.7, ...rest }: { name: IconName; size?: number; strokeWidth?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className="ico" {...rest}>
      {PATHS[name]}
    </svg>
  );
}
