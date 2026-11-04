import { EnsureProduct } from '@/components/EnsureProduct';
import { activeProduct } from '@/lib/context';
import { requireUser } from '@/lib/auth';
import { notFound } from 'next/navigation';
import { all } from '@/lib/db';
import { getEdition } from '@/lib/editions';
import { getProduct, baseUrl } from '@/lib/settings';
import { configuredProviders } from '@/lib/ai/providers';
import { Editor } from './Editor';
import { duplicate, deleteEdition } from '../../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Editor' };

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const e = getEdition(id);
  if (!e) notFound();
  const p = getProduct(e.product_id)!;
  const kb = all('SELECT id, title, summary, problem, result, pillar, status, media_url, client_name, client_permission FROM kb_items WHERE product_id = ? AND active = 1 ORDER BY pillar, title', p.id);
  const stories = all("SELECT id, title, url, publisher, published_at FROM stories WHERE product_id = ? AND status IN ('new','shortlisted','used') ORDER BY created_at DESC LIMIT 40", p.id);
  const __active = await activeProduct();
  return (
    <>
    <EnsureProduct productId={e.product_id} activeId={__active?.id || null} />
    <Editor
      edition={JSON.parse(JSON.stringify(e))}
      product={{ id: p.id, name: p.name, slug: p.slug, newsletter: p.newsletter_name }}
      kb={kb as any}
      stories={stories as any}
      publicUrl={`${baseUrl()}/e/${p.slug}/${e.slug}`}
      aiReady={configuredProviders().length > 0}
      duplicateAction={duplicate.bind(null, e.id)}
      deleteAction={deleteEdition.bind(null, e.id)}
    />
    </>
  );
}
