/** Leads skeleton: header, stage filter and the table, matching the real page. */
export default function Loading() {
  return (
    <div className="sk-page leads" aria-busy="true" aria-label="Loading leads">
      <div className="ph">
        <div className="sk-ph">
          <div className="skeleton" style={{ width: 110, height: 13 }} />
          <div className="skeleton" style={{ width: 140, height: 36 }} />
          <div className="skeleton" style={{ width: 'min(520px, 90%)', height: 15 }} />
        </div>
        <div className="sk-row">
          <div className="skeleton" style={{ width: 168, height: 34 }} />
          <div className="skeleton" style={{ width: 104, height: 34 }} />
        </div>
      </div>
      <div className="skeleton sk-lp" style={{ borderRadius: 14 }} />
      <div className="sk-tbl">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="sk-tr">
            <div className="skeleton sk-av" />
            <div style={{ display: 'grid', gap: 6 }}><div className="skeleton" style={{ width: '58%', height: 13 }} /><div className="skeleton" style={{ width: '42%', height: 11 }} /></div>
            <div className="skeleton" style={{ width: '64%', height: 24, borderRadius: 999 }} />
            <div className="skeleton" style={{ width: '45%', height: 22, borderRadius: 999 }} />
            <div className="skeleton" style={{ width: 56, height: 28 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
