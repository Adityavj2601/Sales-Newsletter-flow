'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Sheet } from '@/components/ui';

/**
 * The shared Sheet, rendered into <body>. Page and card entrance animations animate `transform`, which makes
 * them the containing block for fixed elements; portalling keeps the backdrop covering the whole window.
 */
export function BodySheet(props: React.ComponentProps<typeof Sheet>) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => { setHost(document.body); }, []);
  if (!host || !props.open) return null;
  return createPortal(<Sheet {...props} />, host);
}
