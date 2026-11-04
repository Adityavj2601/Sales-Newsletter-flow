import { api } from '@/lib/api';
import { activeProduct } from '@/lib/context';
import { blankEdition, draftEdition } from '@/lib/editions';
import { runChecks } from '@/lib/checks';

export const maxDuration = 300;
export const POST = api(async ({ user, body }) => {
  const p = await activeProduct();
  if (!p) throw new Error('No product selected');
  if (body.mode === 'blank') {
    const e = blankEdition(p.id, user.name, body.plannedFor);
    return { id: e.id, message: 'Blank edition created.' };
  }
  const { edition, mode, model } = await draftEdition(p.id, { storyIds: Array.isArray(body.storyIds) && body.storyIds.length ? body.storyIds : undefined, kbIds: body.kbIds, brief: body.brief, plannedFor: body.plannedFor }, user.name);
  await runChecks(edition.id, false).catch(() => null);
  return { id: edition.id, message: mode === 'ai' ? `Draft written by ${model}. Run all checks before approving.` : 'Demo draft built. Connect an AI provider for real writing.' };
});
