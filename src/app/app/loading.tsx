/** Instant skeleton while a studio page loads. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" style={{ display: 'grid', gap: 18 }}>
      <div className="skeleton" style={{ width: 120, height: 14 }} />
      <div className="skeleton" style={{ width: 'min(420px, 80%)', height: 34 }} />
      <div className="grid2">
        <div className="skeleton" style={{ height: 180, borderRadius: 18 }} />
        <div className="skeleton" style={{ height: 180, borderRadius: 18 }} />
      </div>
      <div className="skeleton" style={{ height: 260, borderRadius: 18 }} />
    </div>
  );
}
