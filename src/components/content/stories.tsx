'use client';
import { useEffect, useState } from 'react';
import { Icon } from './icons';

const leave = (el: HTMLElement) => el.closest('tr')?.classList.add('st-leaving');

/** One-tap shortlist star: fills with a spring the instant it’s tapped, then the server catches up. */
export function StarButton({ on, onAction, offAction, title, leaveWhenOff }: { on: boolean; onAction: () => Promise<void>; offAction: () => Promise<void>; title: string; leaveWhenOff?: boolean }) {
  const [state, setState] = useState(on);
  const [bump, setBump] = useState(0);
  useEffect(() => setState(on), [on]);
  return (
    <form action={on ? offAction : onAction} onSubmit={(e) => { if (state && leaveWhenOff) leave(e.currentTarget); setState(!state); setBump((b) => b + 1); }}>
      <button type="submit" className={`st-star ${state ? 'on' : ''}`} aria-pressed={state} title={state ? 'On your shortlist' : 'Shortlist'}
        aria-label={state ? `Remove “${title}” from shortlist` : `Shortlist “${title}”`}>
        <Icon key={bump} name="star" size={19} className={bump ? 'pop' : ''} />
        <span className="st-star-l">{state ? 'Shortlisted' : 'Shortlist'}</span>
      </button>
    </form>
  );
}

/** Dismiss / restore: the row slides away immediately. */
export function RowAction({ action, label, icon, title, className = 'st-act' }: { action: () => Promise<void>; label: string; icon: string; title: string; className?: string }) {
  return (
    <form action={action} onSubmit={(e) => leave(e.currentTarget)}>
      <button type="submit" className={className} title={label} aria-label={`${label}: “${title}”`}><Icon name={icon} size={16} /><span>{label}</span></button>
    </form>
  );
}
