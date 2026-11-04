/** Contacts skeleton: the real page's header, toolbar and table shape, so nothing jumps when it loads. */
export default function Loading() {
  return (
    <div className="sk-page contacts" aria-busy="true" aria-label="Loading contacts">
      <div className="ph">
        <div className="sk-ph">
          <div className="skeleton" style={{ width: 110, height: 13 }} />
          <div className="skeleton" style={{ width: 190, height: 36 }} />
          <div className="skeleton" style={{ width: 'min(560px, 90%)', height: 15 }} />
        </div>
        <div className="sk-row">
          <div className="skeleton" style={{ width: 104, height: 34 }} />
          <div className="skeleton" style={{ width: 112, height: 34 }} />
          <div className="skeleton" style={{ width: 124, height: 34 }} />
        </div>
      </div>
      <div className="sk-row">
        <div className="skeleton" style={{ flex: '1 1 260px', maxWidth: 420, height: 38 }} />
        <div className="skeleton" style={{ width: 96, height: 36 }} />
        <div className="skeleton" style={{ width: 120, height: 36 }} />
        <div className="skeleton" style={{ width: 104, height: 36 }} />
      </div>
      <div className="sk-tbl">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="sk-tr">
            <div className="skeleton sk-av" />
            <div style={{ display: 'grid', gap: 6 }}><div className="skeleton" style={{ width: '62%', height: 13 }} /><div className="skeleton" style={{ width: '40%', height: 11 }} /></div>
            <div className="skeleton" style={{ width: '70%', height: 12 }} />
            <div className="skeleton" style={{ width: '55%', height: 12 }} />
            <div className="skeleton" style={{ width: 44, height: 22, borderRadius: 999 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
