-- ─────────────────────────────────────────────────────────────
-- KotoIQ GMB Images — geo-tagged image tracking
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kotoiq_gmb_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  source text NOT NULL, -- 'upload' | 'generated'
  prompt text,          -- original prompt if AI-generated
  enhanced_prompt text, -- Claude-enhanced prompt
  caption text,
  alt_text text,
  keywords jsonb DEFAULT '[]',

  -- Geo-tag data
  gps_lat numeric(10,7),
  gps_lng numeric(10,7),
  address text,
  city text,
  state text,
  country text,
  metadata jsonb DEFAULT '{}',

  -- Storage
  storage_path text,
  public_url text,

  -- GBP upload state
  gbp_media_id text,
  gbp_category text,
  gbp_uploaded_at timestamptz,
  gbp_error text,

  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gmb_images_client ON kotoiq_gmb_images(client_id);
CREATE INDEX IF NOT EXISTS idx_gmb_images_created ON kotoiq_gmb_images(created_at DESC);

-- NOTE: Also create the 'gmb-images' storage bucket in Supabase dashboard → Storage → New bucket
-- Settings: name='gmb-images', Public access=ON, File size limit=10MB, allowed MIME types: image/jpeg,image/png,image/webp
