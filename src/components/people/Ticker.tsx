'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const useIso = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * A number that eases to its value: counts up once on mount (from `from`), then rolls on change.
 * Server HTML always holds the final value, so no-JS and screen readers get the real number. Honours reduced motion.
 */
export function Ticker({ value, from = 0, duration = 700, format }: { value: number; from?: number | null; duration?: number; format?: (n: number) => string }) {
  const [shown, setShown] = useState(value);
  const last = useRef<number>(from == null ? value : from);
  useIso(() => {
    const start = last.current;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || start === value) { setShown(value); last.current = value; return; }
    setShown(start);
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / duration);
      const e = 1 - Math.pow(1 - k, 3);
      const v = Math.round(start + (value - start) * e);
      setShown(v);
      last.current = v;
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  const f = format || ((n: number) => n.toLocaleString('en-IN'));
  return <span className="tick"><span className="sr">{f(value)}</span><span aria-hidden>{f(shown)}</span></span>;
}
