/* Small SF-Symbols-like line icons (server-safe). Stroke follows currentColor. */
const P: Record<string, React.ReactNode> = {
  mail: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></>,
  chat: <><path d="M20 11.5a8 8 0 0 1-11.6 7.1L4 20l1.4-4.2A8 8 0 1 1 20 11.5Z" /></>,
  link: <><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" /><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" /></>,
  bolt: <><path d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z" /></>,
  check: <><path d="m5 12.5 4.5 4.5L19 7.5" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>,
  upload: <><path d="M12 15V4m0 0L7.5 8.5M12 4l4.5 4.5" /><path d="M4.5 14.5v3a2.5 2.5 0 0 0 2.5 2.5h10a2.5 2.5 0 0 0 2.5-2.5v-3" /></>,
  users: <><circle cx="9" cy="8.5" r="3.5" /><path d="M2.5 19.5a6.5 6.5 0 0 1 13 0" /><path d="M16 5.2a3.5 3.5 0 0 1 0 6.6M18 14.2a6.5 6.5 0 0 1 3.5 5.3" /></>,
  phone: <><path d="M6.6 3.5h2.2l1.6 4.2-2 1.4a11 11 0 0 0 6.5 6.5l1.4-2 4.2 1.6v2.2a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7a2 2 0 0 1 2.1-2.2Z" /></>,
  x: <><path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" /></>,
  arrow: <><path d="M5 12h14m0 0-5.5-5.5M19 12l-5.5 5.5" /></>,
  chev: <><path d="m9.5 6 6 6-6 6" /></>,
  out: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" /></>,
  send: <><path d="M21 3 10.5 13.5M21 3l-6.5 18-4-7.5L3 9.5 21 3Z" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></>,
  spark: <><path d="M12 3.5 13.8 9 19.5 10.5 13.8 12.2 12 18 10.2 12.2 4.5 10.5 10.2 9 12 3.5Z" /><path d="M18.5 16.5 19.2 18.8 21.5 19.5 19.2 20.2 18.5 22.5" /></>,
  flame: <><path d="M12 21a6.5 6.5 0 0 0 6.5-6.5c0-4-3-6.5-4-9.5-2 1.5-3 3.5-3 5.5-1-1-1.5-2-1.5-3C7.5 9.5 5.5 12 5.5 14.5A6.5 6.5 0 0 0 12 21Z" /></>,
  doc: <><path d="M14 3.5H7.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8L14 3.5Z" /><path d="M14 3.5V8h4.5M9 13h6M9 16.5h4" /></>,
  tag: <><path d="M3.5 12.2V5a1.5 1.5 0 0 1 1.5-1.5h7.2l8.3 8.3a1.5 1.5 0 0 1 0 2.1l-7 7a1.5 1.5 0 0 1-2.1 0l-7.9-7.7Z" /><circle cx="8" cy="8" r="1.4" /></>,
  trash: <><path d="M4.5 6.5h15M9.5 6.5V4.5h5v2M6.5 6.5l1 13a1.5 1.5 0 0 0 1.5 1.4h6a1.5 1.5 0 0 0 1.5-1.4l1-13" /></>,
  bell: <><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15L6 16.5Z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>,
  minus: <><path d="M6 12h12" /></>,
  plus: <><path d="M12 5.5v13M5.5 12h13" /></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M21 20H3" /></>,
  pencil: <><path d="m14.5 5.5 4 4L8 20H4v-4L14.5 5.5Z" /></>,
  briefcase: <><rect x="3.5" y="7" width="17" height="12.5" rx="2.5" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3.5 12.5h17" /></>,
  pin: <><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" /><circle cx="12" cy="10" r="2.3" /></>,
  building: <><path d="M4.5 20.5V5a1.5 1.5 0 0 1 1.5-1.5h7A1.5 1.5 0 0 1 14.5 5v15.5M14.5 9.5H18a1.5 1.5 0 0 1 1.5 1.5v9.5M3 20.5h18M8 7.5h3M8 11h3M8 14.5h3" /></>,
  lock: <><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></>,
  warn: <><path d="M12 4.5 2.8 19.5h18.4L12 4.5Z" /><path d="M12 10v4.2" /><circle cx="12" cy="16.9" r=".9" fill="currentColor" stroke="none" /></>,
  more: <><circle cx="5.5" cy="12" r="1.3" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" /><circle cx="18.5" cy="12" r="1.3" fill="currentColor" stroke="none" /></>,
  poll: <><rect x="4" y="5" width="16" height="3.5" rx="1.75" /><rect x="4" y="10.25" width="11" height="3.5" rx="1.75" /><rect x="4" y="15.5" width="6.5" height="3.5" rx="1.75" /></>,
};
export type IconName = keyof typeof P;
export function Icon({ name, size = 16, className, stroke = 1.7 }: { name: string; size?: number; className?: string; stroke?: number }) {
  return (
    <svg className={`ic-svg ${className || ''}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
      {P[name] || null}
    </svg>
  );
}
