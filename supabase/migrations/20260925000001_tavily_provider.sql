-- Adds Tavily as a provider "kind". Tavily is a pure search API (not a
-- chat/completions endpoint), so it's routed separately from the LLM
-- providers, but reuses the same ai_providers table, key encryption and
-- admin UI as everything else.

do $$
declare
  con text;
begin
  select conname into con
    from pg_constraint
   where conrelid = 'public.ai_providers'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%kind%openai_compatible%';
  if con is not null then
    execute format('alter table public.ai_providers drop constraint %I', con);
  end if;
end $$;

alter table public.ai_providers
  add constraint ai_providers_kind_check
  check (kind in ('openai_compatible', 'anthropic', 'tavily'));
