/** Instant skeleton while a studio page loads: the standard page header, then Home's shape (one compact row of
 *  numbers, then the work beside people and system). Routes with a distinctive shape (e.g. /app/editions and the
 *  editor) ship their own loading.tsx. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="ph">
        <div>
          <span className="eyebrow"><span className="skeleton" style={{ display: 'inline-block', width: 110, height: 12, verticalAlign: 'middle' }} /></span>
          <div className="skeleton" style={{ width: 'min(360px, 70%)', height: 34, borderRadius: 10, margin: '2px 0 0' }} />
          <div className="skeleton" style={{ width: 'min(520px, 90%)', height: 14, marginTop: 12 }} />
        </div>
      </div>
      <div style={{ display: 'grid', gap: 18 }}>
        <div className="skeleton" style={{ height: 150, borderRadius: 18 }} />
        <div className="grid2" style={{ alignItems: 'start', gap: 18 }}>
          <div className="skeleton" style={{ height: 420, borderRadius: 18 }} />
          <div className="skeleton" style={{ height: 300, borderRadius: 18 }} />
        </div>
      </div>
    </div>
  );
}
