'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Sheet } from '@/components/ui';

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * A Sheet whose open state lives in the URL (e.g. ?add=1). Rendered into <body> so page transforms
 * never trap it, animates out on close, focuses the first field, and becomes a bottom sheet on phones.
 */
export function RouteSheet({ open, title, closeHref, width, children }: { open: boolean; title: string; closeHref: string; width?: number; children: React.ReactNode }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(open);
  const [closing, setClosing] = useState(false);
  const last = useRef(children);
  if (open) last.current = children;
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (open) { setShown(true); setClosing(false); return; }
    if (!shown) return;
    setClosing(true);
    const t = setTimeout(() => { setShown(false); setClosing(false); }, reduced() ? 0 : 220);
    return () => clearTimeout(t);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!shown || !mounted || closing) return;
    const t = setTimeout(() => {
      const el = host.current?.querySelector<HTMLElement>('.sheet input:not([type=hidden]):not([type=checkbox]), .sheet textarea');
      el?.focus({ preventScroll: true });
    }, 60);
    return () => clearTimeout(t);
  }, [shown, mounted]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = useCallback(() => {
    setClosing(true);
    router.push(closeHref, { scroll: false });
    setTimeout(() => { setShown(false); setClosing(false); }, reduced() ? 0 : 220);
  }, [router, closeHref]);

  if (!mounted || !shown) return null;
  return createPortal(
    <div ref={host} className={`cx-sheet ${closing ? 'closing' : ''}`}>
      <Sheet open onClose={close} title={title} width={width}>{open ? children : last.current}</Sheet>
    </div>,
    document.body,
  );
}

/** Button that closes the nearest RouteSheet by navigating to its close URL. */
export function SheetCancel({ href, children = 'Cancel', className = 'btn' }: { href: string; children?: React.ReactNode; className?: string }) {
  const router = useRouter();
  return <button type="button" className={className} onClick={() => router.push(href, { scroll: false })}>{children}</button>;
}
