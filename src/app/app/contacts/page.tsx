import { all } from '@/lib/db';
import { requireProduct } from '@/lib/context';
import { ago } from '@/lib/format';
import { ContactsTable, type Row } from '@/components/people/ContactsTable';
import { bulkContacts } from '../actions';
import { ContactsActions } from './Importer';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Contacts' };

const CAP = 500;

export default async function Contacts({ searchParams }: { searchParams: Promise<{ q?: string; tag?: string; consent?: string; status?: string; add?: string; import?: string }> }) {
  const p = await requireProduct();
  const sp = await searchParams;
  let rows = all('SELECT * FROM contacts WHERE product_id = ? ORDER BY created_at DESC', p.id);
  const total = rows.length;
  const tags = [...new Set(rows.flatMap((r) => String(r.tags || '').split(',').map((t: string) => t.trim()).filter(Boolean)))].sort();
  // Small lists are searched instantly in the browser; very large ones are narrowed on the server first.
  if (sp.q && total > CAP) {
    const q = sp.q.toLowerCase(), digits = sp.q.replace(/\D/g, '');
    rows = rows.filter((r) => `${r.first_name} ${r.last_name} ${r.email} ${r.phone} ${r.company} ${r.city} ${r.role}`.toLowerCase().includes(q) || (digits.length >= 5 && String(r.phone || '').replace(/\D/g, '').includes(digits)));
  }
  if (sp.tag) rows = rows.filter((r) => String(r.tags || '').split(',').map((t: string) => t.trim()).includes(sp.tag!));
  if (sp.consent === 'email') rows = rows.filter((r) => r.email_consent);
  if (sp.consent === 'wa') rows = rows.filter((r) => r.wa_consent);
  if (sp.consent === 'none') rows = rows.filter((r) => !r.email_consent && !r.wa_consent);
  if (sp.status) rows = rows.filter((r) => r.status === sp.status);
  const shown: Row[] = rows.slice(0, CAP).map((r) => ({
    id: r.id, first_name: r.first_name || '', last_name: r.last_name || '', email: r.email, phone: r.phone, company: r.company || '', role: r.role || '', city: r.city || '',
    tags: r.tags || '', email_consent: r.email_consent ? 1 : 0, wa_consent: r.wa_consent ? 1 : 0, status: r.status, stage: r.stage, score: Number(r.score || 0), last: ago(r.last_engaged_at),
  }));
  return (
    <div className="contacts">
      <ContactsActions
        eyebrow={`${p.name} audience`} title="Contacts"
        sub={`${total} ${total === 1 ? 'contact' : 'contacts'}. Only people who agreed to hear from you get editions, and consent is stored per channel. Unsubscribes are honoured automatically.`}
        openImport={!!sp.import} openAdd={!!sp.add} empty={total === 0}
      />
      {total > 0 && (
        <ContactsTable rows={shown} tags={tags} q={sp.q || ''} tag={sp.tag || ''} consent={sp.consent || ''} status={sp.status || ''} total={rows.length} capped={rows.length > CAP} action={bulkContacts} />
      )}
    </div>
  );
}
