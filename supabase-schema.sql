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
