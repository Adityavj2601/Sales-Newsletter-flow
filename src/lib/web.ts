/* Small helpers for fetching and reading web pages without extra dependencies. */
import { BlockList, isIPv4 } from 'node:net';

export const UA = 'Mozilla/5.0 (compatible; BriefStudio/1.0; +https://github.com/)';

/** Blocks requests to loopback, private, link-local and metadata addresses (SSRF). Set ALLOW_PRIVATE_FETCH=1 to allow, e.g. for local testing. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let u: URL;
  try { u = new URL(raw); } catch { throw new Error('That is not a valid web address.'); }
  if (!/^https?:$/.test(u.protocol)) throw new Error('Only http(s) addresses are allowed.');
  if (process.env.ALLOW_PRIVATE_FETCH === '1') return u;
  const host = u.hostname.replace(/^\[|\]$/g, '');
  const { lookup } = await import('node:dns/promises');
  const { isIP } = await import('node:net');
  const addrs = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [] as { address: string }[])).map((a) => a.address);
  if (!addrs.length) throw new Error(`Could not find ${host}.`);
  for (const a of addrs) if (isPrivate(a)) throw new Error('Addresses on private or internal networks are not allowed.');
  return u;
}
function isPrivate(ip: string): boolean {
  const bl = new BlockList();
  for (const [net, bits] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 3]] as const) bl.addSubnet(net, bits, 'ipv4');
  for (const [net, bits] of [['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['64:ff9b::', 96]] as const) bl.addSubnet(net, bits, 'ipv6');
  // IPv4-mapped/compatible IPv6 (e.g. ::ffff:7f00:1) is decoded and checked as IPv4 too.
  const m = ip.toLowerCase().match(/^::(?:ffff:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (m) { const a = parseInt(m[1], 16), b = parseInt(m[2], 16); return isPrivate(`${a >> 8}.${a & 255}.${b >> 8}.${b & 255}`); }
  const dotted = ip.replace(/^::ffff:/i, '');
  if (isIPv4(dotted)) return bl.check(dotted, 'ipv4');
  try { return bl.check(ip, 'ipv6'); } catch { return true; }
}

export async function fetchText(url: string, ms = 12000): Promise<{ status: number; text: string; finalUrl: string; type: string }> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    let current = url;
    for (let hop = 0; hop < 6; hop++) {
      await assertPublicUrl(current); // re-checked on every redirect
      const res = await fetch(current, { headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,application/xml,application/rss+xml;q=0.9,*/*;q=0.8' }, redirect: 'manual', signal: ctl.signal });
      const loc = res.headers.get('location');
      if (res.status >= 300 && res.status < 400 && loc) { current = new URL(loc, current).toString(); continue; }
      const type = res.headers.get('content-type') || '';
      const text = type.includes('image') || type.includes('video') ? '' : (await res.text()).slice(0, 2_000_000);
      return { status: res.status, text, finalUrl: current, type };
    }
    throw new Error('Too many redirects.');
  } finally {
    clearTimeout(t);
  }
}

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…', rupee: '₹' };
export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
}
export function stripTags(html: string): string {
  return decodeEntities(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}
export function meta(html: string, name: string): string {
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*>`, 'i');
  const tag = html.match(re)?.[0];
  const c = tag?.match(/content=["']([^"']*)["']/i)?.[1];
  return c ? decodeEntities(c).trim() : '';
}
export function pageTitle(html: string): string {
  return meta(html, 'og:title') || decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').trim();
}

/** Readable text: paragraphs from <article> or <main> when present, else all <p>. */
export function readableText(html: string, max = 6000): string {
  const scope = html.match(/<article[\s\S]*?<\/article>/i)?.[0] || html.match(/<main[\s\S]*?<\/main>/i)?.[0] || html;
  const paras = [...scope.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => stripTags(m[1])).filter((p) => p.length > 60);
  const text = paras.join('\n\n');
  return (text || stripTags(scope)).slice(0, max);
}

/** Headings and key text from a homepage, used to brief the AI about a product. */
export function siteDigest(html: string, max = 9000): string {
  const heads = [...html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map((m) => stripTags(m[1])).filter(Boolean);
  const lis = [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) => stripTags(m[1])).filter((t) => t.length > 12 && t.length < 200);
  return [
    `TITLE: ${pageTitle(html)}`,
    `DESCRIPTION: ${meta(html, 'description') || meta(html, 'og:description')}`,
    `HEADINGS:\n- ${heads.slice(0, 40).join('\n- ')}`,
    `LIST ITEMS:\n- ${lis.slice(0, 40).join('\n- ')}`,
    `TEXT:\n${readableText(html, 4000)}`,
  ].join('\n\n').slice(0, max);
}

export function sameSiteLinks(html: string, base: string, limit = 6): string[] {
  const origin = new URL(base).origin;
  const out = new Set<string>();
  for (const m of html.matchAll(/<a[^>]+href=["']([^"'#]+)["']/gi)) {
    try {
      const u = new URL(m[1], base);
      if (u.origin === origin && u.pathname !== '/' && !/\.(pdf|png|jpe?g|svg|webp|gif|zip)$/i.test(u.pathname) && /product|feature|solution|about|case|work|platform|how|service|customer/i.test(u.pathname)) out.add(u.origin + u.pathname);
    } catch { /* ignore */ }
    if (out.size >= limit) break;
  }
  return [...out];
}
