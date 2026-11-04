import { SkelPage, PhSkel, ListSkel, Bar } from '@/components/shell/Skeleton';

export default function Loading() {
  return (
    <SkelPage>
      <PhSkel actions={2} />
      <div className="row" style={{ justifyContent: 'space-between', margin: '-8px 0' }}><Bar w={300} h={14} /><Bar w={220} h={13} /></div>
      <Bar h={54} r={14} />
      <div className="row" style={{ justifyContent: 'space-between' }}><Bar w={380} h={34} r={11} /><Bar w={250} h={34} r={10} /></div>
      <ListSkel rows={6} lead={42} round tall />
    </SkelPage>
  );
}
