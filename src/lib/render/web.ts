import type { Product } from '../settings';
import type { Edition } from '../editions';
import { CTA_LABELS, PILLARS, type Block, type EditionContent } from '../types';
import { esc, paras, brandVars, onColor, youTubeId, vimeoId, sourceLine, wordmark } from './common';
import { chartSVG } from './chart';
import { fmtDate } from '../format';

export type WebCtx = { base: string; token?: string | null; firstName?: string; preview?: boolean; tz?: string };

const CSS = `
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--page);color:var(--text);font:16px/1.6 "IBM Plex Sans",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
a{color:inherit}img,video,iframe{max-width:100%}
.wrap{max-width:680px;margin:0 auto;background:var(--paper);min-height:100vh;box-shadow:0 0 0 1px rgba(0,0,0,.04)}
.mast{background:var(--ink);color:var(--on-ink);padding:16px max(20px,env(safe-area-inset-left));display:flex;justify-content:space-between;align-items:center;gap:12px}
.logo{font-weight:600;font-size:17px;letter-spacing:.01em;text-decoration:none;display:flex;align-items:center;gap:8px}
.logo img{height:28px;width:auto}.logo b{color:var(--acc-on-ink);font-weight:600}
.mast .meta{font:12px/1.35 "IBM Plex Mono",ui-monospace,monospace;opacity:.8;text-align:right}
.hero{background:var(--ink);color:var(--on-ink);padding:28px 20px 26px}
.kicker,.lbl{font:500 11.5px/1.2 "IBM Plex Mono",ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase}
.kicker{color:var(--acc-on-ink)}
.hero h1{font:600 clamp(30px,7vw,42px)/1.08 "Newsreader",Georgia,serif;margin:10px 0 12px;text-wrap:balance}
.hero p{margin:0;opacity:.88;font-size:17px}
.rt{font:12px "IBM Plex Mono",monospace;opacity:.7;margin-top:14px}
.sec{padding:24px 20px;border-bottom:1px solid var(--line)}
.lbl{color:var(--acc);display:block;margin-bottom:10px}
.soft{background:var(--soft)}
.tldr ul{margin:0;padding-left:20px;display:grid;gap:8px}
.stat .big{font:600 clamp(48px,14vw,72px)/1 "Newsreader",Georgia,serif;color:var(--ink);letter-spacing:-.01em}
.stat .cap{color:var(--muted);margin-top:6px}
h2{font:600 24px/1.2 "Newsreader",Georgia,serif;color:var(--ink);margin:0 0 10px;text-wrap:balance}
p{margin:0 0 12px}
.why{border-left:3px solid var(--acc);background:var(--soft);padding:12px 14px;border-radius:0 8px 8px 0;font-size:15px}
.why b{display:block;font:500 11.5px "IBM Plex Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--ink);margin-bottom:4px}
.src{font-size:12.5px;color:var(--muted);margin-top:10px}.src a{color:var(--muted)}
.op{display:inline-block;font:500 11px "IBM Plex Mono",monospace;background:var(--ink);color:var(--on-ink);padding:2px 7px;border-radius:4px;margin-bottom:8px;letter-spacing:.06em}
.insight{font-weight:600;margin-bottom:12px}
.chart svg{width:100%;height:auto;overflow:visible}.chart .bar{transition:opacity .15s}.chart g:hover .bar{opacity:.75}
.card{border:1px solid var(--line);border-radius:12px;padding:16px;display:grid;gap:10px;background:var(--paper)}
.card+.card{margin-top:14px}
.card .pl{font:500 11px "IBM Plex Mono",monospace;letter-spacing:.1em;text-transform:uppercase;color:var(--acc)}
.card h3{font:600 20px/1.25 "Newsreader",Georgia,serif;color:var(--ink);margin:0}
.card img,.card video{border-radius:8px;width:100%;display:block}
.pill{justify-self:start;border:1.5px solid var(--ink);color:var(--ink);background:var(--paper);border-radius:999px;padding:9px 16px;font-weight:600;font-size:14.5px;text-decoration:none;cursor:pointer}
.pill:hover{background:var(--ink);color:var(--on-ink)}
.vid{position:relative;aspect-ratio:16/9;border-radius:10px;overflow:hidden;background:#000}.vid iframe,.vid video{position:absolute;inset:0;width:100%;height:100%;border:0}
figure{margin:0}figcaption{font-size:13px;color:var(--muted);margin-top:8px}
blockquote{margin:0;font:500 22px/1.35 "Newsreader",Georgia,serif;color:var(--ink)}blockquote+cite{display:block;margin-top:8px;color:var(--muted);font-style:normal;font-size:14px}
.poll{display:grid;gap:8px}.poll button{font:inherit;text-align:left;border:1px solid var(--line);background:var(--paper);border-radius:10px;padding:12px 14px;cursor:pointer;color:var(--text)}
.poll button[aria-pressed=true]{border-color:var(--ink);background:var(--soft);font-weight:600}
.note{font-size:13.5px;color:var(--muted);margin-top:10px}
.ctas{display:grid;grid-template-columns:1fr 1fr;gap:10px}.ctas a{display:block;text-align:center;text-decoration:none;border:1px solid var(--line);border-radius:10px;padding:13px 8px;font-weight:600;color:var(--ink);background:var(--paper)}
.ctas a.primary{grid-column:1/-1;background:var(--ink);color:var(--on-ink);border-color:var(--ink)}
.ctas a:hover{border-color:var(--ink)}
.sources ol{margin:0;padding-left:20px;font-size:13.5px;color:var(--muted);display:grid;gap:6px}.sources a{color:var(--muted);word-break:break-word}
.foot{padding:22px 20px 90px;background:var(--soft);font-size:13px;color:var(--muted);display:grid;gap:8px}.foot .links{display:flex;flex-wrap:wrap;gap:14px}
.sticky{position:fixed;left:0;right:0;bottom:0;transform:translateY(110%);transition:transform .25s;z-index:5;padding:10px max(16px,env(safe-area-inset-left)) calc(10px + env(safe-area-inset-bottom))}
.sticky.on{transform:none}
.sticky .in{max-width:648px;margin:0 auto;background:var(--ink);color:var(--on-ink);border-radius:14px;padding:10px 10px 10px 16px;display:flex;align-items:center;justify-content:space-between;gap:10px;box-shadow:0 10px 30px rgba(0,0,0,.25)}
.sticky a{background:var(--acc);color:var(--on-acc);text-decoration:none;font-weight:600;border-radius:999px;padding:9px 16px;white-space:nowrap}
.toast{position:fixed;left:50%;top:16px;transform:translateX(-50%);background:#111;color:#fff;padding:10px 16px;border-radius:10px;font-size:14px;z-index:9;display:none;max-width:90vw}
.pv{background:#fff5d6;color:#5b4300;font:13px "IBM Plex Sans",sans-serif;padding:8px 14px;text-align:center}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
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
      return `<section class="sec soft tldr"><span class="lbl">${esc(b.heading || 'The 30-second version')}</span><ul>${b.bullets.filter(Boolean).map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>`;
    case 'stat':
      return `<section class="sec stat"><span class="lbl">Number of the week</span><div class="big">${esc(b.value)}</div><div class="cap">${esc(b.caption)}</div>${src(b.sourceIds)}</section>`;
    case 'story':
      return `<section class="sec">${b.opinion ? '<span class="op">OUR VIEW</span>' : ''}<h2>${esc(b.headline)}</h2>${paras(b.body)}${b.why ? `<div class="why"><b>Why it matters for you</b>${esc(b.why)}</div>` : ''}${b.opinion ? '<div class="src">Opinion from the editorial team.</div>' : src(b.sourceIds)}</section>`;
    case 'chart':
      return `<section class="sec chart"><span class="lbl">The chart</span><h2>${esc(b.title)}</h2>${b.insight ? `<p class="insight">${esc(b.insight)}</p>` : ''}${chartSVG(b, brandVars(p))}${src(b.sourceIds)}</section>`;
    case 'showcase': {
      const media = b.mediaUrl ? (/\.(mp4|webm)(\?|$)/i.test(b.mediaUrl) ? `<video src="${esc(b.mediaUrl)}" controls muted playsinline preload="metadata"></video>` : `<img src="${esc(b.mediaUrl)}" alt="${esc(b.title)}" loading="lazy">`) : '';
      return `<div class="card"><span class="pl">${esc(PILLARS[b.pillar].label)}</span>${media}<h3>${esc(b.title)}</h3>${paras(b.body)}<a class="pill" data-act="showcase" href="${esc(linkFor(ctx, e.id, 'showcase', `&k=${encodeURIComponent(b.kbId || b.id)}`))}">${esc(b.cta)}</a></div>`;
    }
    case 'video': {
      const yt = youTubeId(b.url), vm = vimeoId(b.url);
      const player = yt ? `<iframe src="https://www.youtube-nocookie.com/embed/${yt}?rel=0" title="${esc(b.caption || 'Video')}" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe>`
        : vm ? `<iframe src="https://player.vimeo.com/video/${vm}" title="${esc(b.caption || 'Video')}" loading="lazy" allow="fullscreen; picture-in-picture" allowfullscreen></iframe>`
        : `<video src="${esc(b.url)}" controls playsinline preload="metadata"></video>`;
      return `<section class="sec"><span class="lbl">Watch</span><div class="vid">${player}</div>${b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : ''}</section>`;
    }
    case 'image':
      return `<section class="sec"><figure><img src="${esc(b.url)}" alt="${esc(b.alt)}" loading="lazy" style="border-radius:10px;width:100%">${b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : ''}</figure></section>`;
    case 'quote':
      return `<section class="sec"><blockquote>“${esc(b.text)}”</blockquote>${b.author ? `<cite>— ${esc(b.author)}</cite>` : ''}</section>`;
    case 'text':
      return `<section class="sec">${b.heading ? `<h2>${esc(b.heading)}</h2>` : ''}${paras(b.body)}</section>`;
    case 'poll':
      return `<section class="sec"><span class="lbl">Quick poll · one tap</span><p style="font-weight:600">${esc(b.question)}</p><div class="poll" data-poll="${esc(b.id)}">${b.options.filter(Boolean).map((o) => `<button type="button" aria-pressed="false" data-v="${esc(o)}">${esc(o)}</button>`).join('')}</div><div class="note" hidden>Thanks, noted.</div></section>`;
    case 'cta': {
      const acts = b.actions.map((a, i) => {
        const href = a === 'share' ? '#share' : linkFor(ctx, e.id, a);
        return `<a ${i === 0 ? 'class="primary"' : ''} data-act="${a}" href="${esc(href)}">${esc(CTA_LABELS[a])}</a>`;
      });
      return `<section class="sec" id="cta"><span class="lbl">${esc(b.heading || 'Curious?')}</span>${b.body ? `<p>${esc(b.body)}</p>` : ''}<div class="ctas">${acts.join('')}</div></section>`;
    }
  }
}

export function renderWeb(e: Edition, p: Product, ctx: WebCtx): string {
  const c = e.content;
  const v = brandVars(p);
  const [w1, w2] = wordmark(p);
  const url = `${ctx.base}/e/${p.slug}/${e.slug}`;
  const og = `${ctx.base}/og/${e.id}.png?v=${encodeURIComponent(e.updated_at)}`;
  const date = fmtDate(e.sent_at || e.scheduled_at || e.planned_for || e.created_at, ctx.tz);
  // Showcase cards are grouped into one section.
  const parts: string[] = [];
  let group: string[] = [];
  const flush = () => {
    if (group.length) parts.push(`<section class="sec"><span class="lbl">Meanwhile, at ${esc(p.name)}</span>${group.join('')}</section>`);
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
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(c.title)} · ${esc(p.newsletter_name)}</title>
<meta name="description" content="${esc(c.preview.description)}">
<meta property="og:type" content="article"><meta property="og:site_name" content="${esc(p.newsletter_name)} by ${esc(p.name)}">
<meta property="og:title" content="${esc(c.preview.title)}"><meta property="og:description" content="${esc(c.preview.description)}">
<meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${esc(og)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="theme-color" content="${v.ink}">
${ctx.preview ? '<meta name="robots" content="noindex">' : ''}
<link rel="canonical" href="${esc(url)}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;600&family=Newsreader:opsz,wght@6..72,500;6..72,600&display=swap">
<style>:root{--ink:${v.ink};--acc:${v.acc};--soft:${v.soft};--on-ink:${onColor(v.ink)};--on-acc:${onColor(v.acc)};--acc-on-ink:${onColor(v.ink) === '#ffffff' ? v.acc : v.ink};--paper:#fff;--page:#f3f4f6;--text:#20232a;--muted:#626a76;--line:#e3e6eb}${CSS}</style>
</head><body>
${ctx.preview ? '<div class="pv">Preview. Taps here are not recorded.</div>' : ''}
<div class="wrap">
<header class="mast"><a class="logo" href="${ctx.base}/e/${p.slug}">${p.brand.logoUrl ? `<img src="${esc(p.brand.logoUrl)}" alt="${esc(p.name)}">` : `<span>${esc(w1)}<b>${esc(w2)}</b></span>`}</a><div class="meta">${esc(p.newsletter_name)}<br>Edition ${String(e.number).padStart(2, '0')} · ${esc(date)}</div></header>
<section class="hero">${c.kicker ? `<div class="kicker">${esc(c.kicker)}</div>` : ''}<h1>${esc(c.title)}</h1>${c.dek ? `<p>${esc(c.dek)}</p>` : ''}<div class="rt">${c.readMinutes} min read${ctx.firstName ? ` · prepared for ${esc(ctx.firstName)}` : ''}</div></section>
${parts.join('\n')}
${srcs.length ? `<section class="sec sources"><span class="lbl">Sources</span><ol>${srcs.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title || s.url)}</a>${s.publisher ? ` · ${esc(s.publisher)}` : ''}${s.date ? ` · ${esc(s.date)}` : ''}</li>`).join('')}</ol></section>` : ''}
<footer class="foot"><div>${esc(p.newsletter_name)} is a weekly briefing from ${esc(p.name)}${p.brand.tagline ? `, ${esc(p.brand.tagline)}` : ''}.${p.brand.address ? ` ${esc(p.brand.address)}.` : ''}</div>
<div class="links"><a href="${ctx.base}/e/${p.slug}">Past editions</a>${p.website ? `<a href="${esc(p.website)}" target="_blank" rel="noopener">${esc(p.website.replace(/^https?:\/\//, ''))}</a>` : ''}${prefs}</div></footer>
</div>
${c.blocks.some((b) => b.type === 'cta') ? `<div class="sticky" id="sticky"><div class="in"><span>${ctx.firstName ? `Liked this, ${esc(ctx.firstName)}?` : 'Liked this?'}</span><a data-act="interested" href="${esc(linkFor(ctx, e.id, 'interested'))}">Talk to us →</a></div></div>` : ''}
<div class="toast" id="toast"></div>
<script>
(function(){var C=${cfg.replace(/</g, '\\u003c')};
function send(type,value,meta){if(C.preview)return;try{var b=JSON.stringify({e:C.e,t:C.t,type:type,value:value||null,meta:meta||null});if(navigator.sendBeacon){navigator.sendBeacon(C.base+'/api/track',new Blob([b],{type:'application/json'}))}else{fetch(C.base+'/api/track',{method:'POST',headers:{'content-type':'application/json'},body:b,keepalive:true})}}catch(e){}}
function toast(t){var el=document.getElementById('toast');el.textContent=t;el.style.display='block';clearTimeout(el._t);el._t=setTimeout(function(){el.style.display='none'},2600)}
send('view',null,{ref:document.referrer||null});
var marks=[25,50,75,100],hit={},st=document.getElementById('sticky'),t0=Date.now();
function onScroll(){var h=document.documentElement,p=Math.round((h.scrollTop+window.innerHeight)/h.scrollHeight*100);marks.forEach(function(m){if(p>=m&&!hit[m]){hit[m]=1;send('scroll',String(m))}});if(st){st.classList.toggle('on',p>45&&p<92)}}
window.addEventListener('scroll',onScroll,{passive:true});onScroll();
document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden'){send('time',String(Math.round((Date.now()-t0)/1000)))}});
document.querySelectorAll('[data-poll]').forEach(function(g){g.querySelectorAll('button').forEach(function(b){b.addEventListener('click',function(){g.querySelectorAll('button').forEach(function(x){x.setAttribute('aria-pressed',x===b?'true':'false')});g.nextElementSibling.hidden=false;send('poll',b.getAttribute('data-v'),{block:g.getAttribute('data-poll')})})})});
document.querySelectorAll('[data-act]').forEach(function(a){a.addEventListener('click',function(ev){var act=a.getAttribute('data-act');
 if(act==='share'){ev.preventDefault();send('share');if(navigator.share){navigator.share({title:document.title,url:C.url}).catch(function(){})}else{window.open('https://wa.me/?text='+encodeURIComponent(C.share),'_blank')}return}
 if(C.preview){ev.preventDefault();toast('Preview: in a real send this records "'+act+'" and alerts your team.')}})});
})();
</script>
</body></html>`;
}
