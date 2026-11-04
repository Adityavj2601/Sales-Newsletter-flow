import { STAGE_LABEL } from '@/components/bits';

export function ContactFields({ c, stage = true }: { c?: any; stage?: boolean }) {
  return <>
    <input type="hidden" name="id" value={c?.id || ''} />
    <label className="f"><span>First name</span><input className="in" name="first_name" defaultValue={c?.first_name} /></label>
    <label className="f"><span>Last name</span><input className="in" name="last_name" defaultValue={c?.last_name} /></label>
    <label className="f"><span>Email</span><input className="in" type="email" name="email" defaultValue={c?.email || ''} /></label>
    <label className="f"><span>Mobile / WhatsApp</span><input className="in" name="phone" defaultValue={c?.phone || ''} placeholder="+91 98xxxxxxxx" /></label>
    <label className="f"><span>Company</span><input className="in" name="company" defaultValue={c?.company || ''} /></label>
    <label className="f"><span>Role</span><input className="in" name="role" defaultValue={c?.role || ''} placeholder="e.g. Head of Sales" /></label>
    <label className="f"><span>City</span><input className="in" name="city" defaultValue={c?.city || ''} /></label>
    <label className="f"><span>Tags (comma separated)</span><input className="in" name="tags" defaultValue={c?.tags || ''} placeholder="pune, tier-1, event-2026" /></label>
    {stage && <label className="f"><span>Stage</span><select className="in" name="stage" defaultValue={c?.stage || 'new'}>{Object.entries(STAGE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>}
    <label className="f"><span>How they agreed</span><input className="in" name="consent_source" defaultValue={c?.consent_source || ''} placeholder="e.g. Met at CREDAI event, asked for updates" /></label>
    <label className="check"><input type="checkbox" name="email_consent" defaultChecked={c ? !!c.email_consent : false} /><span>Agreed to receive email</span></label>
    <label className="check"><input type="checkbox" name="wa_consent" defaultChecked={c ? !!c.wa_consent : false} /><span>Agreed to receive WhatsApp</span></label>
    <label className="f full"><span>Notes</span><textarea className="in" name="notes" defaultValue={c?.notes || ''} rows={3} /></label>
  </>;
}
