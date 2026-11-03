import Link from 'next/link';
import { all, get } from '@/lib/db';
import { requireProduct } from '@/lib/context';
import { MATURITY, PILLARS } from '@/lib/types';
import { configuredProviders } from '@/lib/ai/providers';
import { ago } from '@/lib/format';
import { MaturityPill } from '@/components/bits';
import { Submit } from '@/components/ui';
import { saveKb, deleteKb, importWebsite } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Our work' };

function KbForm({ k }: { k?: any }) {
  return (
    <form action={saveKb} className="form-grid">
      <input type="hidden" name="id" value={k?.id || ''} />
      <label className="f"><span>Section</span><select className="in" name="pillar" defaultValue={k?.pillar || 'feature'}>{Object.entries(PILLARS).map(([v, x]) => <option key={v} value={v}>{x.label}: {x.hint}</option>)}</select></label>
      <label className="f"><span>Honest status</span><select className="in" name="status" defaultValue={k?.status || 'live'}>{Object.entries(MATURITY).map(([v, x]) => <option key={v} value={v}>{x.label}</option>)}</select></label>
      <label className="f full"><span>Title</span><input className="in" name="title" defaultValue={k?.title} required placeholder="e.g. Instant WhatsApp follow-up after a site visit" /></label>
      <label className="f full"><span>What it is (2–3 sentences)</span><textarea className="in" name="summary" defaultValue={k?.summary} rows={3} /></label>
      <label className="f"><span>Problem it solves for a developer’s team</span><textarea className="in" name="problem" defaultValue={k?.problem || ''} rows={2} /></label>
      <label className="f"><span>Result (only numbers you can stand behind)</span><textarea className="in" name="result" defaultValue={k?.result || ''} rows={2} /></label>
      <label className="f"><span>Client name (delivered work)</span><input className="in" name="client_name" defaultValue={k?.client_name || ''} /></label>
      <label className="f"><span>Approved numbers (what the client OK’d)</span><input className="in" name="approved_numbers" defaultValue={k?.approved_numbers || ''} placeholder="e.g. 3 days → 4 hours" /></label>
      <label className="f"><span>Image / video URL</span><input className="in" name="media_url" defaultValue={k?.media_url || ''} placeholder="Upload in the editor, or paste a link" /></label>
      <label className="f"><span>Link for more</span><input className="in" name="link" defaultValue={k?.link || ''} /></label>
      <label className="check full"><input type="checkbox" name="client_permission" defaultChecked={!!k?.client_permission} /><span>We have written permission to name this client</span></label>
      <label className="check full"><input type="checkbox" name="active" defaultChecked={k ? !!k.active : true} /><span>Confirmed and ready to feature (the AI only uses confirmed items)</span></label>
      <div className="full row"><Submit>{k ? 'Save' : 'Add item'}</Submit></div>
    </form>
  );
}

export default async function Knowledge({ searchParams }: { searchParams: Promise<{ edit?: string; add?: string }> }) {
  const p = await requireProduct();
  const sp = await searchParams;
  const items = all('SELECT * FROM kb_items WHERE product_id = ? ORDER BY active ASC, pillar, title', p.id);
  const editing = sp.edit ? get('SELECT * FROM kb_items WHERE id = ?', sp.edit) : null;
  const review = items.filter((i) => !i.active);
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="ph">
        <div><div className="eyebrow">{p.name}</div><h1>Our work</h1><p className="sub">Features, delivered projects and ideas the newsletter can feature. Each has an honest status, and the checks block any wording that claims more than that status.</p></div>
        <div className="row">
          {p.website && <form action={importWebsite.bind(null, p.id)}><Submit className="btn" pending="Reading the website…">Import from {p.website.replace(/^https?:\/\//, '')}</Submit></form>}
          <Link className="btn primary" href="/app/knowledge?add=1">Add item</Link>
        </div>
      </div>
      {!configuredProviders().length && p.website && <div className="notice">Website import reads your site and, with an AI key connected, suggests features for you to confirm. Without a key it only fills in the description.</div>}
      <section className="card">
        <div className="card-head"><h2>About {p.name}</h2><Link href={`/app/settings?tab=products&p=${p.id}`}>Edit profile →</Link></div>
        <p>{p.brand.about || <span className="hint">No description yet. Import it from the website or write it in Settings → Products. The AI uses it to pick stories and write the “Our work” cards.</span>}</p>
        {p.brand.icp && <p className="hint"><b>Readers:</b> {p.brand.icp}</p>}
      </section>
      {(sp.add || editing) && <section className="card"><div className="card-head"><h2>{editing ? 'Edit item' : 'New item'}</h2><Link href="/app/knowledge" className="btn sm ghost">Close</Link></div><KbForm k={editing} /></section>}
      {review.length > 0 && <div className="notice warn"><b>{review.length} item(s) need your review.</b> Imported or unconfirmed items are never used until you confirm their real status.</div>}
      {items.length ? (
        <div className="grid3">
          {items.map((k) => (
            <article key={k.id} className="card" style={{ display: 'grid', gap: 8, alignContent: 'start', borderStyle: k.active ? 'solid' : 'dashed' }}>
              <div className="row"><span className="eyebrow">{(PILLARS as any)[k.pillar]?.label}</span><span className="spacer" /><MaturityPill status={k.status} />{!k.active && <span className="pill warn">Needs review</span>}</div>
              <h3>{k.title}</h3>
              <p className="hint" style={{ margin: 0 }}>{k.summary || 'No description.'}</p>
              {k.result && <p style={{ margin: 0, fontSize: 13.5 }}><b>Result:</b> {k.result}</p>}
              {k.client_name && <p className="hint" style={{ margin: 0 }}>Client: {k.client_name} · {k.client_permission ? 'may be named' : 'keep anonymous'}</p>}
              <div className="hint">Featured {k.times_featured}× · last {ago(k.last_featured_at)}</div>
              <div className="row"><Link className="btn sm" href={`/app/knowledge?edit=${k.id}`}>{k.active ? 'Edit' : 'Review'}</Link><form action={deleteKb.bind(null, k.id)}><button className="btn sm ghost">Delete</button></form></div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty"><b>Nothing here yet</b><span>Add 5–10 items: what’s live, what you’ve delivered for developers, and ideas you could build with a client. That covers about two months of editions.</span><Link className="btn primary" href="/app/knowledge?add=1">Add the first item</Link></div>
      )}
    </div>
  );
}
