-- ==============================================================================
-- GTA 6 Viral Autopilot & Video Downloader - Supabase SQL Schema (100% Free Tier)
-- Paste and run this script in your Supabase SQL Editor (https://supabase.com/dashboard)
-- ==============================================================================

-- 1. Enable UUID Extension
create extension if not exists "uuid-ossp";

-- 2. YouTube OAuth Persistent Tokens (Channel Auth)
create table if not exists public.user_youtube_tokens (
    id text primary key default 'primary',
    channel_id text,
    channel_title text,
    access_token text not null,
    refresh_token text,
    token_expiry timestamptz,
    updated_at timestamptz default now()
);

-- 2b. Multiple YouTube Channels per User
create table if not exists public.user_youtube_channels (
    id text primary key,
    user_id text not null,
    channel_id text not null,
    channel_title text not null,
    thumbnail_url text,
    access_token text not null,
    refresh_token text,
    token_expiry timestamptz,
    is_default boolean default false,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create index if not exists idx_user_yt_channels_user_id on public.user_youtube_channels(user_id);

-- 3. Viral Video Discovery & Global Deduplication Archive
create table if not exists public.autopilot_sources (
    video_id text primary key,
    title text not null,
    duration integer default 0,
    view_count bigint default 0,
    thumbnail_url text,
    processed_at timestamptz default now()
);

-- Index for instant deduplication lookup
create index if not exists idx_autopilot_sources_video_id on public.autopilot_sources(video_id);

-- 4. 6-Short Daily Batches
create table if not exists public.autopilot_batches (
    id text primary key,
    source_video_id text references public.autopilot_sources(video_id) on delete cascade,
    source_title text not null,
    source_url text not null,
    status text default 'queued' check (status in ('processing', 'queued', 'completed', 'cooldown')),
    created_at timestamptz default now()
);

-- 5. Individual Scheduled Shorts Queue & Virality Performance
create table if not exists public.autopilot_clips (
    id text primary key,
    batch_id text references public.autopilot_batches(id) on delete cascade,
    source_video_id text,
    source_title text,
    clip_index integer not null check (clip_index between 1 and 6),
    start_time float not null,
    end_time float not null,
    duration float not null,
    hook_title text not null,
    hook_style text not null default 'hormozi_bold',
    progress_bar_color text not null default 'yellow',
    layout text not null default 'center_crop',
    background_music text default 'none',
    filename text,
    scheduled_time timestamptz,
    published_at timestamptz,
    status text default 'queued' check (status in ('queued', 'rendering', 'uploading', 'published', 'cleaned', 'failed')),
    youtube_video_id text,
    youtube_url text,
    views_count integer default 0,
    likes_count integer default 0,
    error text,
    created_at timestamptz default now()
);

-- Index for queue scheduler query: find next pending clip
create index if not exists idx_autopilot_clips_status_scheduled on public.autopilot_clips(status, scheduled_time);

-- 6. Custom Audio Library
create table if not exists public.custom_audio_library (
    id uuid default gen_random_uuid() primary key,
    filename text not null,
    storage_path text,
    public_url text,
    duration float,
    created_at timestamptz default now()
);

-- 7. Cross-Device Download History
create table if not exists public.download_history (
    id uuid default gen_random_uuid() primary key,
    platform text not null,
    title text not null,
    thumbnail text,
    creator text,
    format text,
    filesize bigint,
    downloaded_at timestamptz default now()
);

create index if not exists idx_download_history_downloaded_at on public.download_history(downloaded_at desc);

-- ==============================================================================
-- Row Level Security (RLS) & Policies
-- ==============================================================================
alter table public.user_youtube_tokens enable row level security;
alter table public.user_youtube_channels enable row level security;
alter table public.autopilot_sources enable row level security;
alter table public.autopilot_batches enable row level security;
alter table public.autopilot_clips enable row level security;
alter table public.custom_audio_library enable row level security;
alter table public.download_history enable row level security;

-- Open policies for service and anon keys (single tenant / creator app)
create policy "Allow all operations for service and anon on user_youtube_tokens"
    on public.user_youtube_tokens for all using (true) with check (true);

create policy "Allow all operations for service and anon on user_youtube_channels"
    on public.user_youtube_channels for all using (true) with check (true);

create policy "Allow all operations for service and anon on autopilot_sources"
    on public.autopilot_sources for all using (true) with check (true);

create policy "Allow all operations for service and anon on autopilot_batches"
    on public.autopilot_batches for all using (true) with check (true);

create policy "Allow all operations for service and anon on autopilot_clips"
    on public.autopilot_clips for all using (true) with check (true);

create policy "Allow all operations for service and anon on custom_audio_library"
    on public.custom_audio_library for all using (true) with check (true);

create policy "Allow all operations for service and anon on download_history"
    on public.download_history for all using (true) with check (true);

-- Enable Realtime on autopilot_clips so Next.js UI gets instant WebSocket notifications
alter publication supabase_realtime add table public.autopilot_clips;
