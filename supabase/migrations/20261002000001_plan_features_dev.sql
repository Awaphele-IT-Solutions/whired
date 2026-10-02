-- w/hired migration 5: editable tier features, per-tier RevenueCat mapping,
-- and an unlimited "dev" plan that admins get automatically.
-- Run in the SQL Editor (or `supabase db push`) after the earlier migrations.

alter table public.plans
  add column if not exists features        text[] not null default '{}',
  add column if not exists rc_entitlement  text;

create unique index if not exists plans_rc_entitlement_key
  on public.plans (rc_entitlement) where rc_entitlement is not null;

-- The existing paid tier is wired to RevenueCat's "pro" entitlement.
update public.plans set rc_entitlement = 'pro' where id = 'pro' and rc_entitlement is null;

-- Unlimited, never shown to users (active = false hides it from the Upgrade screen).
insert into public.plans (id, name, description, price_label, research_per_month, daily_ai_calls, sort, active)
values ('dev', 'Dev', 'Unlimited. Applied automatically to admins.', '', null, null, 99, false)
on conflict (id) do nothing;

-- Admins always resolve to the dev plan; everyone else works as before.
create or replace function public.effective_plan(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (select 1 from public.admins where user_id = p_user) then 'dev'
    else coalesce(
      (select s.plan_id
         from public.subscriptions s
        where s.user_id = p_user
          and s.status in ('active', 'cancelled', 'past_due')
          and (s.period_end is null or s.period_end > now())),
      'free'
    )
  end;
$$;
revoke all on function public.effective_plan(uuid) from public, anon, authenticated;
grant execute on function public.effective_plan(uuid) to service_role;
