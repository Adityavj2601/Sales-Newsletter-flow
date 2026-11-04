'use client';
import { useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Spinner } from '@/components/ui';
import { BodySheet as Sheet } from '@/components/people/BodySheet';
import { Icon } from './Icon';

/** "Edit" button that opens the full contact form in a sheet. */
export function EditSheet({ children, label = 'Edit', open: open0 = false }: { children: React.ReactNode; label?: string; open?: boolean }) {
  const [open, setOpen] = useState(open0);
  return (
    <>
      <button type="button" className="pc-act" onClick={() => setOpen(true)}><span className="pc-act-ic"><Icon name="pencil" size={18} /></span><span>{label}</span></button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Edit contact" width={640}>{children}</Sheet>
    </>
  );
}

function Busy() {
  const { pending } = useFormStatus();
  return pending ? <span className="pgroup-busy" aria-live="polite"><Spinner size={12} />Saving…</span> : null;
}

/** Live consent switches: flipping one saves immediately (all other fields are carried along unchanged). */
export function ConsentSwitches({ action, c }: { action: (fd: FormData) => Promise<void>; c: Record<string, any> }) {
  const ref = useRef<HTMLFormElement>(null);
  const keep = ['id', 'first_name', 'last_name', 'email', 'phone', 'company', 'role', 'city', 'tags', 'consent_source', 'notes'];
  return (
    <form action={action} ref={ref} className="pgroup pc-consent">
      {keep.map((k) => <input key={k} type="hidden" name={k} value={c[k] ?? ''} />)}
      <label className="pswitch">
        <span><span className="pc-ic tn-blue"><Icon name="mail" size={14} stroke={2} /></span><span>Email<small>{c.email ? 'Agreed to receive email' : 'No email address'}</small></span></span>
        <input type="checkbox" className="toggle" name="email_consent" defaultChecked={!!c.email_consent} onChange={() => ref.current?.requestSubmit()} />
      </label>
      <label className="pswitch">
        <span><span className="pc-ic tn-green"><Icon name="chat" size={14} stroke={2} /></span><span>WhatsApp<small>{c.phone ? 'Agreed to receive WhatsApp' : 'No mobile number'}</small></span></span>
        <input type="checkbox" className="toggle" name="wa_consent" defaultChecked={!!c.wa_consent} onChange={() => ref.current?.requestSubmit()} />
      </label>
      <Busy />
    </form>
  );
}
