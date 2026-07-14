create table if not exists public.chat_settings (
  couple_id uuid primary key,
  theme_key text default 'default',
  appearance_mode text default 'light',
  translation_enabled boolean default false,
  translation_target text default 'es',
  notifications_muted boolean default false,
  mute_until timestamptz,
  chat_nickname text,
  auto_save_media boolean default false,
  confirm_before_delete boolean default true,
  disappearing_enabled boolean default false,
  disappearing_timer_seconds integer,
  lock_enabled boolean default false,
  wallpaper_key text default 'default',
  custom_theme jsonb,
  bubble_color text,
  partner_bubble_color text,
  chat_background_color text,
  chat_wallpaper_type text default 'color',
  chat_wallpaper_value text,
  text_color text,
  accent_color text,
  sound_enabled boolean default true,
  updated_by uuid,
  updated_at timestamptz default now()
);

alter table public.chat_settings
add column if not exists appearance_mode text default 'light',
add column if not exists mute_until timestamptz,
add column if not exists chat_nickname text,
add column if not exists auto_save_media boolean default false,
add column if not exists confirm_before_delete boolean default true,
add column if not exists disappearing_enabled boolean default false,
add column if not exists disappearing_timer_seconds integer,
add column if not exists lock_enabled boolean default false,
add column if not exists wallpaper_key text default 'default',
add column if not exists custom_theme jsonb,
add column if not exists bubble_color text,
add column if not exists partner_bubble_color text,
add column if not exists chat_background_color text,
add column if not exists chat_wallpaper_type text default 'color',
add column if not exists chat_wallpaper_value text,
add column if not exists text_color text,
add column if not exists accent_color text,
add column if not exists sound_enabled boolean default true;

alter table public.messages
add column if not exists is_favorite boolean default false;

notify pgrst, 'reload schema';
