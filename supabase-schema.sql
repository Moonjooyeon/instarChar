create table if not exists public.alive_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text not null default '',
  onboarded boolean not null default false,
  app_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.alive_profiles enable row level security;

drop policy if exists "alive_profiles_select_own" on public.alive_profiles;
create policy "alive_profiles_select_own"
on public.alive_profiles for select
using (auth.uid() = id);

drop policy if exists "alive_profiles_insert_own" on public.alive_profiles;
create policy "alive_profiles_insert_own"
on public.alive_profiles for insert
with check (auth.uid() = id);

drop policy if exists "alive_profiles_update_own" on public.alive_profiles;
create policy "alive_profiles_update_own"
on public.alive_profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

create or replace function public.touch_alive_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists alive_profiles_touch_updated_at on public.alive_profiles;
create trigger alive_profiles_touch_updated_at
before update on public.alive_profiles
for each row
execute function public.touch_alive_profiles_updated_at();

create table if not exists public.alive_shared_characters (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  owner_name text not null default '',
  source_account_id text not null,
  name text not null,
  handle text not null default '',
  persona text not null default '',
  tags text[] not null default array[]::text[],
  character jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, source_account_id)
);

alter table public.alive_shared_characters enable row level security;

drop policy if exists "alive_shared_characters_select_public" on public.alive_shared_characters;
create policy "alive_shared_characters_select_public"
on public.alive_shared_characters for select
using (true);

drop policy if exists "alive_shared_characters_insert_own" on public.alive_shared_characters;
create policy "alive_shared_characters_insert_own"
on public.alive_shared_characters for insert
with check (auth.uid() = owner_id);

drop policy if exists "alive_shared_characters_update_own" on public.alive_shared_characters;
create policy "alive_shared_characters_update_own"
on public.alive_shared_characters for update
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "alive_shared_characters_delete_own" on public.alive_shared_characters;
create policy "alive_shared_characters_delete_own"
on public.alive_shared_characters for delete
using (auth.uid() = owner_id);

create index if not exists alive_shared_characters_owner_idx on public.alive_shared_characters(owner_id);
create index if not exists alive_shared_characters_name_idx on public.alive_shared_characters(name);

drop trigger if exists alive_shared_characters_touch_updated_at on public.alive_shared_characters;
create trigger alive_shared_characters_touch_updated_at
before update on public.alive_shared_characters
for each row
execute function public.touch_alive_profiles_updated_at();

create table if not exists public.alive_character_follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references auth.users(id) on delete cascade,
  follower_name text not null default '',
  follower_account_id text not null,
  follower_character jsonb not null default '{}'::jsonb,
  target_shared_character_id uuid not null references public.alive_shared_characters(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(follower_id, follower_account_id, target_shared_character_id)
);

alter table public.alive_character_follows enable row level security;

drop policy if exists "alive_character_follows_select_public" on public.alive_character_follows;
create policy "alive_character_follows_select_public"
on public.alive_character_follows for select
using (true);

drop policy if exists "alive_character_follows_insert_own" on public.alive_character_follows;
create policy "alive_character_follows_insert_own"
on public.alive_character_follows for insert
with check (auth.uid() = follower_id);

drop policy if exists "alive_character_follows_delete_own" on public.alive_character_follows;
create policy "alive_character_follows_delete_own"
on public.alive_character_follows for delete
using (auth.uid() = follower_id);

create index if not exists alive_character_follows_target_idx
on public.alive_character_follows(target_shared_character_id);

create index if not exists alive_character_follows_follower_idx
on public.alive_character_follows(follower_id, follower_account_id);

create table if not exists public.alive_characters (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_account_id text not null,
  name text not null default '',
  handle text not null default '',
  character jsonb not null default '{}'::jsonb,
  gallery jsonb not null default '[]'::jsonb,
  posts jsonb not null default '[]'::jsonb,
  following jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, source_account_id)
);

alter table public.alive_characters enable row level security;

drop policy if exists "alive_characters_select_own" on public.alive_characters;
create policy "alive_characters_select_own"
on public.alive_characters for select
using (auth.uid() = owner_id);

drop policy if exists "alive_characters_insert_own" on public.alive_characters;
create policy "alive_characters_insert_own"
on public.alive_characters for insert
with check (auth.uid() = owner_id);

drop policy if exists "alive_characters_update_own" on public.alive_characters;
create policy "alive_characters_update_own"
on public.alive_characters for update
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "alive_characters_delete_own" on public.alive_characters;
create policy "alive_characters_delete_own"
on public.alive_characters for delete
using (auth.uid() = owner_id);

create index if not exists alive_characters_owner_idx
on public.alive_characters(owner_id);

drop trigger if exists alive_characters_touch_updated_at on public.alive_characters;
create trigger alive_characters_touch_updated_at
before update on public.alive_characters
for each row
execute function public.touch_alive_profiles_updated_at();

create table if not exists public.alive_personas (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  persona_id text not null,
  name text not null default '',
  persona jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, persona_id)
);

alter table public.alive_personas enable row level security;

drop policy if exists "alive_personas_select_own" on public.alive_personas;
create policy "alive_personas_select_own"
on public.alive_personas for select
using (auth.uid() = owner_id);

drop policy if exists "alive_personas_insert_own" on public.alive_personas;
create policy "alive_personas_insert_own"
on public.alive_personas for insert
with check (auth.uid() = owner_id);

drop policy if exists "alive_personas_update_own" on public.alive_personas;
create policy "alive_personas_update_own"
on public.alive_personas for update
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "alive_personas_delete_own" on public.alive_personas;
create policy "alive_personas_delete_own"
on public.alive_personas for delete
using (auth.uid() = owner_id);

create index if not exists alive_personas_owner_idx
on public.alive_personas(owner_id);

drop trigger if exists alive_personas_touch_updated_at on public.alive_personas;
create trigger alive_personas_touch_updated_at
before update on public.alive_personas
for each row
execute function public.touch_alive_profiles_updated_at();

create table if not exists public.alive_dm_threads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  thread_key text not null,
  messages jsonb not null default '[]'::jsonb,
  world_pref jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, thread_key)
);

alter table public.alive_dm_threads enable row level security;

drop policy if exists "alive_dm_threads_select_own" on public.alive_dm_threads;
create policy "alive_dm_threads_select_own"
on public.alive_dm_threads for select
using (auth.uid() = owner_id);

drop policy if exists "alive_dm_threads_insert_own" on public.alive_dm_threads;
create policy "alive_dm_threads_insert_own"
on public.alive_dm_threads for insert
with check (auth.uid() = owner_id);

drop policy if exists "alive_dm_threads_update_own" on public.alive_dm_threads;
create policy "alive_dm_threads_update_own"
on public.alive_dm_threads for update
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "alive_dm_threads_delete_own" on public.alive_dm_threads;
create policy "alive_dm_threads_delete_own"
on public.alive_dm_threads for delete
using (auth.uid() = owner_id);

create index if not exists alive_dm_threads_owner_idx
on public.alive_dm_threads(owner_id);

drop trigger if exists alive_dm_threads_touch_updated_at on public.alive_dm_threads;
create trigger alive_dm_threads_touch_updated_at
before update on public.alive_dm_threads
for each row
execute function public.touch_alive_profiles_updated_at();
