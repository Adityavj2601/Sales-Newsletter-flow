'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { Submit } from '@/components/ui';
import { Icon } from './icons';

const KINDS = {
  gnews: { label: 'Google News search', short: 'Google News', icon: 'search', field: 'Search words', ph: '“channel partner” real estate India', tip: 'Use quotes for exact phrases, OR between alternatives, and a minus sign to leave words out. India edition, last 7 days.' },
  rss: { label: 'RSS or Atom feed', short: 'RSS feed', icon: 'rss', field: 'Feed address', ph: 'https://example.com/feed', tip: 'Paste the feed’s full address. It starts with https:// and usually ends in /feed, /rss or .xml.' },
} as const;

export function SourceForm({ action, productName }: { action: (fd: FormData) => Promise<void>; productName: string }) {
  const [kind, setKind] = useState<keyof typeof KINDS>('gnews');
  const k = KINDS[kind];
  return (
    <form action={action} className="card so-add">
      <div className="so-add-head">
        <h2>Add a source</h2>
        <div className="cx-radio-seg" role="radiogroup" aria-label="Source type">
          {(Object.keys(KINDS) as (keyof typeof KINDS)[]).map((v) => (
            <label key={v}><input type="radio" name="kind" value={v} checked={kind === v} onChange={() => setKind(v)} /><span><Icon name={KINDS[v].icon} size={14} />{KINDS[v].short}</span></label>
          ))}
        </div>
      </div>
      <div className="so-fields">
        <label className="f so-q"><span>{k.field}</span>
          <span className="so-in"><Icon name={k.icon} size={16} /><input className="in" name="url" required placeholder={k.ph} key={kind} type={kind === 'rss' ? 'url' : 'text'} /></span>
          <small key={kind + '-tip'} className="so-tip">{k.tip}</small>
        </label>
        <label className="f"><span>Name <em className="cx-opt">optional</em></span><input className="in" name="name" placeholder={kind === 'gnews' ? 'e.g. Channel partners' : 'e.g. ET Realty'} /></label>
        <div className="f"><span id="so-scope">Use for</span>
          <div className="cx-radio-seg wide" role="radiogroup" aria-labelledby="so-scope">
            <label><input type="radio" name="scope" value="product" defaultChecked /><span>Only {productName}</span></label>
            <label><input type="radio" name="scope" value="all" /><span>All products</span></label>
          </div>
        </div>
      </div>
      <div className="so-add-foot"><Submit><Icon name="plus" size={16} strokeWidth={2.2} />Add source</Submit></div>
    </form>
  );
}

/** Active switch for a source; flips instantly and saves. */
export function SourceSwitch({ action, active, name }: { action: () => Promise<void>; active: boolean; name: string }) {
  return (
    <form action={action}>
      <input type="checkbox" role="switch" className="toggle" defaultChecked={active} aria-label={`Read “${name}” every morning`} onChange={(e) => e.currentTarget.form?.requestSubmit()} />
    </form>
  );
}

/** “⋯” row menu: open the source, or delete it behind an explicit confirm step. */
export function SourceMenu({ name, href, shared, del }: { name: string; href: string; shared: boolean; del: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [ask, setAsk] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); (box.current?.querySelector('.so-more') as HTMLElement | null)?.focus(); } };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    requestAnimationFrame(() => (box.current?.querySelector('.so-menu-pop button, .so-menu-pop a') as HTMLElement | null)?.focus());
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open, ask]);
  useEffect(() => { if (!open) setAsk(false); }, [open]);
  return (
    <div className="so-menu" ref={box}>
      <button type="button" className="so-more" aria-haspopup="menu" aria-expanded={open} aria-controls={id} aria-label={`More for “${name}”`} onClick={() => setOpen(!open)}>
        <Icon name="more" size={18} />
      </button>
      {open && (
        <div className="so-menu-pop" id={id} role="menu" aria-label={name}>
          {!ask ? (
            <>
              <a className="so-menu-i" role="menuitem" href={href} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}><Icon name="arrowUpRight" size={16} />Open source</a>
              <span className="so-menu-sep" role="separator" />
              <button type="button" className="so-menu-i danger" role="menuitem" onClick={() => setAsk(true)}><Icon name="trash" size={16} />Delete source…</button>
            </>
          ) : (
            <form action={del} className="so-confirm">
              <b>Delete “{name}”?</b>
              <span>{shared ? 'It is shared, so every product stops reading it. ' : ''}Stories already fetched stay in the pool.</span>
              <span className="so-confirm-row">
                <button type="button" className="btn sm" onClick={() => setAsk(false)}>Cancel</button>
                <Submit className="btn sm danger" pending="Deleting…">{shared ? 'Delete for all' : 'Delete'}</Submit>
              </span>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
