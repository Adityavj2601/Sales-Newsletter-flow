/* Route loading skeletons. Each mirrors its page: the standard .ph header (eyebrow, title, sub) at the exact
   position real titles sit, then that page's own list, table or grid shape. Server-safe. */
type BarProps = { w?: number | string; h?: number; r?: number; style?: React.CSSProperties };

export function Bar({ w = '100%', h = 14, r, style }: BarProps) {
  return <span className="skeleton" style={{ display: 'block', width: w, height: h, ...(r !== undefined ? { borderRadius: r } : {}), ...style }} />;
}

/** Standard page header placeholder: same box model as .ph, so the title line never jumps when content arrives. */
export function PhSkel({ actions = 1, sub = true }: { actions?: number; sub?: boolean }) {
  return (
    <div className="ph" aria-hidden>
      <div>
        <span className="eyebrow"><Bar w={130} h={12} style={{ marginTop: 3 }} /></span>
        <Bar w="min(320px, 70%)" h={36} r={10} style={{ marginTop: 1 }} />
        {sub && <Bar w="min(560px, 92%)" h={14} style={{ marginTop: 13 }} />}
      </div>
      {actions > 0 && <div className="row">{Array.from({ length: actions }, (_, i) => <Bar key={i} w={i === actions - 1 ? 132 : 112} h={34} r={10} />)}</div>}
    </div>
  );
}

/** A card holding n list rows (leading icon or avatar, two text lines, trailing control). */
export function ListSkel({ rows = 6, lead = 36, tall = false, round = false }: { rows?: number; lead?: number; tall?: boolean; round?: boolean }) {
  return (
    <div className="sk-list" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="sk-row" style={{ minHeight: tall ? 96 : 62 }}>
          {lead > 0 && <Bar w={lead} h={lead} r={round ? 999 : Math.round(lead / 3.6)} />}
          <div className="sk-lines">
            <Bar w={`${52 + ((i * 17) % 36)}%`} h={14} />
            <Bar w={`${28 + ((i * 23) % 40)}%`} h={11} />
            {tall && <Bar w="78%" h={11} />}
          </div>
          <Bar w={68} h={28} r={999} />
        </div>
      ))}
    </div>
  );
}

export function SkelPage({ children }: { children: React.ReactNode }) {
  return <div className="pg sk-page" aria-busy="true" aria-label="Loading">{children}</div>;
}
