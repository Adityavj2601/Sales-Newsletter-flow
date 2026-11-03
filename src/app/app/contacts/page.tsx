import Link from 'next/link';
import { all } from '@/lib/db';
import { requireProduct } from '@/lib/context';
import { ago } from '@/lib/format';
import { StagePill, Score } from '@/components/bits';
import { Submit } from '@/components/ui';
import { saveContact, bulkContacts, loadSampleContacts } from '../actions';
import { Importer } from './Importer';
import { ContactFields } from './fields';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Contacts' };

export default async function Contacts({ searchParams }: { searchParams: Promise<{ q?: string; tag?: string; consent?: string; status?: string; add?: string; import?: string }> }) {
  const p = await requireProduct();
  const sp = await searchParams;
  let rows = all('SELECT * FROM contacts WHERE product_id = ? ORDER BY created_at DESC', p.id);
  const total = rows.length;
  const tags = [...new Set(rows.flatMap((r) => String(r.tags || '').split(',').map((t: string) => t.trim()).filter(Boolean)))].sort();
  if (sp.q) rows = rows.filter((r) => `${r.first_name} ${r.last_name} ${r.email} ${r.phone} ${r.company} ${r.city} ${r.role}`.toLowerCase().includes(sp.q!.toLowerCase()));
  if (sp.tag) rows = rows.filter((r) => String(r.tags || '').split(',').map((t: string) => t.trim()).includes(sp.tag!));
  if (sp.consent === 'email') rows = rows.filter((r) => r.email_consent);
  if (sp.consent === 'wa') rows = rows.filter((r) => r.wa_consent);
  if (sp.consent === 'none') rows = rows.filter((r) => !r.email_consent && !r.wa_consent);
  if (sp.status) rows = rows.filter((r) => r.status === sp.status);
  const shown = rows.slice(0, 500);
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="ph">
        <div><div className="eyebrow">{p.name} audience</div><h1>Contacts</h1><p className="sub">{total} contacts. Only people who agreed to hear from you get editions, and consent is stored per channel. Unsubscribes are honoured automatically.</p></div>
        <div className="row">
          <a className="btn" href={`/api/export?type=contacts`}>Export CSV</a>
          <Link className="btn" href="/app/contacts?import=1">Import CSV</Link>
          <Link className="btn primary" href="/app/contacts?add=1">Add contact</Link>
        </div>
      </div>
      {sp.import && <section className="card"><div className="card-head"><h2>Import contacts</h2><Link className="btn sm ghost" href="/app/contacts">Close</Link></div><Importer /></section>}
      {sp.add && <section className="card"><div className="card-head"><h2>New contact</h2><Link className="btn sm ghost" href="/app/contacts">Close</Link></div><form action={saveContact} className="form-grid"><ContactFields /><div className="full"><Submit>Save contact</Submit></div></form></section>}
      {total === 0 && !sp.add && !sp.import && (
        <div className="empty"><b>No contacts yet</b><span>Import a CSV from your CRM or Apollo (name, email, phone, company, role, city), or load three sample contacts to try the flow end to end.</span>
          <div className="row"><Link className="btn primary" href="/app/contacts?import=1">Import CSV</Link><form action={loadSampleContacts}><button className="btn">Load sample contacts</button></form></div></div>
      )}
      {total > 0 && <>
        <form className="row">
          <input className="in" name="q" defaultValue={sp.q} placeholder="Search name, company, city…" style={{ maxWidth: 280 }} />
          <select className="in" name="tag" defaultValue={sp.tag || ''} style={{ width: 'auto' }}><option value="">All tags</option>{tags.map((t) => <option key={t}>{t}</option>)}</select>
          <select className="in" name="consent" defaultValue={sp.consent || ''} style={{ width: 'auto' }}><option value="">Any consent</option><option value="email">Email consent</option><option value="wa">WhatsApp consent</option><option value="none">No consent</option></select>
          <select className="in" name="status" defaultValue={sp.status || ''} style={{ width: 'auto' }}><option value="">Any status</option><option value="active">Active</option><option value="unsubscribed">Unsubscribed</option></select>
          <button className="btn">Filter</button>{(sp.q || sp.tag || sp.consent || sp.status) && <Link className="btn ghost" href="/app/contacts">Clear</Link>}
        </form>
        <form action={bulkContacts} className="stack" style={{ gap: 10 }}>
          <div className="row"><span className="hint">{rows.length} shown{rows.length > 500 ? ' (first 500)' : ''}. With selected:</span>
            <select className="in" name="bulk" style={{ width: 'auto' }}><option value="tag">Add tag</option><option value="unsubscribe">Unsubscribe</option><option value="delete">Delete</option></select>
            <input className="in" name="tag" placeholder="tag name" style={{ width: 140 }} /><Submit className="btn sm">Apply</Submit></div>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th></th><th>Name</th><th>Company</th><th>Reach</th><th>Stage</th><th className="num">Score</th><th>Last active</th></tr></thead>
            <tbody>{shown.map((c) => (
              <tr key={c.id} style={{ opacity: c.status === 'active' ? 1 : 0.55 }}>
                <td><input type="checkbox" name="ids" value={c.id} aria-label="Select" /></td>
                <td><Link href={`/app/contacts/${c.id}`}><b>{`${c.first_name} ${c.last_name}`.trim() || '(no name)'}</b></Link><div className="hint">{c.role}{c.city ? ` · ${c.city}` : ''}</div></td>
                <td>{c.company}<div className="hint">{c.tags}</div></td>
                <td style={{ fontSize: 12.5 }}>{c.email && <div>{c.email_consent ? '✓' : '✕'} {c.email}</div>}{c.phone && <div>{c.wa_consent ? '✓' : '✕'} {c.phone}</div>}{c.status !== 'active' && <span className="pill bad">{c.status}</span>}</td>
                <td><StagePill stage={c.stage} /></td>
                <td className="num"><Score n={c.score} /></td>
                <td className="hint">{ago(c.last_engaged_at)}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </form>
      </>}
    </div>
  );
}
