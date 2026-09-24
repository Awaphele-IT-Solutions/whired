// Organisation research. One saved brief per user per organisation.
//  - Existing brief and no refresh requested: returned as-is, no credit used.
//  - New research or a refresh: uses one credit from the plan's monthly quota
//    (reserved atomically in the database, released if the AI call fails).
// Users can't write research rows directly, so the quota can't be bypassed.

import { AiUnavailableError, parseJsonLoose, runAi } from "../_shared/ai.ts";
import { makeGetKey, makeStore } from "../_shared/ai_store.ts";
import { authenticate, checkDailyCap, clean, cors, reply, serviceClient } from "../_shared/http.ts";
import { normalizeOrg } from "../_shared/org.ts";
import { cleanResearch, cleanSources, researchSystemPrompt, researchUserPrompt } from "../_shared/research_logic.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "method_not_allowed" }, 405);

  const auth = await authenticate(req);
  if (!auth) return reply({ error: "unauthorized" }, 401);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return reply({ error: "bad_request" }, 400);
  }

  const orgName = clean(body?.org_name, 80);
  const roleFocus = clean(body?.role_focus, 80);
  const refresh = body?.refresh === true;
  const orgKey = normalizeOrg(orgName);
  if (orgName.length < 2 || !orgKey) return reply({ error: "bad_org_name" }, 400);

  const admin = serviceClient();
  const userId = auth.user.id;

  const { data: existing } = await admin
    .from("org_research")
    .select("*")
    .eq("user_id", userId)
    .eq("org_key", orgKey)
    .maybeSingle();

  if (existing && !refresh) return reply({ research: existing, reused: true });

  const cap = await checkDailyCap(auth.client);
  if (!cap.ok) return reply(cap.body, cap.status);

  const { data: reservation, error: reserveError } = await admin.rpc("reserve_research", {
    p_user: userId,
    p_org_key: orgKey,
    p_kind: existing ? "refresh" : "new",
  });
  if (reserveError || !reservation) return reply({ error: "server_error" }, 500);
  if (!reservation.ok) {
    return reply(
      { error: "research_limit", limit: reservation.limit, used: reservation.used, plan_id: reservation.plan_id, resets_at: reservation.resets_at },
      402,
    );
  }
  const release = () => admin.from("research_usage").delete().eq("id", reservation.id);

  try {
    const result = await runAi(
      {
        purpose: "research",
        userId,
        system: researchSystemPrompt(),
        messages: [{ role: "user", content: researchUserPrompt(orgName, roleFocus) }],
        json: true,
        webSearch: true,
        maxTokens: 3000,
        timeoutMs: 60_000,
        maxAttempts: 2,
        validate: (text) => cleanResearch(parseJsonLoose(text)),
      },
      { store: makeStore(admin), getKey: makeGetKey() },
    );

    const { data: saved, error: saveError } = await admin
      .from("org_research")
      .upsert(
        {
          user_id: userId,
          org_key: orgKey,
          org_name: orgName,
          role_focus: roleFocus || null,
          content: result.value,
          sources: cleanSources(result.sources),
          grounded: result.grounded,
          research_count: (existing?.research_count ?? 0) + 1,
          researched_at: new Date().toISOString(),
        },
        { onConflict: "user_id,org_key" },
      )
      .select("*")
      .single();
    if (saveError || !saved) {
      await release();
      return reply({ error: "server_error" }, 500);
    }

    await admin.from("research_usage").update({ status: "done" }).eq("id", reservation.id);
    await admin.from("ai_usage").insert({ user_id: userId, kind: "research" });
    return reply({ research: saved, reused: false, quota: { limit: reservation.limit, used: reservation.used } });
  } catch (err) {
    await release();
    if (err instanceof AiUnavailableError) {
      console.error("AI unavailable:", err.message, err.attempts.join(" | "));
      return reply({ error: "ai_unavailable" }, 503);
    }
    console.error(err);
    return reply({ error: "server_error" }, 500);
  }
});
