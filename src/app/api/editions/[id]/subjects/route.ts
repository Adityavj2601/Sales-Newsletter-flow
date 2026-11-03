import { api } from '@/lib/api';
import { suggestSubjects } from '@/lib/editions';

export const POST = api<{ id: string }>(async ({ params }) => suggestSubjects(params.id));
