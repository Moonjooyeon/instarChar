create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_provider') then
    create type user_provider as enum ('google', 'apple');
  end if;
end
$$;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email varchar(320) not null,
  provider user_provider not null,
  provider_subject varchar(255) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_users_provider_subject unique(provider, provider_subject)
);

create table if not exists profiles (
  user_id uuid primary key references users(id) on delete cascade,
  display_name varchar(120) not null default '',
  onboarded boolean not null default false,
  app_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists characters (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users(id) on delete cascade,
  source_account_id varchar(120) not null,
  name varchar(120) not null default '',
  handle varchar(120) not null default '',
  character jsonb not null default '{}'::jsonb,
  gallery jsonb not null default '[]'::jsonb,
  posts jsonb not null default '[]'::jsonb,
  following jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_characters_owner_source unique(owner_id, source_account_id)
);

create table if not exists personas (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users(id) on delete cascade,
  persona_id varchar(120) not null,
  name varchar(120) not null default '',
  persona jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_personas_owner_persona unique(owner_id, persona_id)
);

create table if not exists shared_characters (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users(id) on delete cascade,
  owner_name varchar(120) not null default '',
  source_account_id varchar(120) not null,
  name varchar(120) not null,
  handle varchar(120) not null default '',
  persona text not null default '',
  tags text[] not null default array[]::text[],
  character jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_shared_characters_owner_source unique(owner_id, source_account_id)
);

create table if not exists character_follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references users(id) on delete cascade,
  follower_name varchar(120) not null default '',
  follower_account_id varchar(120) not null,
  follower_character jsonb not null default '{}'::jsonb,
  target_shared_character_id uuid not null references shared_characters(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint uq_character_follows unique(follower_id, follower_account_id, target_shared_character_id)
);

create table if not exists dm_threads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users(id) on delete cascade,
  thread_key varchar(500) not null,
  messages jsonb not null default '[]'::jsonb,
  world_pref jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_dm_threads_owner_key unique(owner_id, thread_key)
);

create table if not exists shared_dm_threads (
  id uuid primary key default gen_random_uuid(),
  thread_key varchar(500) not null unique,
  participant_user_ids uuid[] not null default array[]::uuid[],
  participant_labels text[] not null default array[]::text[],
  messages jsonb not null default '[]'::jsonb,
  world_pref jsonb not null default '{}'::jsonb,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists characters_owner_idx on characters(owner_id);
create index if not exists shared_characters_created_at_idx on shared_characters(created_at desc);
create index if not exists character_follows_target_idx on character_follows(target_shared_character_id);
create index if not exists shared_dm_threads_participants_idx on shared_dm_threads using gin(participant_user_ids);
