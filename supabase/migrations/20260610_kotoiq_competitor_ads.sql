-- ============================================================
-- KotoIQ — Competitor Ad Creative Library (Phase E)
--
-- Persists ad creatives discovered via Meta Ads Library API
-- (free, official) and Google Ads Transparency (public scrape).
-- One row per ad. Used by Competitor Ads tab + unified timeline.
-- ============================================================

CREATE TABLE IF NOT EXISTS kotoiq_competitor_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  source text NOT NULL,            -- 'meta' | 'google'
  external_ad_id text,             -- Meta archive ID, Google ad ID
  brand_name text NOT NULL,        -- the brand we searched for
  page_name text,                  -- Facebook page name (Meta) / advertiser (Google)
  page_id text,                    -- FB page ID / Google advertiser ID
  platforms text[],                -- ['facebook','instagram'] | ['search','display']
  creative_snapshot_url text,      -- link to the rendered ad screenshot
  creative_image_url text,         -- direct image URL when available
  headline text,
  body_text text,
  cta_text text,
  link_url text,
  spend_range text,                -- e.g. "$100-$499"
  impressions_range text,
  currency text,
  delivery_start timestamptz,
  delivery_stop timestamptz,
  is_active boolean DEFAULT true,
  regions jsonb,                   -- [{region, percentage}]
  demographics jsonb,              -- [{age, gender, percentage}]
  raw jsonb,                       -- full API response for debugging
  detected_at timestamptz DEFAULT now(),
  UNIQUE (source, external_ad_id)
);

CREATE INDEX IF NOT EXISTS idx_competitor_ads_client_brand
  ON kotoiq_competitor_ads(client_id, brand_name);
CREATE INDEX IF NOT EXISTS idx_competitor_ads_active
  ON kotoiq_competitor_ads(client_id, is_active, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_competitor_ads_source_brand
  ON kotoiq_competitor_ads(source, brand_name);

ALTER TABLE kotoiq_competitor_ads ENABLE ROW LEVEL SECURITY;
