'use client';
import { useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Spinner, Submit } from '@/components/ui';
import { BodySheet as Sheet } from '@/components/people/BodySheet';
import { Icon } from './Icon';

/** "Edit" button that opens the full contact form in a sheet. */
export function EditSheet({ children, label = 'Edit', open: open0 = false }: { children: React.ReactNode; label?: string; open?: boolean }) {
  const [open, setOpen] = useState(open0);
  return (
    <>
      <button type="button" className="btn" onClick={() => setOpen(true)}><Icon name="pencil" size={15} />{label}</button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Edit contact" width={640}>{children}</Sheet>
    </>
  );
}

function Busy() {
  const { pending } = useFormStatus();
  return pending ? <span className="pgroup-busy" aria-live="polite"><Spinner size={12} />Saving…</span> : null;
}

const KEEP = ['id', 'first_name', 'last_name', 'email', 'phone', 'company', 'role', 'city', 'tags', 'consent_source'];

/**
 * Inline note field: a quiet one-line field that opens into a textarea on click. Saving appends a dated line
 * to the contact's notes ("[2026-11-04] …") through the same save as the Edit sheet, so nothing else changes.
 */
export function NoteComposer({ action, c, today, name }: { action: (fd: FormData) => Promise<void>; c: Record<string, any>; today: string; name: string }) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const body = text.trim();
  const notes = body ? `${String(c.notes || '').trimEnd()}${c.notes ? '\n' : ''}[${today}] ${body}` : String(c.notes || '');
  const close = () => { setText(''); setOpen(false); ref.current?.blur(); };
  return (
    <form action={action} ref={formRef} className={`pnote-new${open ? ' is-open' : ''}`}>
      {KEEP.map((k) => <input key={k} type="hidden" name={k} value={c[k] ?? ''} />)}
      {c.email_consent ? <input type="hidden" name="email_consent" value="1" /> : null}
      {c.wa_consent ? <input type="hidden" name="wa_consent" value="1" /> : null}
      <input type="hidden" name="notes" value={notes} />
      <textarea ref={ref} className="in pnote-in" aria-label="New note" rows={open ? 3 : 1} value={text} placeholder={`Add a note about ${name}…`}
        onFocus={() => setOpen(true)} onBlur={() => { if (!text.trim()) setOpen(false); }} onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.preventDefault(); close(); }
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && body) { e.preventDefault(); formRef.current?.requestSubmit(); }
        }} />
      {open && (
        <div className="pnote-acts">
          <button type="button" className="btn sm ghost" onMouseDown={(e) => e.preventDefault()} onClick={close}>Cancel</button>
          <Submit className="btn sm primary" pending="Saving…" disabled={!body}>Save note</Submit>
        </div>
      )}
    </form>
  );
}

/** Live consent switches: flipping one saves immediately (all other fields are carried along unchanged). */
export function ConsentSwitches({ action, c }: { action: (fd: FormData) => Promise<void>; c: Record<string, any> }) {
  const ref = useRef<HTMLFormElement>(null);
  const keep = ['id', 'first_name', 'last_name', 'email', 'phone', 'company', 'role', 'city', 'tags', 'consent_source', 'notes'];
  return (
    <form action={action} ref={ref} className="pgroup pc-consent">
      {keep.map((k) => <input key={k} type="hidden" name={k} value={c[k] ?? ''} />)}
      <label className="pswitch">
        <span><span className="icon-chip pc-ic" aria-hidden><Icon name="mail" size={15} /></span><span>Email<small>{c.email ? 'Agreed to receive email' : 'No email address'}</small></span></span>
        <input type="checkbox" className="toggle" name="email_consent" defaultChecked={!!c.email_consent} onChange={() => ref.current?.requestSubmit()} />
      </label>
      <label className="pswitch">
        <span><span className="icon-chip ok pc-ic" aria-hidden><Icon name="chat" size={15} /></span><span>WhatsApp<small>{c.phone ? 'Agreed to receive WhatsApp' : 'No mobile number'}</small></span></span>
        <input type="checkbox" className="toggle" name="wa_consent" defaultChecked={!!c.wa_consent} onChange={() => ref.current?.requestSubmit()} />
      </label>
      <Busy />
    </form>
  );
}
