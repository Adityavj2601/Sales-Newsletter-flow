import { SkelPage, PhSkel, ListSkel, Bar } from '@/components/shell/Skeleton';

export default function Loading() {
  return (
    <SkelPage>
      <PhSkel actions={0} />
      <div className="se-shell">
        <div className="se-nav sk-se-nav" aria-hidden>
          {Array.from({ length: 8 }, (_, i) => <div key={i} className="row" style={{ gap: 10, padding: '6px 10px 6px 7px' }}><Bar w={22} h={22} r={6} /><Bar w={`${50 + ((i * 19) % 40)}%`} h={13} /></div>)}
        </div>
        <div className="se-pane">
          <div className="row" style={{ gap: 14 }}><Bar w={46} h={46} r={11} /><div style={{ display: 'grid', gap: 8, flex: 1 }}><Bar w={200} h={22} /><Bar w="60%" h={13} /></div></div>
          <ListSkel rows={2} lead={0} />
          <ListSkel rows={3} lead={0} />
        </div>
      </div>
    </SkelPage>
  );
}
