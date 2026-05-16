-- ============================================================
-- KotoIQ — Newsletter Intel (Phase G)
--
-- Track competitor email marketing by subscribing a unique alias
-- per brand to their newsletter. Resend inbound webhook posts
-- received emails; Haiku classifies journey stage + extracts CTA.
-- Manual paste-import also supported for any email source.
-- ============================================================

CREATE TABLE IF NOT EXISTS kotoiq_competitor_email_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  brand_name text NOT NULL,
  alias_email text NOT NULL UNIQUE,        -- intel-{hash}@hellokoto-inbound.com
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_aliases_client ON kotoiq_competitor_email_aliases(client_id, is_active);

CREATE TABLE IF NOT EXISTS kotoiq_competitor_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  alias_id uuid REFERENCES kotoiq_competitor_email_aliases(id) ON DELETE SET NULL,
  brand_name text NOT NULL,
  from_address text,
  from_name text,
  subject text,
  preview_text text,                       -- first ~120 chars of plain body
  body_html text,
  body_text text,
  links jsonb,                             -- [{url, anchor}]
  cta_texts jsonb,                         -- [{text, url}]
  journey_stage text,                      -- welcome | promo | nurture | cart_abandon | win_back | announcement | digest | other
  emotion text,                            -- urgent | informational | playful | exclusive | other
  promo_detected text,                     -- '20% off', 'Free shipping', etc.
  sent_at timestamptz,
  received_at timestamptz DEFAULT now(),
  ingestion_source text DEFAULT 'webhook', -- 'webhook' | 'manual_paste'
  classifier_cost_usd numeric(10,6)
);
CREATE INDEX IF NOT EXISTS idx_competitor_emails_client_brand ON kotoiq_competitor_emails(client_id, brand_name, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_competitor_emails_journey ON kotoiq_competitor_emails(client_id, journey_stage, received_at DESC);

ALTER TABLE kotoiq_competitor_email_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE kotoiq_competitor_emails ENABLE ROW LEVEL SECURITY;
