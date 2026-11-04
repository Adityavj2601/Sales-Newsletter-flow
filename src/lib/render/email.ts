import type { Product } from '../settings';
import type { Edition } from '../editions';
import { CTA_LABELS, PILLARS, type Block } from '../types';
import { esc, brandVars, onColor, youTubeId, hostOf, wordmark } from './common';
import { personalize, fmtDate } from '../format';
import { baseUrl } from '../settings';
import { linkSig, imgKey } from '../crypto';

export type EmailCtx = { token: string; firstName?: string } | null;

/** Table-based, inline-styled email (Gmail/Outlook safe). With no ctx it renders a preview with neutral links. */
export function renderEmail(e: Edition, p: Product, ctx: EmailCtx, opts: { base?: string; tz?: string } = {}): string {
  const base = opts.base || baseUrl();
  const c = e.content;
  const v = brandVars(p);
  const onInk = onColor(v.ink);
  const t = ctx?.token || '_';
  const web = `${base}/e/${p.slug}/${e.slug}${ctx ? `?r=${ctx.token}` : ''}`;
  const track = (u: string) => (ctx ? `${base}/t/c/${ctx.token}?u=${encodeURIComponent(u)}&s=${linkSig(ctx.token, u)}` : u);
  const act = (a: string, extra = '') => `${base}/a/${t}/${a}?e=${e.id}${extra}`;
  const F = `font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;`;
  const SERIF = `font-family:Georgia,'Times New Roman',serif;`;
  const MONO = `font-family:'SFMono-Regular',Menlo,Consolas,monospace;`;
  const lbl = (s: string) => `<div style="${MONO}font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:${v.acc};margin:0 0 10px">${esc(s)}</div>`;
  const row = (inner: string, bg = '#ffffff') => `<tr><td style="padding:24px 28px;background:${bg};border-bottom:1px solid #e8eaee">${inner}</td></tr>`;
  const P = (s: string) => s.split(/\n{2,}/).map((x) => `<p style="${F}font-size:16px;line-height:1.6;color:#22252b;margin:0 0 12px">${esc(x)}</p>`).join('');
  const src = (ids: string[]) => {
    const list = ids.map((id) => c.sources.find((s) => s.id === id)).filter(Boolean) as any[];
    return list.length ? `<div style="${F}font-size:12px;color:#6b7280;margin-top:10px">Source: ${list.map((s) => `<a href="${esc(track(s.url))}" style="color:#6b7280">${esc(s.publisher || hostOf(s.url))}</a>`).join(' · ')}</div>` : '';
  };
  const btn = (href: string, label: string, primary = false) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0"><tr><td style="border-radius:999px;background:${primary ? v.ink : '#ffffff'};border:1.5px solid ${v.ink}"><a href="${esc(href)}" style="${F}display:inline-block;padding:11px 20px;font-size:15px;font-weight:bold;color:${primary ? onInk : v.ink};text-decoration:none;border-radius:999px">${esc(label)}</a></td></tr></table>`;

  const parts: string[] = [];
  let cards: string[] = [];
  const flush = () => {
    if (cards.length) parts.push(row(lbl(`Meanwhile, at ${p.name}`) + cards.join('<div style="height:14px"></div>')));
    cards = [];
  };
  const block = (b: Block): string => {
    switch (b.type) {
      case 'tldr': return row(lbl(b.heading || 'The 30-second version') + `<ul style="margin:0;padding-left:20px">${b.bullets.filter(Boolean).map((x) => `<li style="${F}font-size:16px;line-height:1.55;color:#22252b;margin-bottom:8px">${esc(x)}</li>`).join('')}</ul>`, v.soft);
      case 'stat': return row(lbl('Number of the week') + `<div style="${SERIF}font-size:56px;line-height:1;font-weight:bold;color:${v.ink}">${esc(b.value)}</div><div style="${F}font-size:15px;color:#5b6270;margin-top:8px">${esc(b.caption)}</div>${src(b.sourceIds)}`);
      case 'story': return row(`${b.opinion ? `<div style="${MONO}display:inline-block;font-size:11px;background:${v.ink};color:${onInk};padding:2px 7px;border-radius:4px;margin-bottom:8px">OUR VIEW</div>` : ''}<h2 style="${SERIF}font-size:23px;line-height:1.25;color:${v.ink};margin:0 0 10px">${esc(b.headline)}</h2>${P(b.body)}${b.why ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-left:3px solid ${v.acc};background:${v.soft};padding:12px 14px"><div style="${MONO}font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${v.ink};margin-bottom:4px">Why it matters for you</div><div style="${F}font-size:15px;line-height:1.5;color:#22252b">${esc(b.why)}</div></td></tr></table>` : ''}${b.opinion ? '' : src(b.sourceIds)}`);
      case 'chart': return row(lbl('The chart') + `<h2 style="${SERIF}font-size:21px;color:${v.ink};margin:0 0 6px">${esc(b.title)}</h2>${b.insight ? `<p style="${F}font-size:15px;font-weight:bold;color:#22252b;margin:0 0 12px">${esc(b.insight)}</p>` : ''}<a href="${esc(track(web))}"><img src="${base}/chart/${e.id}/${b.id}.png?v=${encodeURIComponent(e.updated_at)}&amp;k=${imgKey(e.id)}" width="544" alt="${esc(b.title)}: ${esc(b.data.map((d) => `${d.label} ${d.value}${b.unit}`).join(', '))}" style="display:block;width:100%;max-width:544px;height:auto;border:0"></a>${src(b.sourceIds)}`);
      case 'showcase': return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e3e6eb;border-radius:12px"><tr><td style="padding:16px"><div style="${MONO}font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:${v.acc};margin-bottom:8px">${esc(PILLARS[b.pillar].label)}</div>${b.mediaUrl && !/\.(mp4|webm)/i.test(b.mediaUrl) ? `<img src="${esc(b.mediaUrl)}" width="500" alt="${esc(b.title)}" style="display:block;width:100%;height:auto;border-radius:8px;margin-bottom:10px">` : ''}<div style="${SERIF}font-size:19px;font-weight:bold;color:${v.ink};margin-bottom:6px">${esc(b.title)}</div>${P(b.body)}${btn(act('showcase', `&k=${encodeURIComponent(b.kbId || b.id)}`), b.cta)}</td></tr></table>`;
      case 'video': {
        const yt = youTubeId(b.url);
        const thumb = yt ? `https://img.youtube.com/vi/${yt}/hqdefault.jpg` : '';
        return row(lbl('Watch') + (thumb ? `<a href="${esc(track(web))}"><img src="${thumb}" width="544" alt="Play video: ${esc(b.caption)}" style="display:block;width:100%;height:auto;border-radius:8px"></a>` : '') + `<div style="margin-top:10px">${btn(track(web), '▶  Watch on the web page')}</div>${b.caption ? `<div style="${F}font-size:13px;color:#6b7280">${esc(b.caption)}</div>` : ''}`);
      }
      case 'image': return row(`<img src="${esc(b.url)}" width="544" alt="${esc(b.alt)}" style="display:block;width:100%;height:auto;border-radius:8px">${b.caption ? `<div style="${F}font-size:13px;color:#6b7280;margin-top:8px">${esc(b.caption)}</div>` : ''}`);
      case 'quote': return row(`<div style="${SERIF}font-size:21px;line-height:1.4;color:${v.ink}">“${esc(b.text)}”</div>${b.author ? `<div style="${F}font-size:14px;color:#6b7280;margin-top:8px">— ${esc(b.author)}</div>` : ''}`);
      case 'text': return row(`${b.heading ? `<h2 style="${SERIF}font-size:21px;color:${v.ink};margin:0 0 10px">${esc(b.heading)}</h2>` : ''}${P(b.body)}`);
      case 'poll': return row(lbl('Quick poll · one tap') + `<p style="${F}font-size:16px;font-weight:bold;color:#22252b;margin:0 0 12px">${esc(b.question)}</p>` + b.options.filter(Boolean).map((o) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px"><tr><td style="border:1px solid #d7dbe1;border-radius:10px"><a href="${esc(act('poll', `&b=${b.id}&v=${encodeURIComponent(o)}`))}" style="${F}display:block;padding:12px 14px;font-size:15px;color:#22252b;text-decoration:none">${esc(o)}</a></td></tr></table>`).join(''));
      case 'cta': return row(lbl(b.heading || 'Curious?') + (b.body ? `<p style="${F}font-size:15px;color:#22252b;margin:0 0 12px">${esc(b.body)}</p>` : '') + b.actions.map((a, i) => btn(act(a), CTA_LABELS[a], i === 0)).join(''));
    }
  };
  for (const b of c.blocks) {
    if (b.type === 'showcase') cards.push(block(b));
    else { flush(); parts.push(block(b)); }
  }
  flush();
  const [w1, w2] = wordmark(p);
  const pre = personalize(c.preheader, { first_name: ctx?.firstName || '' });
  const logo = p.brand.logoUrl ? `<img src="${esc(p.brand.logoUrl)}" height="28" alt="${esc(p.name)}" style="display:block;height:28px;border:0">` : `<span style="${F}font-size:17px;font-weight:bold;color:${onInk}">${esc(w1)}<span style="color:${v.acc}">${esc(w2)}</span></span>`;
  const unsub = ctx ? `${base}/u/${ctx.token}?unsubscribe=1` : `${base}/u/_?p=${p.slug}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><meta name="color-scheme" content="light only"><title>${esc(c.title)}</title>
<style>a{color:${v.ink}}@media (max-width:620px){.wrap{width:100%!important}.pad{padding:18px!important}}</style></head>
<body style="margin:0;padding:0;background:#eef0f3">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(pre)}${'&#847;&zwnj;&nbsp;'.repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef0f3"><tr><td align="center" style="padding:20px 10px">
<table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="padding:10px 28px;background:#ffffff;${F}font-size:12px;color:#6b7280;text-align:center">Charts and polls work best online. <a href="${esc(track(web))}" style="color:#6b7280">View the interactive version →</a></td></tr>
<tr><td style="background:${v.ink};padding:16px 28px"><table role="presentation" width="100%"><tr><td>${logo}</td><td align="right" style="${MONO}font-size:11px;color:${onInk};opacity:.85">${esc(p.newsletter_name)}<br>Edition ${String(e.number).padStart(2, '0')} · ${esc(fmtDate(e.scheduled_at || e.planned_for || e.created_at, opts.tz))}</td></tr></table></td></tr>
<tr><td class="pad" style="background:${v.ink};padding:22px 28px 28px">${c.kicker ? `<div style="${MONO}font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:${v.acc}">${esc(c.kicker)}</div>` : ''}<h1 style="${SERIF}font-size:32px;line-height:1.12;color:${onInk};margin:10px 0 12px">${esc(c.title)}</h1>${c.dek ? `<p style="${F}font-size:16px;line-height:1.5;color:${onInk};opacity:.88;margin:0">${esc(c.dek)}</p>` : ''}<p style="${MONO}font-size:11px;color:${onInk};opacity:.7;margin:14px 0 0">${c.readMinutes} min read</p></td></tr>
${parts.join('\n')}
<tr><td style="padding:22px 28px;background:${v.soft};${F}font-size:12px;line-height:1.6;color:#6b7280">${esc(p.brand.signOff || `— The ${p.name} team`)}<br><br>You're receiving ${esc(p.newsletter_name)} from ${esc(p.name)} because you agreed to hear from us.${p.brand.address ? `<br>${esc(p.brand.address)}` : ''}<br><a href="${esc(track(`${base}/e/${p.slug}`))}" style="color:#6b7280">Past editions</a> · <a href="${esc(ctx ? `${base}/u/${ctx.token}` : unsub)}" style="color:#6b7280">Preferences</a> · <a href="${esc(unsub)}" style="color:#6b7280">Unsubscribe</a></td></tr>
</table>
${ctx ? `<img src="${base}/t/o/${ctx.token}.gif" width="1" height="1" alt="" style="display:block;border:0;width:1px;height:1px">` : ''}
</td></tr></table></body></html>`;
}

/** Plain-text alternative for the email. */
export function renderEmailText(e: Edition, p: Product, ctx: EmailCtx, base = baseUrl()): string {
  const c = e.content;
  const web = `${base}/e/${p.slug}/${e.slug}${ctx ? `?r=${ctx.token}` : ''}`;
  const out: string[] = [`${p.newsletter_name} · Edition ${e.number}`, '', c.title.toUpperCase(), c.dek, '', `Read online: ${web}`, ''];
  for (const b of c.blocks) {
    if (b.type === 'tldr') out.push('THE 30-SECOND VERSION', ...b.bullets.filter(Boolean).map((x) => `- ${x}`), '');
    if (b.type === 'stat') out.push(`NUMBER OF THE WEEK: ${b.value}`, b.caption, '');
    if (b.type === 'story') out.push(b.headline.toUpperCase(), b.body, b.why ? `Why it matters: ${b.why}` : '', '');
    if (b.type === 'showcase') out.push(`${PILLARS[b.pillar].label}: ${b.title}`, b.body, '');
    if (b.type === 'cta') out.push(`Interested? ${base}/a/${ctx?.token || '_'}/interested?e=${e.id}`, '');
  }
  out.push('---', `Unsubscribe: ${base}/u/${ctx?.token || '_'}?unsubscribe=1`);
  if (p.brand.address) out.push(p.brand.address);
  return out.filter((x, i, a) => !(x === '' && a[i - 1] === '')).join('\n');
}

export function renderWhatsApp(e: Edition, p: Product, link: string, firstName?: string): string {
  const txt = e.content.waText || `Hi {first_name} 👋\n${e.content.title}\n👉 {link}`;
  return personalize(txt, { first_name: firstName || 'there', link }).replace(/[ \t]{2,}/g, ' ');
}
