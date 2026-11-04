'use client';
import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { parseCSV, guessMap } from '@/lib/csv';
import { importContacts, saveContact, loadSampleContacts, type ImportResult } from '../actions';
import { Submit } from '@/components/ui';
import { BodySheet as Sheet } from '@/components/people/BodySheet';
import { Icon } from '@/components/people/Icon';
import { ContactFields } from './fields';

const FIELDS: [string, string][] = [['first_name', 'First name'], ['last_name', 'Last name'], ['name', 'Full name (if no first/last)'], ['email', 'Email'], ['phone', 'Mobile / WhatsApp'], ['company', 'Company'], ['role', 'Role / title'], ['city', 'City'], ['tags', 'Tags']];
const PREVIEW: [string, string][] = [['name', 'Name'], ['email', 'Email'], ['phone', 'Mobile'], ['company', 'Company'], ['role', 'Role'], ['city', 'City']];

export function Importer({ onDone }: { onDone?: () => void }) {
  const [text, setText] = useState('');
  const [file, setFile] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [state, action] = useActionState<ImportResult | null, FormData>(importContacts, null);
  const rows = useMemo(() => (text ? parseCSV(text) : []), [text]);
  const head = rows[0] || [];
  const [map, setMap] = useState<Record<string, string>>({});
  const effective = useMemo(() => ({ ...guessMap(head), ...map }), [head, map]);
  const n = Math.max(0, rows.length - 1);
  const mapped = FIELDS.filter(([k]) => effective[k]).length;
  const val = (r: string[], k: string) => { const i = effective[k] ? head.indexOf(effective[k]) : -1; return i >= 0 ? String(r[i] ?? '').trim() : ''; };
  const nameOf = (r: string[]) => [val(r, 'first_name'), val(r, 'last_name')].filter(Boolean).join(' ') || val(r, 'name');
  const hasReach = mapped > 0 && (effective.email || effective.phone);
  const success = !!state && (state.added > 0 || state.updated > 0);
  const steps = [head.length ? 'done' : 'on', head.length ? (hasReach ? 'done' : 'on') : '', success ? 'done' : head.length ? 'on' : ''];
  const resRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (state) resRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, [state]);
  async function take(f?: File | null) { if (!f) return; setFile(f.name); setText(await f.text()); }

  return (
    <form action={action} className="imp">
      <ol className="imp-steps" aria-label="Import steps">
        {(['Add your file', 'Match columns', 'Confirm consent'] as const).map((l, i) => { const st = steps[i]; return <li key={l} className={st}><span>{st === 'done' ? <Icon name="check" size={11} stroke={3} /> : i + 1}</span>{l}</li>; })}
      </ol>

      <label className={`imp-drop ${drag ? 'is-drag' : ''} ${file || n ? 'has-file' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); take(e.dataTransfer.files?.[0]); }}>
        <input className="imp-file" type="file" accept=".csv,text/csv" aria-label="Upload a CSV" onChange={(e) => take(e.target.files?.[0])} />
        <span className="imp-drop-ic"><Icon name={n ? 'doc' : 'upload'} size={22} stroke={1.8} /></span>
        {n ? <span className="imp-drop-t"><b>{file || 'Pasted rows'}</b><span>{n} {n === 1 ? 'row' : 'rows'} · {head.length} columns · <u>Choose another file</u></span></span>
          : <span className="imp-drop-t"><b>Drop a CSV here, or <u>choose a file</u></b><span>Exports from your CRM, Apollo or Google Sheets work. First row = headers.</span></span>}
      </label>

      <label className="f imp-paste"><span>…or paste rows</span>
        <textarea className="in" rows={3} value={text} onChange={(e) => { setText(e.target.value); setFile(null); }} placeholder={'Name,Email,Mobile,Company,Designation,City\nRohan Mehta,rohan@skyline.in,9800000001,Skyline Developers,Head of Sales,Pune'} />
      </label>
      <input type="hidden" name="csv" value={text} />
      <input type="hidden" name="map" value={JSON.stringify(effective)} />

      {head.length > 0 && (
        <div className="imp-more">
          <section className="imp-sec">
            <div className="imp-sec-h"><h3>Match your columns</h3><span className="hint">{mapped} of {FIELDS.length} matched · {n} rows found</span></div>
            <div className="imp-map">
              {FIELDS.map(([k, l]) => (
                <label key={k} className={`imp-map-row ${effective[k] ? 'is-on' : ''}`}>
                  <span className="imp-map-l"><span className="imp-map-dot" aria-hidden>{effective[k] ? <Icon name="check" size={10} stroke={3.2} /> : null}</span>{l}</span>
                  <select className="in" value={effective[k] || ''} onChange={(e) => setMap({ ...map, [k]: e.target.value })}>
                    <option value="">Not in file</option>{head.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </label>
              ))}
            </div>
            {!hasReach && <div className="notice warn"><span className="ni" aria-hidden>!</span><div>Match an Email or Mobile column. Rows without either are skipped.</div></div>}
          </section>

          <section className="imp-sec">
            <div className="imp-sec-h"><h3>Preview</h3><span className="hint">First {Math.min(3, n)} of {n}, as they’ll be saved</span></div>
            <div className="imp-prev"><table className="tbl">
              <thead><tr>{PREVIEW.map(([, l]) => <th key={l}>{l}</th>)}</tr></thead>
              <tbody>{rows.slice(1, 4).map((r, i) => <tr key={i}>{PREVIEW.map(([k]) => { const v = k === 'name' ? nameOf(r) : val(r, k); return <td key={k} className={v ? '' : 'imp-nil'}>{v || '—'}</td>; })}</tr>)}</tbody>
            </table></div>
          </section>

          <section className="imp-sec">
            <div className="imp-sec-h"><h3>Consent</h3><span className="hint">Stored per channel, per person</span></div>
            <div className="pgroup">
              <label className="pswitch"><span><Icon name="mail" size={16} /><span>They agreed to receive email</span></span><input type="checkbox" className="toggle" name="email_consent" defaultChecked /></label>
              <label className="pswitch"><span><Icon name="chat" size={16} /><span>They agreed to receive WhatsApp</span></span><input type="checkbox" className="toggle" name="wa_consent" /></label>
            </div>
            <div className="form-grid">
              <label className="f"><span>How they agreed</span><input className="in" name="consent_source" placeholder="e.g. Signed up at our booth, CREDAI 2026" /></label>
              <label className="f"><span>Add a tag to everyone</span><input className="in" name="tag" placeholder="e.g. credai-2026" /></label>
            </div>
            <label className="check imp-confirm"><input type="checkbox" name="confirm" /><span>I confirm these people agreed to receive updates from us on the channels switched on above (needed under India’s DPDP Act, GDPR and WhatsApp’s rules).</span></label>
          </section>

          <div className="imp-foot">
            <span className="hint">Existing contacts (same email or phone) are updated, not duplicated.</span>
            <Submit pending="Importing…" className="btn primary lg">Import {rows.length - 1} rows</Submit>
          </div>
        </div>
      )}
      {state && (
        <div className="imp-res" ref={resRef}>
          <div className={`notice ${state.errors.length && !state.added ? 'bad' : 'ok'}`} role="status"><span className="ni" aria-hidden>{state.errors.length && !state.added ? '!' : '✓'}</span><div>{state.added} added, {state.updated} updated, {state.skipped} skipped.{state.errors.length ? <><br />{state.errors.join(' · ')}</> : null}</div></div>
          {onDone && (state.added > 0 || state.updated > 0) && <div className="imp-res-btn"><button type="button" className="btn primary" onClick={onDone}>Done</button></div>}
        </div>
      )}
    </form>
  );
}

/** Contacts header, import/add sheets and the empty state. Sheets open instantly; the URL keeps ?import=1 / ?add=1 deep-linkable. */
export function ContactsActions({ title, eyebrow, sub, openImport, openAdd, empty }: { title: string; eyebrow: React.ReactNode; sub: string; openImport: boolean; openAdd: boolean; empty: boolean }) {
  const [imp, setImp] = useState(openImport);
  const [add, setAdd] = useState(openAdd);
  const [gen, setGen] = useState(0);
  useEffect(() => { if (openImport) setImp(true); }, [openImport]);
  useEffect(() => { if (openAdd) setAdd(true); }, [openAdd]);
  const setUrl = (q: string) => { try { window.history.replaceState(null, '', `/app/contacts${q}`); } catch {} };
  const open = (which: 'import' | 'add') => { if (which === 'import') { setGen((g) => g + 1); setImp(true); } else setAdd(true); setUrl(`?${which}=1`); };
  const close = () => { setImp(false); setAdd(false); setUrl(''); };
  return (
    <>
      <div className="ph">
        <div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p className="sub">{sub}</p></div>
        <div className="row">
          {!empty && <a className="btn cexport" href="/api/export?type=contacts">Export CSV</a>}
          <button type="button" className="btn" onClick={() => open('import')}><Icon name="upload" size={15} />Import CSV</button>
          <button type="button" className="btn primary" onClick={() => open('add')}><Icon name="plus" size={15} stroke={2.2} />Add contact</button>
        </div>
      </div>
      {empty && (
        <div className="empty cempty">
          <span className="lempty-ic"><Icon name="users" size={24} /></span>
          <b>No contacts yet</b>
          <span>Import a CSV from your CRM or Apollo (name, email, phone, company, role, city), or load three sample contacts to try the flow end to end.</span>
          <div className="row"><button type="button" className="btn primary" onClick={() => open('import')}>Import CSV</button><form action={loadSampleContacts}><Submit className="btn" pending="Loading…">Load sample contacts</Submit></form></div>
        </div>
      )}
      <Sheet open={imp} onClose={close} title="Import contacts" width={760}>
        <Importer key={gen} onDone={close} />
      </Sheet>
      <Sheet open={add} onClose={close} title="New contact" width={640}>
        <form action={saveContact} className="form-grid padd"><ContactFields /><div className="full padd-foot"><button type="button" className="btn" onClick={close}>Cancel</button><Submit>Save contact</Submit></div></form>
      </Sheet>
    </>
  );
}
