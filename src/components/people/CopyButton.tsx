'use client';
import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

/**
 * The one Copy button for the people/send pages. "Copied" replaces the label in place: both labels share one
 * grid cell, so the button never changes width.
 */
export function CopyButton({ text, label = 'Copy', className = 'btn sm' }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(t.current), []);
  async function copy() {
    try { await navigator.clipboard.writeText(text); } catch {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
    setDone(true); clearTimeout(t.current); t.current = setTimeout(() => setDone(false), 1600);
  }
  return (
    <button type="button" className={`${className} pcopy${done ? ' is-copied' : ''}`} onClick={copy}>
      <span className="pcopy-a" aria-hidden={done}>{label}</span>
      <span className="pcopy-b" aria-hidden={!done}><Icon name="check" size={13} stroke={2.4} />Copied</span>
      <span className="sr" aria-live="polite">{done ? 'Copied' : ''}</span>
    </button>
  );
}
