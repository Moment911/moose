-- ═══════════════════════════════════════════════════════════════
-- Client Q&A snapshot — structured, queryable store of all
-- onboarding questions and answers per client.
--
-- Populated from clients table + onboarding_answers jsonb.
-- Refreshed on onboarding autosave, voice call save, and manual sync.
-- Consumed by KotoIQ for client context across all tabs.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS kotoiq_client_qa (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  field_key     text NOT NULL,
  question      text NOT NULL,
  answer        text NOT NULL,
  label         text NOT NULL,
  section       text NOT NULL,           -- 'Owner & Contact', 'Services & Products', etc.
  priority      smallint DEFAULT 3,      -- 1=must get, 2=important, 3=nice, 4=adaptive, 5=extra
  pass          text,                    -- 'voice', 'web', or 'adaptive' — which onboarding pass asks this
  source        text,                    -- 'voice', 'web', or null — how this specific answer was collected
  answered_at   timestamptz,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE(client_id, field_key)
);

CREATE INDEX IF NOT EXISTS idx_client_qa_client ON kotoiq_client_qa(client_id);
CREATE INDEX IF NOT EXISTS idx_client_qa_section ON kotoiq_client_qa(section);

ALTER TABLE kotoiq_client_qa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_client_qa" ON kotoiq_client_qa FOR ALL USING (true) WITH CHECK (true);
