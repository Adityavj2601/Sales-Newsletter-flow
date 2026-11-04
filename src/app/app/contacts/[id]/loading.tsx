/** Contact skeleton: header, contact card and the two-column body. */
export default function Loading() {
  return (
    <div className="sk-page pc" aria-busy="true" aria-label="Loading contact">
      <div className="ph">
        <div className="sk-ph">
          <div className="skeleton" style={{ width: 150, height: 13 }} />
          <div className="skeleton" style={{ width: 220, height: 36 }} />
          <div className="skeleton" style={{ width: 'min(320px, 80%)', height: 15 }} />
        </div>
        <div className="sk-row">
          <div className="skeleton" style={{ width: 76, height: 34 }} />
          <div className="skeleton" style={{ width: 112, height: 34 }} />
        </div>
      </div>
      <div className="skeleton" style={{ height: 168, borderRadius: 18 }} />
      <div className="pc-grid">
        <div className="skeleton" style={{ height: 320, borderRadius: 18 }} />
        <div className="skeleton" style={{ height: 320, borderRadius: 18 }} />
      </div>
    </div>
  );
}
