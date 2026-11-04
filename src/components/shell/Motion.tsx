'use client';
import { useLayoutEffect, useRef } from 'react';

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Number that counts up once on first paint. The server renders the final value, so it reads correctly without JS. */
export function CountUp({ value, duration = 900 }: { value: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || reduced() || value <= 0) return;
    const fmt = new Intl.NumberFormat('en-IN');
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / duration);
      el.textContent = fmt.format(Math.round(value * (1 - Math.pow(1 - k, 4))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    el.textContent = fmt.format(0);
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); el.textContent = fmt.format(Math.round(value)); };
  }, [value, duration]);
  return <span ref={ref}>{Math.round(value).toLocaleString('en-IN')}</span>;
}
