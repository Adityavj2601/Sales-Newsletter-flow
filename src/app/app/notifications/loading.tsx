import { SkelPage, PhSkel, ListSkel, Bar } from '@/components/shell/Skeleton';

export default function Loading() {
  return (
    <SkelPage>
      <PhSkel actions={1} />
      <div style={{ display: 'grid', gap: 8 }}><Bar w={70} h={13} style={{ marginLeft: 4 }} /><ListSkel rows={7} lead={36} /></div>
    </SkelPage>
  );
}
