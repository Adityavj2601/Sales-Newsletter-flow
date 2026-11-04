import { STAGE_LABEL } from '@/components/bits';

const Toggle = ({ name, label, on }: { name: string; label: string; on: boolean }) => (
  <label className="pswitch"><span><span>{label}</span></span><input type="checkbox" className="toggle" name={name} defaultChecked={on} /></label>
);

export function ContactFields({ c, stage = true }: { c?: any; stage?: boolean }) {
  return <>
    <input type="hidden" name="id" value={c?.id || ''} />
    <div className="full pfs-h">Name</div>
    <label className="f"><span>First name</span><input className="in" name="first_name" defaultValue={c?.first_name} autoComplete="off" /></label>
    <label className="f"><span>Last name</span><input className="in" name="last_name" defaultValue={c?.last_name} autoComplete="off" /></label>
    <div className="full pfs-h">Reach</div>
    <label className="f"><span>Email</span><input className="in" type="email" name="email" defaultValue={c?.email || ''} autoComplete="off" /></label>
    <label className="f"><span>Mobile / WhatsApp</span><input className="in" name="phone" inputMode="tel" defaultValue={c?.phone || ''} placeholder="+91 98xxxxxxxx" autoComplete="off" /></label>
    <div className="full pfs-h">Work</div>
    <label className="f"><span>Company</span><input className="in" name="company" defaultValue={c?.company || ''} /></label>
    <label className="f"><span>Role</span><input className="in" name="role" defaultValue={c?.role || ''} placeholder="e.g. Head of Sales" /></label>
    <label className="f"><span>City</span><input className="in" name="city" defaultValue={c?.city || ''} /></label>
    <label className="f"><span>Tags <small>comma separated</small></span><input className="in" name="tags" defaultValue={c?.tags || ''} placeholder="pune, tier-1, event-2026" /></label>
    {stage && <label className="f"><span>Stage</span><select className="in" name="stage" defaultValue={c?.stage || 'new'}>{Object.entries(STAGE_LABEL).filter(([k]) => k !== 'not_interested' || c?.stage === k).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>}
    <div className="full pfs-h">Consent</div>
    <div className="full pgroup">
      <Toggle name="email_consent" label="Agreed to receive email" on={c ? !!c.email_consent : false} />
      <Toggle name="wa_consent" label="Agreed to receive WhatsApp" on={c ? !!c.wa_consent : false} />
    </div>
    <label className="f full"><span>How they agreed</span><input className="in" name="consent_source" defaultValue={c?.consent_source || ''} placeholder="e.g. Met at CREDAI event, asked for updates" /></label>
    <label className="f full"><span>Notes</span><textarea className="in" name="notes" defaultValue={c?.notes || ''} rows={3} /></label>
  </>;
}
