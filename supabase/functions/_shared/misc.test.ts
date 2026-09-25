import test from "node:test";
import assert from "node:assert/strict";
import { decryptSecret, encryptSecret, last4 } from "./crypto.ts";
import { normalizeOrg } from "./org.ts";
import { validateBaseUrl } from "./url.ts";
import { cleanResearch, cleanSources, researchContextBlock } from "./research_logic.ts";
import { interpretEvent, timingSafeEqual } from "./billing.ts";

const MASTER = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));

test("crypto: round trip, random IV, AAD binding, tamper and wrong-key detection", async () => {
  const a = await encryptSecret("sk-secret-1234", MASTER, "row-1");
  const b = await encryptSecret("sk-secret-1234", MASTER, "row-1");
  assert.notEqual(a, b);
  assert.ok(!a.includes("sk-secret"));
  assert.equal(await decryptSecret(a, MASTER, "row-1"), "sk-secret-1234");
  await assert.rejects(decryptSecret(a, MASTER, "row-2"));
  const other = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
  await assert.rejects(decryptSecret(a, other, "row-1"));
  const parts = a.split(".");
  parts[2] = parts[2].slice(0, -4) + (parts[2].endsWith("AAAA") ? "BBBB" : "AAAA");
  await assert.rejects(decryptSecret(parts.join("."), MASTER, "row-1"));
  await assert.rejects(encryptSecret("x", btoa("short"), "r"));
  assert.equal(last4("sk-secret-1234"), "1234");
});

test("normalizeOrg: casing, punctuation, suffixes, accents, non-latin", () => {
  assert.equal(normalizeOrg("Stripe, Inc."), "stripe");
  assert.equal(normalizeOrg("  STRIPE "), "stripe");
  assert.equal(normalizeOrg("McDonald's"), normalizeOrg("McDonalds"));
  assert.equal(normalizeOrg("Procter & Gamble"), "procter and gamble");
  assert.equal(normalizeOrg("Nestlé S.A."), "nestle");
  assert.equal(normalizeOrg("Standard Bank Group"), "standard bank");
  assert.equal(normalizeOrg("Group"), "group");
  assert.equal(normalizeOrg("腾讯"), "腾讯");
  assert.equal(normalizeOrg(""), "");
});

test("validateBaseUrl blocks non-https, private and metadata hosts", () => {
  assert.equal(validateBaseUrl("https://api.groq.com/openai/v1/").ok, true);
  assert.equal((validateBaseUrl("https://api.groq.com/openai/v1/") as any).url, "https://api.groq.com/openai/v1");
  for (const bad of [
    "http://api.example.com", "https://localhost/v1", "https://127.0.0.1/v1", "https://169.254.169.254/latest",
    "https://[::1]/v1", "https://10.0.0.5", "https://2130706433", "https://user:pw@api.example.com",
    "https://api.example.com:8443", "https://intranet", "https://db.internal", "not a url",
  ]) assert.equal(validateBaseUrl(bad).ok, false, bad);
});

test("cleanResearch trims, caps and requires an overview", () => {
  const c = cleanResearch({
    overview: " Acme  makes \n tools ",
    vision: "Build the default tools",
    values: ["Ownership", ""],
    culture: ["a", "", "b"],
    challenges: ["Margin pressure"],
    strengths: ["Won a big contract"],
    likely_topics: Array(20).fill("t"),
  });
  assert.equal(c.overview, "Acme makes tools");
  assert.equal(c.vision, "Build the default tools");
  assert.deepEqual(c.values, ["Ownership"]);
  assert.deepEqual(c.culture, ["a", "b"]);
  assert.deepEqual(c.challenges, ["Margin pressure"]);
  assert.deepEqual(c.strengths, ["Won a big contract"]);
  assert.equal(c.likely_topics.length, 8);
  assert.throws(() => cleanResearch({ culture: ["x"] }));
});

test("cleanSources dedupes, keeps http(s) only, caps at 8", () => {
  const s = cleanSources([
    { title: "A", url: "https://a.com/x" }, { title: "dup", url: "https://a.com/x" },
    { title: "bad", url: "javascript:alert(1)" }, { title: "", url: "https://b.com" },
    ...Array.from({ length: 12 }, (_, i) => ({ title: "n", url: `https://n${i}.com` })),
  ]);
  assert.equal(s.length, 8);
  assert.equal(s[1].title, "b.com");
  assert.ok(s.every((x) => x.url.startsWith("http")));
});

test("researchContextBlock is empty without data and includes notes when present", () => {
  assert.equal(researchContextBlock(null), "");
  const b = researchContextBlock({
    org_name: "Acme",
    content: { overview: "Makes tools", culture: ["Ownership"], vision: "Default tools", challenges: ["Churn"] },
    notes: "Met their recruiter",
  });
  assert.match(b, /<research>/);
  assert.match(b, /Makes tools/);
  assert.match(b, /Default tools/);
  assert.match(b, /Churn/);
  assert.match(b, /Met their recruiter/);
  assert.match(b, /judge whether this candidate is a fit/);
});

const UID = "11111111-2222-3333-4444-555555555555";
test("interpretEvent maps RevenueCat events", () => {
  const exp = Date.parse("2026-11-01T00:00:00Z");
  const base = { app_user_id: UID, entitlement_ids: ["pro"], expiration_at_ms: exp, event_timestamp_ms: 1000, product_id: "pro_monthly" };
  const active = interpretEvent({ ...base, type: "RENEWAL" })!;
  assert.equal(active.status, "active");
  assert.equal(active.periodEnd, "2026-11-01T00:00:00.000Z");
  assert.equal(active.autoRenew, true);
  assert.equal(interpretEvent({ ...base, type: "CANCELLATION" })!.status, "cancelled");
  assert.equal(interpretEvent({ ...base, type: "CANCELLATION" })!.autoRenew, false);
  assert.equal(interpretEvent({ ...base, type: "BILLING_ISSUE" })!.status, "past_due");
  assert.equal(interpretEvent({ ...base, type: "EXPIRATION" })!.status, "expired");
  assert.equal(interpretEvent({ ...base, type: "TEST" }), null);
  assert.equal(interpretEvent({ ...base, type: "RENEWAL", entitlement_ids: ["other"] }), null);
  assert.equal(interpretEvent({ ...base, type: "RENEWAL", app_user_id: "$RCAnonymousID:abc" }), null);
  assert.equal(interpretEvent({ ...base, type: "RENEWAL", app_user_id: "$RCAnonymousID:abc", aliases: ["$RCAnonymousID:abc", UID] })!.userId, UID);
});

test("timingSafeEqual", () => {
  assert.equal(timingSafeEqual("Bearer abc", "Bearer abc"), true);
  assert.equal(timingSafeEqual("Bearer abc", "Bearer abd"), false);
  assert.equal(timingSafeEqual("a", "ab"), false);
});
