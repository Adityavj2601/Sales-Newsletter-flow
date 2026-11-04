'use client';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Form from 'next/form';
import { useFormStatus } from 'react-dom';
import { StagePill, Score } from '@/components/bits';
import { Spinner } from '@/components/ui';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { Rel } from './Rel';
import { fmtPhone } from '@/lib/format';

export type Row = {
  id: string; first_name: string; last_name: string; email: string | null; phone: string | null; company: string; role: string; city: string;
  tags: string; email_consent: number; wa_consent: number; status: string; stage: string; score: number; last: string | null;
};

function BulkBar({ n, onClear }: { n: number; onClear: () => void }) {
  const { pending } = useFormStatus();
  const [del, setDel] = useState(false);
  useEffect(() => { if (!n) setDel(false); }, [n]);
  const on = n > 0;
  return (
    <div className={`bulk ${on ? 'is-on' : ''}`} role="region" aria-label="Bulk actions" aria-hidden={!on} inert={!on}>
      <div className="bulk-in">
        <button type="button" className="bulk-x" onClick={onClear} aria-label="Clear selection"><Icon name="x" size={13} stroke={2.4} /></button>
        <span className="bulk-n"><b>{n}</b> selected</span>
        <span className="bulk-sep" aria-hidden />
        <span className="bulk-tag"><Icon name="tag" size={14} /><input name="tag" aria-label="Tag to add" placeholder="Tag name" /></span>
        <button className="btn sm" name="bulk" value="tag" disabled={pending}>{pending ? <Spinner size={12} /> : null}Add tag</button>
        <button className="btn sm" name="bulk" value="unsubscribe" disabled={pending}>Unsubscribe</button>
        {del
          ? <button key="confirm-delete" className="btn sm danger bulk-del" name="bulk" value="delete" disabled={pending} autoFocus>Delete {n}?</button>
          : <button key="ask-delete" type="button" className="btn sm danger" onClick={(e) => { e.preventDefault(); setDel(true); }} disabled={pending}><Icon name="trash" size={13} />Delete</button>}
        {del && <button key="cancel-delete" type="button" className="btn sm ghost" onClick={() => setDel(false)}>Cancel</button>}
      </div>
    </div>
  );
}

export function ContactsTable({ rows, tags, q: q0, tag, consent, status, total, action, capped }: { rows: Row[]; tags: string[]; q: string; tag: string; consent: string; status: string; total: number; action: (fd: FormData) => Promise<void>; capped: boolean }) {
  const [q, setQ] = useState(q0);
  const dq = useDeferredValue(q);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const filterRef = useRef<HTMLFormElement>(null);
  const key = rows.map((r) => r.id + r.tags + r.status).join('|');
  useEffect(() => { setSel(new Set()); }, [key]);
  const list = useMemo(() => {
    if (!dq.trim()) return rows;
    const s = dq.toLowerCase().trim(), digits = dq.replace(/\D/g, '');
    return rows.filter((r) => `${r.first_name} ${r.last_name} ${r.email} ${r.phone} ${r.company} ${r.city} ${r.role} ${r.tags}`.toLowerCase().includes(s) || (digits.length >= 5 && String(r.phone || '').replace(/\D/g, '').includes(digits)));
  }, [rows, dq]);
  const visibleIds = list.map((r) => r.id);
  const allOn = visibleIds.length > 0 && visibleIds.every((id) => sel.has(id));
  const someOn = !allOn && visibleIds.some((id) => sel.has(id));
  const nSel = visibleIds.filter((id) => sel.has(id)).length;
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const filtered = !!(q || tag || consent || status);
  const autoSubmit = () => filterRef.current?.requestSubmit();

  return (
    <>
      <Form action="/app/contacts" ref={filterRef} className="ctool" role="search">
        <label className="psearch psearch-lg"><Icon name="search" size={16} />
          <input name="q" aria-label="Search contacts" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, company, city, phone…" autoComplete="off" />
          {q && <button type="button" className="psearch-x" aria-label="Clear search" onClick={() => setQ('')}><Icon name="x" size={11} stroke={2.6} /></button>}
        </label>
        <select className="in cfil" name="tag" aria-label="Tag" defaultValue={tag} onChange={autoSubmit} data-on={!!tag}><option value="">All tags</option>{tags.map((t) => <option key={t}>{t}</option>)}</select>
        <select className="in cfil" name="consent" aria-label="Consent" defaultValue={consent} onChange={autoSubmit} data-on={!!consent}><option value="">Any consent</option><option value="email">Email consent</option><option value="wa">WhatsApp consent</option><option value="none">No consent</option></select>
        <select className="in cfil" name="status" aria-label="Status" defaultValue={status} onChange={autoSubmit} data-on={!!status}><option value="">Any status</option><option value="active">Active</option><option value="unsubscribed">Unsubscribed</option></select>
        <noscript><button className="btn">Filter</button></noscript>
        {filtered && <Link className="btn ghost sm" href="/app/contacts" onClick={() => setQ('')}>Clear</Link>}
        <span className="ccount" aria-live="polite">{list.length === total ? `${total} ${total === 1 ? 'contact' : 'contacts'}` : `${list.length} of ${total}`}{capped ? ' (first 500)' : ''}</span>
      </Form>

      <form action={action} className="cform">
        {list.length ? (
          <div className="tbl-wrap ptbl-wrap">
            <table className="tbl ptbl ctbl">
              <thead><tr>
                <th className="ptd-sel"><input type="checkbox" className="pcb" aria-label="Select all shown" checked={allOn} ref={(el) => { if (el) el.indeterminate = someOn; }} onChange={() => setSel((s) => { const n = new Set(s); if (allOn) visibleIds.forEach((id) => n.delete(id)); else visibleIds.forEach((id) => n.add(id)); return n; })} /></th>
                <th>Name</th><th>Company</th><th>Reach</th><th>Stage</th><th className="num">Score</th><th>Last active</th>
              </tr></thead>
              <tbody>{list.map((c) => {
                const name = `${c.first_name} ${c.last_name}`.trim() || '(no name)';
                const on = sel.has(c.id);
                const tg = String(c.tags || '').split(',').map((t) => t.trim()).filter(Boolean);
                return (
                  <tr key={c.id} className={`${on ? 'is-sel' : ''} ${c.status !== 'active' ? 'is-off' : ''}`}>
                    <td className="ptd-sel"><input type="checkbox" className="pcb" name="ids" value={c.id} aria-label={`Select ${name}`} checked={on} onChange={() => toggle(c.id)} /></td>
                    <td className="ptd-who"><Link href={`/app/contacts/${c.id}`} className="pwho"><Avatar name={name} size={36} /><span><b>{name}</b><span>{[c.role, c.city].filter(Boolean).join(' · ') || c.email || fmtPhone(c.phone)}</span></span></Link></td>
                    <td className="ptd-co"><span className="pco">{c.company || <span className="hint">—</span>}</span>{tg.length > 0 && <span className="ptags">{tg.slice(0, 3).map((t) => <span key={t} className="ptag">{t}</span>)}{tg.length > 3 && <span className="ptag">+{tg.length - 3}</span>}</span>}</td>
                    <td className="ptd-reach">
                      {c.email && <span className={`preach ${c.email_consent ? 'on' : ''}`} title={c.email_consent ? 'Email consent' : 'No email consent'}><Icon name="mail" size={13} /><span className="clip">{c.email}</span><span className="sr">{c.email_consent ? 'Email consent' : 'No email consent'}</span></span>}
                      {c.phone && <span className={`preach ${c.wa_consent ? 'on' : ''}`} title={c.wa_consent ? 'WhatsApp consent' : 'No WhatsApp consent'}><Icon name="chat" size={13} /><span className="tnum">{fmtPhone(c.phone)}</span><span className="sr">{c.wa_consent ? 'WhatsApp consent' : 'No WhatsApp consent'}</span></span>}
                      {c.status !== 'active' && <span className="pill bad">{c.status === 'unsubscribed' ? 'Unsubscribed' : c.status[0].toUpperCase() + c.status.slice(1)}</span>}
                    </td>
                    <td className="ptd-stage"><StagePill stage={c.stage} /></td>
                    <td className="num ptd-score"><Score n={c.score} /></td>
                    <td className="hint ptd-last">{c.last ? <Rel iso={c.last} /> : '—'}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        ) : (
          <div className="empty"><b>No matches</b><span>Nothing matches “{q || 'these filters'}”.</span>{filtered && <Link className="btn" href="/app/contacts" onClick={() => setQ('')}>Clear filters</Link>}</div>
        )}
        <BulkBar n={nSel} onClear={() => setSel(new Set())} />
      </form>
    </>
  );
}
