// Multi-provider AI router. Providers are rows in public.ai_providers, edited
// from the admin console. For each request the router:
//   1. keeps providers that are enabled, serve this purpose, are not cooling
//      down, and are under their configured per-minute / per-day / token limits
//   2. orders them by priority (then by how much headroom they have left)
//   3. tries them in turn, failing over on rate limits, auth errors, outages,
//      timeouts and unusable output, and puts a failing provider on cooldown
// This module is pure (no Deno or Supabase imports) so it can be tested.

export type Purpose = "interview" | "research";
export type Kind = "openai_compatible" | "anthropic" | "tavily";

export interface Provider {
  id: string;
  label: string;
  kind: Kind;
  base_url: string;
  model: string;
  api_key_enc: string | null;
  purposes: string[];
  web_search: boolean;
  json_mode: boolean;
  priority: number;
  enabled: boolean;
  rpm_limit: number | null;
  rpd_limit: number | null;
  tpd_limit: number | null;
  cooldown_until: string | null;
}
export interface Load { rpm: number; rpd: number; tpd: number }
export type ProviderWithLoad = Provider & { load: Load };

export interface CallEvent {
  provider_id: string;
  provider_label: string;
  user_id: string | null;
  purpose: string;
  status: "ok" | "error" | "rate_limited";
  http_status: number | null;
  tokens_in: number | null;
  tokens_out: number | null;
  latency_ms: number;
  error: string | null;
}

export interface Store {
  listProviders(): Promise<ProviderWithLoad[]>;
  recordCall(e: CallEvent): Promise<void>;
  setCooldown(id: string, until: Date, error: string): Promise<void>;
  markOk(id: string, limits: Record<string, string>): Promise<void>;
}

export interface Deps {
  store: Store;
  getKey(p: Provider): Promise<string>;
  fetch?: typeof fetch;
  now?: () => number;
}

export interface Msg { role: "user" | "assistant"; content: string }

export interface AiRequest {
  purpose: Purpose;
  userId?: string | null;
  system: string;
  messages: Msg[];
  json?: boolean;
  webSearch?: boolean;
  maxTokens?: number;
  timeoutMs?: number;
  maxAttempts?: number;
  /** Parse/validate model text. Throwing counts as unusable output and fails over. */
  validate?: (text: string) => unknown;
}

export interface Source { title: string; url: string }

export interface AiResult {
  value: any;
  text: string;
  providerId: string;
  providerLabel: string;
  sources: Source[];
  grounded: boolean;
}

export class AiUnavailableError extends Error {
  attempts: string[];
  constructor(message: string, attempts: string[]) {
    super(message);
    this.name = "AiUnavailableError";
    this.attempts = attempts;
  }
}

class ProviderError extends Error {
  status: number | null;
  retryAfterSec: number | null;
  constructor(message: string, status: number | null, retryAfterSec: number | null = null) {
    super(message);
    this.status = status;
    this.retryAfterSec = retryAfterSec;
  }
}

// ------------------------------------------------------------- selection
export function utilisation(p: ProviderWithLoad): number {
  const ratios = [
    p.rpm_limit ? p.load.rpm / p.rpm_limit : 0,
    p.rpd_limit ? p.load.rpd / p.rpd_limit : 0,
    p.tpd_limit ? p.load.tpd / p.tpd_limit : 0,
  ];
  return Math.max(...ratios);
}

export function underLimits(p: ProviderWithLoad): boolean {
  return (
    (p.rpm_limit == null || p.load.rpm < p.rpm_limit) &&
    (p.rpd_limit == null || p.load.rpd < p.rpd_limit) &&
    (p.tpd_limit == null || p.load.tpd < p.tpd_limit)
  );
}

export function pickCandidates(
  all: ProviderWithLoad[],
  purpose: Purpose,
  webSearch: boolean,
  nowMs: number,
): ProviderWithLoad[] {
  return all
    .filter((p) =>
      p.enabled &&
      p.kind !== "tavily" && // pure search, not a chat/completions provider
      p.purposes.includes(purpose) &&
      (!p.cooldown_until || Date.parse(p.cooldown_until) <= nowMs) &&
      underLimits(p)
    )
    .sort((a, b) => {
      if (webSearch && a.web_search !== b.web_search) return a.web_search ? -1 : 1;
      if (a.priority !== b.priority) return a.priority - b.priority;
      const ua = utilisation(a);
      const ub = utilisation(b);
      if (ua !== ub) return ua - ub;
      return a.label.localeCompare(b.label);
    });
}

// Picks the best enabled Tavily provider for a purpose, same ordering rules
// (priority, then headroom) as pickCandidates, but for the tavily kind only.
export function pickTavily(all: ProviderWithLoad[], purpose: Purpose, nowMs: number): ProviderWithLoad | null {
  const candidates = all
    .filter((p) =>
      p.enabled &&
      p.kind === "tavily" &&
      p.purposes.includes(purpose) &&
      (!p.cooldown_until || Date.parse(p.cooldown_until) <= nowMs) &&
      underLimits(p)
    )
    .sort((a, b) => (a.priority !== b.priority ? a.priority - b.priority : utilisation(a) - utilisation(b)));
  return candidates[0] ?? null;
}

export interface TavilyResult { title: string; url: string; content: string }
export interface TavilyOutcome { results: TavilyResult[]; answer: string }

// Direct call to Tavily's search API. Not routed through callProvider/runAi:
// Tavily returns ranked results, not a chat completion, so it's a different
// shape entirely. Callers should treat a failure here as non-fatal and fall
// back to an ungrounded request.
export async function tavilySearch(
  apiKey: string,
  query: string,
  fetchFn: typeof fetch,
  opts: { maxResults?: number; timeoutMs?: number } = {},
): Promise<TavilyOutcome> {
  const signal = AbortSignal.timeout(opts.timeoutMs ?? 20_000);
  const res = await fetchFn("https://api.tavily.com/search", {
    method: "POST",
    signal,
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      query,
      search_depth: "basic",
      max_results: opts.maxResults ?? 5,
      include_answer: true,
    }),
  });
  if (!res.ok) await failFromResponse(res);
  const data = await res.json();
  const results: TavilyResult[] = (Array.isArray(data?.results) ? data.results : [])
    .map((r: any) => ({ title: String(r?.title ?? ""), url: String(r?.url ?? ""), content: String(r?.content ?? "") }))
    .filter((r: TavilyResult) => r.url);
  return { results, answer: String(data?.answer ?? "") };
}

// --------------------------------------------------------------- parsing
export function parseJsonLoose(text: string): any {
  const stripped = String(text).replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, "").trim();
  try {
    return JSON.parse(stripped);
  } catch {
    const a = stripped.indexOf("{");
    const b = stripped.lastIndexOf("}");
    if (a >= 0 && b > a) return JSON.parse(stripped.slice(a, b + 1));
    throw new Error("no JSON object in model output");
  }
}

// -------------------------------------------------------------- adapters
interface RawResult {
  text: string;
  tokensIn: number | null;
  tokensOut: number | null;
  limits: Record<string, string>;
  sources: Source[];
  searched: boolean;
}

function rateLimitHeaders(res: Response): Record<string, string> {
  const out: Record<string, string> = {};
  res.headers.forEach((value, name) => {
    if (name.toLowerCase().includes("ratelimit")) out[name.toLowerCase()] = value;
  });
  return out;
}

async function failFromResponse(res: Response): Promise<never> {
  let detail = "";
  try {
    const body = await res.json();
    const e = body?.error ?? body;
    detail = String(e?.type ?? e?.code ?? e?.message ?? "").replace(/\s+/g, " ").slice(0, 120);
  } catch { /* body wasn't JSON */ }
  const retry = Number(res.headers.get("retry-after"));
  throw new ProviderError(
    `HTTP ${res.status}${detail ? `: ${detail}` : ""}`,
    res.status,
    Number.isFinite(retry) && retry > 0 ? retry : null,
  );
}

// Anthropic wants alternating roles starting with "user".
export function normaliseForAnthropic(messages: Msg[]): Msg[] {
  const merged: Msg[] = [];
  for (const m of messages) {
    const last = merged[merged.length - 1];
    if (last && last.role === m.role) last.content += "\n\n" + m.content;
    else merged.push({ role: m.role, content: m.content });
  }
  if (!merged.length || merged[0].role !== "user") {
    merged.unshift({ role: "user", content: "Begin." });
  }
  return merged;
}

export async function callProvider(
  p: Provider,
  apiKey: string,
  req: Pick<AiRequest, "system" | "messages" | "json" | "webSearch" | "maxTokens" | "timeoutMs">,
  fetchFn: typeof fetch,
): Promise<RawResult> {
  if (p.kind === "tavily") {
    // Tavily is a search API, not a chat/completions endpoint. It's called
    // directly via tavilySearch() from research/index.ts and from the admin
    // "test" action, never routed through here.
    throw new Error("tavily providers don't support chat completions");
  }

  const base = p.base_url.replace(/\/+$/, "");
  const signal = AbortSignal.timeout(req.timeoutMs ?? 30_000);

  if (p.kind === "anthropic") {
    const useSearch = !!(req.webSearch && p.web_search);
    const res = await fetchFn(`${base}/v1/messages`, {
      method: "POST",
      signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: p.model,
        max_tokens: req.maxTokens ?? 2048,
        system: req.system,
        messages: normaliseForAnthropic(req.messages),
        ...(useSearch ? { tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }] } : {}),
      }),
    });
    if (!res.ok) await failFromResponse(res);
    const data = await res.json();
    const blocks: any[] = Array.isArray(data?.content) ? data.content : [];
    const text = blocks.filter((b) => b?.type === "text").map((b) => String(b.text ?? "")).join("");
    const sources: Source[] = [];
    for (const b of blocks) {
      if (b?.type === "web_search_tool_result" && Array.isArray(b.content)) {
        for (const r of b.content) if (r?.url) sources.push({ title: String(r.title ?? ""), url: String(r.url) });
      }
      if (b?.type === "text" && Array.isArray(b.citations)) {
        for (const c of b.citations) if (c?.url) sources.push({ title: String(c.title ?? ""), url: String(c.url) });
      }
    }
    return {
      text,
      tokensIn: data?.usage?.input_tokens ?? null,
      tokensOut: data?.usage?.output_tokens ?? null,
      limits: rateLimitHeaders(res),
      sources,
      searched: useSearch,
    };
  }

  // OpenAI-compatible chat completions (OpenAI, Groq, Gemini, OpenRouter, ...).
  // Sampling parameters are omitted on purpose: some newer models reject them.
  const res = await fetchFn(`${base}/chat/completions`, {
    method: "POST",
    signal,
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: p.model,
      messages: [{ role: "system", content: req.system }, ...req.messages],
      ...(req.json && p.json_mode ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) await failFromResponse(res);
  const data = await res.json();
  return {
    text: String(data?.choices?.[0]?.message?.content ?? ""),
    tokensIn: data?.usage?.prompt_tokens ?? null,
    tokensOut: data?.usage?.completion_tokens ?? null,
    limits: rateLimitHeaders(res),
    sources: [],
    searched: false,
  };
}

// ---------------------------------------------------------------- router
function classify(e: unknown): { status: CallEvent["status"]; http: number | null; message: string; cooldownSec: number } {
  if (e instanceof ProviderError) {
    if (e.status === 429) {
      return { status: "rate_limited", http: 429, message: e.message, cooldownSec: Math.min(e.retryAfterSec ?? 60, 3600) };
    }
    if (e.status === 401 || e.status === 403) {
      return { status: "error", http: e.status, message: `${e.message} (check the API key)`, cooldownSec: 900 };
    }
    if (e.status !== null && e.status >= 400 && e.status < 500) {
      return { status: "error", http: e.status, message: `${e.message} (check model and base URL)`, cooldownSec: 300 };
    }
    return { status: "error", http: e.status, message: e.message, cooldownSec: 30 };
  }
  const err = e as Error;
  if (err?.name === "TimeoutError" || err?.name === "AbortError") {
    return { status: "error", http: null, message: "timeout", cooldownSec: 30 };
  }
  if (err?.message === "no_key") {
    return { status: "error", http: null, message: "no API key saved", cooldownSec: 900 };
  }
  return { status: "error", http: null, message: String(err?.message ?? "network error").slice(0, 120), cooldownSec: 30 };
}

export async function runAi(req: AiRequest, deps: Deps): Promise<AiResult> {
  const fetchFn = deps.fetch ?? fetch;
  const now = deps.now ?? Date.now;

  const all = await deps.store.listProviders();
  const candidates = pickCandidates(all, req.purpose, !!req.webSearch, now()).slice(0, req.maxAttempts ?? 3);
  if (candidates.length === 0) throw new AiUnavailableError("no_provider_available", []);

  const attempts: string[] = [];

  for (const p of candidates) {
    const started = now();
    const event = (over: Partial<CallEvent>): CallEvent => ({
      provider_id: p.id,
      provider_label: p.label,
      user_id: req.userId ?? null,
      purpose: req.purpose,
      status: "ok",
      http_status: null,
      tokens_in: null,
      tokens_out: null,
      latency_ms: now() - started,
      error: null,
      ...over,
    });

    let raw: RawResult;
    try {
      const key = await deps.getKey(p);
      raw = await callProvider(p, key, req, fetchFn);
    } catch (e) {
      const c = classify(e);
      attempts.push(`${p.label}: ${c.message}`);
      await deps.store.recordCall(event({ status: c.status, http_status: c.http, error: c.message }));
      await deps.store.setCooldown(p.id, new Date(now() + c.cooldownSec * 1000), c.message);
      continue;
    }

    let value: unknown = raw.text;
    if (req.validate) {
      try {
        value = req.validate(raw.text);
      } catch (e) {
        const msg = `unusable output (${String((e as Error)?.message ?? "invalid").slice(0, 60)})`;
        attempts.push(`${p.label}: ${msg}`);
        await deps.store.recordCall(event({ status: "error", http_status: 200, tokens_in: raw.tokensIn, tokens_out: raw.tokensOut, error: msg }));
        await deps.store.setCooldown(p.id, new Date(now() + 30_000), msg);
        continue;
      }
    }

    await deps.store.recordCall(event({ tokens_in: raw.tokensIn, tokens_out: raw.tokensOut }));
    await deps.store.markOk(p.id, raw.limits);
    return {
      value,
      text: raw.text,
      providerId: p.id,
      providerLabel: p.label,
      sources: raw.sources,
      grounded: raw.searched && raw.sources.length > 0,
    };
  }

  throw new AiUnavailableError("all_providers_failed", attempts);
}