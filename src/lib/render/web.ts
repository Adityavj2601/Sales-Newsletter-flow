import { imgKey } from '../crypto';
import type { Product } from '../settings';
import type { Edition } from '../editions';
import { CTA_LABELS, PILLARS, type Block, type CtaAction, type EditionContent } from '../types';
import { esc, paras, brandVars, youTubeId, vimeoId, sourceLine, wordmark } from './common';
import { chartHTML } from './chart';
import { themeCSS, BASE_CSS, FONTS } from './page';
import { fmtDate } from '../format';

export type WebCtx = { base: string; token?: string | null; firstName?: string; preview?: boolean; tz?: string };

const svg = (d: string, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const I = {
  share: '<path d="M12 3.5v11"/><path d="M8 7l4-4 4 4"/><path d="M7.5 10.5H6a1.5 1.5 0 0 0-1.5 1.5v7A1.5 1.5 0 0 0 6 20.5h12a1.5 1.5 0 0 0 1.5-1.5v-7a1.5 1.5 0 0 0-1.5-1.5h-1.5"/>',
  arrow: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  user: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.8-3.4 3.6-5.5 7-5.5s6.2 2.1 7 5.5"/>',
  bulb: '<path d="M9.5 18h5"/><path d="M10.5 21h3"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.1V16h5v-.1c0-.8.4-1.6 1.1-2.1A6 6 0 0 0 12 3z"/>',
  book: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17"/><path d="M8 3v4"/><path d="M16 3v4"/>',
  more: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M4 7.5l8 6 8-6"/>',
  interested: '<path d="M12 20.5s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.9c0 5.6-7.5 10-7.5 10z"/>',
  notnow: '<path d="M6 12h12"/>',
};
const ACT_ICON: Record<CtaAction, string> = { interested: I.interested, book: I.book, more: I.more, share: I.share, notnow: I.notnow };

const CSS = `
body{background:linear-gradient(var(--ink),var(--ink)) 0 0/100% 300px no-repeat,var(--page)}
.js .rv{opacity:0;transform:translateY(22px);transition:opacity .8s var(--ease),transform .9s var(--ease);transition-delay:var(--d,0s)}
.js .rv.in{opacity:1;transform:none}
/* Preview banner */
.pv{background:#fff4ce;color:#5b4300;font-size:13px;font-weight:500;text-align:center;padding:10px 16px}
/* Navigation: brand glass with collapsing title and reading progress */
.nav{position:sticky;top:0;z-index:20;background:var(--ink-glass);-webkit-backdrop-filter:saturate(180%) blur(20px);backdrop-filter:saturate(180%) blur(20px);color:var(--on-ink);padding-top:env(safe-area-inset-top)}
@supports not ((-webkit-backdrop-filter:blur(1px)) or (backdrop-filter:blur(1px))){.nav{background:var(--ink)}}
.nav-in{max-width:1040px;margin:0 auto;height:52px;display:flex;align-items:center;gap:12px;padding:0 max(8px,env(safe-area-inset-right)) 0 max(20px,env(safe-area-inset-left))}
.logo{display:flex;align-items:center;min-height:44px;text-decoration:none;font-weight:700;font-size:18px;letter-spacing:-.01em;flex:none}
.logo img{height:26px;width:auto;display:block}.logo b{color:var(--acc-on-ink);font-weight:700}
.nav-mid{position:relative;flex:1;min-width:0;align-self:stretch}
.nav-mid::before{content:"";position:absolute;left:0;top:17px;bottom:17px;width:1px;background:var(--on-ink-line)}
.nav-mid span{position:absolute;left:12px;right:0;top:0;line-height:52px;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:opacity .35s var(--ease),transform .5s var(--ease)}
.nav-nl{color:var(--on-ink-2)}
.nav-t{font-weight:600;opacity:0;transform:translateY(10px)}
.nav.s .nav-nl{opacity:0;transform:translateY(-10px)}.nav.s .nav-t{opacity:1;transform:none}
.nav-sh{flex:none;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;color:var(--on-ink);transition:background .2s,transform .25s var(--ease)}
.nav-sh:active{transform:scale(.88);background:var(--on-ink-fill)}
@media (hover:hover){.nav-sh:hover{background:var(--on-ink-fill)}}
.prog{position:absolute;left:0;right:0;bottom:0;height:2px;pointer-events:none;overflow:hidden}
.prog i{display:block;height:100%;background:var(--acc-on-ink);transform-origin:0 50%;transform:scaleX(0);will-change:transform}
/* Hero */
.hero{position:relative;color:var(--on-ink);background:radial-gradient(720px 480px at 0% 40%,var(--ink-hi),transparent 70%),var(--ink);padding:40px 0 68px;overflow:hidden}
.hero-in{max-width:760px;margin:0 auto;padding:0 max(20px,env(safe-area-inset-left))}
.hero-in>*{animation:rise .9s var(--ease) both}
.hero-in>:nth-child(2){animation-delay:.06s}.hero-in>:nth-child(3){animation-delay:.12s}.hero-in>:nth-child(4){animation-delay:.18s}
.kicker{display:block;font-size:13px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--acc-on-ink);margin:0 0 14px}
.hero h1{font-size:clamp(34px,9.4vw,60px);line-height:1.05;font-weight:700;letter-spacing:-.03em;margin:0 0 16px;text-wrap:balance}
.dek{font-size:clamp(19px,5vw,23px);line-height:1.42;letter-spacing:-.012em;color:var(--on-ink-2);margin:0 0 24px;text-wrap:pretty;max-width:36em}
.by{display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:14px;color:var(--on-ink-2)}
.chip{display:inline-flex;align-items:center;gap:6px;min-height:30px;padding:0 12px 0 9px;border-radius:999px;background:var(--on-ink-fill);color:var(--on-ink);font-weight:500;white-space:nowrap}
.chip .i{width:16px;height:16px;opacity:.85}
/* Article sheet */
.sheet{position:relative;z-index:1;max-width:760px;margin:-30px auto 0;background:var(--paper);border-radius:28px 28px 0 0;padding:6px max(20px,env(safe-area-inset-left)) 12px}
.sec{padding:32px 0}
.sec+.sec{border-top:1px solid var(--line)}
.sec.boxed,.sec.boxed+.sec{border-top:0}
.sec.boxed{padding:14px 0}
.sheet>.sec:first-child{padding-top:20px}
.lbl{display:block;font-size:12px;line-height:1.3;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--acc-text);margin:0 0 12px}
h2{font-size:clamp(26px,6.8vw,34px);line-height:1.12;font-weight:700;letter-spacing:-.024em;color:var(--head);margin:0 0 14px;text-wrap:balance}
.sec p{margin:0 0 16px;text-wrap:pretty}
.sec p:last-child{margin-bottom:0}
.box{background:var(--tint);border-radius:24px;padding:24px 22px 26px}
.box .lbl{color:var(--tint-acc)}
.tldr ul{list-style:none;margin:0;padding:0;display:grid;gap:14px;counter-reset:n}
.tldr li{position:relative;padding-left:40px;counter-increment:n;line-height:1.5}
.tldr li::before{content:counter(n);position:absolute;left:0;top:0;width:26px;height:26px;border-radius:50%;background:var(--btn);color:var(--on-btn);font-size:13px;font-weight:700;line-height:26px;text-align:center;font-variant-numeric:tabular-nums}
/* Number of the week */
.stat .big{display:inline-block;max-width:100%;font-size:clamp(56px,16vw,112px);line-height:1;font-weight:700;letter-spacing:-.045em;font-variant-numeric:tabular-nums;color:var(--head);background:linear-gradient(100deg,var(--grad-a) 30%,var(--grad-b) 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;padding:4px 4px 8px 0;margin:2px 0 8px;overflow-wrap:anywhere}
.stat .cap{font-size:19px;line-height:1.45;letter-spacing:-.01em;color:var(--text-2);max-width:32em}
/* Stories */
.op{display:inline-flex;align-items:center;font-size:11px;font-weight:700;letter-spacing:.09em;background:var(--btn);color:var(--on-btn);padding:5px 11px;border-radius:999px;margin-bottom:14px}
.why{display:grid;grid-template-columns:auto 1fr;gap:6px 12px;align-items:start;background:var(--tint);border-radius:18px;padding:16px 18px 18px;margin:22px 0 2px;font-size:16px;line-height:1.5}
.why .i{grid-row:span 2;width:22px;height:22px;color:var(--tint-acc)}
.why b{font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--tint-acc);line-height:22px}
.src{font-size:13px;line-height:1.5;color:var(--muted);margin-top:16px}
.src a,.sources a{color:var(--muted);text-decoration:underline;text-decoration-color:var(--line-2);text-underline-offset:3px;transition:color .2s}
.src a{display:inline-block;padding:10px 0;margin:-10px 0}
@media (hover:hover){.src a:hover,.sources a:hover{color:var(--text)}}
/* Chart */
.insight{font-weight:600;color:var(--text)}
.plot{margin:20px 0 0;background:var(--fill);border-radius:22px;padding:22px 18px 18px}
.bars{display:grid;gap:16px}
.hb-h{display:flex;justify-content:space-between;align-items:baseline;gap:12px;font-size:15px;line-height:1.3;margin-bottom:8px}
.hb-l{color:var(--text-2);min-width:0}
.hb-v{font-weight:700;font-variant-numeric:tabular-nums;color:var(--text);transition:opacity .5s var(--ease) calc(.25s + var(--i)*70ms)}
.hb.hi .hb-v{color:var(--acc-text)}
.hb-t{position:relative;height:12px;border-radius:6px;background:var(--track)}
.hb-t i{position:absolute;top:0;bottom:0;border-radius:6px;background:var(--chart-lo);transform-origin:0 50%;transition:transform 1s var(--ease) calc(var(--i)*70ms)}
.hb-t i.neg{transform-origin:100% 50%}
.hb.hi .hb-t i{background:var(--chart-hi)}
.hb-t b{position:absolute;top:-4px;bottom:-4px;width:1.5px;background:var(--line-2)}
.cl-w{display:flex;align-items:stretch}
.cl{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center}
.cl-p{position:relative;width:100%;height:180px;margin-top:26px}
.cl-p::after{content:"";position:absolute;left:0;right:0;bottom:var(--z);height:1.5px;background:var(--line-2)}
.cl-p i{position:absolute;left:50%;width:min(44px,62%);transform:translateX(-50%);border-radius:8px 8px 3px 3px;background:var(--chart-lo);transform-origin:50% 100%;transition:transform 1s var(--ease) calc(var(--i)*60ms)}
.cl-p i.neg{border-radius:3px 3px 8px 8px;transform-origin:50% 0}
.cl.hi .cl-p i{background:var(--chart-hi)}
.cl-v{position:absolute;left:0;right:0;text-align:center;font-size:13px;font-weight:700;font-variant-numeric:tabular-nums;color:var(--text);white-space:nowrap;transition:opacity .5s var(--ease) calc(.3s + var(--i)*60ms)}
.cl.hi .cl-v{color:var(--acc-text)}
.cl-l{margin-top:10px;font-size:12.5px;line-height:1.25;color:var(--muted);text-align:center;padding:0 3px;max-width:100%;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.ln-p{position:relative;height:200px;margin:28px 0 0}
.ln-p svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;transition:clip-path 1.3s var(--ease)}
.ln-l{fill:none;stroke:var(--chart-ink);stroke-width:2.5;stroke-linejoin:round;stroke-linecap:round}
.ln-d{position:absolute;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;background:var(--paper);border:2.5px solid var(--chart-ink);transition:opacity .4s var(--ease) calc(.2s + var(--i)*80ms),transform .5s var(--spring) calc(.2s + var(--i)*80ms)}
.ln-d.hi{width:14px;height:14px;margin:-7px 0 0 -7px;background:var(--chart-hi);border-color:var(--paper);box-shadow:0 0 0 4px var(--acc-glow)}
.ln-v{position:absolute;transform:translate(-50%,calc(-100% - 12px));font-size:13px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--text);transition:opacity .5s var(--ease) 1s}
.ln-v.hi{color:var(--acc-text)}
.ln-x{display:flex;margin-top:12px}
.ln-x span{flex:1;min-width:0;text-align:center;font-size:12.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 2px}
@media (max-width:520px){.ln.dense .ln-x span:nth-child(even),.cols.dense .cl:nth-child(even) .cl-l{visibility:hidden}.cols.dense .cl-v{font-size:11px}}
.js .plot:not(.in) .hb-t i{transform:scaleX(0)}
.js .plot:not(.in) .cl-p i{transform:translateX(-50%) scaleY(0)}
.js .plot:not(.in) .hb-v,.js .plot:not(.in) .cl-v,.js .plot:not(.in) .ln-v,.js .plot:not(.in) .ln-d{opacity:0}
.js .plot:not(.in) .ln-d{transform:scale(.3)}
.js .plot:not(.in) .ln-p svg{clip-path:inset(0 100% 0 0)}
.ln-p svg{clip-path:inset(0 0 0 0)}
/* Our work */
.cards{display:grid;gap:16px}
.card{background:var(--card);border:1px solid var(--line);border-radius:24px;padding:20px 20px 22px;display:grid;gap:12px;box-shadow:var(--shadow-1);transition:transform .45s var(--ease),box-shadow .45s var(--ease),opacity .8s var(--ease)}
@media (hover:hover){.card:hover{transform:translateY(-3px);box-shadow:var(--shadow-2)}}
.card .pl{justify-self:start;font-size:12px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--acc-card)}
.card h3{font-size:22px;line-height:1.22;font-weight:700;letter-spacing:-.018em;color:var(--head);margin:0;text-wrap:balance}
.card p{margin:0;color:var(--text-2);font-size:16px;line-height:1.5}
.card img,.card video{border-radius:16px;width:100%;display:block}
.pill{justify-self:start;display:inline-flex;align-items:center;gap:8px;min-height:46px;padding:0 20px;margin-top:6px;border-radius:999px;background:var(--btn);color:var(--on-btn);font-weight:600;font-size:15.5px;letter-spacing:-.005em;text-decoration:none;touch-action:manipulation;transition:transform .2s var(--ease),filter .2s}
.pill .i{width:18px;height:18px;transition:transform .3s var(--ease)}
.pill:active{transform:scale(.96)}
@media (hover:hover){.pill:hover{filter:brightness(1.1)}.pill:hover .go{transform:translateX(3px)}}
/* Media, quote */
.vid{position:relative;aspect-ratio:16/9;border-radius:18px;overflow:hidden;background:#000}.vid iframe,.vid video{position:absolute;inset:0;width:100%;height:100%;border:0}
figure{margin:0}figcaption{font-size:14px;line-height:1.45;color:var(--muted);margin-top:10px}
.pic img{display:block;width:100%;border-radius:18px}
blockquote{margin:0;font-size:clamp(24px,6.2vw,30px);line-height:1.28;font-weight:600;letter-spacing:-.02em;color:var(--head);text-wrap:balance}
blockquote::before{content:"";display:block;width:36px;height:4px;border-radius:2px;background:var(--acc-text);margin-bottom:18px}
blockquote+cite{display:block;margin-top:14px;color:var(--muted);font-style:normal;font-size:15px}
/* Poll */
.q{font-size:21px;line-height:1.3;font-weight:700;letter-spacing:-.016em;color:var(--head);margin:0 0 18px!important}
.poll{display:grid;gap:10px}
.poll button{-webkit-appearance:none;appearance:none;display:flex;align-items:center;justify-content:space-between;gap:14px;width:100%;min-height:56px;padding:12px 14px 12px 18px;font:inherit;font-size:17px;line-height:1.35;text-align:left;color:var(--text);background:var(--card);border:1px solid var(--line-2);border-radius:16px;cursor:pointer;touch-action:manipulation;transition:transform .25s var(--ease),background .3s,border-color .3s,box-shadow .3s,opacity .4s}
.poll button:active{transform:scale(.975)}
@media (hover:hover){.poll button:hover{border-color:var(--sel)}}
.tick{flex:none;width:26px;height:26px;border-radius:50%;border:2px solid var(--line-2);display:grid;place-items:center;transition:background .3s var(--ease),border-color .3s}
.tick svg{width:16px;height:16px;fill:none;stroke:var(--on-sel);stroke-width:3;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:22;stroke-dashoffset:22;transition:stroke-dashoffset .4s var(--ease) .08s}
.poll button[aria-pressed=true]{border-color:var(--sel);box-shadow:inset 0 0 0 1px var(--sel);background:var(--tint);font-weight:600}
.poll button[aria-pressed=true] .tick{background:var(--sel);border-color:var(--sel);animation:pop .45s var(--spring)}
.poll button[aria-pressed=true] .tick svg{stroke-dashoffset:0}
.poll.voted button[aria-pressed=false]{opacity:.7}
.note{display:flex;align-items:center;gap:8px;font-size:15px;font-weight:600;color:var(--acc-text);margin-top:14px;animation:rise .5s var(--ease) both}
.note[hidden]{display:none}
.note .i{width:18px;height:18px}
/* Call to action */
.cta-card{position:relative;overflow:hidden;color:var(--on-ink);background:radial-gradient(90% 80% at 0% 100%,var(--ink-hi),transparent 70%),var(--ink);border-radius:28px;padding:30px 20px 18px}
.cta-card .lbl{color:var(--acc-on-ink)}
.cta-card h2{color:var(--on-ink);font-size:clamp(30px,8vw,40px);margin-bottom:10px}
.cta-card p{color:var(--on-ink-2);font-size:17px}
.ctas{display:grid;gap:12px;margin-top:24px}
.ctas a{text-decoration:none;touch-action:manipulation;-webkit-user-select:none;user-select:none}
.ctas .primary{display:flex;align-items:center;justify-content:center;gap:10px;min-height:58px;padding:0 24px;border-radius:999px;background:var(--acc-on-ink);color:var(--on-acc-on-ink);font-size:18px;font-weight:600;letter-spacing:-.01em;box-shadow:0 10px 30px var(--acc-shadow);transition:transform .25s var(--ease),box-shadow .3s,filter .2s}
.ctas .primary:active{transform:scale(.97);box-shadow:0 4px 14px var(--acc-shadow)}
.ctas .primary .go{transition:transform .3s var(--ease)}
@media (hover:hover){.ctas .primary:hover{filter:brightness(1.06)}.ctas .primary:hover .go{transform:translateX(4px)}}
.grp{border-radius:18px;background:var(--on-ink-fill);overflow:hidden}
.grp a{position:relative;display:flex;align-items:center;gap:14px;min-height:56px;padding:0 16px;color:var(--on-ink);font-weight:500;transition:background .2s}
.grp a+a::before{content:"";position:absolute;top:0;left:52px;right:0;height:1px;background:var(--on-ink-line)}
.grp a:active{background:var(--on-ink-fill)}
@media (hover:hover){.grp a:hover{background:var(--on-ink-fill)}}
.grp a span{flex:1}
.grp .lead{width:22px;height:22px;color:var(--acc-on-ink)}
.grp .go{width:18px;height:18px;opacity:.55}
.ghost{display:flex;align-items:center;justify-content:center;min-height:46px;color:var(--on-ink-2);font-size:15px;font-weight:500;border-radius:12px}
.ctas a.busy{pointer-events:none}.ctas a.busy .go,.pill.busy .go,.sticky a.busy .go{display:none}.busy .spin{display:inline-block}
.primary.busy{filter:saturate(.85)}
/* Sources & footer */
.sources ol{margin:0;padding-left:20px;font-size:14px;line-height:1.5;color:var(--muted);display:grid;gap:10px}
.sources a{word-break:break-word}
.foot{max-width:760px;margin:0 auto;padding:36px max(20px,env(safe-area-inset-left)) calc(124px + env(safe-area-inset-bottom));font-size:13px;line-height:1.55;color:var(--muted);text-align:center}
.foot .mk{font-weight:700;font-size:15px;color:var(--text);letter-spacing:-.01em;margin-bottom:6px}
.foot .links{display:flex;flex-wrap:wrap;justify-content:center;gap:0 22px;margin-top:8px}
.foot .links a{display:inline-flex;align-items:center;min-height:44px;color:var(--muted);text-decoration:none;font-weight:500}
@media (hover:hover){.foot .links a:hover{color:var(--text)}}
/* Floating bar */
.sticky{position:fixed;left:0;right:0;bottom:0;z-index:15;padding:0 max(12px,env(safe-area-inset-left)) calc(12px + env(safe-area-inset-bottom));transform:translateY(calc(100% + 20px));opacity:0;visibility:hidden;transition:transform .6s var(--ease),opacity .35s,visibility 0s .6s;pointer-events:none}
.sticky.on{transform:none;opacity:1;visibility:visible;transition:transform .6s var(--ease),opacity .35s,visibility 0s;pointer-events:auto}
.sticky .in{max-width:480px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:7px 7px 7px 20px;border-radius:999px;background:var(--ink-glass-2);-webkit-backdrop-filter:saturate(180%) blur(20px);backdrop-filter:saturate(180%) blur(20px);color:var(--on-ink);box-shadow:0 12px 40px rgba(0,0,0,.28),inset 0 0 0 1px var(--on-ink-line);font-size:15px;font-weight:600;letter-spacing:-.01em}
.sticky .in>span{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sticky a{flex:none;display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 18px;border-radius:999px;background:var(--acc-on-ink);color:var(--on-acc-on-ink);font-weight:600;text-decoration:none;touch-action:manipulation;transition:transform .2s var(--ease)}
.sticky a:active{transform:scale(.95)}
.sticky a .i{width:18px;height:18px}
.toast{position:fixed;left:50%;top:calc(64px + env(safe-area-inset-top));z-index:30;max-width:min(90vw,420px);transform:translate(-50%,-14px) scale(.97);opacity:0;visibility:hidden;background:rgba(28,28,30,.88);-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);color:#fff;padding:12px 18px;border-radius:16px;font-size:14px;line-height:1.4;box-shadow:0 12px 40px rgba(0,0,0,.25);transition:transform .45s var(--ease),opacity .3s,visibility 0s .45s}
.toast.on{transform:translate(-50%,0);opacity:1;visibility:visible;transition:transform .45s var(--ease),opacity .3s}
/* Larger screens */
@media (min-width:820px){
body{font-size:18px}
.hero{padding:72px 0 120px}
.sheet{margin-top:-72px;border-radius:32px;padding:20px 56px 28px;box-shadow:var(--shadow-2)}
.sheet>.sec:first-child{padding-top:36px}
.sec{padding:40px 0}.sec.boxed{padding:18px 0}
.box{padding:30px 32px 32px}
.plot{padding:28px 28px 22px}
.cta-card{padding:44px 40px 28px}
.ctas{grid-template-columns:1fr 1fr}.ctas .primary,.ctas .grp,.ctas .ghost{grid-column:1/-1}
.cards{gap:20px}.card{padding:26px 26px 28px}
}
@media (prefers-color-scheme:dark){.pv{background:#3a2f05;color:#ffe08a}.sheet{box-shadow:none}}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}.js .rv{opacity:1;transform:none}}
@media print{.nav,.sticky,.toast,.pv{display:none}.js .rv{opacity:1;transform:none}.sheet{margin:0;box-shadow:none}}
`;

function linkFor(ctx: WebCtx, editionId: string, action: string, extra = '') {
  return `${ctx.base}/a/${ctx.token || '_'}/${action}?e=${editionId}${extra}`;
}

export function blockHTML(b: Block, c: EditionContent, e: Edition, p: Product, ctx: WebCtx): string {
  const src = (ids: string[]) => {
    const s = sourceLine(ids, c.sources);
    return s ? `<div class="src">${s}</div>` : '';
  };
  switch (b.type) {
    case 'tldr':
      return `<section class="sec boxed tldr rv"><div class="box"><span class="lbl">${esc(b.heading || 'The 30-second version')}</span><ul>${b.bullets.filter(Boolean).map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div></section>`;
    case 'stat':
      return `<section class="sec stat rv"><span class="lbl">Number of the week</span><div class="big"><span class="sr">${esc(b.value)}</span><span aria-hidden="true" data-count>${esc(b.value)}</span></div><div class="cap">${esc(b.caption)}</div>${src(b.sourceIds)}</section>`;
    case 'story':
      return `<section class="sec rv">${b.opinion ? '<span class="op">OUR VIEW</span>' : ''}<h2>${esc(b.headline)}</h2>${paras(b.body)}${b.why ? `<div class="why">${svg(I.bulb)}<b>Why it matters for you</b><span>${esc(b.why)}</span></div>` : ''}${b.opinion ? '<div class="src">Opinion from the editorial team.</div>' : src(b.sourceIds)}</section>`;
    case 'chart':
      return `<section class="sec chart rv"><span class="lbl">The chart</span><h2>${esc(b.title)}</h2>${b.insight ? `<p class="insight">${esc(b.insight)}</p>` : ''}${chartHTML(b)}${src(b.sourceIds)}</section>`;
    case 'showcase': {
      const media = b.mediaUrl ? (/\.(mp4|webm)(\?|$)/i.test(b.mediaUrl) ? `<video src="${esc(b.mediaUrl)}" controls muted playsinline preload="metadata"></video>` : `<img src="${esc(b.mediaUrl)}" alt="${esc(b.title)}" loading="lazy">`) : '';
      return `<div class="card rv"><span class="pl">${esc(PILLARS[b.pillar].label)}</span>${media}<h3>${esc(b.title)}</h3>${paras(b.body)}<a class="pill" data-act="showcase" href="${esc(linkFor(ctx, e.id, 'showcase', `&k=${encodeURIComponent(b.kbId || b.id)}`))}"><span>${esc(b.cta)}</span>${svg(I.arrow, 'i go')}<span class="spin" aria-hidden="true"></span></a></div>`;
    }
    case 'video': {
      const yt = youTubeId(b.url), vm = vimeoId(b.url);
      const player = yt ? `<iframe src="https://www.youtube-nocookie.com/embed/${yt}?rel=0" title="${esc(b.caption || 'Video')}" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"></iframe>`
        : vm ? `<iframe src="https://player.vimeo.com/video/${vm}" title="${esc(b.caption || 'Video')}" loading="lazy" allow="fullscreen; picture-in-picture"></iframe>`
        : `<video src="${esc(b.url)}" controls playsinline preload="metadata"></video>`;
      return `<section class="sec rv"><span class="lbl">Watch</span><div class="vid">${player}</div>${b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : ''}</section>`;
    }
    case 'image':
      return `<section class="sec rv"><figure class="pic"><img src="${esc(b.url)}" alt="${esc(b.alt)}" loading="lazy">${b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : ''}</figure></section>`;
    case 'quote':
      return `<section class="sec rv"><blockquote>“${esc(b.text)}”</blockquote>${b.author ? `<cite>— ${esc(b.author)}</cite>` : ''}</section>`;
    case 'text':
      return `<section class="sec rv">${b.heading ? `<h2>${esc(b.heading)}</h2>` : ''}${paras(b.body)}</section>`;
    case 'poll':
      return `<section class="sec rv"><span class="lbl">Quick poll · one tap</span><p class="q" id="q-${esc(b.id)}">${esc(b.question)}</p><div class="poll" role="group" aria-labelledby="q-${esc(b.id)}" data-poll="${esc(b.id)}">${b.options.filter(Boolean).map((o) => `<button type="button" aria-pressed="false" data-v="${esc(o)}"><span>${esc(o)}</span><span class="tick" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5.5 12.5l4 4L18.5 7.5"/></svg></span></button>`).join('')}</div><div class="note" role="status" hidden>${svg(I.check)}Thanks, noted. Your vote is in.</div></section>`;
    case 'cta': {
      const href = (a: CtaAction) => esc(a === 'share' ? '#share' : linkFor(ctx, e.id, a));
      const [first, ...rest] = b.actions;
      const rows = rest.filter((a) => a !== 'notnow');
      const primary = first ? `<a class="primary" data-act="${esc(first)}" href="${href(first)}"><span>${esc(CTA_LABELS[first])}</span>${svg(I.arrow, 'i go')}<span class="spin" aria-hidden="true"></span></a>` : '';
      const group = rows.length ? `<div class="grp">${rows.map((a) => `<a data-act="${esc(a)}" href="${href(a)}">${svg(ACT_ICON[a], 'i lead')}<span>${esc(CTA_LABELS[a])}</span>${svg(I.chev, 'i go')}<span class="spin" aria-hidden="true"></span></a>`).join('')}</div>` : '';
      const ghost = rest.includes('notnow') ? `<a class="ghost" data-act="notnow" href="${href('notnow')}">${esc(CTA_LABELS.notnow)}</a>` : '';
      return `<section class="sec boxed rv" id="cta"><div class="cta-card"><span class="lbl">From the ${esc(p.name)} team</span><h2>${esc(b.heading || 'Curious?')}</h2>${b.body ? `<p>${esc(b.body)}</p>` : ''}<div class="ctas">${primary}${group}${ghost}</div></div></section>`;
    }
  }
}

export function renderWeb(e: Edition, p: Product, ctx: WebCtx): string {
  const c = e.content;
  const v = brandVars(p);
  const [w1, w2] = wordmark(p);
  const url = `${ctx.base}/e/${p.slug}/${e.slug}`;
  const og = `${ctx.base}/og/${e.id}.png?v=${encodeURIComponent(e.updated_at)}&k=${imgKey(e.id)}`;
  const date = fmtDate(e.sent_at || e.scheduled_at || e.planned_for || e.created_at, ctx.tz);
  // Showcase cards are grouped into one section.
  const parts: string[] = [];
  let group: string[] = [];
  const flush = () => {
    if (group.length) parts.push(`<section class="sec ours"><span class="lbl rv">Meanwhile, at ${esc(p.name)}</span><div class="cards">${group.join('')}</div></section>`);
    group = [];
  };
  for (const b of c.blocks) {
    if (b.type === 'showcase') group.push(blockHTML(b, c, e, p, ctx));
    else { flush(); parts.push(blockHTML(b, c, e, p, ctx)); }
  }
  flush();
  const used = new Set(c.blocks.flatMap((b: any) => b.sourceIds || []));
  const srcs = c.sources.filter((s) => used.has(s.id));
  const prefs = ctx.token ? `<a href="${ctx.base}/u/${ctx.token}">Preferences</a><a href="${ctx.base}/u/${ctx.token}?unsubscribe=1">Unsubscribe in one click</a>` : '';
  const shareText = `${c.title} — ${url}`;
  const cfg = JSON.stringify({ e: e.id, t: ctx.token || null, base: ctx.base, preview: !!ctx.preview, share: shareText, url });
  const logo = p.brand.logoUrl ? `<img src="${esc(p.brand.logoUrl)}" alt="${esc(p.name)}">` : `<span>${esc(w1)}<b>${esc(w2)}</b></span>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(c.title)} · ${esc(p.newsletter_name)}</title>
<meta name="description" content="${esc(c.preview.description)}">
<meta property="og:type" content="article"><meta property="og:site_name" content="${esc(p.newsletter_name)} by ${esc(p.name)}">
<meta property="og:title" content="${esc(c.preview.title)}"><meta property="og:description" content="${esc(c.preview.description)}">
<meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${esc(og)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="theme-color" content="${v.ink}"><meta name="color-scheme" content="light dark">
${ctx.preview ? '<meta name="robots" content="noindex">' : ''}
<link rel="canonical" href="${esc(url)}">
${FONTS}
<style>${themeCSS(p)}${BASE_CSS}${CSS}</style>
<script>if('IntersectionObserver' in window)document.documentElement.classList.add('js')</script>
</head><body>
${ctx.preview ? '<div class="pv">Preview. Taps here are not recorded.</div>' : ''}
<header class="nav" id="nav"><div class="nav-in"><a class="logo" href="${ctx.base}/e/${p.slug}" aria-label="${esc(p.newsletter_name)}: past editions">${logo}</a><div class="nav-mid"><span class="nav-nl">${esc(p.newsletter_name)}</span><span class="nav-t" aria-hidden="true">${esc(c.title)}</span></div><a class="nav-sh" data-act="share" href="#share" aria-label="Share this edition">${svg(I.share)}</a></div><div class="prog" aria-hidden="true"><i id="prog"></i></div></header>
<section class="hero"><div class="hero-in">${c.kicker ? `<span class="kicker">${esc(c.kicker)}</span>` : ''}<h1 id="ttl">${esc(c.title)}</h1>${c.dek ? `<p class="dek">${esc(c.dek)}</p>` : ''}<div class="by"><span class="chip">${svg(I.clock)}${c.readMinutes} min read</span>${ctx.firstName ? `<span class="chip">${svg(I.user)}Prepared for ${esc(ctx.firstName)}</span>` : ''}<span>Edition ${String(e.number)} · ${esc(date)}</span></div></div></section>
<main class="sheet">
${parts.join('\n')}
${srcs.length ? `<section class="sec sources rv"><span class="lbl">Sources</span><ol>${srcs.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title || s.url)}</a>${s.publisher ? ` · ${esc(s.publisher)}` : ''}${s.date ? ` · ${esc(s.date)}` : ''}</li>`).join('')}</ol></section>` : ''}
</main>
<footer class="foot"><div class="mk">${esc(p.newsletter_name)}</div><div>A weekly briefing from ${esc(p.name)}${p.brand.tagline ? `, ${esc(p.brand.tagline)}` : ''}.${p.brand.address ? ` ${esc(p.brand.address)}.` : ''}</div>
<div class="links"><a href="${ctx.base}/e/${p.slug}">Past editions</a>${p.website ? `<a href="${esc(p.website)}" target="_blank" rel="noopener">${esc(p.website.replace(/^https?:\/\//, ''))}</a>` : ''}${prefs}</div></footer>
${c.blocks.some((b) => b.type === 'cta') ? `<div class="sticky" id="sticky"><div class="in"><span>${ctx.firstName ? `Liked this, ${esc(ctx.firstName)}?` : 'Liked this?'}</span><a data-act="interested" href="${esc(linkFor(ctx, e.id, 'interested'))}">Talk to us${svg(I.arrow, 'i go')}<span class="spin" aria-hidden="true"></span></a></div></div>` : ''}
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<script>
(function(){var C=${cfg.replace(/</g, '\\u003c')};
var D=document,RM=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
function send(type,value,meta){if(C.preview)return;try{var b=JSON.stringify({e:C.e,t:C.t,type:type,value:value||null,meta:meta||null});if(navigator.sendBeacon){navigator.sendBeacon(C.base+'/api/track',new Blob([b],{type:'application/json'}))}else{fetch(C.base+'/api/track',{method:'POST',headers:{'content-type':'application/json'},body:b,keepalive:true})}}catch(e){}}
function toast(t){var el=D.getElementById('toast');el.textContent=t;el.classList.add('on');clearTimeout(el._t);el._t=setTimeout(function(){el.classList.remove('on')},2800)}
send('view',null,{ref:document.referrer||null});
var marks=[25,50,75,100],hit={},st=D.getElementById('sticky'),pg=D.getElementById('prog'),t0=Date.now(),raf=0,ctaIn=false;
function onScroll(ev){var h=document.documentElement,p=Math.round((h.scrollTop+window.innerHeight)/h.scrollHeight*100);if(ev&&h.scrollTop>40){marks.forEach(function(m){if(p>=m&&!hit[m]){hit[m]=1;send('scroll',String(m))}})}if(st){st.classList.toggle('on',p>45&&p<92&&!ctaIn)}
 if(pg&&!raf){raf=requestAnimationFrame(function(){raf=0;var m=h.scrollHeight-window.innerHeight;pg.style.transform='scaleX('+(m>0?Math.min(1,Math.max(0,h.scrollTop/m)):0)+')'})}}
window.addEventListener('scroll',onScroll,{passive:true});onScroll(null);
document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden'){send('time',String(Math.round((Date.now()-t0)/1000)))}});
function count(el){var f=el.textContent,m=f.match(/^(\\D*?)(\\d[\\d,]*(?:\\.\\d+)?)([\\s\\S]*)$/);if(!m||RM)return;var raw=m[2],n=parseFloat(raw.replace(/,/g,'')),dp=(raw.split('.')[1]||'').length,cm=raw.indexOf(',')>-1,t1=0,dur=1400;if(!(n>0))return;
 function fm(x){return cm?x.toLocaleString('en-IN',{minimumFractionDigits:dp,maximumFractionDigits:dp}):x.toFixed(dp)}
 function step(ts){if(!t1)t1=ts;var k=Math.min(1,(ts-t1)/dur),q=1-Math.pow(1-k,4);el.textContent=k<1?m[1]+fm(n*q)+m[3]:f;if(k<1)requestAnimationFrame(step)}
 el.textContent=m[1]+fm(0)+m[3];requestAnimationFrame(step)}
try{var nav=D.getElementById('nav'),ttl=D.getElementById('ttl');
 if('IntersectionObserver' in window){
  if(nav&&ttl)new IntersectionObserver(function(es){nav.classList.toggle('s',!es[0].isIntersecting&&es[0].boundingClientRect.top<60)},{rootMargin:'-52px 0px 0px 0px'}).observe(ttl);
  var io=new IntersectionObserver(function(es){es.forEach(function(x){if(x.isIntersecting){var t=x.target;t.classList.add('in');io.unobserve(t);if(t.hasAttribute('data-count'))count(t)}})},{rootMargin:'0px 0px -8% 0px'});
  D.querySelectorAll('.rv,.plot,[data-count]').forEach(function(el){io.observe(el)});
  var cta=D.getElementById('cta');if(cta&&st)new IntersectionObserver(function(es){ctaIn=es[0].isIntersecting;onScroll(null)}).observe(cta);
  D.querySelectorAll('.cards .card').forEach(function(el,i){el.style.setProperty('--d',(i%3)*0.08+'s')});
 }}catch(e){D.documentElement.classList.remove('js')}
document.querySelectorAll('[data-poll]').forEach(function(g){g.querySelectorAll('button').forEach(function(b){b.addEventListener('click',function(){g.querySelectorAll('button').forEach(function(x){x.setAttribute('aria-pressed',x===b?'true':'false')});g.classList.add('voted');g.nextElementSibling.hidden=false;try{if(navigator.vibrate)navigator.vibrate(8)}catch(e){}send('poll',b.getAttribute('data-v'),{block:g.getAttribute('data-poll')})})})});
document.querySelectorAll('[data-act]').forEach(function(a){a.addEventListener('click',function(ev){var act=a.getAttribute('data-act');
 if(act==='share'){ev.preventDefault();send('share');if(navigator.share){navigator.share({title:document.title,url:C.url}).catch(function(){})}else{window.open('https://wa.me/?text='+encodeURIComponent(C.share),'_blank')}return}
 if(C.preview){ev.preventDefault();toast('Preview: in a real send this records "'+act+'" and alerts your team.');return}
 if(ev.metaKey||ev.ctrlKey||ev.shiftKey||ev.altKey||ev.button)return;
 a.classList.add('busy');setTimeout(function(){a.classList.remove('busy')},8000)})});
window.addEventListener('pageshow',function(){D.querySelectorAll('.busy').forEach(function(x){x.classList.remove('busy')})});
})();
</script>
</body></html>`;
}
