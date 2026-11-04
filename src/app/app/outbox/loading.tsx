import { SkelPage, PhSkel, ListSkel } from '@/components/shell/Skeleton';

export default function Loading() {
  return (
    <SkelPage>
      <PhSkel actions={2} />
      <ListSkel rows={8} lead={30} round />
    </SkelPage>
  );
}
