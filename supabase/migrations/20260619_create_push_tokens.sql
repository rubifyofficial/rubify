create extension if not exists pgcrypto;

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  expo_push_token text not null unique,
  platform text,
  updated_at timestamptz not null default now()
);

create index if not exists push_tokens_user_id_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'push_tokens'
      and policyname = 'push_tokens_select_own'
  ) then
    create policy push_tokens_select_own
      on public.push_tokens
      for select
      to authenticated
      using (user_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'push_tokens'
      and policyname = 'push_tokens_insert_own'
  ) then
    create policy push_tokens_insert_own
      on public.push_tokens
      for insert
      to authenticated
      with check (user_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'push_tokens'
      and policyname = 'push_tokens_update_own'
  ) then
    create policy push_tokens_update_own
      on public.push_tokens
      for update
      to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'push_tokens'
      and policyname = 'push_tokens_delete_own'
  ) then
    create policy push_tokens_delete_own
      on public.push_tokens
      for delete
      to authenticated
      using (user_id = auth.uid());
  end if;
end $$;
