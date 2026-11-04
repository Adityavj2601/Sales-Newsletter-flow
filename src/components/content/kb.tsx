'use client';
import { useState } from 'react';
import { Submit } from '@/components/ui';
import { Icon } from './icons';
import { SheetCancel } from './sheet';

type Pillars = Record<string, { label: string; hint: string; defaultStatus: string }>;
type Maturity = Record<string, { label: string; allowed: string; banned: string[] }>;

const STATUS_NOTE: Record<string, string> = {
  live: 'Customers can use it today.',
  delivered: 'Built and handed over to a real client.',
  pilot: 'Being tested with a client right now.',
  prototype: 'A working demo exists, not in production.',
  concept: 'An idea. Nothing is built yet.',
};

export function KbForm({ k, action, pillars, maturity, defaultPillar }: { k?: any; action: (fd: FormData) => Promise<void>; pillars: Pillars; maturity: Maturity; defaultPillar?: string }) {
  const startPillar = k?.pillar || (defaultPillar && pillars[defaultPillar] ? defaultPillar : 'feature');
  const [pillar, setPillar] = useState<string>(startPillar);
  const [status, setStatus] = useState<string>(k?.status || pillars[startPillar].defaultStatus);
  const [adjusted, setAdjusted] = useState('');
  const m = maturity[status];

  const pickPillar = (v: string) => {
    setPillar(v);
    if (v === 'concept' && !['concept', 'prototype'].includes(status)) { setStatus('concept'); setAdjusted('Status set to Concept: ideas on the drawing board aren’t built yet.'); }
    else if (v !== 'concept' && status === 'concept') { setStatus(pillars[v].defaultStatus); setAdjusted(`Status set to ${maturity[pillars[v].defaultStatus].label}.`); }
    else setAdjusted('');
  };
  const pickStatus = (v: string) => {
    setStatus(v);
    if (v === 'concept' && pillar !== 'concept') { setPillar('concept'); setAdjusted('Moved to “On the drawing board”, because concepts aren’t built yet.'); }
    else setAdjusted('');
  };

  return (
    <form action={action} className="kw-form">
      <input type="hidden" name="id" value={k?.id || ''} />

      <div className="cx-group-box">
        <label className="cx-row">
          <span className="cx-row-l"><span className="cx-row-t">Section</span><small className="cx-row-s">{pillars[pillar]?.hint}</small></span>
          <span className="cx-row-c"><select className="in" name="pillar" value={pillar} onChange={(e) => pickPillar(e.target.value)}>{Object.entries(pillars).map(([v, x]) => <option key={v} value={v}>{x.label}</option>)}</select></span>
        </label>
        <label className="cx-row">
          <span className="cx-row-l"><span className="cx-row-t">Honest status</span><small className="cx-row-s">{STATUS_NOTE[status]}</small></span>
          <span className="cx-row-c"><select className="in" name="status" value={status} onChange={(e) => pickStatus(e.target.value)}>{Object.entries(maturity).map(([v, x]) => <option key={v} value={v}>{x.label}</option>)}</select></span>
        </label>
      </div>

      <div className={`kw-guide s-${status}`} key={status} aria-live="polite">
        <div className="kw-guide-h"><Icon name="check" size={15} strokeWidth={2.2} /><b>Wording that fits “{m.label}”</b></div>
        <p>{m.allowed}</p>
        {m.banned.length > 0 && <p className="kw-guide-no"><Icon name="x" size={13} strokeWidth={2.2} /><span>The checks block: {m.banned.map((b) => `“${b}”`).join(', ')}</span></p>}
        {adjusted && <p className="kw-guide-adj"><Icon name="info" size={13} />{adjusted}</p>}
      </div>

      <div className="cx-group-box">
        <label className="cx-row stack"><span className="cx-row-l"><span className="cx-row-t">Title</span></span>
          <span className="cx-row-c"><input className="in" name="title" defaultValue={k?.title} required placeholder="e.g. Instant WhatsApp follow-up after a site visit" /></span></label>
        <label className="cx-row stack"><span className="cx-row-l"><span className="cx-row-t">What it is</span><small className="cx-row-s">Two or three plain sentences.</small></span>
          <span className="cx-row-c"><textarea className="in" name="summary" defaultValue={k?.summary} rows={3} /></span></label>
        <label className="cx-row stack"><span className="cx-row-l"><span className="cx-row-t">Problem it solves for a developer’s team</span></span>
          <span className="cx-row-c"><textarea className="in" name="problem" defaultValue={k?.problem || ''} rows={2} /></span></label>
        <label className="cx-row stack"><span className="cx-row-l"><span className="cx-row-t">Result</span><small className="cx-row-s">Only numbers you can stand behind.</small></span>
          <span className="cx-row-c"><textarea className="in" name="result" defaultValue={k?.result || ''} rows={2} /></span></label>
      </div>

      <h3 className="cx-group-h">Client and proof</h3>
      <div className="cx-group-box">
        <label className="cx-row"><span className="cx-row-l"><span className="cx-row-t">Client name</span><small className="cx-row-s">For delivered work</small></span>
          <span className="cx-row-c"><input className="in" name="client_name" defaultValue={k?.client_name || ''} placeholder="Optional" /></span></label>
        <label className="cx-row"><span className="cx-row-l"><span className="cx-row-t">Approved numbers</span><small className="cx-row-s">What the client OK’d</small></span>
          <span className="cx-row-c"><input className="in" name="approved_numbers" defaultValue={k?.approved_numbers || ''} placeholder="e.g. 3 days → 4 hours" /></span></label>
        <label className="cx-row"><span className="cx-row-l"><span className="cx-row-t">Permission to name the client</span><small className="cx-row-s">Written permission only. Otherwise we say “a leading developer”.</small></span>
          <span className="cx-row-c end"><input type="checkbox" role="switch" className="toggle" name="client_permission" defaultChecked={!!k?.client_permission} /></span></label>
      </div>

      <h3 className="cx-group-h">Media and links</h3>
      <div className="cx-group-box">
        <label className="cx-row"><span className="cx-row-l"><span className="cx-row-t">Image or video</span></span>
          <span className="cx-row-c"><input className="in" name="media_url" defaultValue={k?.media_url || ''} placeholder="https://… (or upload in the editor)" /></span></label>
        <label className="cx-row"><span className="cx-row-l"><span className="cx-row-t">Link for more</span></span>
          <span className="cx-row-c"><input className="in" name="link" defaultValue={k?.link || ''} placeholder="https://…" /></span></label>
      </div>

      <div className="cx-group-box kw-ready">
        <label className="cx-row"><span className="cx-row-l"><span className="cx-row-t">Confirmed and ready to feature</span><small className="cx-row-s">The AI only uses confirmed items in drafts.</small></span>
          <span className="cx-row-c end"><input type="checkbox" role="switch" className="toggle" name="active" defaultChecked={k ? !!k.active : true} /></span></label>
      </div>

      <div className="kw-form-foot">
        <SheetCancel href="/app/knowledge" />
        <Submit pending="Saving…">{k ? 'Save' : 'Add item'}</Submit>
      </div>
    </form>
  );
}
