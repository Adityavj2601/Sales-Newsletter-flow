'use client';
import { useEffect, useRef } from 'react';

/** A <details> popover that also closes on an outside click or Escape. Works without JS as a plain disclosure. */
export function Popover({ summary, children, className = 'lpop' }: { summary: React.ReactNode; children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const down = (e: PointerEvent) => { if (el.open && !el.contains(e.target as Node)) el.open = false; };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape' && el.open) { el.open = false; el.querySelector('summary')?.focus(); } };
    document.addEventListener('pointerdown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', down); document.removeEventListener('keydown', key); };
  }, []);
  return (
    <details ref={ref} className={className}>
      <summary className="btn">{summary}</summary>
      <div className={`${className}-body`} role="note">{children}</div>
    </details>
  );
}
