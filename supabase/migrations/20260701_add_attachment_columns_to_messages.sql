alter table public.messages
add column if not exists message_type text default 'text';

alter table public.messages
add column if not exists media_url text;

alter table public.messages
add column if not exists duration_ms integer;

alter table public.messages
add column if not exists metadata jsonb;

alter table public.messages
add column if not exists file_name text;

alter table public.messages
add column if not exists mime_type text;

alter table public.messages
add column if not exists file_size integer;

update public.messages
set message_type = 'text'
where message_type is null;

notify pgrst, 'reload schema';
