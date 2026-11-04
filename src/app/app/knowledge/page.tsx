import Link from 'next/link';
import { all, get } from '@/lib/db';
import { requireProduct } from '@/lib/context';
import { MATURITY, PILLARS } from '@/lib/types';
import { configuredProviders } from '@/lib/ai/providers';
import { ago } from '@/lib/format';
import { Submit } from '@/components/ui';
import { Icon } from '@/components/content/icons';
import { RouteSheet } from '@/components/content/sheet';
import { KbForm, KbMenu } from '@/components/content/kb';
import { saveKb, deleteKb, importWebsite } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Our work' };

const STATUS_TONE: Record<string, string> = { live: 'ok', delivered: 'ok', pilot: 'warn', prototype: 'warn', concept: 'info' };

export default async function Knowledge({ searchParams }: { searchParams: Promise<{ edit?: string; add?: string; pillar?: string }> }) {
  const p = await requireProduct();
  const sp = await searchParams;
  const items = all('SELECT * FROM kb_items WHERE product_id = ? ORDER BY active ASC, pillar, title', p.id);
  const editing = sp.edit ? get('SELECT * FROM kb_items WHERE id = ? AND product_id = ?', sp.edit, p.id) : null;
  const review = items.filter((i) => !i.active);
  const open = !!(sp.add || editing);
  const pillars = Object.fromEntries(Object.entries(PILLARS).map(([k, v]) => [k, { label: v.label, hint: v.hint, defaultStatus: v.defaultStatus }]));
  const ai = configuredProviders().length > 0;
  const site = p.website?.replace(/^https?:\/\//, '').replace(/\/$/, '') || '';
  const importTip = ai ? `Reads ${site} and suggests items for you to confirm` : `Reads ${site} and fills in the description. Connect an AI key to also get suggested items.`;
  const maturity = Object.fromEntries(Object.entries(MATURITY).map(([k, v]) => [k, { label: v.label, allowed: v.allowed, banned: v.banned }]));

  return (
    <div className="pg kw">
      <div className="ph">
        <div><span className="eyebrow">{p.name}<span className="sep" aria-hidden>·</span>{p.newsletter_name}</span><h1>Our work</h1><p className="sub">Features, delivered projects and ideas the newsletter can feature. Each carries an honest status, and the checks block any wording that claims more than that status allows.</p></div>
        <div className="row">
          {p.website && <form action={importWebsite.bind(null, p.id)} title={importTip}><Submit className="btn" pending="Reading the website…"><Icon name="globe" size={16} />Import from {site}</Submit></form>}
          <Link className="btn primary" href="/app/knowledge?add=1" scroll={false}><Icon name="plus" size={16} strokeWidth={2.2} />Add item</Link>
        </div>
      </div>

      <section className="kw-about">
        <div className="kw-about-h"><span className="eyebrow">About {p.name}</span><Link href={`/app/settings?tab=products&p=${p.id}`}>Edit profile<Icon name="chevron" size={13} strokeWidth={2.2} /></Link></div>
        {p.brand.about
          ? <p className="kw-about-t">{p.brand.about}</p>
          : <p className="kw-about-t kw-about-empty">No description yet. {p.website ? `Import it from ${site}${ai ? ' (which also suggests items to confirm)' : ''} or add it with Edit profile.` : 'Add it with Edit profile.'} The AI uses it to pick stories and write the “Our work” cards.</p>}
        {p.brand.icp && <p className="kw-about-r"><b>Readers</b>{p.brand.icp}</p>}
      </section>

      {review.length > 0 && (
        <div className="notice warn"><span className="ni" aria-hidden>!</span><div><b>{review.length} item{review.length === 1 ? '' : 's'} need{review.length === 1 ? 's' : ''} your review.</b> Imported or unconfirmed items are never used until you confirm their real status.</div></div>
      )}

      {items.length ? Object.entries(PILLARS).map(([key, pl]) => {
        const list = items.filter((k) => k.pillar === key);
        return (
          <section key={key} className="kw-sec" aria-labelledby={`kw-${key}`} aria-describedby={`kw-${key}-d`}>
            <div className="kw-sec-h">
              <div className="kw-sec-t">
                <h2 id={`kw-${key}`} className="group-title">{pl.label}<span className="cx-group-n">{list.length}</span></h2>
                <p className="cx-group-f" id={`kw-${key}-d`}>{pl.hint}</p>
              </div>
              <Link className="btn sm ghost" href={`/app/knowledge?add=1&pillar=${key}`} scroll={false} aria-label={`New item in ${pl.label}`}><Icon name="plus" size={14} strokeWidth={2.2} />New</Link>
            </div>
            {list.length ? (
              <div className="kw-list">
                {list.map((k) => (
                  <article key={k.id} className={`card kw-card ${k.active ? '' : 'needs'}`}>
                    <div className="kw-main">
                      <div className="kw-title-row">
                        <h3>{k.title}</h3>
                        <span className={`pill ${STATUS_TONE[k.status] || ''}`}><span className="dot" />{MATURITY[k.status as keyof typeof MATURITY]?.label || k.status}</span>
                        {!k.active && <span className="pill warn">Needs review</span>}
                      </div>
                      <p className="kw-sum">{k.summary || <span className="hint">No description yet.</span>}</p>
                    </div>
                    <div className="kw-proof">
                      {k.result && <p className="kw-res"><Icon name="chart" size={14} /><span>{k.result}</span></p>}
                      {k.client_name && <p className="kw-client"><Icon name="building" size={14} /><span>{k.client_name}</span><span className={`kw-perm ${k.client_permission ? 'ok' : ''}`}>{k.client_permission ? 'May be named' : 'Keep anonymous'}</span></p>}
                      <span className="kw-feat">{k.times_featured ? (k.times_featured === 1 ? `Featured ${ago(k.last_featured_at)}` : `Featured ${k.times_featured} times, last ${ago(k.last_featured_at)}`) : 'Not featured yet'}</span>
                    </div>
                    <div className="kw-card-acts">
                      <Link className={`btn sm ${k.active ? '' : 'primary'}`} href={`/app/knowledge?edit=${k.id}`} scroll={false} aria-label={`${k.active ? 'Edit' : 'Review'} “${k.title}”`}>{k.active ? 'Edit' : 'Review'}</Link>
                      <KbMenu title={k.title} del={deleteKb.bind(null, k.id)} />
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <Link href={`/app/knowledge?add=1&pillar=${key}`} scroll={false} className="kw-blank"><Icon name="plus" size={16} strokeWidth={2.2} />Add something {key === 'feature' ? 'customers can use today' : key === 'delivered' ? 'you built for a client' : 'you could build together'}</Link>
            )}
          </section>
        );
      }) : (
        <div className="empty cx-empty">
          <span className="cx-empty-i"><Icon name="box" size={26} /></span>
          <b>Nothing here yet</b>
          <span>Add 5–10 items: what’s live, what you’ve delivered for developers, and ideas you could build with a client. That covers about two months of editions.</span>
          <Link className="btn primary" href="/app/knowledge?add=1" scroll={false}>Add the first item</Link>
        </div>
      )}

      <RouteSheet open={open} title={editing ? 'Edit item' : 'New item'} closeHref="/app/knowledge" width={620}>
        <KbForm key={editing?.id || `new-${sp.pillar || ''}`} k={editing} action={saveKb} pillars={pillars} maturity={maturity} defaultPillar={sp.pillar} />
      </RouteSheet>
    </div>
  );
}
