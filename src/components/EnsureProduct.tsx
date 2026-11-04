'use client';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

/** If a deep page belongs to another product than the sidebar shows, switch the sidebar to it. */
export function EnsureProduct({ productId, activeId }: { productId: string; activeId: string | null }) {
  const router = useRouter();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !productId || productId === activeId) return;
    done.current = true;
    fetch('/api/product', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: productId }) }).then(() => router.refresh()).catch(() => null);
  }, [productId, activeId, router]);
  return null;
}
