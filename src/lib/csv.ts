/** The delimiter used by the header line: whichever of , ; or tab appears most outside quotes. */
function detectDelimiter(t: string): string {
  const line = t.split(/\r?\n/)[0] || '';
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0 };
  let q = false;
  for (const ch of line) { if (ch === '"') q = !q; else if (!q && ch in counts) counts[ch]++; }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : ',';
}

/** RFC-4180-ish CSV parser (quotes, escaped quotes, CRLF, BOM); one delimiter per file. */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  const t = text.replace(/^﻿/, '');
  const delim = detectDelimiter(t);
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) {
      if (ch === '"' && t[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && t[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

export function toCSV(rows: (string | number | null | undefined)[][]): string {
  return rows.map((r) => r.map((v) => {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s) && !/^\+?\d[\d\s-]{6,}$/.test(s)) s = `'${s}`; // stop spreadsheet formula injection (plain phone numbers are left alone)
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\r\n');
}

/** Normalise to E.164-ish digits with a leading +. Ten-digit Indian mobiles get +91. */
export function normalizePhone(raw: string, defaultCountry = '91'): string {
  if (!raw) return '';
  let d = raw.replace(/[^\d+]/g, '');
  if (!d) return '';
  if (d.startsWith('+')) return '+' + d.slice(1).replace(/\D/g, '');
  d = d.replace(/\D/g, '');
  if (d.startsWith('00')) return '+' + d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  if (d.length === 10) return `+${defaultCountry}${d}`;
  return '+' + d;
}

/** Guess which CSV column holds which field. */
export function guessMap(headers: string[]): Record<string, string> {
  const pick = (...res: RegExp[]) => headers.find((h) => res.some((r) => r.test(h.trim()))) || '';
  return {
    first_name: pick(/^first/i, /^given/i, /^fname/i),
    last_name: pick(/^last/i, /^surname/i, /^family/i, /^lname/i),
    name: pick(/^(full\s*)?name$/i, /^contact\s*name/i),
    email: pick(/e-?mail/i),
    phone: pick(/whats\s*app/i, /mobile/i, /phone/i, /^cell/i, /^contact\s*(no|number)/i),
    company: pick(/company/i, /organi[sz]ation/i, /^account/i, /developer/i, /firm/i),
    role: pick(/title/i, /designation/i, /^role/i, /position/i),
    city: pick(/city/i, /location/i, /^town/i),
    tags: pick(/^tags?$/i, /segment/i, /list/i),
  };
}
