import { api } from '@/lib/api';
import { getEdition, saveContent } from '@/lib/editions';

export const GET = api<{ id: string }>(async ({ params }) => {
  const e = getEdition(params.id);
  if (!e) throw new Error('Edition not found');
  return e;
});
export const PUT = api<{ id: string }>(async ({ params, body, user }) => {
  const e = saveContent(params.id, body.content, { author: user.name, note: body.note, version: !!body.version });
  if (body.plannedFor !== undefined) {
    const { update } = await import('@/lib/db');
    update('editions', e.id, { planned_for: body.plannedFor || null });
  }
  return { status: e.status, updated_at: e.updated_at, slug: e.slug };
});
