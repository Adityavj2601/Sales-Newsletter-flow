'use client';
import { useId, useRef, useState } from 'react';
import { Icon, type IconName } from './icons';

type Kind = 'text' | 'email' | 'password' | 'new-password' | 'url';

const MESSAGES: Record<Kind, (v: ValidityState, label: string) => string> = {
  text: () => 'Please fill this in.',
  email: (v) => (v.valueMissing ? 'Enter your email address.' : 'That doesn’t look like an email address.'),
  password: () => 'Enter your password.',
  'new-password': (v) => (v.valueMissing ? 'Choose a password.' : 'Use at least 8 characters.'),
  url: () => 'Use a full address starting with https://',
};

/** Labelled input with inline validation (after blur or a submit attempt), password reveal and caps-lock hint. */
export function AuthField({ label, name, kind = 'text', icon, hint, required, autoComplete, placeholder, autoFocus, minLength }: {
  label: string; name: string; kind?: Kind; icon?: IconName; hint?: string; required?: boolean; autoComplete?: string; placeholder?: string; autoFocus?: boolean; minLength?: number;
}) {
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState('');
  const [touched, setTouched] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [caps, setCaps] = useState(false);
  const [len, setLen] = useState(0);
  const isPw = kind === 'password' || kind === 'new-password';
  const type = isPw ? (reveal ? 'text' : 'password') : kind === 'email' ? 'email' : kind === 'url' ? 'url' : 'text';
  const check = (el: HTMLInputElement) => setErr(el.validity.valid ? '' : MESSAGES[kind](el.validity, label));
  const describedBy = [hint && `${id}-hint`, err && `${id}-err`, kind === 'new-password' && `${id}-req`].filter(Boolean).join(' ') || undefined;
  const minOk = kind === 'new-password' && len >= (minLength || 8);
  return (
    <div className={`af${err ? ' invalid' : ''}${touched && !err && len > 0 ? ' valid' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <div className="af-box">
        {icon && <Icon name={icon} size={17} />}
        <input
          ref={ref} id={id} name={name} type={type} className="in" required={required} autoComplete={autoComplete} placeholder={placeholder}
          autoFocus={autoFocus} minLength={minLength} aria-invalid={!!err || undefined} aria-describedby={describedBy}
          spellCheck={kind === 'text' ? undefined : false} autoCapitalize={kind === 'text' ? undefined : 'none'}
          onBlur={(e) => { setTouched(true); setLen(e.currentTarget.value.length); if (e.currentTarget.value || err) check(e.currentTarget); }}
          onInput={(e) => { setLen(e.currentTarget.value.length); if (err) check(e.currentTarget); }}
          onInvalid={(e) => { e.preventDefault(); setTouched(true); check(e.currentTarget); const first = e.currentTarget.form?.querySelector<HTMLInputElement>(':invalid'); if (first === e.currentTarget) first.focus(); }}
          onKeyUp={(e) => isPw && setCaps(e.getModifierState?.('CapsLock') || false)}
        />
        {isPw && (
          <button type="button" className="af-eye" onClick={() => { setReveal((r) => !r); ref.current?.focus(); }} aria-pressed={reveal} aria-label={reveal ? 'Hide password' : 'Show password'} title={reveal ? 'Hide password' : 'Show password'}>
            <Icon name={reveal ? 'eyeOff' : 'eye'} size={17} />
          </button>
        )}
      </div>
      {kind === 'new-password' && (
        <div id={`${id}-req`} className={`af-req${minOk ? ' ok' : ''}`}><span className="tick" aria-hidden><Icon name="check" size={10} strokeWidth={3} /></span>At least {minLength || 8} characters{minOk && <span className="sr"> (met)</span>}</div>
      )}
      {err ? <div id={`${id}-err`} className="af-err" role="alert"><Icon name="warn" size={14} />{err}</div>
        : caps ? <div className="af-caps"><Icon name="lock" size={13} />Caps Lock is on</div>
        : hint ? <small id={`${id}-hint`}>{hint}</small> : null}
    </div>
  );
}
