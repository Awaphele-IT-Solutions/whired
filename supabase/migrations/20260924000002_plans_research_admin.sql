-- w/hired migration 2: plans, subscriptions, saved organisation research,
-- AI provider registry (keys are stored encrypted by the Edge Functions),
-- admin access and audit log.
-- Run after 20260924000001_init.sql (SQL Editor, or `supabase db push`).

-- ------------------------------------------------ sign-up: better name capture
-- Google and Microsoft send full_name / name; Apple may send neither.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name', ''), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ------------------------------------------------------------------ admins
-- Membership is managed only with SQL (see README). No client can write here.
create table public.admins (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ------------------------------------------------------------------- plans
create table public.plans (
  id                  text primary key,
  name                text not null,
  description         text not null default '',
  price_label         text not null default '',
  research_per_month  int check (research_per_month is null or research_per_month >= 0), -- null = unlimited
  daily_ai_calls      int check (daily_ai_calls is null or daily_ai_calls >= 0),         -- null = unlimited
  sort                int not null default 0,
  active              boolean not null default true,
  updated_at          timestamptz not null default now()
);

create trigger plans_set_updated_at
  before update on public.plans
  for each row execute function public.set_updated_at();

-- Starting numbers. Change them any time from the admin console.
insert into public.plans (id, name, description, price_label, research_per_month, daily_ai_calls, sort) values
  ('free', 'Free', 'Unlimited mock interviews with fair use, 10 organisation researches a month.', 'Free', 10, 80, 0),
  ('pro',  'Pro',  'More organisation research, higher daily AI allowance.', '', 50, 300, 1);

alter table public.plans enable row level security;
create policy "plans_read" on public.plans for select to authenticated using (true);

-- ----------------------------------------------------------- subscriptions
-- No row = Free. Written only by the revenuecat-webhook function or the admin console.
create table public.subscriptions (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  plan_id        text not null references public.plans (id),
  status         text not null check (status in ('active', 'cancelled', 'past_due', 'expired')),
  source         text not null check (source in ('revenuecat', 'manual')),
  period_end     timestamptz,
  auto_renew     boolean not null default false,
  provider_ref   text,
  last_event_at  timestamptz,
  updated_at     timestamptz not null default now()
);

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

alter table public.subscriptions enable row level security;
create policy "subscriptions_select_own" on public.subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.effective_plan(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select s.plan_id
       from public.subscriptions s
      where s.user_id = p_user
        and s.status in ('active', 'cancelled', 'past_due')
        and (s.period_end is null or s.period_end > now())),
    'free'
  );
$$;
revoke all on function public.effective_plan(uuid) from public, anon, authenticated;
grant execute on function public.effective_plan(uuid) to service_role;

-- --------------------------------------------------------- research storage
create table public.org_research (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  org_key         text not null,
  org_name        text not null,
  role_focus      text,
  content         jsonb not null default '{}'::jsonb,
  sources         jsonb not null default '[]'::jsonb,
  grounded        boolean not null default false,
  notes           text not null default '' check (char_length(notes) <= 4000),
  research_count  int not null default 1,
  researched_at   timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, org_key)
);

create index org_research_user_updated_idx on public.org_research (user_id, updated_at desc);

create trigger org_research_set_updated_at
  before update on public.org_research
  for each row execute function public.set_updated_at();

alter table public.org_research enable row level security;
create policy "research_select_own" on public.org_research
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "research_update_own" on public.org_research
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "research_delete_own" on public.org_research
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Users can read and delete their research and edit only their notes.
-- New research and refreshes go through the research function so the monthly
-- quota can't be bypassed.
revoke all on public.org_research from anon, authenticated;
grant select, delete on public.org_research to authenticated;
grant update (notes) on public.org_research to authenticated;

-- One row per research run, used for the monthly quota.
create table public.research_usage (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  org_key     text not null,
  kind        text not null check (kind in ('new', 'refresh')),
  status      text not null default 'pending' check (status in ('pending', 'done')),
  created_at  timestamptz not null default now()
);
create index research_usage_user_created_idx on public.research_usage (user_id, created_at desc);

alter table public.research_usage enable row level security;
create policy "research_usage_select_own" on public.research_usage
  for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.research_usage from anon, authenticated;
grant select on public.research_usage to authenticated;

-- Atomically check the monthly quota and reserve one run. Pending rows count
-- for 5 minutes so a crashed request doesn't lock a user out forever.
create or replace function public.reserve_research(p_user uuid, p_org_key text, p_kind text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  pid          text;
  lim          int;
  used         int;
  month_start  timestamptz := date_trunc('month', now() at time zone 'utc') at time zone 'utc';
  rid          uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));

  pid := public.effective_plan(p_user);
  select research_per_month into lim from public.plans where id = pid;

  select count(*) into used
    from public.research_usage r
   where r.user_id = p_user
     and r.created_at >= month_start
     and (r.status = 'done' or (r.status = 'pending' and r.created_at > now() - interval '5 minutes'));

  if lim is not null and used >= lim then
    return jsonb_build_object(
      'ok', false, 'limit', lim, 'used', used, 'plan_id', pid,
      'resets_at', month_start + interval '1 month'
    );
  end if;

  insert into public.research_usage (user_id, org_key, kind)
  values (p_user, p_org_key, p_kind)
  returning id into rid;

  return jsonb_build_object('ok', true, 'id', rid, 'limit', lim, 'used', used + 1, 'plan_id', pid);
end;
$$;
revoke all on function public.reserve_research(uuid, text, text) from public, anon, authenticated;
grant execute on function public.reserve_research(uuid, text, text) to service_role;

-- What the app shows: plan, research quota, daily AI allowance.
create or replace function public.my_entitlements()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid          uuid := (select auth.uid());
  pid          text;
  pl           record;
  sub          record;
  used         int;
  daily_used   int;
  month_start  timestamptz := date_trunc('month', now() at time zone 'utc') at time zone 'utc';
  day_start    timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
begin
  if uid is null then
    return null;
  end if;

  pid := public.effective_plan(uid);
  select * into pl from public.plans where id = pid;

  select count(*) into used
    from public.research_usage r
   where r.user_id = uid
     and r.created_at >= month_start
     and (r.status = 'done' or (r.status = 'pending' and r.created_at > now() - interval '5 minutes'));

  select count(*) into daily_used
    from public.ai_usage a
   where a.user_id = uid and a.created_at >= day_start;

  select * into sub from public.subscriptions where user_id = uid;

  return jsonb_build_object(
    'plan_id', pl.id,
    'plan_name', pl.name,
    'research_limit', pl.research_per_month,
    'research_used', used,
    'research_resets_at', month_start + interval '1 month',
    'daily_ai_limit', pl.daily_ai_calls,
    'daily_ai_used', daily_used,
    'period_end', sub.period_end,
    'auto_renew', coalesce(sub.auto_renew, false)
  );
end;
$$;
revoke all on function public.my_entitlements() from public, anon;
grant execute on function public.my_entitlements() to authenticated;

-- ai_usage is now written by the Edge Functions only.
drop policy if exists "usage_insert_own" on public.ai_usage;
revoke insert on public.ai_usage from authenticated;

-- ------------------------------------------------------------- AI providers
-- Registry managed from the admin console. api_key_enc is AES-256-GCM
-- ciphertext produced by the admin function; the master key lives in an Edge
-- Function secret, never in the database.
create table public.ai_providers (
  id              uuid primary key default gen_random_uuid(),
  label           text not null,
  kind            text not null check (kind in ('openai_compatible', 'anthropic')),
  base_url        text not null,
  model           text not null,
  api_key_enc     text,
  key_last4       text,
  purposes        text[] not null default '{interview,research}',
  web_search      boolean not null default false,
  json_mode       boolean not null default true,
  priority        int not null default 100,
  enabled         boolean not null default true,
  rpm_limit       int check (rpm_limit is null or rpm_limit > 0),
  rpd_limit       int check (rpd_limit is null or rpd_limit > 0),
  tpd_limit       bigint check (tpd_limit is null or tpd_limit > 0),
  cooldown_until  timestamptz,
  last_error      text,
  last_error_at   timestamptz,
  last_ok_at      timestamptz,
  last_limits     jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger ai_providers_set_updated_at
  before update on public.ai_providers
  for each row execute function public.set_updated_at();

-- One row per attempt against a provider (including failures).
create table public.ai_provider_calls (
  id              bigint generated always as identity primary key,
  provider_id     uuid references public.ai_providers (id) on delete set null,
  provider_label  text,
  user_id         uuid references auth.users (id) on delete set null,
  purpose         text not null,
  status          text not null check (status in ('ok', 'error', 'rate_limited')),
  http_status     int,
  tokens_in       int,
  tokens_out      int,
  latency_ms      int,
  error           text,
  created_at      timestamptz not null default now()
);
create index ai_provider_calls_provider_idx on public.ai_provider_calls (provider_id, created_at desc);
create index ai_provider_calls_created_idx on public.ai_provider_calls (created_at desc);

create table public.admin_audit (
  id          bigint generated always as identity primary key,
  admin_id    uuid references auth.users (id) on delete set null,
  action      text not null,
  target      text,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

alter table public.ai_providers      enable row level security;
alter table public.ai_provider_calls enable row level security;
alter table public.admin_audit       enable row level security;
-- No policies on purpose: only the service role (Edge Functions) can touch these.
revoke all on public.admins, public.ai_providers, public.ai_provider_calls, public.admin_audit
  from anon, authenticated;

-- Current load per provider, used by the router and the admin console.
create or replace function public.provider_load()
returns table (provider_id uuid, rpm int, rpd int, tpd bigint, ok_today int, errors_1h int)
language sql
stable
security definer
set search_path = ''
as $$
  with bounds as (
    select date_trunc('day', now() at time zone 'utc') at time zone 'utc' as today
  )
  select
    p.id,
    (count(c.id) filter (where c.created_at > now() - interval '1 minute'))::int,
    (count(c.id) filter (where c.created_at >= b.today))::int,
    coalesce(sum(coalesce(c.tokens_in, 0) + coalesce(c.tokens_out, 0)) filter (where c.created_at >= b.today), 0)::bigint,
    (count(c.id) filter (where c.status = 'ok' and c.created_at >= b.today))::int,
    (count(c.id) filter (where c.status <> 'ok' and c.created_at > now() - interval '1 hour'))::int
  from public.ai_providers p
  cross join bounds b
  left join public.ai_provider_calls c
    on c.provider_id = p.id and c.created_at >= now() - interval '2 days'
  group by p.id, b.today;
$$;
revoke all on function public.provider_load() from public, anon, authenticated;
grant execute on function public.provider_load() to service_role;

-- Admin user lookup (email is in auth.users, which PostgREST doesn't expose).
create or replace function public.admin_find_user(p_email text)
returns table (id uuid, email text, created_at timestamptz, last_sign_in_at timestamptz, provider text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.email::text, u.created_at, u.last_sign_in_at, (u.raw_app_meta_data ->> 'provider')
    from auth.users u
   where lower(u.email) = lower(p_email)
   limit 1;
$$;
revoke all on function public.admin_find_user(text) from public, anon, authenticated;
grant execute on function public.admin_find_user(text) to service_role;

-- Housekeeping: keep 90 days of provider call logs. Schedule with pg_cron
-- (Database > Extensions > pg_cron), for example daily:
--   select cron.schedule('purge-ai-calls', '15 3 * * *', $$select public.purge_old_ai_calls()$$);
create or replace function public.purge_old_ai_calls()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.ai_provider_calls where created_at < now() - interval '90 days';
$$;
revoke all on function public.purge_old_ai_calls() from public, anon, authenticated;
grant execute on function public.purge_old_ai_calls() to service_role;

-- ------------------------------------------------------------ explicit grants
revoke all on public.plans, public.subscriptions from anon, authenticated;
grant select on public.plans to authenticated;
grant select on public.subscriptions to authenticated;
