-- org_research is written only by the research Edge Function (service role).
-- The earlier migration revoked privileges from anon/authenticated and granted
-- a narrow subset back, but never granted INSERT/UPDATE to service_role.
-- Result: Groq calls succeeded (ai_provider_calls) while saving the brief
-- failed with "permission denied for table org_research".

grant select, insert, update, delete on table public.org_research to service_role;
grant select, insert, update, delete on table public.research_usage to service_role;
grant select, insert on table public.ai_usage to service_role;
