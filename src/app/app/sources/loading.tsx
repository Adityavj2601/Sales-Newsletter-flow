import { SkelPage, PhSkel, ListSkel, Bar } from '@/components/shell/Skeleton';

export default function Loading() {
  return (
    <SkelPage>
      <PhSkel actions={3} />
      <div className="sk-card" style={{ minHeight: 210 }}><Bar w={140} h={18} /><Bar h={44} r={10} style={{ marginTop: 10 }} /><Bar w="60%" h={12} /></div>
      <Bar w={200} h={16} />
      <ListSkel rows={5} lead={10} round />
    </SkelPage>
  );
}
