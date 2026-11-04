import { api } from '@/lib/api';
import { all, get } from '@/lib/db';
import { saveContent } from '@/lib/editions';

export const GET = api<{ id: string }>(async ({ params }) => all('SELECT id, author, note, created_at FROM edition_versions WHERE edition_id = ? ORDER BY created_at DESC', params.id));
export const POST = api<{ id: string }>(async ({ params, body, user }) => {
  const v = get('SELECT * FROM edition_versions WHERE id = ? AND edition_id = ?', body.versionId, params.id);
  if (!v) throw new Error('Version not found');
  const e = saveContent(params.id, JSON.parse(v.content), { author: user.name, note: `Restored version from ${v.created_at.slice(0, 16).replace('T', ' ')}`, version: true });
  return { content: e.content, status: e.status, updated_at: e.updated_at };
});
