/* Inset grouped lists (iOS Settings / macOS System Settings). Server-safe. */

export function Group({ title, footer, children, className = '', id }: { title?: React.ReactNode; footer?: React.ReactNode; children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section className={`cx-group ${className}`} id={id}>
      {title && <h3 className="cx-group-h">{title}</h3>}
      <div className="cx-group-box">{children}</div>
      {footer && <p className="cx-group-f">{footer}</p>}
    </section>
  );
}

/**
 * A row: label (and optional helper text) on the left, control on the right.
 * `as="label"` (default) wires a single control to its label; use `as="div"` for rows with several controls.
 */
export function Row({ label, sub, children, as = 'label', stack, className = '', wide }: { label: React.ReactNode; sub?: React.ReactNode; children?: React.ReactNode; as?: 'label' | 'div'; stack?: boolean; className?: string; wide?: boolean }) {
  const Tag = as as any;
  return (
    <Tag className={`cx-row ${stack ? 'stack' : ''} ${wide ? 'wide' : ''} ${className}`} {...(as === 'div' ? { role: 'group' } : {})}>
      <span className="cx-row-l"><span className="cx-row-t">{label}</span>{sub && <small className="cx-row-s">{sub}</small>}</span>
      {children !== undefined && <span className="cx-row-c">{children}</span>}
    </Tag>
  );
}

const GLYPH = { info: 'i', warn: '!', ok: '✓', bad: '!' } as const;
/** The app's one banner: globals .notice with a leading status glyph. */
export function Callout({ tone = 'info', children }: { icon?: string; tone?: 'info' | 'warn' | 'ok' | 'bad'; children: React.ReactNode }) {
  return <div className={`notice${tone === 'info' ? '' : ` ${tone}`}`}><span className="ni" aria-hidden>{GLYPH[tone]}</span><div>{children}</div></div>;
}
