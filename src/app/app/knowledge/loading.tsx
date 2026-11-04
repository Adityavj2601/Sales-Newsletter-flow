import { SkelPage, PhSkel, Bar } from '@/components/shell/Skeleton';

export default function Loading() {
  return (
    <SkelPage>
      <PhSkel actions={2} />
      <div className="sk-card" style={{ minHeight: 104 }}><Bar w={120} h={12} /><Bar w="90%" h={14} /><Bar w="70%" h={14} /></div>
      {[0, 1].map((s) => (
        <div key={s} style={{ display: 'grid', gap: 14 }}>
          <div className="row" style={{ gap: 12 }}><Bar w={28} h={28} r={7} /><Bar w={220} h={22} /></div>
          <div className="sk-grid">
            {[0, 1, 2].map((i) => (
              <div key={i} className="sk-card" style={{ minHeight: 210 }}>
                <Bar w={72} h={22} r={999} /><Bar w="80%" h={18} /><Bar h={12} /><Bar w="86%" h={12} /><Bar w="60%" h={12} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </SkelPage>
  );
}
