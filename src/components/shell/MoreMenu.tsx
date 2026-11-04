'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { Submit } from '@/components/ui';
import { Icon } from './icons';

/**
 * Page-header “⋯” menu holding one destructive action behind an explicit confirm step,
 * so a rarely used, irreversible command never sits next to the primary button.
 */
export function DangerMenu({ label, item, title, body, confirm, pending = 'Working…', action }: {
  label: string; item: string; title: string; body: string; confirm: string; pending?: string; action: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [ask, setAsk] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); box.current?.querySelector<HTMLElement>('.so-more')?.focus(); } };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    requestAnimationFrame(() => box.current?.querySelector<HTMLElement>('.so-menu-pop button')?.focus());
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open, ask]);
  useEffect(() => { if (!open) setAsk(false); }, [open]);
  return (
    <div className="so-menu ph-more" ref={box}>
      <button type="button" className="so-more" aria-haspopup="menu" aria-expanded={open} aria-controls={id} aria-label={label} title={label} onClick={() => setOpen(!open)}>
        <Icon name="more" size={19} />
      </button>
      {open && (
        <div className="so-menu-pop" id={id} role="menu" aria-label={label}>
          {!ask ? (
            <button type="button" className="so-menu-i danger" role="menuitem" onClick={() => setAsk(true)}><Icon name="trash" size={16} />{item}</button>
          ) : (
            <form action={action} className="so-confirm">
              <b>{title}</b>
              <span>{body}</span>
              <span className="so-confirm-row">
                <button type="button" className="btn sm" onClick={() => setAsk(false)}>Cancel</button>
                <Submit className="btn sm danger" pending={pending}>{confirm}</Submit>
              </span>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
