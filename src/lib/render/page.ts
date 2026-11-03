import type { Product } from '../settings';
import { esc, brandVars, onColor, wordmark } from './common';

/** Minimal branded page for thank-you, preferences and archive screens. */
export function shell(p: Product, title: string, inner: string, base: string) {
  const v = brandVars(p);
  const [w1, w2] = wordmark(p);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)} · ${esc(p.newsletter_name)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600&family=Newsreader:opsz,wght@6..72,600&display=swap">
<style>*{box-sizing:border-box}body{margin:0;background:#f3f4f6;color:#20232a;font:16px/1.6 "IBM Plex Sans",system-ui,sans-serif}
.top{background:${v.ink};color:${onColor(v.ink)};padding:16px 20px}.top a{color:inherit;text-decoration:none;font-weight:600}.top b{color:${v.acc}}
.box{max-width:560px;margin:28px auto;background:#fff;border-radius:14px;padding:28px 24px;box-shadow:0 1px 0 rgba(0,0,0,.04)}
h1{font:600 28px/1.15 "Newsreader",Georgia,serif;color:${v.ink};margin:0 0 10px}p{margin:0 0 14px}.muted{color:#626a76;font-size:14px}
textarea,input[type=text]{width:100%;font:inherit;border:1px solid #d7dbe1;border-radius:10px;padding:10px 12px}
button,.btn{display:inline-block;font:600 15px "IBM Plex Sans",sans-serif;background:${v.ink};color:${onColor(v.ink)};border:0;border-radius:999px;padding:11px 20px;cursor:pointer;text-decoration:none}
.btn.alt{background:#fff;color:${v.ink};border:1.5px solid ${v.ink}}label{display:flex;gap:10px;align-items:flex-start;margin:8px 0}input[type=radio],input[type=checkbox]{accent-color:${v.ink};margin-top:5px}
.row{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}.list a{display:block;padding:14px 0;border-bottom:1px solid #eceef1;text-decoration:none;color:inherit}.list b{font:600 19px/1.3 "Newsreader",Georgia,serif;color:${v.ink}}
</style></head><body><div class="top"><a href="${base}/e/${p.slug}">${p.brand.logoUrl ? `<img src="${esc(p.brand.logoUrl)}" alt="${esc(p.name)}" style="height:26px">` : `${esc(w1)}<b>${esc(w2)}</b>`}</a></div><div class="box">${inner}</div></body></html>`;
}
export const html = (s: string, status = 200) => new Response(s, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
