import { insert, uid, now, get } from '../db';
import { getSetting, providerKey, PROVIDERS, type Provider, type Task } from '../settings';

export type Msg = { role: 'user' | 'assistant'; content: string };
export type LLMResult = { text: string; provider: Provider | 'demo'; model: string; inputTokens: number; outputTokens: number };

/** Suggested models per provider. Editable in Settings → AI; these are only defaults. */
export const MODEL_DEFAULTS: Record<Provider, { writer: string; fast: string; suggestions: string[] }> = {
  anthropic: { writer: 'claude-sonnet-5-5', fast: 'claude-haiku-5-5', suggestions: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'] },
  openai: { writer: 'gpt-5', fast: 'gpt-5-mini', suggestions: ['gpt-5', 'gpt-5-mini'] },
  gemini: { writer: 'gemini-2.5-pro', fast: 'gemini-2.5-flash', suggestions: ['gemini-2.5-pro', 'gemini-2.5-flash'] },
  openrouter: { writer: 'openrouter/auto', fast: 'openrouter/auto', suggestions: ['openrouter/auto', 'anthropic/claude-sonnet-4.5', 'openai/gpt-5', 'google/gemini-2.5-pro'] },
};
export const PROVIDER_LABEL: Record<Provider, string> = { anthropic: 'Claude (Anthropic)', openai: 'ChatGPT (OpenAI)', gemini: 'Gemini (Google)', openrouter: 'OpenRouter' };

export const configuredProviders = () => PROVIDERS.filter((p) => !!providerKey(p));

/** Resolve the ordered list of {provider, model} attempts for a task (primary first, then fallbacks). */
export function routeFor(task: Task, avoid?: Provider | 'demo'): { provider: Provider; model: string }[] {
  const ai = getSetting('ai');
  const have = configuredProviders();
  if (!have.length) return [];
  const pick = (p: Provider, explicit?: string) => ({ provider: p, model: explicit || (task === 'fast' ? MODEL_DEFAULTS[p].fast : MODEL_DEFAULTS[p].writer) });
  const r = ai.routing[task];
  const out: { provider: Provider; model: string }[] = [];
  if (r && r.provider !== 'auto' && have.includes(r.provider)) out.push(pick(r.provider, r.model));
  let order = [...have];
  if (task === 'factcheck' && avoid) order = [...have.filter((p) => p !== avoid), ...have.filter((p) => p === avoid)];
  for (const p of order) if (!out.some((o) => o.provider === p)) out.push(pick(p));
  return out;
}

export function tokensThisMonth(): number {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const r = get('SELECT COALESCE(SUM(input_tokens + output_tokens), 0) AS t FROM llm_usage WHERE created_at >= ?', start.toISOString());
  return Number(r?.t || 0);
}

async function post(url: string, headers: Record<string, string>, body: any, ms = 180_000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: ctl.signal });
    const txt = await res.text();
    let json: any = null;
    try { json = JSON.parse(txt); } catch { /* keep text */ }
    if (!res.ok) {
      const msg = json?.error?.message || json?.error?.status || json?.message || txt.slice(0, 300);
      throw new Error(`${res.status}: ${msg}`);
    }
    return json;
  } finally {
    clearTimeout(t);
  }
}

export async function callProvider(provider: Provider, model: string, system: string, messages: Msg[], opts: { json?: boolean; maxTokens?: number } = {}): Promise<LLMResult> {
  const key = providerKey(provider);
  if (!key) throw new Error(`No API key saved for ${PROVIDER_LABEL[provider]}.`);
  const maxTokens = opts.maxTokens ?? 8000;
  if (provider === 'anthropic') {
    const j = await post('https://api.anthropic.com/v1/messages', { 'x-api-key': key, 'anthropic-version': '2023-06-01' }, { model, max_tokens: maxTokens, system, messages });
    const text = (j.content || []).filter((c: any) => c.type === 'text').map((c: any) => c.text).join('');
    return { text, provider, model, inputTokens: j.usage?.input_tokens || 0, outputTokens: j.usage?.output_tokens || 0 };
  }
  if (provider === 'openai' || provider === 'openrouter') {
    const url = provider === 'openai' ? 'https://api.openai.com/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions';
    const headers: Record<string, string> = { authorization: `Bearer ${key}` };
    if (provider === 'openrouter') Object.assign(headers, { 'HTTP-Referer': 'https://github.com/sales-newsletter-flow', 'X-Title': 'Brief Studio' });
    const body: any = { model, messages: [{ role: 'system', content: system }, ...messages] };
    if (opts.json) body.response_format = { type: 'json_object' };
    const j = await post(url, headers, body);
    return { text: j.choices?.[0]?.message?.content || '', provider, model, inputTokens: j.usage?.prompt_tokens || 0, outputTokens: j.usage?.completion_tokens || 0 };
  }
  // gemini
  const j = await post(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, { 'x-goog-api-key': key }, {
    systemInstruction: { parts: [{ text: system }] },
    contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
    generationConfig: { maxOutputTokens: maxTokens, ...(opts.json ? { responseMimeType: 'application/json' } : {}) },
  });
  const text = (j.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || '').join('');
  return { text, provider, model, inputTokens: j.usageMetadata?.promptTokenCount || 0, outputTokens: j.usageMetadata?.candidatesTokenCount || 0 };
}

function logUsage(task: string, provider: string, model: string, r: Partial<LLMResult> | null, ms: number, error?: string) {
  insert('llm_usage', { id: uid(), task, provider, model, input_tokens: r?.inputTokens || 0, output_tokens: r?.outputTokens || 0, ok: error ? 0 : 1, error: error || null, ms, created_at: now() });
}

/** Run a task with fallback across configured providers. Returns null when no provider is configured (caller uses demo mode). */
export async function runTask(task: Task, system: string, messages: Msg[], opts: { json?: boolean; maxTokens?: number; avoid?: Provider | 'demo' } = {}): Promise<LLMResult | null> {
  const routes = routeFor(task, opts.avoid);
  if (!routes.length) return null;
  const limit = getSetting('ai').monthlyTokenLimit;
  if (limit > 0 && tokensThisMonth() >= limit) throw new Error('Monthly AI token limit reached. Raise it in Settings → AI.');
  const errors: string[] = [];
  for (const r of routes) {
    const t0 = Date.now();
    try {
      const res = await callProvider(r.provider, r.model, system, messages, opts);
      logUsage(task, r.provider, r.model, res, Date.now() - t0);
      if (!res.text.trim()) throw new Error('Empty response');
      return res;
    } catch (e: any) {
      const msg = String(e?.message || e);
      logUsage(task, r.provider, r.model, null, Date.now() - t0, msg);
      errors.push(`${PROVIDER_LABEL[r.provider]} (${r.model}): ${msg}`);
    }
  }
  throw new Error('All AI providers failed. ' + errors.join(' | '));
}

/** Pull the first JSON object out of a model reply (handles ```json fences and chatter). */
export function extractJSON<T = any>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('The AI reply did not contain JSON.');
  return JSON.parse(candidate.slice(start, end + 1));
}

/** Ask for JSON; on parse failure, ask once more to fix it. */
export async function runJSON<T = any>(task: Task, system: string, user: string, opts: { maxTokens?: number; avoid?: Provider | 'demo' } = {}): Promise<{ data: T; meta: LLMResult } | null> {
  const first = await runTask(task, system, [{ role: 'user', content: user }], { json: true, ...opts });
  if (!first) return null;
  try {
    return { data: extractJSON<T>(first.text), meta: first };
  } catch {
    const second = await runTask(task, system, [
      { role: 'user', content: user },
      { role: 'assistant', content: first.text.slice(0, 20000) },
      { role: 'user', content: 'That was not valid JSON. Reply again with ONLY the complete, valid JSON object and nothing else.' },
    ], { json: true, ...opts });
    if (!second) return null;
    return { data: extractJSON<T>(second.text), meta: second };
  }
}
