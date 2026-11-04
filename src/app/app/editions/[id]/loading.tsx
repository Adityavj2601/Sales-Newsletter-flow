'use client';
import { usePathname } from 'next/navigation';
import AppLoading from '../../loading';

/** Editor skeleton: toolbar, block list, device preview and inspector in their real positions.
 *  This boundary also wraps the Send and Results sub-pages; those get the generic page skeleton. */
export default function Loading() {
  const path = usePathname() || '';
  if (/\/(distribute|analytics)(\/|$)/.test(path)) return <AppLoading />;
  return (
    <div className="ed ed-route sk-page" aria-busy="true" aria-label="Loading the editor">
      <div className="ed-top">
      <div className="statusbar ed-bar">
        <div className="tb-l">
          <span className="skeleton sk-line" style={{ width: 84, height: 16 }} />
          <span className="skeleton sk-line" style={{ width: 'min(320px, 50%)', height: 18 }} />
          <span className="skeleton sk-pill" />
        </div>
        <div className="tb-r"><span className="skeleton sk-btn" style={{ width: 128, borderRadius: 999 }} /></div>
      </div>
      </div>
      <div className="ed-shell ed-v2">
        <div className="ed-col ed-left">
          <div className="pane-h"><h2>Content</h2></div>
          <div className="ed-blocks">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="blk sk-blk">
                <span className="skeleton sk-bi" />
                <span className="sk-t"><span className="skeleton sk-line" style={{ width: 70, height: 10 }} /><span className="skeleton sk-line" style={{ width: `${86 - (i % 3) * 14}%` }} /></span>
              </div>
            ))}
          </div>
        </div>
        <div className="ed-col ed-center">
          <div className="pv-head"><span className="skeleton sk-seg" /></div>
          <div className="pv-stage"><span className="skeleton sk-device" /></div>
        </div>
        <aside className="ed-col ed-right">
          <div className="insp">
            <div className="insp-h"><span className="skeleton sk-seg" style={{ width: '100%' }} /></div>
            <div className="insp-b sk-insp">
              <span className="skeleton" style={{ width: 52, height: 52, borderRadius: 16 }} />
              <span className="skeleton sk-line" style={{ width: '60%' }} />
              <span className="skeleton sk-line" style={{ width: '80%', height: 11 }} />
              {[0, 1, 2, 3].map((i) => <span key={i} className="skeleton" style={{ width: '100%', height: 38, borderRadius: 12 }} />)}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
