// Supabase-backed Store and key loader for the AI router (Deno runtime).
import type { ProviderWithLoad, Store } from "./ai.ts";
import { decryptSecret } from "./crypto.ts";

const COLUMNS =
  "id,label,kind,base_url,model,api_key_enc,purposes,web_search,json_mode,priority,enabled,rpm_limit,rpd_limit,tpd_limit,cooldown_until";

export function makeStore(admin: any): Store {
  return {
    async listProviders(): Promise<ProviderWithLoad[]> {
      const [{ data: rows, error }, { data: load }] = await Promise.all([
        admin.from("ai_providers").select(COLUMNS),
        admin.rpc("provider_load"),
      ]);
      if (error) throw new Error("could not read ai_providers");
      const byId = new Map<string, any>((load ?? []).map((l: any) => [l.provider_id, l]));
      return (rows ?? []).map((r: any) => {
        const l = byId.get(r.id);
        return { ...r, load: { rpm: l?.rpm ?? 0, rpd: l?.rpd ?? 0, tpd: Number(l?.tpd ?? 0) } };
      });
    },
    async recordCall(e) {
      await admin.from("ai_provider_calls").insert(e);
    },
    async setCooldown(id, until, error) {
      await admin
        .from("ai_providers")
        .update({ cooldown_until: until.toISOString(), last_error: error, last_error_at: new Date().toISOString() })
        .eq("id", id);
    },
    async markOk(id, limits) {
      await admin
        .from("ai_providers")
        .update({ last_ok_at: new Date().toISOString(), last_limits: limits })
        .eq("id", id);
    },
  };
}

export function makeGetKey() {
  const master = Deno.env.get("KEY_ENCRYPTION_SECRET");
  return async (p: { id: string; api_key_enc: string | null }) => {
    if (!p.api_key_enc) throw new Error("no_key");
    if (!master) throw new Error("KEY_ENCRYPTION_SECRET is not set");
    return decryptSecret(p.api_key_enc, master, p.id);
  };
}
