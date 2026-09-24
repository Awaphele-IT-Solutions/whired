// Capacity maths and health warnings for the admin console. Pure, so it is tested.

export interface ProviderView {
  id: string;
  label: string;
  kind: string;
  enabled: boolean;
  purposes: string[];
  web_search: boolean;
  priority: number;
  rpm_limit: number | null;
  rpd_limit: number | null;
  tpd_limit: number | null;
  has_key: boolean;
  cooldown_until: string | null;
  last_error: string | null;
  last_error_at: string | null;
  last_ok_at: string | null;
  last_limits: Record<string, string>;
  load: { rpm: number; rpd: number; tpd: number; ok_today: number; errors_1h: number };
}

export interface Warning { level: "critical" | "warn" | "info"; text: string }

export type ProviderStatus = "off" | "no_key" | "cooldown" | "limit" | "ok";

export function providerStatus(p: ProviderView, nowMs: number): ProviderStatus {
  if (!p.enabled) return "off";
  if (!p.has_key) return "no_key";
  if (p.cooldown_until && Date.parse(p.cooldown_until) > nowMs) return "cooldown";
  if (
    (p.rpm_limit != null && p.load.rpm >= p.rpm_limit) ||
    (p.rpd_limit != null && p.load.rpd >= p.rpd_limit) ||
    (p.tpd_limit != null && p.load.tpd >= p.tpd_limit)
  ) return "limit";
  return "ok";
}

// Average model calls per active user per day, from recent ai_usage rows.
export function averageCallsPerActiveUser(rows: { user_id: string; created_at: string }[], fallback = 12): number {
  if (!rows.length) return fallback;
  const userDays = new Set(rows.map((r) => `${r.user_id}|${r.created_at.slice(0, 10)}`));
  return Math.max(1, Math.round((rows.length / userDays.size) * 10) / 10);
}

export interface Capacity {
  /** Sum of daily request limits across enabled, keyed providers that have one. */
  rpd_capacity: number | null;
  rpd_used: number;
  headroom_pct: number | null;
  avg_calls_per_active_user: number;
  /** Rough number of active users per day the configured capacity can carry. */
  est_daily_users: number | null;
  /** Enabled providers with no daily limit set, so capacity can't be tracked for them. */
  untracked: string[];
}

export function computeCapacity(providers: ProviderView[], avgCalls: number): Capacity {
  const live = providers.filter((p) => p.enabled && p.has_key);
  const tracked = live.filter((p) => p.rpd_limit != null);
  const capacity = tracked.reduce((n, p) => n + (p.rpd_limit as number), 0);
  const used = tracked.reduce((n, p) => n + p.load.rpd, 0);
  return {
    rpd_capacity: tracked.length ? capacity : null,
    rpd_used: used,
    headroom_pct: tracked.length && capacity > 0 ? Math.max(0, Math.round((1 - used / capacity) * 100)) : null,
    avg_calls_per_active_user: avgCalls,
    est_daily_users: tracked.length && avgCalls > 0 ? Math.floor(capacity / avgCalls) : null,
    untracked: live.filter((p) => p.rpd_limit == null).map((p) => p.label),
  };
}

function remainingRequests(limits: Record<string, string>): number | null {
  for (const [k, v] of Object.entries(limits ?? {})) {
    if (/remaining/.test(k) && /request/.test(k)) {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

export function buildWarnings(
  providers: ProviderView[],
  capacity: Capacity,
  plans: { id: string; daily_ai_calls: number | null }[],
  nowMs: number,
): Warning[] {
  const out: Warning[] = [];
  const usable = (purpose: string) =>
    providers.filter((p) => p.enabled && p.has_key && p.purposes.includes(purpose));

  for (const purpose of ["interview", "research"]) {
    const n = usable(purpose).length;
    if (n === 0) out.push({ level: "critical", text: `No enabled provider with a key serves ${purpose}. ${purpose === "interview" ? "Mock interviews" : "Organisation research"} will fail.` });
    else if (n === 1) out.push({ level: "warn", text: `Only one provider serves ${purpose}, so there is no failover if it goes down.` });
  }
  if (usable("research").length && !usable("research").some((p) => p.web_search)) {
    out.push({ level: "info", text: "No research provider has web search on. Research will be labelled general knowledge, not sourced." });
  }

  for (const p of providers) {
    if (!p.enabled) continue;
    if (!p.has_key) out.push({ level: "critical", text: `${p.label} has no API key saved.` });
    const status = providerStatus(p, nowMs);
    if (status === "cooldown") out.push({ level: "warn", text: `${p.label} is cooling down after an error: ${p.last_error ?? "unknown"}.` });
    if (status === "limit") out.push({ level: "critical", text: `${p.label} has hit a configured limit and is being skipped.` });

    const ratios: [string, number | null, number][] = [
      ["daily requests", p.rpd_limit, p.load.rpd],
      ["requests per minute", p.rpm_limit, p.load.rpm],
      ["daily tokens", p.tpd_limit, p.load.tpd],
    ];
    for (const [name, limit, used] of ratios) {
      if (limit && used / limit >= 0.8 && used < limit) {
        out.push({ level: used / limit >= 0.95 ? "critical" : "warn", text: `${p.label} is at ${Math.round((used / limit) * 100)}% of its ${name} limit.` });
      }
    }
    if (p.load.errors_1h >= 5) out.push({ level: "warn", text: `${p.label} had ${p.load.errors_1h} failed calls in the last hour.` });
    const rem = remainingRequests(p.last_limits);
    if (rem !== null && rem <= 5) out.push({ level: "warn", text: `${p.label} reports only ${rem} requests left in its current window.` });
  }

  if (capacity.untracked.length) {
    out.push({ level: "info", text: `Set a daily request limit on ${capacity.untracked.join(", ")} so capacity can be tracked.` });
  }
  if (capacity.headroom_pct !== null) {
    if (capacity.headroom_pct < 5) out.push({ level: "critical", text: "Less than 5% of today's AI capacity is left. Add a provider or raise limits now." });
    else if (capacity.headroom_pct < 20) out.push({ level: "warn", text: `Only ${capacity.headroom_pct}% of today's AI capacity is left.` });
  }
  for (const pl of plans) {
    if (pl.daily_ai_calls == null) out.push({ level: "info", text: `The ${pl.id} plan has no daily AI cap, so one heavy user could use a lot of capacity.` });
  }

  const rank = { critical: 0, warn: 1, info: 2 };
  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}
