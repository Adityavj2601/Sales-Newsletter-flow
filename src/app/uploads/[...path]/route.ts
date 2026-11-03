import fs from 'node:fs';
import path from 'node:path';
import { UPLOAD_DIR } from '@/lib/db';

const TYPES: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml', mp4: 'video/mp4', webm: 'video/webm', pdf: 'application/pdf' };
export async function GET(_: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const name = path.basename((await params).path.join('/'));
  const file = path.join(UPLOAD_DIR, name);
  if (!file.startsWith(UPLOAD_DIR) || !fs.existsSync(file)) return new Response('Not found', { status: 404 });
  const ext = name.split('.').pop()!.toLowerCase();
  return new Response(fs.readFileSync(file), { headers: { 'content-type': TYPES[ext] || 'application/octet-stream', 'cache-control': 'public, max-age=31536000, immutable', ...(ext === 'svg' ? { 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'" } : {}) } });
}
