import { api } from '@/lib/api';
import { aiEdit } from '@/lib/editions';

export const maxDuration = 300;
export const POST = api<{ id: string }>(async ({ params, body }) => {
  if (!String(body.instruction || '').trim()) throw new Error('Tell the copilot what to change.');
  return aiEdit(params.id, String(body.instruction).slice(0, 2000), body.blockId || undefined);
});
