// Maps RevenueCat webhook events to a subscription row. Pure, so it is tested.
// RevenueCat app_user_id is set to the Supabase user id by the app (Purchases.logIn).

export interface SubUpdate {
  userId: string;
  planId: string;
  status: "active" | "cancelled" | "past_due" | "expired";
  periodEnd: string | null;
  autoRenew: boolean;
  eventAt: string;
  ref: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function interpretEvent(event: any, entitlement = "pro", planId = "pro"): SubUpdate | null {
  if (!event || typeof event !== "object") return null;

  const candidates = [event.app_user_id, ...(Array.isArray(event.aliases) ? event.aliases : [])];
  const userId = candidates.find((v) => typeof v === "string" && UUID.test(v));
  if (!userId) return null;

  const ids: string[] = Array.isArray(event.entitlement_ids)
    ? event.entitlement_ids
    : event.entitlement_id ? [event.entitlement_id] : [];
  if (!ids.includes(entitlement)) return null;

  const expMs = Number(event.expiration_at_ms);
  const periodEnd = Number.isFinite(expMs) && expMs > 0 ? new Date(expMs).toISOString() : null;
  const evMs = Number(event.event_timestamp_ms);
  const eventAt = new Date(Number.isFinite(evMs) && evMs > 0 ? evMs : Date.now()).toISOString();
  const ref = typeof event.product_id === "string" ? event.product_id : null;

  const base = { userId, planId, periodEnd, eventAt, ref };
  switch (event.type) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "PRODUCT_CHANGE":
    case "UNCANCELLATION":
      return { ...base, status: "active", autoRenew: true };
    case "NON_RENEWING_PURCHASE":
      return { ...base, status: "active", autoRenew: false };
    case "CANCELLATION":
    case "SUBSCRIPTION_PAUSED":
      return { ...base, status: "cancelled", autoRenew: false };
    case "BILLING_ISSUE":
      return { ...base, status: "past_due", autoRenew: true };
    case "EXPIRATION":
      return { ...base, status: "expired", autoRenew: false };
    default:
      return null;
  }
}

export function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}
