-- KotoIQ Builder — Elementor Template-Clone Publisher + Closed-Loop Attribution
-- Phase 1 foundation: 10 new tables + koto_wp_pages extensions
-- All tables carry agency_id (explicit or transitive) for tenant isolation

-- ═══════════════════════════════════════════════════════════════════════════
-- SCHEMA VERSION PINNING (must exist before kotoiq_templates references it)
-- ═════════════════���═════════════════════════════��═══════════════════════════

CREATE TABLE IF NOT EXISTS kotoiq_elementor_schema_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES koto_wp_sites(id) ON DELETE CASCADE,
  elementor_version text NOT NULL,               -- '4.0.2', '4.0.3', '4.1.0'
  captured_from_post_id int,                     -- sample page used to derive schema
  widget_schema jsonb NOT NULL,                  -- atomic widget → settings shape
  is_pinned boolean DEFAULT false,               -- the version this site is locked to
  drift_status text DEFAULT 'clean',             -- clean | additive | breaking
  drift_details jsonb,                           -- diff details when drift detected
  captured_at timestamptz DEFAULT now(),
  notes text
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_elem_schema_site_ver
  ON kotoiq_elementor_schema_versions (site_id, elementor_version);

-- ═══��═════════════════════════════════════════════════════════���═════════════
-- BUILDER-SCOPED SITE CONFIG
-- ════════════════════════════��═══════════════════════════════���══════════════

CREATE TABLE IF NOT EXISTS kotoiq_builder_sites (
  site_id uuid PRIMARY KEY REFERENCES koto_wp_sites(id) ON DELETE CASCADE,
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  indexnow_key text,                             -- 32-char hex; served from /{key}.txt
  indexnow_key_verified_at timestamptz,
  crux_api_key text,
  default_schema_version_id uuid REFERENCES kotoiq_elementor_schema_versions(id),
  publish_concurrency int DEFAULT 3,             -- max concurrent PUTs to this WP site
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_builder_sites_agency ON kotoiq_builder_sites (agency_id);

-- ═══��═══════════════════════════════════════════════════════════════════════
-- TEMPLATES
-- ═════���════════════════��════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS kotoiq_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  site_id uuid REFERENCES koto_wp_sites(id) ON DELETE CASCADE,
  source_post_id int,                            -- wp_posts.ID on the client site
  source_title text,
  schema_version_id uuid REFERENCES kotoiq_elementor_schema_versions(id),
  elementor_data jsonb NOT NULL,                 -- master JSON for cloning
  elementor_version text,                        -- e.g. '4.0.2'
  page_settings jsonb DEFAULT '{}',              -- _elementor_page_settings
  status text DEFAULT 'draft',                   -- draft | ready | archived
  slot_count int DEFAULT 0,
  token_estimate int DEFAULT 0,
  ingested_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_templates_agency_status
  ON kotoiq_templates (agency_id, client_id, status);

-- ════════���═══════════════════════════════��═════════════════════════���════════
-- TEMPLATE SLOTS
-- ══════════════════════════════════════════════════════════��════════════════

CREATE TABLE IF NOT EXISTS kotoiq_template_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES kotoiq_templates(id) ON DELETE CASCADE,
  json_path text NOT NULL,                       -- stable: "elementId:settings.property"
  slot_kind text NOT NULL,                       -- heading | paragraph | button_text | button_url | image_url | image_alt | link_url | repeater_row
  label text,                                    -- author-provided friendly name
  wildcard_key text,                             -- e.g. '{service}' — maps to shared wildcard pool
  constraints jsonb DEFAULT '{}',                -- {max_chars, tone, banned_phrases, required_entities}
  required boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(template_id, json_path)
);
CREATE INDEX IF NOT EXISTS idx_template_slots_template
  ON kotoiq_template_slots (template_id);

-- ════════════���═════════════════════��════════════════════════════════���═══════
-- CAMPAIGNS
-- ═══════���══════════════════���════════════════════════════════��═══════════════

CREATE TABLE IF NOT EXISTS kotoiq_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  site_id uuid REFERENCES koto_wp_sites(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES kotoiq_templates(id) ON DELETE CASCADE,
  name text NOT NULL,
  cadence text DEFAULT 'drip',                   -- burst | drip | weekly
  cadence_config jsonb DEFAULT '{}',             -- {per_day_cap, start_at, timezone}
  status text DEFAULT 'draft',                   -- draft | scheduled | running | paused | complete | cancelled
  total_variants int DEFAULT 0,
  published_variants int DEFAULT 0,
  failed_variants int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_campaigns_agency_status
  ON kotoiq_campaigns (agency_id, status);

-- ══════════════���════════════��═══════════════════════════════════════════════
-- VARIANTS
-- ═══════���════════════════════��══════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS kotoiq_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES kotoiq_campaigns(id) ON DELETE CASCADE,
  seed_row jsonb NOT NULL,                       -- {city, state, service, phone, ...}
  slot_fills jsonb DEFAULT '{}',                 -- keyed by slot_id
  rendered_elementor_data jsonb,                 -- materialized JSON ready to PUT
  target_slug text,
  target_title text,
  body_hash text,                                -- sha256 of rendered body for dedup
  idempotency_key text,                          -- sha256(agency_id + template_id + seed_row)
  status text DEFAULT 'pending',                 -- pending | generating | ready | publishing | published | failed
  error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_variants_campaign_status
  ON kotoiq_variants (campaign_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_variants_idempotency
  ON kotoiq_variants (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- ��═════════════���═════════════════════════════���══════════════════════════════
-- PUBLISHES
-- ═��═══════════════════════════════════════════════��═════════════════════════

CREATE TABLE IF NOT EXISTS kotoiq_publishes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL REFERENCES kotoiq_variants(id) ON DELETE CASCADE,
  site_id uuid REFERENCES koto_wp_sites(id) ON DELETE CASCADE,
  wp_post_id int,
  url text,
  tracking_number text,                          -- Telnyx per-page number
  workflow_run_id text,                          -- Vercel Workflow run id
  idempotency_key text,                          -- sha256(campaign_id + variant_id + step)
  published_at timestamptz,
  indexnow_submitted_at timestamptz,
  gsc_pinged_at timestamptz,
  first_cwv_read_at timestamptz,
  unpublished_at timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_publishes_site_date
  ON kotoiq_publishes (site_id, published_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_publishes_idempotency
  ON kotoiq_publishes (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- ═��══════════════════════════════════════════════════��══════════════════════
-- CWV READINGS
-- ═════���══════════════════��══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS kotoiq_cwv_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publish_id uuid REFERENCES kotoiq_publishes(id) ON DELETE CASCADE,
  url text NOT NULL,
  source text NOT NULL,                          -- 'crux_origin' | 'crux_url' | 'psi_lab' | 'rum_beacon'
  device text DEFAULT 'mobile',                  -- 'mobile' | 'desktop'
  lcp_p75_ms int,
  cls_p75 numeric(6,4),
  inp_p75_ms int,
  fcp_p75_ms int,
  ttfb_p75_ms int,
  fetched_at timestamptz DEFAULT now(),
  source_url text,                               -- per VerifiedDataSource standard
  raw jsonb                                      -- full API response
);
CREATE INDEX IF NOT EXISTS idx_cwv_publish_date
  ON kotoiq_cwv_readings (publish_id, fetched_at DESC);

-- ════════���════════════════════��══════════════════════════════���══════════════
-- INDEXNOW SUBMISSIONS
-- ═════════════���═════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS kotoiq_indexnow_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publish_id uuid REFERENCES kotoiq_publishes(id) ON DELETE CASCADE,
  engine text NOT NULL,                          -- 'indexnow' | 'google_sitemap_ping'
  url text NOT NULL,
  status_code int,
  response jsonb,
  submitted_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_indexnow_publish
  ON kotoiq_indexnow_submissions (publish_id);

-- ═════��═══════════════════════════════════════════════════��═════════════════
-- CALL ATTRIBUTION
-- ════��══════════════════════════════════════════════���═══════════════════════

CREATE TABLE IF NOT EXISTS kotoiq_call_attribution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publish_id uuid REFERENCES kotoiq_publishes(id) ON DELETE SET NULL,
  variant_id uuid REFERENCES kotoiq_variants(id) ON DELETE SET NULL,
  inbound_call_id uuid NOT NULL,                 -- references koto_inbound_calls(id)
  match_method text,                             -- 'dynamic_number' | 'utm' | 'referrer' | 'heuristic'
  confidence numeric(3,2),                       -- 0.00 - 1.00
  matched_at timestamptz DEFAULT now(),
  UNIQUE(inbound_call_id)
);
CREATE INDEX IF NOT EXISTS idx_call_attr_publish
  ON kotoiq_call_attribution (publish_id);

-- ══��═══════════════════════════════════════════════════���════════════════════
-- EXTENSIONS TO koto_wp_pages (FND-02)
-- ═════════��═════════��════════════════════════════════���══════════════════════

ALTER TABLE koto_wp_pages
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES kotoiq_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES kotoiq_variants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS publish_id uuid REFERENCES kotoiq_publishes(id) ON DELETE SET NULL;

-- ══════════════════════════��════════════════════════════════════════════════
-- RLS POLICIES — defense in depth (service role bypasses, but anon key won't)
-- ═��═══════════════��══════════════════════════════════���══════════════════════

ALTER TABLE kotoiq_builder_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE kotoiq_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE kotoiq_template_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE kotoiq_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE kotoiq_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE kotoiq_publishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE kotoiq_cwv_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE kotoiq_indexnow_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE kotoiq_call_attribution ENABLE ROW LEVEL SECURITY;
ALTER TABLE kotoiq_elementor_schema_versions ENABLE ROW LEVEL SECURITY;

-- Direct agency_id tables: simple policy
CREATE POLICY kotoiq_builder_sites_agency ON kotoiq_builder_sites
  FOR ALL USING (agency_id = (current_setting('app.agency_id', true))::uuid);

CREATE POLICY kotoiq_templates_agency ON kotoiq_templates
  FOR ALL USING (agency_id = (current_setting('app.agency_id', true))::uuid);

CREATE POLICY kotoiq_campaigns_agency ON kotoiq_campaigns
  FOR ALL USING (agency_id = (current_setting('app.agency_id', true))::uuid);

-- Transitive tables: join through parent
CREATE POLICY kotoiq_template_slots_agency ON kotoiq_template_slots
  FOR ALL USING (
    template_id IN (
      SELECT id FROM kotoiq_templates
      WHERE agency_id = (current_setting('app.agency_id', true))::uuid
    )
  );

CREATE POLICY kotoiq_variants_agency ON kotoiq_variants
  FOR ALL USING (
    campaign_id IN (
      SELECT id FROM kotoiq_campaigns
      WHERE agency_id = (current_setting('app.agency_id', true))::uuid
    )
  );

CREATE POLICY kotoiq_publishes_agency ON kotoiq_publishes
  FOR ALL USING (
    site_id IN (
      SELECT id FROM koto_wp_sites
      WHERE agency_id = (current_setting('app.agency_id', true))::uuid
    )
  );

CREATE POLICY kotoiq_cwv_agency ON kotoiq_cwv_readings
  FOR ALL USING (
    publish_id IN (
      SELECT p.id FROM kotoiq_publishes p
      JOIN koto_wp_sites s ON s.id = p.site_id
      WHERE s.agency_id = (current_setting('app.agency_id', true))::uuid
    )
  );

CREATE POLICY kotoiq_indexnow_agency ON kotoiq_indexnow_submissions
  FOR ALL USING (
    publish_id IN (
      SELECT p.id FROM kotoiq_publishes p
      JOIN koto_wp_sites s ON s.id = p.site_id
      WHERE s.agency_id = (current_setting('app.agency_id', true))::uuid
    )
  );

CREATE POLICY kotoiq_call_attr_agency ON kotoiq_call_attribution
  FOR ALL USING (
    variant_id IN (
      SELECT v.id FROM kotoiq_variants v
      JOIN kotoiq_campaigns c ON c.id = v.campaign_id
      WHERE c.agency_id = (current_setting('app.agency_id', true))::uuid
    )
  );

CREATE POLICY kotoiq_schema_ver_agency ON kotoiq_elementor_schema_versions
  FOR ALL USING (
    site_id IN (
      SELECT id FROM koto_wp_sites
      WHERE agency_id = (current_setting('app.agency_id', true))::uuid
    )
  );
