create extension if not exists pgcrypto;

create table if not exists public.couple_calls (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null,
  caller_id uuid not null,
  recipient_id uuid not null,
  stream_call_id text not null unique,
  call_type text not null check (call_type in ('audio', 'video')),
  status text not null default 'ringing' check (status in ('ringing', 'accepted', 'rejected', 'cancelled', 'ended')),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists couple_calls_recipient_status_idx on public.couple_calls (recipient_id, status);
create index if not exists couple_calls_caller_status_idx on public.couple_calls (caller_id, status);
create index if not exists couple_calls_couple_id_idx on public.couple_calls (couple_id);
create index if not exists couple_calls_created_at_idx on public.couple_calls (created_at desc);

alter table public.couple_calls enable row level security;
alter table public.couple_calls replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'couple_calls'
      and policyname = 'couple_calls_select_own'
  ) then
    create policy couple_calls_select_own
      on public.couple_calls
      for select
      to authenticated
      using (caller_id = auth.uid() or recipient_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'couple_calls'
      and policyname = 'couple_calls_insert_caller'
  ) then
    create policy couple_calls_insert_caller
      on public.couple_calls
      for insert
      to authenticated
      with check (
        caller_id = auth.uid()
        and caller_id <> recipient_id
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'couple_calls'
      and policyname = 'couple_calls_update_participants'
  ) then
    create policy couple_calls_update_participants
      on public.couple_calls
      for update
      to authenticated
      using (caller_id = auth.uid() or recipient_id = auth.uid())
      with check (caller_id = auth.uid() or recipient_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'couple_calls'
  ) then
    alter publication supabase_realtime add table public.couple_calls;
  end if;
end $$;
