import fs from 'node:fs';
import path from 'node:path';
import { api } from '@/lib/api';
import { UPLOAD_DIR, token } from '@/lib/db';
import { baseUrl } from '@/lib/settings';

const OK: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'video/mp4': 'mp4', 'video/webm': 'webm', 'application/pdf': 'pdf' };

export const POST = api(async ({ req }) => {
  const fd = await req.formData();
  const f = fd.get('file');
  if (!(f instanceof File)) throw new Error('No file received.');
  const ext = OK[f.type];
  if (!ext) throw new Error('Use PNG, JPG, WebP, GIF, SVG, MP4, WebM or PDF.');
  if (f.size > 25 * 1024 * 1024) throw new Error('Files must be under 25 MB. For long videos, use YouTube or Vimeo.');
  const name = `${new Date().toISOString().slice(0, 10)}-${token(8)}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), Buffer.from(await f.arrayBuffer()));
  return { url: `${baseUrl(new URL(req.url).origin)}/uploads/${name}` };
});
