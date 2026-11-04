'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { all, get, insert, update, run, uid, now, tx } from '@/lib/db';
import { requireUser, requireAdmin, destroySession, revokeSessions, createSession } from '@/lib/auth';
import { hashPassword, encrypt, verifyPassword } from '@/lib/crypto';
import { PRODUCT_COOKIE, requireProduct } from '@/lib/context';
import { getSetting, setSetting, setProviderKey, getProduct, BRAND_DEFAULT, PROVIDERS, type Provider, type Task } from '@/lib/settings';
import { ingestProduct, addStoryByUrl } from '@/lib/ingest';
import { ensureJobs, runJob, nextRun } from '@/lib/jobs';
import { blankEdition, duplicateEdition } from '@/lib/editions';
import { sampleContacts } from '@/lib/seed';
import { importFromWebsite } from '@/lib/siteImport';
import { normalizePhone, parseCSV } from '@/lib/csv';
import { safeUrl } from '@/lib/types';
const EMAIL = /^[^@\s"'<>(),;:\\]+@[^@\s"'<>(),;:\\]+\.[a-z]{2,}$/i;

const s = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
function back(path: string, msg: string): never {
  revalidatePath('/app', 'layout');
  redirect(`${path}${path.includes('?') ? '&' : '?'}msg=${encodeURIComponent(msg)}`);
}
const errMsg = (e: any) => String(e?.message || e).slice(0, 300);

/* ---------- Session / product ---------- */
export async function switchProduct(fd: FormData) {
  await requireUser();
  const id = s(fd, 'product');
  (await cookies()).set(PRODUCT_COOKIE, id, { path: '/', maxAge: 365 * 86400, sameSite: 'lax', httpOnly: true });
  const raw = s(fd, 'to');
  const to = raw.startsWith('/app') && !raw.startsWith('//') ? raw : '/app';
  redirect(to.startsWith('/app/editions/') || to.startsWith('/app/contacts/') ? to.split('/').slice(0, 3).join('/') : to);
}
export async function logout() {
  await destroySession();
  redirect('/login');
}
export async function markAllRead() {
  const p = await requireProduct();
  run('UPDATE notifications SET read_at = ? WHERE read_at IS NULL AND (product_id = ? OR product_id IS NULL)', now(), p.id);
  back('/app/notifications', 'All caught up.');
}

/* ---------- Stories ---------- */
export async function fetchNewsNow() {
  await requireUser();
  const p = await requireProduct();
  let msg = '';
  try {
    const lines: string[] = [];
    const r = await ingestProduct(p.id, (l) => lines.push(l));
    const failed = lines.filter((l) => l.startsWith('✕')).length;
    msg = `${r.added} new stories.${failed ? ` ${failed} source(s) failed; see Sources.` : ''}`;
  } catch (e) { msg = errMsg(e); }
  back('/app/stories', msg);
}
export async function setStoryStatus(id: string, status: string) {
  await requireUser();
  if (!['new', 'shortlisted', 'dismissed', 'used'].includes(status)) return;
  run('UPDATE stories SET status = ? WHERE id = ?', status, id);
  revalidatePath('/app/stories');
}
export async function addStory(fd: FormData) {
  await requireUser();
  const p = await requireProduct();
  let msg = 'Story added to your shortlist.';
  try { await addStoryByUrl(p.id, s(fd, 'url')); } catch (e) { msg = errMsg(e); }
  back('/app/stories', msg);
}
export async function clearOldStories() {
  await requireUser();
  const p = await requireProduct();
  run("DELETE FROM stories WHERE product_id = ? AND status IN ('new','dismissed') AND created_at < ?", p.id, new Date(Date.now() - 30 * 86400_000).toISOString());
  back('/app/stories', 'Removed unused stories older than 30 days.');
}

/* ---------- Sources ---------- */
export async function addSource(fd: FormData) {
  await requireUser();
  const p = await requireProduct();
  const kind = s(fd, 'kind') === 'rss' ? 'rss' : 'gnews';
  const url = s(fd, 'url');
  if (!url) back('/app/sources', 'Enter a feed URL or a search query.');
  if (kind === 'rss' && !/^https?:\/\//.test(url)) back('/app/sources', 'Feed URLs start with https://');
  const scope = s(fd, 'scope') === 'all' ? null : p.id;
  insert('sources', { id: uid('src_'), product_id: scope, kind, name: s(fd, 'name') || (kind === 'gnews' ? `Google News: ${url}` : url), url, active: 1, last_fetched_at: null, last_error: null, last_count: null, created_at: now() });
  back('/app/sources', 'Source added. It is read on the next “Fetch news” run.');
}
export async function toggleSource(id: string) {
  await requireUser();
  run('UPDATE sources SET active = 1 - active WHERE id = ?', id);
  revalidatePath('/app/sources');
}
export async function deleteSource(id: string) {
  await requireUser();
  run('DELETE FROM sources WHERE id = ?', id);
  revalidatePath('/app/sources');
}

/* ---------- Knowledge base ---------- */
export async function saveKb(fd: FormData) {
  await requireUser();
  const p = await requireProduct();
  const id = s(fd, 'id');
  const row = {
    pillar: ['feature', 'delivered', 'concept'].includes(s(fd, 'pillar')) ? s(fd, 'pillar') : 'feature',
    status: ['live', 'delivered', 'pilot', 'prototype', 'concept'].includes(s(fd, 'status')) ? s(fd, 'status') : 'live',
    title: s(fd, 'title'), summary: s(fd, 'summary'), problem: s(fd, 'problem'), result: s(fd, 'result'),
    client_name: s(fd, 'client_name') || null, client_permission: fd.get('client_permission') ? 1 : 0,
    approved_numbers: s(fd, 'approved_numbers'), media_url: safeUrl(s(fd, 'media_url')) || null, link: safeUrl(s(fd, 'link')) || null,
    active: fd.get('active') ? 1 : 0,
  };
  if (!row.title) back('/app/knowledge', 'Give the item a title.');
  let note = '';
  if (row.pillar === 'concept' && !['concept', 'prototype'].includes(row.status)) { row.status = 'concept'; note = ' Status set to Concept, because ideas on the drawing board can’t be live or delivered.'; }
  if (row.pillar !== 'concept' && row.status === 'concept') { row.pillar = 'concept'; note = ' Moved to “On the drawing board”, because concepts aren’t built yet.'; }
  if (id) update('kb_items', id, row);
  else insert('kb_items', { id: uid('kb_'), product_id: p.id, ...row, times_featured: 0, last_featured_at: null, created_at: now() });
  back('/app/knowledge', (id ? 'Saved.' : 'Added to the knowledge base.') + note);
}
export async function deleteKb(id: string) {
  await requireUser();
  run('DELETE FROM kb_items WHERE id = ?', id);
  revalidatePath('/app/knowledge');
}
export async function importWebsite(productId: string) {
  await requireUser();
  let msg = '';
  try {
    const r = await importFromWebsite(productId);
    msg = r.ai ? `Read ${r.pages} page(s). Profile updated and ${r.added} item(s) added to the knowledge base for your review.` : `Read the website. Add an AI key to also extract features automatically.`;
  } catch (e) { msg = errMsg(e); }
  back('/app/knowledge', msg);
}

/* ---------- Contacts ---------- */
function contactRow(fd: FormData) {
  return {
    first_name: s(fd, 'first_name'), last_name: s(fd, 'last_name'), email: s(fd, 'email').toLowerCase() || null, phone: normalizePhone(s(fd, 'phone')) || null,
    company: s(fd, 'company'), role: s(fd, 'role'), city: s(fd, 'city'), tags: s(fd, 'tags').split(',').map((t) => t.trim()).filter(Boolean).join(', '),
    email_consent: fd.get('email_consent') ? 1 : 0, wa_consent: fd.get('wa_consent') ? 1 : 0, consent_source: s(fd, 'consent_source') || null,
    stage: s(fd, 'stage') || 'new', notes: s(fd, 'notes') || null,
  };
}
export async function saveContact(fd: FormData) {
  await requireUser();
  const p = await requireProduct();
  const id = s(fd, 'id');
  const row = contactRow(fd);
  const retry = id ? `/app/contacts/${id}` : '/app/contacts?add=1';
  if (!fd.has('stage')) delete (row as any).stage;
  if (row.phone && row.phone.replace(/\D/g, '').length < 8) back(retry, `“${s(fd, 'phone')}” is too short to be a phone number.`);
  if (!row.email && !row.phone) back(retry, 'Add an email or a phone number.');
  if (row.email && !EMAIL.test(row.email)) back(retry, `“${row.email}” is not a valid email address.`);
  try {
    if (id) {
      const prev = get('SELECT * FROM contacts WHERE id = ?', id);
      const consentChanged = prev && (prev.email_consent !== row.email_consent || prev.wa_consent !== row.wa_consent);
      update('contacts', id, { ...row, ...(consentChanged ? { consent_at: now() } : {}), ...(fd.get('resubscribe') ? { status: 'active' } : {}) });
    } else insert('contacts', { id: uid('c_'), product_id: p.id, ...row, consent_at: row.email_consent || row.wa_consent ? now() : null, status: 'active', frequency: 'weekly', score: 0, last_engaged_at: null, last_intent: null, last_intent_at: null, created_at: now() });
  } catch (e: any) {
    back(retry, /UNIQUE/.test(String(e?.message)) ? 'A contact with that email or phone already exists.' : errMsg(e));
  }
  back(id ? `/app/contacts/${id}` : '/app/contacts', 'Contact saved.');
}
export async function setStage(id: string, stage: string) {
  await requireUser();
  update('contacts', id, { stage });
  revalidatePath('/app/leads');
  revalidatePath(`/app/contacts/${id}`);
}
export async function deleteContact(id: string) {
  await requireUser();
  run('DELETE FROM contacts WHERE id = ?', id);
  back('/app/contacts', 'Contact deleted.');
}
export async function bulkContacts(fd: FormData) {
  await requireUser();
  const ids = fd.getAll('ids').map(String);
  const action = s(fd, 'bulk');
  if (!ids.length) back('/app/contacts', 'Select contacts first.');
  const q = ids.map(() => '?').join(',');
  if (action === 'delete') run(`DELETE FROM contacts WHERE id IN (${q})`, ...ids);
  else if (action === 'tag' && !s(fd, 'tag')) back('/app/contacts', 'Type the tag to add first.');
  else if (action === 'tag') {
    for (const r of all(`SELECT id, tags FROM contacts WHERE id IN (${q})`, ...ids)) {
      const tags = new Set(String(r.tags || '').split(',').map((t: string) => t.trim()).filter(Boolean));
      tags.add(s(fd, 'tag'));
      update('contacts', r.id, { tags: [...tags].join(', ') });
    }
  } else if (action === 'unsubscribe') run(`UPDATE contacts SET status = 'unsubscribed', email_consent = 0, wa_consent = 0 WHERE id IN (${q})`, ...ids);
  back('/app/contacts', `Updated ${ids.length} contact(s).`);
}
export async function loadSampleContacts() {
  await requireUser();
  const p = await requireProduct();
  const n = sampleContacts(p.id);
  back('/app/contacts', n ? `Added ${n} sample contacts (tagged “sample”). Delete them before real sends.` : 'Sample contacts are already loaded.');
}
export type ImportResult = { added: number; updated: number; skipped: number; errors: string[] };
export async function importContacts(_: ImportResult | null, fd: FormData): Promise<ImportResult> {
  await requireUser();
  const p = await requireProduct();
  const text = s(fd, 'csv');
  const map = JSON.parse(s(fd, 'map') || '{}') as Record<string, string>;
  if (!fd.get('confirm')) return { added: 0, updated: 0, skipped: 0, errors: ['Tick the box to confirm these people agreed to hear from you.'] };
  const emailConsent = !!fd.get('email_consent');
  const waConsent = !!fd.get('wa_consent');
  const source = s(fd, 'consent_source') || 'CSV import';
  const extraTag = s(fd, 'tag');
  const rows = parseCSV(text);
  const head = rows.shift() || [];
  const idx = (field: string) => (map[field] ? head.indexOf(map[field]) : -1);
  const res: ImportResult = { added: 0, updated: 0, skipped: 0, errors: [] };
  tx(() => {
    rows.forEach((r, n) => { try {
      const val = (f: string) => (idx(f) >= 0 ? String(r[idx(f)] ?? '').trim() : '');
      let first = val('first_name'), last = val('last_name');
      if (!first && val('name')) {
        const parts = val('name').split(/\s+/);
        first = parts[0];
        last = last || parts.slice(1).join(' ');
      }
      let email = val('email').toLowerCase();
      const rawPhone = normalizePhone(val('phone'));
      const phone = rawPhone.replace(/\D/g, '').length >= 8 ? rawPhone : '';
      if (rawPhone && !phone) res.errors.push(`Row ${n + 2}: “${val('phone')}” is too short to be a phone number`);
      if (email && !EMAIL.test(email)) { res.errors.push(`Row ${n + 2}: “${email}” is not a valid email${phone ? ' (imported with the phone number only)' : ''}`); email = ''; }
      if (!email && !phone) { res.skipped++; if (!rawPhone && !val('email')) res.errors.push(`Row ${n + 2}: no email or phone`); return; }
      const tags = [val('tags'), extraTag].filter(Boolean).join(', ');
      const existing = (email && get('SELECT * FROM contacts WHERE product_id = ? AND email = ?', p.id, email)) || (phone && get('SELECT * FROM contacts WHERE product_id = ? AND phone = ?', p.id, phone));
      const row: any = { first_name: first, last_name: last, company: val('company'), role: val('role'), city: val('city') };
      if (existing) {
        const patch: any = {};
        for (const k of Object.keys(row)) if (row[k] && !existing[k]) patch[k] = row[k];
        if (email && !existing.email && !get('SELECT id FROM contacts WHERE product_id = ? AND email = ? AND id <> ?', p.id, email, existing.id)) patch.email = email;
        if (phone && !existing.phone && !get('SELECT id FROM contacts WHERE product_id = ? AND phone = ? AND id <> ?', p.id, phone, existing.id)) patch.phone = phone;
        if (tags) patch.tags = [...new Set([...String(existing.tags || '').split(','), ...tags.split(',')].map((t) => t.trim()).filter(Boolean))].join(', ');
        if (existing.status === 'active') { if (emailConsent) patch.email_consent = 1; if (waConsent) patch.wa_consent = 1; }
        update('contacts', existing.id, patch);
        res.updated++;
      } else {
        insert('contacts', { id: uid('c_'), product_id: p.id, ...row, email: email || null, phone: phone || null, tags, email_consent: emailConsent && email ? 1 : 0, wa_consent: waConsent && phone ? 1 : 0, consent_source: source, consent_at: now(), status: 'active', frequency: 'weekly', stage: 'new', score: 0, last_engaged_at: null, last_intent: null, last_intent_at: null, notes: null, created_at: now() });
        res.added++;
      }
    } catch (err: any) { res.skipped++; res.errors.push(`Row ${n + 2}: ${/UNIQUE/.test(String(err?.message)) ? 'email or phone already belongs to another contact' : String(err?.message || err).slice(0, 80)}`); } });
  });
  revalidatePath('/app/contacts');
  return { ...res, errors: res.errors.slice(0, 10) };
}

/* ---------- Editions ---------- */
export async function newBlankEdition() {
  const u = await requireUser();
  const p = await requireProduct();
  const e = blankEdition(p.id, u.name);
  redirect(`/app/editions/${e.id}`);
}
export async function duplicate(id: string) {
  const u = await requireUser();
  const e = duplicateEdition(id, u.name);
  redirect(`/app/editions/${e.id}?msg=${encodeURIComponent('Copy created.')}`);
}
export async function deleteEdition(id: string) {
  await requireUser();
  const e = get('SELECT status FROM editions WHERE id = ?', id);
  if (e?.status === 'sent' || e?.status === 'sending') back('/app/editions', 'Sent editions are kept for your records and analytics.');
  run("UPDATE stories SET status = 'new', used_in = NULL WHERE used_in = ?", id);
  run('DELETE FROM editions WHERE id = ?', id);
  back('/app/editions', 'Edition deleted.');
}

/* ---------- Automations ---------- */
export async function saveJob(fd: FormData) {
  await requireUser();
  const id = s(fd, 'id');
  const cron = s(fd, 'cron') || s(fd, 'cron_custom');
  if (!cron) back('/app/automations', 'Choose a preset or type a custom schedule.');
  const next = nextRun(cron);
  if (!next) back('/app/automations', `“${cron}” is not a valid schedule. Use 5 fields: minute hour day month weekday, e.g. “0 9 * * 1”.`);
  update('jobs', id, { cron, enabled: fd.get('enabled') ? 1 : 0, next_run_at: next });
  back('/app/automations', 'Schedule saved.');
}
export async function runJobNow(id: string) {
  await requireUser();
  const r = await runJob(id, 'manual', { force: true });
  back('/app/automations', r.status === 'ok' ? `Done. ${r.log.slice(-1)[0] || ''}` : `Failed: ${r.log.slice(-1)[0] || ''}`);
}

/* ---------- Settings ---------- */
export async function saveGeneral(fd: FormData) {
  await requireAdmin();
  const g = getSetting('general');
  setSetting('general', { ...g, appName: s(fd, 'appName') || g.appName, publicBaseUrl: /^https?:\/\/[^\s"'<>]+$/i.test(s(fd, 'publicBaseUrl')) ? s(fd, 'publicBaseUrl').replace(/\/+$/, '') : '', timezone: s(fd, 'timezone') || 'Asia/Kolkata', sendDay: Number(s(fd, 'sendDay')), sendTime: s(fd, 'sendTime') || '10:00', emailsPerMinute: Math.max(1, Math.min(600, Number.isFinite(Number(s(fd, 'emailsPerMinute'))) && s(fd, 'emailsPerMinute') !== '' ? Number(s(fd, 'emailsPerMinute')) : 30)) });
  for (const j of all('SELECT id, cron FROM jobs')) update('jobs', j.id, { next_run_at: nextRun(j.cron) });
  back('/app/settings?tab=general', 'Saved.');
}
export async function saveProduct(fd: FormData) {
  await requireAdmin();
  const id = s(fd, 'id');
  const p = getProduct(id);
  if (!p) back('/app/settings?tab=products', 'Product not found.');
  const brand: any = { ...p!.brand };
  for (const k of Object.keys(BRAND_DEFAULT)) if (fd.has(k)) brand[k] = s(fd, k);
  for (const k of ['primary', 'accent', 'soft']) if (!/^#[0-9a-f]{6}$/i.test(brand[k])) brand[k] = (BRAND_DEFAULT as any)[k];
  for (const k of ['logoUrl', 'bookingUrl']) brand[k] = safeUrl(brand[k]);
  for (const k of ['senderEmail', 'replyTo', 'alertEmail']) if (brand[k] && !EMAIL.test(brand[k])) back(`/app/settings?tab=products&p=${id}`, `“${brand[k]}” is not a valid email address.`);
  const slug = s(fd, 'slug').toLowerCase().replace(/[^a-z0-9-]/g, '') || p!.slug;
  try {
    update('products', id, { name: s(fd, 'name') || p!.name, slug, website: safeUrl(s(fd, 'website')), newsletter_name: s(fd, 'newsletter_name') || p!.newsletter_name, brand: JSON.stringify(brand) });
  } catch { back(`/app/settings?tab=products&p=${id}`, 'That link name is already used by another product.'); }
  back(`/app/settings?tab=products&p=${id}`, 'Product saved.');
}
export async function addProduct(fd: FormData) {
  await requireAdmin();
  const name = s(fd, 'name');
  if (!name) back('/app/settings?tab=products', 'Enter a product name.');
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `product-${uid().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6)}`;
  const id = uid('p_');
  try {
    insert('products', { id, slug, name, website: safeUrl(s(fd, 'website')), newsletter_name: s(fd, 'newsletter_name') || `${name} Weekly`, brand: JSON.stringify({ ...BRAND_DEFAULT, senderName: `Team ${name}` }), sort: 99, created_at: now() });
  } catch { back('/app/settings?tab=products', 'A product with that name already exists.'); }
  ensureJobs(id);
  (await cookies()).set(PRODUCT_COOKIE, id, { path: '/', maxAge: 365 * 86400, sameSite: 'lax', httpOnly: true });
  back(`/app/settings?tab=products&p=${id}`, `${name} added and selected.`);
}
export async function deleteProduct(fd: FormData) {
  await requireAdmin();
  const id = s(fd, 'id');
  if (s(fd, 'confirm') !== 'DELETE') back(`/app/settings?tab=products&p=${id}`, 'Type DELETE to confirm.');
  run('DELETE FROM products WHERE id = ?', id);
  (await cookies()).delete(PRODUCT_COOKIE);
  back('/app/settings?tab=products', 'Product and all its data deleted.');
}
export async function saveAI(fd: FormData) {
  await requireAdmin();
  for (const p of PROVIDERS) {
    if (fd.get(`clear_${p}`)) setProviderKey(p, '');
    else if (s(fd, `key_${p}`)) setProviderKey(p, s(fd, `key_${p}`));
  }
  const ai = getSetting('ai');
  for (const t of ['draft', 'edit', 'fast', 'factcheck'] as Task[]) {
    const prov = s(fd, `route_${t}`) as Provider | 'auto';
    ai.routing[t] = { provider: prov || 'auto', model: s(fd, `model_${t}`) };
  }
  ai.monthlyTokenLimit = Math.max(0, Number(s(fd, 'monthlyTokenLimit')) || 0);
  setSetting('ai', ai);
  back('/app/settings?tab=ai', 'AI settings saved. Keys are encrypted.');
}
export async function saveSMTP(fd: FormData) {
  await requireAdmin();
  const cur = getSetting('smtp');
  setSetting('smtp', { host: s(fd, 'host'), port: Number(s(fd, 'port')) || 587, secure: !!fd.get('secure'), user: s(fd, 'user'), pass: fd.get('clear_pass') ? '' : s(fd, 'pass') ? encrypt(s(fd, 'pass')) : cur.pass, from: s(fd, 'from') });
  back('/app/settings?tab=email', 'Email settings saved.');
}
export async function saveWA(fd: FormData) {
  await requireAdmin();
  const cur = getSetting('whatsapp');
  setSetting('whatsapp', {
    phoneNumberId: s(fd, 'phoneNumberId'), wabaId: s(fd, 'wabaId'), templateName: s(fd, 'templateName'), templateLang: s(fd, 'templateLang') || 'en',
    verifyToken: s(fd, 'verifyToken') || cur.verifyToken || uid(), apiVersion: s(fd, 'apiVersion') || 'v21.0',
    token: fd.get('clear_token') ? '' : s(fd, 'token') ? encrypt(s(fd, 'token')) : cur.token,
    appSecret: s(fd, 'appSecret') ? encrypt(s(fd, 'appSecret')) : cur.appSecret,
    headerImage: !!fd.get('headerImage'), bodyParams: s(fd, 'bodyParams'), button: (['quick_reply', 'url', 'none'].includes(s(fd, 'button')) ? s(fd, 'button') : 'none') as any,
  });
  back('/app/settings?tab=whatsapp', 'WhatsApp settings saved.');
}
export async function saveAlerts(fd: FormData) {
  await requireAdmin();
  for (const k of ['slackWebhook', 'webhookUrl']) if (s(fd, k) && !/^https:\/\/[^\s"'<>]+$/i.test(s(fd, k))) back('/app/settings?tab=alerts', 'Webhook addresses must start with https://');
  const bad = s(fd, 'alertEmails').split(',').map((x) => x.trim()).filter(Boolean).find((x) => !EMAIL.test(x));
  if (bad) back('/app/settings?tab=alerts', `“${bad}” is not a valid email address.`);
  setSetting('alerts', { alertEmails: s(fd, 'alertEmails'), slackWebhook: s(fd, 'slackWebhook'), webhookUrl: s(fd, 'webhookUrl') });
  back('/app/settings?tab=alerts', 'Alert settings saved.');
}
export async function addUser(fd: FormData) {
  await requireAdmin();
  const email = s(fd, 'email').toLowerCase();
  if (!EMAIL.test(email) || s(fd, 'password').length < 8) back('/app/settings?tab=team', 'A valid email and an 8+ character password are required.');
  try {
    insert('users', { id: uid('u_'), email, name: s(fd, 'name') || email, pass_hash: hashPassword(s(fd, 'password')), role: s(fd, 'role') === 'admin' ? 'admin' : 'editor', created_at: now() });
  } catch { back('/app/settings?tab=team', 'That email already has an account.'); }
  back('/app/settings?tab=team', 'Teammate added. Share the password with them privately.');
}
export async function resetUserPassword(fd: FormData) {
  await requireAdmin();
  if (s(fd, 'password').length < 8) back('/app/settings?tab=team', 'Passwords need at least 8 characters.');
  if (!get('SELECT id FROM users WHERE id = ?', s(fd, 'id'))) back('/app/settings?tab=team', 'That teammate no longer exists.');
  update('users', s(fd, 'id'), { pass_hash: hashPassword(s(fd, 'password')) });
  revokeSessions(s(fd, 'id'));
  back('/app/settings?tab=team', 'Password updated. They’ve been signed out everywhere.');
}
export async function deleteUser(userId: string) {
  const me = await requireAdmin();
  if (userId === me.id) back('/app/settings?tab=team', 'You can’t remove yourself.');
  run('DELETE FROM users WHERE id = ?', userId);
  back('/app/settings?tab=team', 'Teammate removed.');
}
export async function changeMyPassword(fd: FormData) {
  const me = await requireUser();
  const u = get('SELECT pass_hash FROM users WHERE id = ?', me.id);
  if (!u || !verifyPassword(s(fd, 'current'), u.pass_hash)) back('/app/settings?tab=team', 'Your current password is not right.');
  if (s(fd, 'password').length < 8) back('/app/settings?tab=team', 'Passwords need at least 8 characters.');
  update('users', me.id, { pass_hash: hashPassword(s(fd, 'password')) });
  revokeSessions(me.id);
  await createSession(me.id);
  back('/app/settings?tab=team', 'Your password is updated. Other devices were signed out.');
}
export async function clearOutbox() {
  await requireUser();
  run('DELETE FROM outbox');
  back('/app/outbox', 'Outbox cleared.');
}
