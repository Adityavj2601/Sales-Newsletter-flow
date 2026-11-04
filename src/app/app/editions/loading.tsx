/** Editions list skeleton: same header, "Up next" card and table rhythm as the real page, so nothing jumps. */
export default function Loading() {
  return (
    <div className="eds sk-page" aria-busy="true" aria-label="Loading editions">
      <div className="ph">
        <div>
          <span className="eyebrow"><span className="skeleton sk-line" style={{ width: 96 }} /></span>
          <h1>Editions</h1>
          <p className="sub"><span className="skeleton sk-line" style={{ width: 'min(380px, 80%)' }} /></p>
        </div>
        <div className="row"><span className="skeleton sk-btn" style={{ width: 128 }} /></div>
      </div>
      <section className="eds-next sk-next">
        <span className="skeleton sk-cover" />
        <div className="eds-next-b">
          <span className="skeleton sk-line" style={{ width: 150, height: 12 }} />
          <span className="skeleton sk-line" style={{ width: '82%', height: 26 }} />
          <span className="skeleton sk-line" style={{ width: '64%' }} />
          <span className="skeleton sk-line" style={{ width: '100%', maxWidth: 520, height: 10, margin: '14px 0 10px' }} />
          <div className="row"><span className="skeleton sk-btn" style={{ width: 150 }} /><span className="skeleton sk-btn" style={{ width: 92 }} /></div>
        </div>
      </section>
      <section className="eds-grp">
        <div className="eds-grp-h"><h2>Upcoming</h2></div>
        <div className="tbl-wrap eds-list sk-list">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="sk-row">
              <span className="skeleton sk-no" />
              <span className="skeleton sk-thumb" />
              <span className="sk-t"><span className="skeleton sk-line" style={{ width: `${72 - i * 9}%` }} /><span className="skeleton sk-line" style={{ width: '38%', height: 11 }} /></span>
              <span className="skeleton sk-pill" />
              <span className="skeleton sk-line sk-date" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
