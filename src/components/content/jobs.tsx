'use client';
import { useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Spinner } from '@/components/ui';
import { Icon, Tile } from './icons';
import { Countdown } from './controls';
import { cronToText } from './cron';

export type JobView = {
  id: string; label: string; help: string; icon: string; tone: string; cron: string; enabled: boolean;
  nextIso: string | null; nextLabel: string; lastAgo: string; lastStatus: string | null; lastLabel: string;
};

export function JobCard({ job, presets, save, run }: { job: JobView; presets: { label: string; cron: string }[]; save: (fd: FormData) => Promise<void>; run: () => Promise<void> }) {
  const [on, setOn] = useState(job.enabled);
  useEffect(() => setOn(job.enabled), [job.enabled]);
  return (
    <form action={save} className={`card au-card ${on ? '' : 'off'}`}>
      <input type="hidden" name="id" value={job.id} />
      <JobBody job={job} presets={presets} run={run} on={on} setOn={setOn} />
    </form>
  );
}

function JobBody({ job, presets, run, on, setOn }: { job: JobView; presets: { label: string; cron: string }[]; run: () => Promise<void>; on: boolean; setOn: (v: boolean) => void }) {
  const { pending } = useFormStatus();
  const [running, setRunning] = useState(false);
  const isPreset = presets.some((x) => x.cron === job.cron);
  const [sel, setSel] = useState(isPreset ? job.cron : '');
  const [custom, setCustom] = useState(isPreset ? '' : job.cron);
  const customRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!pending) setRunning(false); }, [pending]);
  useEffect(() => { const p = presets.some((x) => x.cron === job.cron); setSel(p ? job.cron : ''); setCustom(p ? '' : job.cron); }, [job.cron]); // eslint-disable-line react-hooks/exhaustive-deps
  const human = cronToText(sel || custom);
  const saving = pending && !running;
  const submit = (el: HTMLElement) => el.closest('form')?.requestSubmit();

  return (
    <>
      <div className="au-head">
        <Tile icon={job.icon} tone={job.tone} />
        <div className="au-title">
          <h2>{job.label}</h2>
          <p className="au-when"><Icon name="clock" size={14} /><span>{human === 'Custom schedule' && (sel || custom) ? <code>{sel || custom}</code> : human}</span></p>
        </div>
        <span className="au-switch">
          {saving && <span className="au-saving" aria-live="polite"><Spinner size={13} />Saving</span>}
          <input type="checkbox" role="switch" className="toggle" name="enabled" checked={on} aria-label={`${job.label}: ${on ? 'on' : 'off'}`}
            onChange={(e) => { setOn(e.target.checked); const el = e.currentTarget; requestAnimationFrame(() => submit(el)); }} />
        </span>
      </div>
      <p className="au-help">{job.help}</p>

      <div className="au-sched">
        <label className="au-field"><span>Schedule</span>
          <select className="in" name="cron" value={sel} onChange={(e) => { const v = e.target.value; setSel(v); const el = e.currentTarget; if (v) requestAnimationFrame(() => submit(el)); else requestAnimationFrame(() => customRef.current?.focus()); }}>
            {presets.map((c) => <option key={c.cron} value={c.cron}>{cronToText(c.cron)}</option>)}
            <option value="">Custom…</option>
          </select>
        </label>
        {sel === '' && (
          <div className="au-custom">
            <label className="au-field"><span>Cron (minute hour day month weekday)</span>
              <input ref={customRef} className="in mono" name="cron_custom" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="0 9 * * 1" spellCheck={false} />
            </label>
            <button type="submit" className="btn sm primary" disabled={pending}>Save</button>
          </div>
        )}
      </div>

      <div className="au-foot">
        <div className="au-next">
          {on && job.nextIso
            ? <><span className="au-k">Next run</span><span className="au-v">{job.nextLabel}</span><Countdown iso={job.nextIso} /></>
            : <><span className="au-k">Next run</span><span className="au-v muted">Paused</span></>}
        </div>
        <div className="au-last">
          <span className={`au-dot ${job.lastStatus || 'none'}`} aria-hidden />
          <span>{job.lastLabel}</span>
        </div>
        <button type="submit" className="btn sm au-run" formAction={run} onClick={() => setRunning(true)} disabled={pending} aria-busy={running && pending}>
          {running && pending ? <><Spinner size={13} />Running…</> : <><Icon name="play" size={12} />Run now</>}
        </button>
      </div>
    </>
  );
}
