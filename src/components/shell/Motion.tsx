'use client';
import { useEffect, useState } from 'react';
import { ago } from '@/lib/format';
import { Ticker } from '@/components/people/Ticker';

/**
 * A KPI number that only animates when it changed since this browser last saw it: it rolls from the old
 * value to the new one, once. Revisits with the same value render still. Uses the app's one Ticker.
 */
export function SeenNumber({ id, value }: { id: string; value: number }) {
  const [from, setFrom] = useState<number | null | undefined>(undefined);
  useEffect(() => {
    const key = `seen:${id}`;
    let prev: number | null = null;
    try {
      const v = localStorage.getItem(key);
      prev = v == null ? null : Number(v);
      localStorage.setItem(key, String(value));
    } catch { /* storage blocked: just show the number */ }
    setFrom(prev != null && Number.isFinite(prev) && prev !== value ? prev : null);
  }, [id, value]);
  if (from == null) return <span className="tick">{value.toLocaleString('en-IN')}</span>;
  return <Ticker key={`${from}-${value}`} value={value} from={from} duration={700} />;
}

/** Relative time (“4 min ago”) that keeps itself current. Tabular digits, so it never jitters. */
export function Ago({ iso, className, title }: { iso: string | null | undefined; className?: string; title?: string }) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!iso) return;
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, [iso]);
  if (!iso) return <span className={className}>never</span>;
  return <time dateTime={iso} className={`tnum${className ? ` ${className}` : ''}`} title={title} suppressHydrationWarning>{ago(iso)}</time>;
}
