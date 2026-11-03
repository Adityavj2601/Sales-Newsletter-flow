/** RFC-4180-ish CSV parser (quotes, escaped quotes, CRLF, BOM). */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  const t = text.replace(/^﻿/, '');
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) {
      if (ch === '"' && t[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',' || ch === ';' || ch === '\t') { row.push(cell); cell = ''; }
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
    const s = v == null ? '' : String(v);
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
