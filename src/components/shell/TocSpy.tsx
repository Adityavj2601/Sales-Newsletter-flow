'use client';
import { useEffect } from 'react';

/** Highlights the "On this page" link for the section currently in view. */
export function TocSpy({ ids }: { ids: string[] }) {
  useEffect(() => {
    const links = new Map(ids.map((id) => [id, document.querySelector<HTMLAnchorElement>(`.toc a[href="#${id}"]`)]));
    const set = (id: string) => links.forEach((a, k) => a?.setAttribute('aria-current', String(k === id)));
    const visible = new Set<string>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) (e.isIntersecting ? visible.add(e.target.id) : visible.delete(e.target.id));
      const first = ids.find((id) => visible.has(id));
      if (first) set(first);
    }, { rootMargin: '-10% 0px -55% 0px' });
    ids.forEach((id) => { const el = document.getElementById(id); if (el) io.observe(el); });
    set(ids[0]);
    return () => io.disconnect();
  }, [ids]);
  return null;
}
