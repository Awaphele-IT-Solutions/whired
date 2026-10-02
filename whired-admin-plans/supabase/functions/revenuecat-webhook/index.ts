// RevenueCat webhook: keeps public.subscriptions in step with the stores.
// Deploy with --no-verify-jwt (RevenueCat doesn't send a Supabase JWT); the
// shared secret below is the authentication.
//   supabase secrets set REVENUECAT_WEBHOOK_SECRET=<long random string>
// In RevenueCat: Integrations > Webhooks > URL = this function's URL,
// Authorization header value = Bearer <same secret>.
// Optional: REVENUECAT_ENTITLEMENT (default "pro"), REVENUECAT_PLAN_ID (default "pro").

import { interpretEvent, timingSafeEqual } from "../_shared/billing.ts";
import { reply, serviceClient } from "../_shared/http.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return reply({ error: "method_not_allowed" }, 405, {});

  const secret = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");
  if (!secret) return reply({ error: "not_configured" }, 500, {});
  if (!timingSafeEqual(req.headers.get("Authorization") ?? "", `Bearer ${secret}`)) {
    return reply({ error: "unauthorized" }, 401, {});
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return reply({ error: "bad_request" }, 400, {});
  }

  // Each paid plan can name its RevenueCat entitlement in the admin console.
  // Highest-sort plan wins if a user holds several. The env vars remain a fallback.
  const admin = serviceClient();
  const { data: mapped } = await admin
    .from("plans")
    .select("id, rc_entitlement")
    .not("rc_entitlement", "is", null)
    .order("sort", { ascending: false });
  const candidates = (mapped ?? []).map((p: any) => ({ entitlement: p.rc_entitlement as string, planId: p.id as string }));
  if (!candidates.length) {
    candidates.push({
      entitlement: Deno.env.get("REVENUECAT_ENTITLEMENT") ?? "pro",
      planId: Deno.env.get("REVENUECAT_PLAN_ID") ?? "pro",
    });
  }
  let update = null;
  for (const c of candidates) {
    update = interpretEvent(payload?.event, c.entitlement, c.planId);
    if (update) break;
  }
  // Events we don't act on still get a 200 so RevenueCat doesn't keep retrying.
  if (!update) return reply({ ok: true, ignored: true }, 200, {});

  const { data: current } = await admin
    .from("subscriptions")
    .select("last_event_at")
    .eq("user_id", update.userId)
    .maybeSingle();

  // Webhooks can arrive out of order: ignore anything older than what we've applied.
  if (current?.last_event_at && Date.parse(current.last_event_at) > Date.parse(update.eventAt)) {
    return reply({ ok: true, stale: true }, 200, {});
  }

  const { error } = await admin.from("subscriptions").upsert({
    user_id: update.userId,
    plan_id: update.planId,
    status: update.status,
    source: "revenuecat",
    period_end: update.periodEnd,
    auto_renew: update.autoRenew,
    provider_ref: update.ref,
    last_event_at: update.eventAt,
  });
  if (error) {
    console.error("subscription upsert failed", error.message);
    return reply({ error: "server_error" }, 500, {});
  }
  return reply({ ok: true }, 200, {});
});
