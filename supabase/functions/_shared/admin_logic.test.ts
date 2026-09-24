import test from "node:test";
import assert from "node:assert/strict";
import { averageCallsPerActiveUser, buildWarnings, computeCapacity, providerStatus } from "./admin_logic.ts";
import type { ProviderView } from "./admin_logic.ts";

const NOW = Date.parse("2026-09-24T10:00:00Z");
const P = (o: Partial<ProviderView> = {}): ProviderView => ({
  id: "a", label: "A", kind: "openai_compatible", enabled: true, purposes: ["interview", "research"],
  web_search: false, priority: 1, rpm_limit: null, rpd_limit: null, tpd_limit: null, has_key: true,
  cooldown_until: null, last_error: null, last_error_at: null, last_ok_at: null, last_limits: {},
  load: { rpm: 0, rpd: 0, tpd: 0, ok_today: 0, errors_1h: 0 }, ...o,
});

test("providerStatus", () => {
  assert.equal(providerStatus(P({ enabled: false }), NOW), "off");
  assert.equal(providerStatus(P({ has_key: false }), NOW), "no_key");
  assert.equal(providerStatus(P({ cooldown_until: new Date(NOW + 1000).toISOString() }), NOW), "cooldown");
  assert.equal(providerStatus(P({ rpd_limit: 10, load: { rpm: 0, rpd: 10, tpd: 0, ok_today: 0, errors_1h: 0 } }), NOW), "limit");
  assert.equal(providerStatus(P(), NOW), "ok");
});

test("capacity sums daily limits of enabled keyed providers and estimates users", () => {
  const cap = computeCapacity([
    P({ id: "a", rpd_limit: 1000, load: { rpm: 0, rpd: 250, tpd: 0, ok_today: 0, errors_1h: 0 } }),
    P({ id: "b", label: "B", rpd_limit: 500 }),
    P({ id: "c", label: "C", enabled: false, rpd_limit: 9999 }),
    P({ id: "d", label: "D" }),
  ], 10);
  assert.equal(cap.rpd_capacity, 1500);
  assert.equal(cap.rpd_used, 250);
  assert.equal(cap.headroom_pct, 83);
  assert.equal(cap.est_daily_users, 150);
  assert.deepEqual(cap.untracked, ["D"]);
  assert.equal(computeCapacity([P()], 10).rpd_capacity, null);
});

test("average calls per active user-day", () => {
  assert.equal(averageCallsPerActiveUser([]), 12);
  const rows = [
    { user_id: "u1", created_at: "2026-09-23T10:00:00Z" }, { user_id: "u1", created_at: "2026-09-23T11:00:00Z" },
    { user_id: "u1", created_at: "2026-09-23T12:00:00Z" }, { user_id: "u2", created_at: "2026-09-23T10:00:00Z" },
  ];
  assert.equal(averageCallsPerActiveUser(rows), 2);
});

test("warnings: missing coverage, single provider, near limit, cooldown, low headroom", () => {
  const providers = [P({
    rpd_limit: 100, load: { rpm: 0, rpd: 92, tpd: 0, ok_today: 0, errors_1h: 6 },
    cooldown_until: new Date(NOW + 5000).toISOString(), last_error: "HTTP 429",
    last_limits: { "x-ratelimit-remaining-requests": "3" },
  })];
  const cap = computeCapacity(providers, 10);
  const w = buildWarnings(providers, cap, [{ id: "free", daily_ai_calls: null }], NOW);
  const text = w.map((x) => x.text).join("\n");
  assert.match(text, /Only one provider serves interview/);
  assert.match(text, /cooling down/);
  assert.match(text, /92% of its daily requests/);
  assert.match(text, /6 failed calls/);
  assert.match(text, /only 3 requests left/);
  assert.match(text, /free plan has no daily AI cap/);
  assert.match(text, /general knowledge/);
  assert.equal(w[0].level, "warn");
  const none = buildWarnings([], computeCapacity([], 10), [], NOW);
  assert.equal(none.filter((x) => x.level === "critical").length, 2);
});
