/* Plain-English descriptions for the 5-field cron schedules automations use. Pure, client- and server-safe. */
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function clock(h: number, m: number) {
  const ap = h >= 12 ? 'pm' : 'am';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, '0')} ${ap}`;
}
const int = (s: string) => (/^\d+$/.test(s) ? Number(s) : NaN);

function dayList(dow: string): string | null {
  if (dow === '1-5') return 'weekday';
  if (dow === '0,6' || dow === '6,0') return 'weekend day';
  const parts = dow.split(',').map(int);
  if (parts.some((n) => isNaN(n) || n < 0 || n > 7)) return null;
  const names = parts.map((n) => DAYS[n % 7]);
  if (names.length === 1) return names[0];
  return names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
}

export function cronToText(cron: string): string {
  const f = (cron || '').trim().split(/\s+/);
  if (f.length !== 5) return 'Custom schedule';
  const [mi, ho, dom, mon, dow] = f;
  const m = int(mi), h = int(ho);
  if (mon !== '*') return 'Custom schedule';
  if (/^\*\/\d+$/.test(mi) && ho === '*' && dom === '*' && dow === '*') return `Every ${mi.slice(2)} minutes`;
  if (!isNaN(m) && ho === '*' && dom === '*' && dow === '*') return m === 0 ? 'Every hour, on the hour' : `Every hour at :${String(m).padStart(2, '0')}`;
  if (!isNaN(m) && /^\*\/\d+$/.test(ho) && dom === '*' && dow === '*') return `Every ${ho.slice(2)} hours`;
  if (isNaN(m) || isNaN(h)) return 'Custom schedule';
  const at = clock(h, m);
  if (dom === '*' && dow === '*') return `Every day at ${at}`;
  if (dom === '*') {
    const d = dayList(dow);
    return d ? `Every ${d} at ${at}` : 'Custom schedule';
  }
  if (dow === '*' && !isNaN(int(dom))) {
    const n = int(dom);
    const suf = n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th';
    return `Monthly on the ${n}${suf} at ${at}`;
  }
  return 'Custom schedule';
}
