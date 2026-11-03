import fs from 'node:fs';
import path from 'node:path';
import { api } from '@/lib/api';
import { all, db, DATA_DIR } from '@/lib/db';
import { activeProduct } from '@/lib/context';
import { toCSV } from '@/lib/csv';

export const GET = api(async ({ req }) => {
  const u = new URL(req.url);
  const type = u.searchParams.get('type');
  const p = await activeProduct();
  if (!p) throw new Error('No product');
  const file = (name: string, csv: string) => new Response('﻿' + csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${p.slug}-${name}-${new Date().toISOString().slice(0, 10)}.csv"` } });
  if (type === 'contacts' || type === 'leads') {
    const rows = all(`SELECT * FROM contacts WHERE product_id = ? ${type === 'leads' ? 'AND score > 0' : ''} ORDER BY score DESC`, p.id);
    const cols = ['first_name', 'last_name', 'email', 'phone', 'company', 'role', 'city', 'tags', 'email_consent', 'wa_consent', 'consent_source', 'consent_at', 'status', 'stage', 'score', 'last_intent', 'last_intent_at', 'last_engaged_at', 'notes'];
    return file(type, toCSV([cols, ...rows.map((r) => cols.map((c) => r[c]))]));
  }
  if (type === 'events') {
    const ed = u.searchParams.get('edition');
    const rows = all(`SELECT ev.created_at, ev.type, ev.value, e.number AS edition, c.first_name, c.last_name, c.email, c.phone, c.company FROM events ev LEFT JOIN editions e ON e.id = ev.edition_id LEFT JOIN contacts c ON c.id = ev.contact_id WHERE ev.product_id = ? ${ed ? 'AND ev.edition_id = ?' : ''} ORDER BY ev.created_at DESC`, p.id, ...(ed ? [ed] : []));
    const cols = ['created_at', 'type', 'value', 'edition', 'first_name', 'last_name', 'email', 'phone', 'company'];
    return file('events', toCSV([cols, ...rows.map((r) => cols.map((c) => r[c]))]));
  }
  if (type === 'backup') {
    const out = path.join(DATA_DIR, `backup-${Date.now()}.db`);
    db().exec(`VACUUM INTO '${out.replace(/'/g, "''")}'`);
    const buf = fs.readFileSync(out);
    fs.unlinkSync(out);
    return new Response(buf, { headers: { 'content-type': 'application/octet-stream', 'content-disposition': `attachment; filename="brief-studio-${new Date().toISOString().slice(0, 10)}.db"` } });
  }
  throw new Error('Unknown export');
});
