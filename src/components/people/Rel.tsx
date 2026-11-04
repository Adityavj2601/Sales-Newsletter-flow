'use client';
import { useEffect, useState } from 'react';
import { ago } from '@/lib/format';

/**
 * A relative time ("3 min ago", "in 2 h") that keeps ticking while the page is open.
 * The server renders the first label and the client refreshes it after mount, so hydration never mismatches.
 */
export function Rel({ iso, title, className = '' }: { iso: string | null | undefined; title?: string; className?: string }) {
  const [label, setLabel] = useState(() => ago(iso));
  useEffect(() => {
    if (!iso) return;
    const tick = () => setLabel(ago(iso));
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [iso]);
  return <time className={`rel ${className}`.trim()} dateTime={iso || undefined} title={title} suppressHydrationWarning>{label}</time>;
}
