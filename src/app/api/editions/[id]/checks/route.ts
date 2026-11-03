import { api } from '@/lib/api';
import { runChecks } from '@/lib/checks';

export const maxDuration = 300;
export const POST = api<{ id: string }>(async ({ params, body }) => runChecks(params.id, body.deep !== false));
