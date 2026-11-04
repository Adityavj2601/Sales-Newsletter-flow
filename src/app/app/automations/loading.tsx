import { SkelPage, PhSkel, ListSkel, Bar } from '@/components/shell/Skeleton';

export default function Loading() {
  return (
    <SkelPage>
      <PhSkel actions={0} />
      <div className="au-grid">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="sk-card" style={{ minHeight: 280, gap: 14 }}>
            <div className="row" style={{ gap: 14 }}><Bar w={40} h={40} r={10} /><div style={{ display: 'grid', gap: 8, flex: 1 }}><Bar w="55%" h={18} /><Bar w="40%" h={12} /></div><Bar w={42} h={26} r={999} /></div>
            <Bar w="92%" h={12} /><Bar w="70%" h={12} /><Bar h={38} r={10} style={{ marginTop: 6 }} /><Bar w="50%" h={14} style={{ marginTop: 'auto' }} />
          </div>
        ))}
      </div>
      <Bar w={180} h={24} />
      <ListSkel rows={4} lead={16} round />
    </SkelPage>
  );
}
