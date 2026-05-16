-- ============================================================
-- KotoIQ — YouTube Intel (Phase F)
--
-- Tracks competitor YouTube channels and their recent uploads.
-- Uses the free YouTube Data API v3 (10K quota/day).
-- ============================================================

CREATE TABLE IF NOT EXISTS kotoiq_competitor_youtube_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  brand_name text NOT NULL,
  channel_id text NOT NULL,            -- YouTube channel ID (UC...)
  channel_handle text,                 -- @ChannelName
  channel_title text,
  channel_description text,
  thumbnail_url text,
  custom_url text,
  uploads_playlist_id text,
  country text,
  subscriber_count bigint,
  view_count bigint,
  video_count int,
  last_synced_at timestamptz,
  added_at timestamptz DEFAULT now(),
  UNIQUE (client_id, channel_id)
);
CREATE INDEX IF NOT EXISTS idx_yt_channels_client_brand
  ON kotoiq_competitor_youtube_channels(client_id, brand_name);

CREATE TABLE IF NOT EXISTS kotoiq_competitor_youtube_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  channel_id text NOT NULL,
  video_id text NOT NULL,
  title text,
  description text,
  thumbnail_url text,
  published_at timestamptz,
  duration_seconds int,
  view_count bigint,
  like_count bigint,
  comment_count bigint,
  is_short boolean DEFAULT false,
  fetched_at timestamptz DEFAULT now(),
  UNIQUE (client_id, video_id)
);
CREATE INDEX IF NOT EXISTS idx_yt_videos_client_pub
  ON kotoiq_competitor_youtube_videos(client_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_yt_videos_channel_pub
  ON kotoiq_competitor_youtube_videos(channel_id, published_at DESC);

ALTER TABLE kotoiq_competitor_youtube_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE kotoiq_competitor_youtube_videos ENABLE ROW LEVEL SECURITY;
