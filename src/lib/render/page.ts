import type { Product } from '../settings';
import { esc, brandVars, onColor, readableOn, contrast, wordmark } from './common';

const rgbOf = (h: string) => {
  const x = h.replace('#', '');
  const n = parseInt(x.length === 3 ? x.split('').map((c) => c + c).join('') : x, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
/** `rgba()` string for a hex colour. */
export const rgba = (h: string, a: number) => `rgba(${rgbOf(h).join(',')},${a})`;
/** Linear mix of two hex colours (t = 0 → a, t = 1 → b). */
export const mix = (a: string, b: string, t: number) => {
  const x = rgbOf(a), y = rgbOf(b);
  return `#${x.map((v, i) => Math.round(v * (1 - t) + y[i] * t).toString(16).padStart(2, '0')).join('')}`;
};

export const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">';

/**
 * Design tokens for reader-facing pages: brand colours plus an Apple-style neutral palette,
 * with a dark variant. Every text/background pair is checked for ≥ 4.5:1 via readableOn/onColor.
 */
export function themeCSS(p: Product) {
  const v = brandVars(p);
  const PAPER_D = '#1c1c1e';
  const onInk = onColor(v.ink);
  const accOnInk = readableOn(v.acc, v.ink, 4.5);
  const head = contrast(v.ink, '#ffffff') >= 7 ? v.ink : '#1d1d1f';
  const tintD = mix(v.ink, PAPER_D, 0.6);
  const btnD = readableOn(v.acc, PAPER_D, 4.5);
  const accD = readableOn(v.acc, PAPER_D, 4.5);
  const accCardD = readableOn(v.acc, '#2c2c2e', 4.5);
  return `:root{--ink:${v.ink};--acc:${v.acc};--soft:${v.soft};--on-ink:${onInk};--on-acc:${onColor(v.acc)};--acc-on-ink:${accOnInk};--on-acc-on-ink:${onColor(accOnInk)};--acc-text:${readableOn(v.acc, '#ffffff')};--acc-text-soft:${readableOn(v.acc, v.soft)};--acc-btn:${readableOn(v.acc, '#ffffff', 4.5)};--on-acc-btn:${onColor(readableOn(v.acc, '#ffffff', 4.5))};
--on-ink-2:${rgba(onInk, 0.76)};--on-ink-line:${rgba(onInk, 0.16)};--on-ink-fill:${rgba(onInk, 0.1)};--ink-glass:${rgba(v.ink, 0.88)};--ink-glass-2:${rgba(v.ink, 0.9)};--ink-hi:${rgba(mix(v.ink, '#ffffff', 0.14), 0.85)};--acc-glow:${rgba(v.acc, 0.3)};--acc-shadow:${rgba(v.acc, 0.32)};
--page:#f5f5f7;--paper:#ffffff;--card:#ffffff;--text:#1d1d1f;--text-2:#3a3a3c;--muted:#6e6e73;--line:rgba(0,0,0,.09);--line-2:rgba(0,0,0,.18);--fill:#f2f2f5;--field:#f2f2f5;--head:${head};--tint:${v.soft};--tint-acc:${readableOn(v.acc, v.soft)};--acc-card:${readableOn(v.acc, '#ffffff')};
--btn:${v.ink};--on-btn:${onInk};--sel:${v.ink};--on-sel:${onInk};--chart-hi:${v.acc};--chart-lo:${rgba(v.ink, 0.26)};--chart-ink:${v.ink};--track:rgba(0,0,0,.05);--grad-a:${head};--grad-b:${readableOn(v.acc, '#ffffff', 3)};--danger:#d70015;--sw-off:#e5e5ea;
--shadow-1:0 1px 2px rgba(0,0,0,.04),0 6px 20px rgba(0,0,0,.06);--shadow-2:0 2px 8px rgba(0,0,0,.05),0 24px 64px rgba(0,0,0,.1);
--sans:-apple-system,BlinkMacSystemFont,"SF Pro Text","SF Pro Display","Inter","Segoe UI",Roboto,"Helvetica Neue",Arial,system-ui,sans-serif;--ease:cubic-bezier(.32,.72,0,1);--spring:cubic-bezier(.34,1.56,.64,1)}
@media (prefers-color-scheme:dark){:root{--page:#000000;--paper:#1c1c1e;--card:#2c2c2e;--text:#f5f5f7;--text-2:#d1d1d6;--muted:#a1a1a6;--line:rgba(255,255,255,.12);--line-2:rgba(255,255,255,.26);--fill:#2c2c2e;--field:#3a3a3c;--head:#f5f5f7;--tint:${tintD};--tint-acc:${readableOn(v.acc, tintD)};--acc-text:${accD};--acc-card:${accCardD};
--btn:${btnD};--on-btn:${onColor(btnD)};--sel:${btnD};--on-sel:${onColor(btnD)};--chart-hi:${btnD};--chart-lo:rgba(255,255,255,.24);--chart-ink:#e5e5ea;--track:rgba(255,255,255,.07);--grad-a:#ffffff;--grad-b:${readableOn(v.acc, PAPER_D, 4.5)};--danger:#ff6961;--sw-off:#39393d;
--shadow-1:0 1px 2px rgba(0,0,0,.3),0 8px 24px rgba(0,0,0,.35);--shadow-2:0 2px 8px rgba(0,0,0,.4),0 24px 64px rgba(0,0,0,.5)}}`;
}

/** Shared base: reset, type, focus, selection. */
export const BASE_CSS = `
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%;color-scheme:light dark;-webkit-tap-highlight-color:transparent}
body{margin:0;background:var(--page);color:var(--text);font:17px/1.55 var(--sans);-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility;font-kerning:normal}
a{color:inherit}img,video,iframe{max-width:100%}
::selection{background:var(--acc-glow)}
:focus-visible{outline:2px solid var(--acc-text);outline-offset:3px;border-radius:6px}
.sr{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.i{width:20px;height:20px;flex:none;display:block}
.spin{display:none;width:18px;height:18px;flex:none;border-radius:50%;border:2px solid currentColor;border-right-color:transparent;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes pop{0%{transform:scale(.6);opacity:0}60%{transform:scale(1.06);opacity:1}100%{transform:scale(1)}}
`;

const ICON = (d: string, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

/** Animated status badge for confirmation pages. `ok` draws a check, `info` an envelope, `warn` an exclamation. */
export function badge(kind: 'ok' | 'info' | 'warn' = 'ok') {
  if (kind === 'ok') return '<div class="badge ok" aria-hidden="true"><svg viewBox="0 0 64 64"><circle class="bc" cx="32" cy="32" r="29"/><path class="bk" d="M19 33.5l8.5 8.5L45 24.5"/></svg></div>';
  if (kind === 'warn') return `<div class="badge warn" aria-hidden="true">${ICON('<path d="M12 7v6"/><path d="M12 17h.01"/>')}</div>`;
  return `<div class="badge info" aria-hidden="true">${ICON('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M4 7.5l8 6 8-6"/>')}</div>`;
}

const SHELL_CSS = `
.top{position:sticky;top:0;z-index:5;background:var(--ink-glass);-webkit-backdrop-filter:saturate(180%) blur(20px);backdrop-filter:saturate(180%) blur(20px);color:var(--on-ink);padding-top:env(safe-area-inset-top)}
@supports not ((-webkit-backdrop-filter:blur(1px)) or (backdrop-filter:blur(1px))){.top{background:var(--ink)}}
.top-in{max-width:640px;margin:0 auto;height:52px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 max(20px,env(safe-area-inset-right)) 0 max(20px,env(safe-area-inset-left))}
.top a{display:flex;align-items:center;min-height:44px;color:inherit;text-decoration:none;font-weight:700;font-size:18px;letter-spacing:-.01em}
.top b{color:var(--acc-on-ink);font-weight:700}.top img{height:26px;width:auto;display:block}
.top .nl{font-size:14px;color:var(--on-ink-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.box{max-width:600px;margin:0 auto;padding:36px max(20px,env(safe-area-inset-left)) calc(48px + env(safe-area-inset-bottom));animation:rise .6s var(--ease) both}
h1{font-size:clamp(30px,8vw,40px);line-height:1.1;font-weight:700;letter-spacing:-.025em;color:var(--head);margin:0 0 12px;text-wrap:balance}
p{margin:0 0 14px;text-wrap:pretty}.muted{color:var(--muted);font-size:15px}
.lead{font-size:19px;line-height:1.45;color:var(--text-2)}
.done{text-align:center;padding:12px 0 8px}.done .lead{max-width:30em;margin-left:auto;margin-right:auto}
.badge{width:76px;height:76px;margin:0 auto 22px;border-radius:50%;display:grid;place-items:center;animation:pop .6s var(--spring) both}
.badge.ok{background:var(--btn);color:var(--on-btn);box-shadow:0 10px 30px var(--acc-glow)}
.badge.ok svg{width:76px;height:76px}.badge .bc{fill:none;stroke:var(--on-btn);stroke-opacity:.16;stroke-width:2;stroke-dasharray:183;stroke-dashoffset:183;animation:draw .7s var(--ease) .15s forwards}
.badge .bk{fill:none;stroke:var(--on-btn);stroke-width:5;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:44;stroke-dashoffset:44;animation:draw .45s var(--ease) .45s forwards}
.badge.info,.badge.warn{background:var(--tint);color:var(--tint-acc)}.badge.info .i,.badge.warn .i{width:34px;height:34px}
@keyframes draw{to{stroke-dashoffset:0}}
.panel{background:var(--card);border-radius:22px;padding:22px 20px;margin-top:28px;box-shadow:var(--shadow-1);text-align:left}
label.fl{display:block;font-size:13px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:0 0 10px}
textarea,input[type=text]{width:100%;font:inherit;font-size:17px;line-height:1.45;color:var(--text);background:var(--field);border:1px solid transparent;border-radius:14px;padding:14px 16px;resize:vertical;min-height:112px;transition:border-color .2s,box-shadow .2s,background .2s;-webkit-appearance:none;appearance:none}
textarea::placeholder{color:var(--muted)}
textarea:focus{outline:none;background:var(--paper);border-color:var(--acc-text);box-shadow:0 0 0 4px var(--acc-glow)}
.row{display:flex;flex-direction:column;gap:10px;margin-top:18px}
button,.btn{-webkit-appearance:none;appearance:none;display:flex;align-items:center;justify-content:center;gap:10px;width:100%;min-height:52px;font:600 17px/1.2 var(--sans);letter-spacing:-.01em;background:var(--btn);color:var(--on-btn);border:0;border-radius:14px;padding:0 22px;cursor:pointer;text-decoration:none;touch-action:manipulation;transition:transform .2s var(--ease),opacity .2s,filter .2s,background .2s}
button:active,.btn:active{transform:scale(.97)}
@media (hover:hover){button:hover,.btn:hover{filter:brightness(1.08)}}
.btn.alt,button.alt{background:var(--card);color:var(--head);box-shadow:0 1px 2px rgba(0,0,0,.04)}.panel .btn.alt{background:var(--field);box-shadow:none}
.btn.plain{background:transparent;color:var(--acc-text);min-height:44px}
button.destr{background:var(--card);color:var(--danger);box-shadow:0 1px 2px rgba(0,0,0,.04)}
button.solid-danger{background:var(--danger);color:#fff}
.busy{pointer-events:none;opacity:.85}.busy .spin{display:inline-block}
.flash{display:flex;align-items:center;gap:10px;background:var(--tint);color:var(--text);border-radius:14px;padding:12px 16px;margin:0 0 22px;font-weight:600;animation:rise .5s var(--ease) both}
.flash .i{color:var(--tint-acc)}
.gh{font-size:13px;font-weight:500;letter-spacing:.02em;text-transform:uppercase;color:var(--muted);margin:28px 16px 8px}
.group{background:var(--card);border-radius:16px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.04)}
.cell{position:relative;display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:52px;padding:10px 16px;cursor:pointer;-webkit-user-select:none;user-select:none;transition:background .15s}
.cell:active{background:var(--fill)}
.cell+.cell::before{content:"";position:absolute;top:0;left:16px;right:0;height:1px;background:var(--line)}
.cell .t{display:flex;flex-direction:column;min-width:0}.cell small{font-size:14px;color:var(--muted);overflow-wrap:anywhere}
.cell:focus-within{box-shadow:inset 0 0 0 2px var(--acc-text)}
.cell input{margin:0;flex:none}
input[type=radio]{-webkit-appearance:none;appearance:none;width:22px;height:22px;background:transparent;border:0;outline:0}
input[type=radio]:checked{background:var(--acc-text);-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M4.5 12.5l5 5L19.5 6.5' fill='none' stroke='%23000' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/contain no-repeat;mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M4.5 12.5l5 5L19.5 6.5' fill='none' stroke='%23000' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/contain no-repeat;animation:pop .35s var(--spring)}
input[type=checkbox]{-webkit-appearance:none;appearance:none;position:relative;width:51px;height:31px;border-radius:999px;background:var(--sw-off);cursor:pointer;outline:0;transition:background .3s var(--ease)}
input[type=checkbox]::before{content:"";position:absolute;top:2px;left:2px;width:27px;height:27px;border-radius:50%;background:#fff;box-shadow:0 3px 8px rgba(0,0,0,.15),0 1px 1px rgba(0,0,0,.16);transition:transform .35s var(--ease)}
input[type=checkbox]:checked{background:var(--sel)}input[type=checkbox]:checked::before{transform:translateX(20px)}
.foot-note{text-align:center;font-size:13px;color:var(--muted);margin-top:32px}
.list{display:grid;gap:12px;margin-top:24px}
.ed{position:relative;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:16px;padding:18px 16px 18px 18px;background:var(--card);border-radius:20px;text-decoration:none;color:inherit;box-shadow:var(--shadow-1);transition:transform .35s var(--ease),box-shadow .35s var(--ease)}
.ed:active{transform:scale(.98)}
@media (hover:hover){.ed:hover{transform:translateY(-2px);box-shadow:var(--shadow-2)}.ed:hover .chev{transform:translateX(3px)}}
.ed .no{width:48px;height:48px;border-radius:14px;background:var(--tint);color:var(--tint-acc);display:grid;place-items:center;font-weight:700;font-size:17px;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.ed .tx{min-width:0;display:flex;flex-direction:column;gap:3px}
.ed .meta{font-size:13px;color:var(--muted);font-weight:500}
.ed b{font-size:18px;line-height:1.25;font-weight:650;letter-spacing:-.015em;color:var(--head)}
.ed .dek{font-size:15px;line-height:1.4;color:var(--muted);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.ed .chev{color:var(--muted);transition:transform .3s var(--ease)}
.ed.latest{grid-template-columns:1fr auto;background:radial-gradient(110% 90% at 100% 0%,var(--acc-glow),transparent 60%),var(--ink);color:var(--on-ink);padding:24px 20px 22px 22px}
.ed.latest .no{display:none}.ed.latest b{color:var(--on-ink);font-size:23px;font-weight:700}.ed.latest .meta,.ed.latest .dek,.ed.latest .chev{color:var(--on-ink-2)}
.ed.latest .pill{align-self:flex-start;font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--on-acc-on-ink);background:var(--acc-on-ink);padding:4px 10px;border-radius:999px;margin-bottom:6px}
.empty{background:var(--card);border-radius:20px;padding:24px;color:var(--muted);text-align:center}
@media (min-width:700px){.box{padding-top:64px}.row{flex-direction:row}.row>*{flex:1}}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}.badge .bc,.badge .bk{stroke-dashoffset:0}}
`;

/** Branded page for thank-you, preferences and archive screens. */
export function shell(p: Product, title: string, inner: string, base: string) {
  const v = brandVars(p);
  const [w1, w2] = wordmark(p);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex"><meta name="color-scheme" content="light dark"><meta name="theme-color" content="${v.ink}"><title>${esc(title)} · ${esc(p.newsletter_name)}</title>
${FONTS}
<style>${themeCSS(p)}${BASE_CSS}${SHELL_CSS}</style></head><body><header class="top"><div class="top-in"><a href="${base}/e/${p.slug}" aria-label="${esc(p.newsletter_name)}: past editions">${p.brand.logoUrl ? `<img src="${esc(p.brand.logoUrl)}" alt="${esc(p.name)}">` : `<span>${esc(w1)}<b>${esc(w2)}</b></span>`}</a><span class="nl">${esc(p.newsletter_name)}</span></div></header><main class="box">${inner}<p class="foot-note">${esc(p.newsletter_name)} · a weekly briefing from ${esc(p.name)}</p></main>
<script>document.querySelectorAll('form').forEach(function(f){f.addEventListener('submit',function(ev){var b=ev.submitter||f.querySelector('button[type=submit]');if(b){b.classList.add('busy');if(!b.querySelector('.spin'))b.insertAdjacentHTML('beforeend','<span class="spin" aria-hidden="true"></span>')}})});window.addEventListener('pageshow',function(){document.querySelectorAll('.busy').forEach(function(b){b.classList.remove('busy')})});</script>
</body></html>`;
}
export const html = (s: string, status = 200) => new Response(s, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
