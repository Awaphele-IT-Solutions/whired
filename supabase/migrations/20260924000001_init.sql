-- w/hired: schema for a NEW Supabase project.
-- Run this once in the Supabase dashboard: SQL Editor > New query > paste > Run.

-- ---------------------------------------------------------------- helpers
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- --------------------------------------------------------------- profiles
create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  display_name      text,
  target_role       text,
  target_company    text,
  experience_level  text check (experience_level in ('entry', 'mid', 'senior', 'switch')),
  interview_date    date,
  onboarded         boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create an empty profile whenever someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------ interview_sessions
create table public.interview_sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company         text,
  role            text not null,
  category        text not null,
  level           text,
  question_count  int  not null check (question_count between 1 and 20),
  score           int  not null check (score between 0 and 100),
  stats           jsonb not null default '{}'::jsonb,
  feedback        jsonb not null default '[]'::jsonb,
  transcript      jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now()
);

create index interview_sessions_user_created_idx
  on public.interview_sessions (user_id, created_at desc);

-- ------------------------------------------------------------ star_stories
create table public.star_stories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null,
  situation   text not null default '',
  task        text not null default '',
  action      text not null default '',
  result      text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index star_stories_user_updated_idx
  on public.star_stories (user_id, updated_at desc);

create trigger star_stories_set_updated_at
  before update on public.star_stories
  for each row execute function public.set_updated_at();

-- --------------------------------------------------------------- ai_usage
-- One row per AI call; the interview Edge Function uses it for a daily cap.
create table public.ai_usage (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind        text not null,
  created_at  timestamptz not null default now()
);

create index ai_usage_user_created_idx
  on public.ai_usage (user_id, created_at desc);

-- ------------------------------------------------- row level security
alter table public.profiles            enable row level security;
alter table public.interview_sessions  enable row level security;
alter table public.star_stories        enable row level security;
alter table public.ai_usage            enable row level security;

-- profiles: read and write your own row. (Deleted via account deletion only.)
create policy "profiles_select_own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- interview_sessions: create, read, delete your own. No edits: history is a record.
create policy "sessions_select_own" on public.interview_sessions
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "sessions_insert_own" on public.interview_sessions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "sessions_delete_own" on public.interview_sessions
  for delete to authenticated using ((select auth.uid()) = user_id);

-- star_stories: full control of your own.
create policy "stories_select_own" on public.star_stories
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "stories_insert_own" on public.star_stories
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "stories_update_own" on public.star_stories
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "stories_delete_own" on public.star_stories
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ai_usage: read and log your own calls.
create policy "usage_select_own" on public.ai_usage
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "usage_insert_own" on public.ai_usage
  for insert to authenticated with check ((select auth.uid()) = user_id);

-- ------------------------------------------------------------------ grants
-- Explicit, so the app keeps working even if default grants are tightened.
grant usage on schema public to authenticated;
grant select, insert, update          on public.profiles           to authenticated;
grant select, insert, delete          on public.interview_sessions to authenticated;
grant select, insert, update, delete  on public.star_stories       to authenticated;
grant select, insert                  on public.ai_usage           to authenticated;
