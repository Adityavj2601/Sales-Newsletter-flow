'use client';
import { useActionState, useMemo, useState } from 'react';
import { parseCSV, guessMap } from '@/lib/csv';
import { importContacts, type ImportResult } from '../actions';
import { Submit } from '@/components/ui';

const FIELDS: [string, string][] = [['first_name', 'First name'], ['last_name', 'Last name'], ['name', 'Full name (if no first/last)'], ['email', 'Email'], ['phone', 'Mobile / WhatsApp'], ['company', 'Company'], ['role', 'Role / title'], ['city', 'City'], ['tags', 'Tags']];

export function Importer() {
  const [text, setText] = useState('');
  const [state, action] = useActionState<ImportResult | null, FormData>(importContacts, null);
  const rows = useMemo(() => (text ? parseCSV(text) : []), [text]);
  const head = rows[0] || [];
  const [map, setMap] = useState<Record<string, string>>({});
  const effective = useMemo(() => ({ ...guessMap(head), ...map }), [head, map]);
  return (
    <form action={action} className="stack" style={{ gap: 14 }}>
      <div className="grid2">
        <label className="f"><span>Upload a CSV</span><input className="in" type="file" accept=".csv,text/csv" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setText(await f.text()); }} /></label>
        <label className="f"><span>…or paste rows (first row = headers)</span><textarea className="in" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={'Name,Email,Mobile,Company,Designation,City\nRohan Mehta,rohan@skyline.in,9800000001,Skyline Developers,Head of Sales,Pune'} /></label>
      </div>
      <input type="hidden" name="csv" value={text} />
      <input type="hidden" name="map" value={JSON.stringify(effective)} />
      {head.length > 0 && (
        <>
          <div className="eyebrow">Match your columns ({rows.length - 1} rows found)</div>
          <div className="form-grid">
            {FIELDS.map(([k, l]) => (
              <label key={k} className="f"><span>{l}</span>
                <select className="in" value={effective[k] || ''} onChange={(e) => setMap({ ...map, [k]: e.target.value })}>
                  <option value="">— not in file —</option>{head.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </label>
            ))}
          </div>
          <div className="tbl-wrap"><table className="tbl"><thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.slice(1, 4).map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table></div>
          <div className="form-grid">
            <label className="check"><input type="checkbox" name="email_consent" defaultChecked /><span>They agreed to receive email</span></label>
            <label className="check"><input type="checkbox" name="wa_consent" /><span>They agreed to receive WhatsApp</span></label>
            <label className="f"><span>How they agreed</span><input className="in" name="consent_source" placeholder="e.g. Signed up at our booth, CREDAI 2026" /></label>
            <label className="f"><span>Add a tag to everyone</span><input className="in" name="tag" placeholder="e.g. credai-2026" /></label>
            <label className="check full"><input type="checkbox" name="confirm" /><span>I confirm these people agreed to receive updates from us on the channels ticked above (needed under India’s DPDP Act, GDPR and WhatsApp’s rules).</span></label>
          </div>
          <div className="row"><Submit pending="Importing…">Import {rows.length - 1} rows</Submit><span className="hint">Existing contacts (same email or phone) are updated, not duplicated.</span></div>
        </>
      )}
      {state && <div className={`notice ${state.errors.length && !state.added ? 'bad' : 'ok'}`}>{state.added} added, {state.updated} updated, {state.skipped} skipped.{state.errors.length ? <><br />{state.errors.join(' · ')}</> : null}</div>}
    </form>
  );
}
