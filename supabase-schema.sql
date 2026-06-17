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
