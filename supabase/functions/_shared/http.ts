// Small helpers shared by the Edge Functions (Deno runtime).
import { createClient } from "npm:@supabase/supabase-js@2";

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export const reply = (body: unknown, status = 200, headers: Record<string, string> = cors) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });

export function serviceClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Validates the caller's JWT and returns a client that acts as that user
// (so row level security applies to anything done through it).
export async function authenticate(req: Request) {
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) return null;
  return { user: data.user, client };
}

// Reads the authenticator assurance level from a JWT that authenticate() has
// already verified ("aal2" means the user completed MFA this session).
export function aalFromJwt(req: Request): string | null {
  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, "="))).aal ?? null;
  } catch {
    return null;
  }
}

export const clean = (value: unknown, max: number) =>
  String(value ?? "").replace(/[\u0000-\u001f]+/g, " ").trim().slice(0, max);

export const clampInt = (value: unknown, min: number, max: number) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : min;
};

// Enforces the plan's daily AI allowance. Fails closed if entitlements can't be read.
export async function checkDailyCap(userClient: any) {
  const { data: ent, error } = await userClient.rpc("my_entitlements");
  if (error || !ent) return { ok: false as const, status: 500, body: { error: "entitlements_unavailable" } };
  if (ent.daily_ai_limit != null && ent.daily_ai_used >= ent.daily_ai_limit) {
    return {
      ok: false as const,
      status: 429,
      body: { error: "daily_limit", plan_id: ent.plan_id, limit: ent.daily_ai_limit },
    };
  }
  return { ok: true as const, ent };
}
