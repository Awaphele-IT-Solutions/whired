import test from "node:test";
import assert from "node:assert/strict";
import { AiUnavailableError, callProvider, normaliseForAnthropic, parseJsonLoose, pickCandidates, runAi } from "./ai.ts";
import type { CallEvent, ProviderWithLoad, Store } from "./ai.ts";

const NOW = Date.parse("2026-09-24T10:00:00Z");

function prov(over: Partial<ProviderWithLoad> = {}): ProviderWithLoad {
  return {
    id: over.id ?? "p1", label: over.label ?? "P1", kind: "openai_compatible",
    base_url: "https://api.example.com/v1", model: "m", api_key_enc: "x",
    purposes: ["interview", "research"], web_search: false, json_mode: true,
    priority: 100, enabled: true, rpm_limit: null, rpd_limit: null, tpd_limit: null,
    cooldown_until: null, load: { rpm: 0, rpd: 0, tpd: 0 }, ...over,
  };
}

function memStore(providers: ProviderWithLoad[]) {
  const calls: CallEvent[] = [];
  const cooldowns: Record<string, { until: Date; error: string }> = {};
  const ok: Record<string, Record<string, string>> = {};
  const store: Store = {
    listProviders: async () => providers,
    recordCall: async (e) => { calls.push(e); },
    setCooldown: async (id, until, error) => { cooldowns[id] = { until, error }; },
    markOk: async (id, limits) => { ok[id] = limits; },
  };
  return { store, calls, cooldowns, ok };
}

const chatOk = (content: string, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }), { status: 200, headers });

const req = { purpose: "interview" as const, system: "s", messages: [{ role: "user" as const, content: "hi" }], json: true };

test("orders by priority and skips disabled, wrong-purpose, cooling and over-limit providers", () => {
  const list = [
    prov({ id: "a", label: "A", priority: 20 }),
    prov({ id: "b", label: "B", priority: 10, enabled: false }),
    prov({ id: "c", label: "C", priority: 5, purposes: ["research"] }),
    prov({ id: "d", label: "D", priority: 6, cooldown_until: new Date(NOW + 60_000).toISOString() }),
    prov({ id: "e", label: "E", priority: 7, rpm_limit: 10, load: { rpm: 10, rpd: 0, tpd: 0 } }),
    prov({ id: "f", label: "F", priority: 8, tpd_limit: 1000, load: { rpm: 0, rpd: 0, tpd: 1000 } }),
    prov({ id: "g", label: "G", priority: 30, cooldown_until: new Date(NOW - 1000).toISOString() }),
  ];
  assert.deepEqual(pickCandidates(list, "interview", false, NOW).map((p) => p.id), ["a", "g"]);
});

test("same priority prefers the provider with more headroom", () => {
  const list = [
    prov({ id: "busy", label: "Busy", rpd_limit: 100, load: { rpm: 0, rpd: 90, tpd: 0 } }),
    prov({ id: "idle", label: "Idle", rpd_limit: 100, load: { rpm: 0, rpd: 10, tpd: 0 } }),
  ];
  assert.deepEqual(pickCandidates(list, "interview", false, NOW).map((p) => p.id), ["idle", "busy"]);
});

test("web-search requests rank search-capable providers first", () => {
  const list = [prov({ id: "plain", priority: 1 }), prov({ id: "search", priority: 50, web_search: true })];
  assert.deepEqual(pickCandidates(list, "research", true, NOW).map((p) => p.id), ["search", "plain"]);
  assert.deepEqual(pickCandidates(list, "research", false, NOW).map((p) => p.id), ["plain", "search"]);
});

test("succeeds on the first provider and records tokens and rate-limit headers", async () => {
  const m = memStore([prov({ id: "a" })]);
  const out = await runAi({ ...req, validate: parseJsonLoose }, {
    store: m.store, getKey: async () => "k", now: () => NOW,
    fetch: async () => chatOk('{"a":1}', { "x-ratelimit-remaining-requests": "42", "content-type": "application/json" }),
  });
  assert.deepEqual(out.value, { a: 1 });
  assert.equal(m.calls[0].status, "ok");
  assert.equal(m.calls[0].tokens_in, 10);
  assert.equal(m.ok["a"]["x-ratelimit-remaining-requests"], "42");
});

test("429 fails over, puts the provider on cooldown and honours Retry-After", async () => {
  const m = memStore([prov({ id: "a", label: "A", priority: 1 }), prov({ id: "b", label: "B", priority: 2 })]);
  let n = 0;
  const out = await runAi(req, {
    store: m.store, getKey: async () => "k", now: () => NOW,
    fetch: async () => (n++ === 0
      ? new Response("{}", { status: 429, headers: { "retry-after": "120" } })
      : chatOk("hello")),
  });
  assert.equal(out.providerId, "b");
  assert.equal(m.calls[0].status, "rate_limited");
  assert.equal(m.cooldowns["a"].until.getTime(), NOW + 120_000);
});

test("401 fails over with a key hint; 500 and timeouts cool down briefly", async () => {
  const m = memStore([
    prov({ id: "a", label: "A", priority: 1 }),
    prov({ id: "b", label: "B", priority: 2 }),
    prov({ id: "c", label: "C", priority: 3 }),
  ]);
  const seq = [
    () => new Response(JSON.stringify({ error: { message: "bad key" } }), { status: 401 }),
    () => { const e = new Error("t"); e.name = "TimeoutError"; throw e; },
    () => chatOk("fine"),
  ];
  let i = 0;
  const out = await runAi(req, { store: m.store, getKey: async () => "k", now: () => NOW, fetch: async () => seq[i++]() });
  assert.equal(out.providerId, "c");
  assert.match(m.cooldowns["a"].error, /check the API key/);
  assert.equal(m.cooldowns["a"].until.getTime(), NOW + 900_000);
  assert.equal(m.cooldowns["b"].until.getTime(), NOW + 30_000);
});

test("unusable output fails over to the next provider", async () => {
  const m = memStore([prov({ id: "a", priority: 1 }), prov({ id: "b", priority: 2 })]);
  let n = 0;
  const out = await runAi({ ...req, validate: parseJsonLoose }, {
    store: m.store, getKey: async () => "k", now: () => NOW,
    fetch: async () => chatOk(n++ === 0 ? "not json at all" : '{"ok":true}'),
  });
  assert.equal(out.providerId, "b");
  assert.match(m.calls[0].error ?? "", /unusable output/);
});

test("missing key is treated as a provider failure, not a crash", async () => {
  const m = memStore([prov({ id: "a", priority: 1 }), prov({ id: "b", priority: 2 })]);
  const out = await runAi(req, {
    store: m.store, now: () => NOW, fetch: async () => chatOk("ok"),
    getKey: async (p) => { if (p.id === "a") throw new Error("no_key"); return "k"; },
  });
  assert.equal(out.providerId, "b");
  assert.equal(m.cooldowns["a"].error, "no API key saved");
});

test("throws AiUnavailableError when nothing is usable or everything fails", async () => {
  await assert.rejects(
    runAi(req, { store: memStore([prov({ enabled: false })]).store, getKey: async () => "k", now: () => NOW }),
    (e: any) => e instanceof AiUnavailableError && e.message === "no_provider_available",
  );
  const m = memStore([prov({ id: "a", priority: 1 }), prov({ id: "b", priority: 2 })]);
  await assert.rejects(
    runAi(req, { store: m.store, getKey: async () => "k", now: () => NOW, fetch: async () => new Response("{}", { status: 503 }) }),
    (e: any) => e instanceof AiUnavailableError && e.attempts.length === 2,
  );
});

test("anthropic adapter: headers, role normalisation, web search tool, sources", async () => {
  let seen: any;
  const p = prov({ kind: "anthropic", base_url: "https://api.anthropic.com", web_search: true, model: "claude-x" });
  const fetchFn = async (url: any, init: any) => {
    seen = { url: String(url), init, body: JSON.parse(init.body) };
    return new Response(JSON.stringify({
      content: [
        { type: "server_tool_use", name: "web_search" },
        { type: "web_search_tool_result", content: [{ type: "web_search_result", url: "https://acme.com/about", title: "About" }] },
        { type: "text", text: '{"overview":"x"}', citations: [{ url: "https://news.example/a", title: "News" }] },
      ],
      usage: { input_tokens: 7, output_tokens: 3 },
    }), { status: 200, headers: { "anthropic-ratelimit-requests-remaining": "9" } });
  };
  const out = await callProvider(p, "sk-test", {
    system: "sys", webSearch: true,
    messages: [{ role: "assistant", content: "Q1" }, { role: "user", content: "A1" }, { role: "user", content: "go" }],
  }, fetchFn as any);
  assert.equal(seen.url, "https://api.anthropic.com/v1/messages");
  assert.equal(seen.init.headers["x-api-key"], "sk-test");
  assert.equal(seen.body.tools[0].type, "web_search_20250305");
  assert.deepEqual(seen.body.messages.map((m: any) => m.role), ["user", "assistant", "user"]);
  assert.equal(seen.body.messages[2].content, "A1\n\ngo");
  assert.equal(out.text, '{"overview":"x"}');
  assert.deepEqual(out.sources.map((s) => s.url), ["https://acme.com/about", "https://news.example/a"]);
  assert.equal(out.limits["anthropic-ratelimit-requests-remaining"], "9");
  assert.equal(out.searched, true);
  assert.equal(out.tokensIn, 7);
});

test("openai-compatible adapter: bearer auth, json mode, no sampling params", async () => {
  let body: any; let headers: any; let url = "";
  const p = prov({ base_url: "https://api.groq.com/openai/v1/" });
  await callProvider(p, "gk", { system: "s", messages: [{ role: "user", content: "u" }], json: true }, (async (u: any, init: any) => {
    url = String(u); headers = init.headers; body = JSON.parse(init.body); return chatOk("{}");
  }) as any);
  assert.equal(url, "https://api.groq.com/openai/v1/chat/completions");
  assert.equal(headers.authorization, "Bearer gk");
  assert.deepEqual(body.response_format, { type: "json_object" });
  assert.equal(body.temperature, undefined);
  assert.equal(body.messages[0].role, "system");
  await callProvider({ ...p, json_mode: false }, "gk", { system: "s", messages: [], json: true }, (async (_u: any, init: any) => {
    body = JSON.parse(init.body); return chatOk("{}");
  }) as any);
  assert.equal(body.response_format, undefined);
});

test("normaliseForAnthropic starts with user and merges consecutive roles", () => {
  assert.deepEqual(normaliseForAnthropic([{ role: "assistant", content: "a" }]).map((m) => m.role), ["user", "assistant"]);
  assert.equal(normaliseForAnthropic([{ role: "user", content: "a" }, { role: "user", content: "b" }]).length, 1);
});

test("parseJsonLoose handles fences and surrounding prose", () => {
  assert.deepEqual(parseJsonLoose('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(parseJsonLoose('Here you go: {"a":2} hope that helps'), { a: 2 });
  assert.throws(() => parseJsonLoose("nope"));
});
