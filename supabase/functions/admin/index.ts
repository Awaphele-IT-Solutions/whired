// Admin console API. Everything here runs with the service role, so access is
// checked three ways before any action: a valid user JWT, membership of
// public.admins, and a completed MFA challenge (aal2). Every change is written
// to admin_audit. API keys are encrypted on the way in and never returned:
// the console only ever sees the last four characters.
// No CORS headers on purpose: only the native app calls this function.

import { averageCallsPerActiveUser, buildWarnings, computeCapacity, providerStatus } from "../_shared/admin_logic.ts";
import type { ProviderView } from "../_shared/admin_logic.ts";
import { callProvider } from "../_shared/ai.ts";
import { makeGetKey } from "../_shared/ai_store.ts";
import { encryptSecret, last4 } from "../_shared/crypto.ts";
import { aalFromJwt, authenticate, clampInt, clean, reply, serviceClient } from "../_shared/http.ts";
import { validateBaseUrl } from "../_shared/url.ts";

const NO_CORS = {};
const send = (body: unknown, status = 200) => reply(body, status, NO_CORS);

const KINDS = ["openai_compatible", "anthropic"];
const PURPOSES = ["interview", "research"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PROVIDER_COLUMNS =
  "id,label,kind,base_url,model,key_last4,api_key_enc,purposes,web_search,json_mode,priority,enabled,rpm_limit,rpd_limit,tpd_limit,cooldown_until,last_error,last_error_at,last_ok_at,last_limits";

const startOfUtcDay = () => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
};
const startOfUtcMonth = () => {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
};

const optionalLimit = (v: unknown, max: number): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n <= 0) throw new Error("Limits must be positive whole numbers or blank.");
  return Math.min(n, max);
};

class BadInput extends Error {}

Deno.serve(async (req) => {
  if (req.method !== "POST") return send({ error: "method_not_allowed" }, 405);

  const auth = await authenticate(req);
  if (!auth) return send({ error: "unauthorized" }, 401);

  const admin = serviceClient();
  const { data: adminRow, error: adminErr } = await admin.from("admins").select("user_id").eq("user_id", auth.user.id).maybeSingle();
  if (adminErr) return send({ error: "admin_lookup_failed", detail: adminErr.message }, 500);
  if (!adminRow) return send({ error: "forbidden" }, 403);
  if (aalFromJwt(req) !== "aal2") return send({ error: "mfa_required" }, 403);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return send({ error: "bad_request" }, 400);
  }

  const audit = (action: string, target: string | null, details: Record<string, unknown> = {}) =>
    admin.from("admin_audit").insert({ admin_id: auth.user.id, action, target, details });

  try {
    switch (body?.action) {
      // ----------------------------------------------------------- overview
      case "overview": {
        const now = Date.now();
        const [{ data: rows }, { data: load }, { data: plans }] = await Promise.all([
          admin.from("ai_providers").select(PROVIDER_COLUMNS).order("priority").order("label"),
          admin.rpc("provider_load"),
          admin.from("plans").select("*").order("sort"),
        ]);
        const loadById = new Map<string, any>((load ?? []).map((l: any) => [l.provider_id, l]));
        const providers: (ProviderView & { base_url: string; model: string; key_last4: string | null; json_mode: boolean; status: string })[] =
          (rows ?? []).map((r: any) => {
            const l = loadById.get(r.id);
            const view = {
              id: r.id, label: r.label, kind: r.kind, base_url: r.base_url, model: r.model,
              key_last4: r.key_last4, json_mode: r.json_mode, enabled: r.enabled, purposes: r.purposes,
              web_search: r.web_search, priority: r.priority, rpm_limit: r.rpm_limit, rpd_limit: r.rpd_limit,
              tpd_limit: r.tpd_limit != null ? Number(r.tpd_limit) : null, has_key: !!r.api_key_enc,
              cooldown_until: r.cooldown_until, last_error: r.last_error, last_error_at: r.last_error_at,
              last_ok_at: r.last_ok_at, last_limits: r.last_limits ?? {},
              load: { rpm: l?.rpm ?? 0, rpd: l?.rpd ?? 0, tpd: Number(l?.tpd ?? 0), ok_today: l?.ok_today ?? 0, errors_1h: l?.errors_1h ?? 0 },
            };
            return { ...view, status: providerStatus(view, now) };
          });

        const weekAgo = new Date(now - 7 * 86_400_000).toISOString();
        const [usersTotal, usersPaid, callsToday, researchMonth, recent] = await Promise.all([
          admin.from("profiles").select("id", { count: "exact", head: true }),
          admin.from("subscriptions").select("user_id", { count: "exact", head: true })
            .in("status", ["active", "cancelled", "past_due"])
            .or(`period_end.is.null,period_end.gt.${new Date(now).toISOString()}`),
          admin.from("ai_usage").select("id", { count: "exact", head: true }).gte("created_at", startOfUtcDay()),
          admin.from("research_usage").select("id", { count: "exact", head: true }).eq("status", "done").gte("created_at", startOfUtcMonth()),
          admin.from("ai_usage").select("user_id,created_at").gte("created_at", weekAgo).limit(20000),
        ]);

        const avg = averageCallsPerActiveUser(recent.data ?? []);
        const capacity = computeCapacity(providers, avg);
        const warnings = buildWarnings(providers, capacity, plans ?? [], now);

        return send({
          providers,
          plans: plans ?? [],
          stats: {
            users_total: usersTotal.count ?? 0,
            users_paid: usersPaid.count ?? 0,
            ai_calls_today: callsToday.count ?? 0,
            research_this_month: researchMonth.count ?? 0,
          },
          capacity,
          warnings,
        });
      }

      // ----------------------------------------------------- provider create/update
      case "provider_save": {
        const p = body.provider ?? {};
        const id: string = p.id ? String(p.id) : crypto.randomUUID();
        if (!UUID.test(id)) throw new BadInput("Invalid provider id.");

        const label = clean(p.label, 40);
        const model = clean(p.model, 100);
        if (!label) throw new BadInput("Give the provider a label.");
        if (!model) throw new BadInput("Enter the model name to use.");
        if (!KINDS.includes(p.kind)) throw new BadInput("Unknown provider type.");
        const url = validateBaseUrl(p.base_url);
        if (!url.ok) throw new BadInput(url.reason);
        const purposes = (Array.isArray(p.purposes) ? p.purposes : []).filter((x: string) => PURPOSES.includes(x));
        if (!purposes.length) throw new BadInput("Pick at least one purpose (interview or research).");

        const record: Record<string, unknown> = {
          id, label, model, kind: p.kind, base_url: url.url, purposes,
          web_search: p.kind === "anthropic" ? !!p.web_search : false,
          json_mode: p.json_mode !== false,
          priority: clampInt(p.priority ?? 100, 1, 1000),
          enabled: p.enabled !== false,
          rpm_limit: optionalLimit(p.rpm_limit, 1_000_000),
          rpd_limit: optionalLimit(p.rpd_limit, 100_000_000),
          tpd_limit: optionalLimit(p.tpd_limit, 1_000_000_000_000),
        };

        const { data: existing } = await admin.from("ai_providers").select("id,base_url,model").eq("id", id).maybeSingle();
        const newKey = typeof p.api_key === "string" ? p.api_key.trim() : "";
        if (!existing && !newKey) throw new BadInput("Enter the API key for a new provider.");

        const master = Deno.env.get("KEY_ENCRYPTION_SECRET");
        if (newKey) {
          if (!master) throw new BadInput("KEY_ENCRYPTION_SECRET is not set on the server.");
          if (newKey.length < 8 || newKey.length > 500) throw new BadInput("That doesn't look like an API key.");
          record.api_key_enc = await encryptSecret(newKey, master, id);
          record.key_last4 = last4(newKey);
        }
        // A changed key, endpoint or model deserves a fresh start.
        if (newKey || (existing && (existing.base_url !== record.base_url || existing.model !== record.model))) {
          record.cooldown_until = null;
          record.last_error = null;
          record.last_error_at = null;
        }

        const { error } = await admin.from("ai_providers").upsert(record);
        if (error) throw new Error(error.message);
        await audit(existing ? "provider_update" : "provider_create", id, {
          label, kind: p.kind, model, base_url: url.url, enabled: record.enabled, purposes, key_rotated: !!newKey,
        });
        return send({ ok: true, id });
      }

      // ------------------------------------------------------------ provider delete
      case "provider_delete": {
        const id = String(body.id ?? "");
        if (!UUID.test(id)) throw new BadInput("Invalid provider id.");
        const { data: all } = await admin.from("ai_providers").select("id,label,enabled,purposes");
        const target = (all ?? []).find((x: any) => x.id === id);
        if (!target) throw new BadInput("Provider not found.");
        const others = (all ?? []).filter((x: any) => x.id !== id && x.enabled);
        for (const purpose of target.enabled ? target.purposes : []) {
          if (!others.some((o: any) => o.purposes.includes(purpose)) && body.force !== true) {
            return send({ error: "last_provider", purpose }, 409);
          }
        }
        const { error } = await admin.from("ai_providers").delete().eq("id", id);
        if (error) throw new Error(error.message);
        await audit("provider_delete", id, { label: target.label, forced: body.force === true });
        return send({ ok: true });
      }

      // ------------------------------------------------------------- provider test
      case "provider_test": {
        const id = String(body.id ?? "");
        if (!UUID.test(id)) throw new BadInput("Invalid provider id.");
        const { data: p } = await admin.from("ai_providers").select("*").eq("id", id).maybeSingle();
        if (!p) throw new BadInput("Provider not found.");

        const started = Date.now();
        try {
          const key = await makeGetKey()(p);
          const out = await callProvider(
            p, key,
            { system: 'Reply with the JSON {"ok":true} and nothing else.', messages: [{ role: "user", content: "ping" }], json: true, maxTokens: 32, timeoutMs: 20_000 },
            fetch,
          );
          const latency = Date.now() - started;
          await admin.from("ai_provider_calls").insert({
            provider_id: p.id, provider_label: p.label, user_id: null, purpose: "test", status: "ok",
            http_status: 200, tokens_in: out.tokensIn, tokens_out: out.tokensOut, latency_ms: latency, error: null,
          });
          await admin.from("ai_providers").update({
            last_ok_at: new Date().toISOString(), last_limits: out.limits, cooldown_until: null, last_error: null,
          }).eq("id", p.id);
          await audit("provider_test", p.id, { label: p.label, ok: true });
          return send({ ok: true, latency_ms: latency, limits: out.limits });
        } catch (e) {
          const message = String((e as Error)?.message ?? "failed").slice(0, 160);
          await admin.from("ai_provider_calls").insert({
            provider_id: p.id, provider_label: p.label, user_id: null, purpose: "test", status: "error",
            http_status: null, tokens_in: null, tokens_out: null, latency_ms: Date.now() - started, error: message,
          });
          await admin.from("ai_providers").update({ last_error: message, last_error_at: new Date().toISOString() }).eq("id", p.id);
          await audit("provider_test", p.id, { label: p.label, ok: false, error: message });
          return send({ ok: false, error: message });
        }
      }

      // --------------------------------------------------------------- plan update
      case "plan_save": {
        const pl = body.plan ?? {};
        const id = clean(pl.id, 20);
        const { data: existing } = await admin.from("plans").select("id").eq("id", id).maybeSingle();
        if (!existing) throw new BadInput("Unknown plan.");
        const limit = (v: unknown) => {
          if (v === null || v === undefined || v === "") return null;
          const n = Math.round(Number(v));
          if (!Number.isFinite(n) || n < 0) throw new BadInput("Limits must be whole numbers, or blank for unlimited.");
          return Math.min(n, 1_000_000);
        };
        const update = {
          name: clean(pl.name, 30) || id,
          description: clean(pl.description, 200),
          price_label: clean(pl.price_label, 30),
          research_per_month: limit(pl.research_per_month),
          daily_ai_calls: limit(pl.daily_ai_calls),
          active: pl.active !== false,
        };
        const { error } = await admin.from("plans").update(update).eq("id", id);
        if (error) throw new Error(error.message);
        await audit("plan_update", id, update);
        return send({ ok: true });
      }

      // ----------------------------------------------------------------- user tools
      case "user_lookup": {
        const email = clean(body.email, 200);
        if (!email.includes("@")) throw new BadInput("Enter the user's full email address.");
        const { data: found } = await admin.rpc("admin_find_user", { p_email: email });
        const u = Array.isArray(found) ? found[0] : found;
        if (!u) return send({ user: null });

        const [{ data: plan }, { data: sub }, research, sessions, stories, callsToday, researchMonth] = await Promise.all([
          admin.rpc("effective_plan", { p_user: u.id }),
          admin.from("subscriptions").select("plan_id,status,source,period_end,auto_renew").eq("user_id", u.id).maybeSingle(),
          admin.from("org_research").select("id", { count: "exact", head: true }).eq("user_id", u.id),
          admin.from("interview_sessions").select("id", { count: "exact", head: true }).eq("user_id", u.id),
          admin.from("star_stories").select("id", { count: "exact", head: true }).eq("user_id", u.id),
          admin.from("ai_usage").select("id", { count: "exact", head: true }).eq("user_id", u.id).gte("created_at", startOfUtcDay()),
          admin.from("research_usage").select("id", { count: "exact", head: true }).eq("user_id", u.id).eq("status", "done").gte("created_at", startOfUtcMonth()),
        ]);
        await audit("user_lookup", u.id, {});
        // Counts only: the console never shows a user's answers, stories or notes.
        return send({
          user: {
            id: u.id, email: u.email, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at, provider: u.provider,
            plan, subscription: sub ?? null,
            usage: {
              researches_saved: research.count ?? 0, sessions: sessions.count ?? 0, stories: stories.count ?? 0,
              ai_calls_today: callsToday.count ?? 0, research_this_month: researchMonth.count ?? 0,
            },
          },
        });
      }

      case "user_grant": {
        const userId = String(body.user_id ?? "");
        if (!UUID.test(userId)) throw new BadInput("Invalid user id.");
        const planId = clean(body.plan_id, 20);
        const days = clampInt(body.days, 1, 3650);
        const { data: plan } = await admin.from("plans").select("id").eq("id", planId).maybeSingle();
        if (!plan || planId === "free") throw new BadInput("Pick a paid plan to grant.");
        const { data: current } = await admin.from("subscriptions").select("source,status,period_end").eq("user_id", userId).maybeSingle();
        if (current?.source === "revenuecat" && ["active", "cancelled", "past_due"].includes(current.status) && current.period_end && Date.parse(current.period_end) > Date.now()) {
          throw new BadInput("This user has a live store subscription. Grant access after it ends.");
        }
        const periodEnd = new Date(Date.now() + days * 86_400_000).toISOString();
        const { error } = await admin.from("subscriptions").upsert({
          user_id: userId, plan_id: planId, status: "active", source: "manual", period_end: periodEnd, auto_renew: false, provider_ref: null, last_event_at: null,
        });
        if (error) throw new Error(error.message);
        await audit("user_grant", userId, { plan_id: planId, days });
        return send({ ok: true, period_end: periodEnd });
      }

      case "user_revoke": {
        const userId = String(body.user_id ?? "");
        if (!UUID.test(userId)) throw new BadInput("Invalid user id.");
        const { data: current } = await admin.from("subscriptions").select("source").eq("user_id", userId).maybeSingle();
        if (!current) throw new BadInput("This user has no subscription record.");
        if (current.source !== "manual") throw new BadInput("Store subscriptions end through the App Store or Google Play. Only manual grants can be revoked here.");
        const { error } = await admin.from("subscriptions").update({ status: "expired", period_end: new Date().toISOString() }).eq("user_id", userId);
        if (error) throw new Error(error.message);
        await audit("user_revoke", userId, {});
        return send({ ok: true });
      }

      // ---------------------------------------------------------------------- audit
      case "audit": {
        const { data } = await admin
          .from("admin_audit").select("id,admin_id,action,target,details,created_at")
          .order("created_at", { ascending: false }).limit(clampInt(body.limit ?? 40, 1, 100));
        return send({ entries: data ?? [] });
      }

      default:
        return send({ error: "unknown_action" }, 400);
    }
  } catch (e) {
    if (e instanceof BadInput) return send({ error: "invalid", message: e.message }, 400);
    console.error("admin error:", (e as Error)?.message);
    return send({ error: "server_error" }, 500);
  }
});