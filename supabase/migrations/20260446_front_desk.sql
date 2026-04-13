-- ══════════════════════════════════════════════════════════════════════════════
-- KOTO FRONT DESK — Virtual Receptionist Configuration
-- One config per client (agency's client)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS koto_front_desk_configs (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id                   uuid NOT NULL,
  client_id                   uuid NOT NULL,

  -- Business info
  company_name                text NOT NULL,
  industry                    text,
  address                     text,
  phone                       text,
  website                     text,
  timezone                    text DEFAULT 'America/New_York',

  -- Hours: { "monday": { "open": "09:00", "close": "17:00" }, "saturday": null }
  business_hours              jsonb DEFAULT '{}'::jsonb,

  -- Services offered (array of strings)
  services                    text[] DEFAULT '{}',

  -- Insurance plans accepted
  insurance_accepted          text[] DEFAULT '{}',

  -- Scheduling
  scheduling_link             text,
  scheduling_department_name  text,
  scheduling_department_phone text,

  -- Staff directory: [{ "name": "Rachel", "role": "Scheduling", "extension": "201" }]
  staff_directory             jsonb DEFAULT '[]'::jsonb,

  -- Greeting customization
  custom_greeting             text,  -- e.g. "{greeting}, it's a great day at {company}!"
  custom_instructions         text,  -- freeform instructions injected into prompt

  -- Features
  hipaa_mode                  boolean DEFAULT false,
  emergency_keywords          text[] DEFAULT ARRAY['emergency','urgent'],
  voicemail_enabled           boolean DEFAULT true,
  transfer_enabled            boolean DEFAULT true,
  sms_enabled                 boolean DEFAULT true,
  recording_enabled           boolean DEFAULT true,

  -- Retell integration
  retell_agent_id             text,
  retell_phone_number         text,
  voice_id                    text,
  voice_name                  text DEFAULT 'Nicole',

  -- Status
  status                      text DEFAULT 'draft' CHECK (status IN ('draft','active','paused','disabled')),

  -- Metrics
  total_calls                 int DEFAULT 0,
  total_appointments          int DEFAULT 0,
  total_transfers             int DEFAULT 0,

  created_at                  timestamptz DEFAULT now(),
  updated_at                  timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_front_desk_client ON koto_front_desk_configs(client_id);
CREATE INDEX IF NOT EXISTS idx_front_desk_agency ON koto_front_desk_configs(agency_id);
CREATE INDEX IF NOT EXISTS idx_front_desk_status ON koto_front_desk_configs(status);

-- RLS
ALTER TABLE koto_front_desk_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "front_desk_all" ON koto_front_desk_configs;
CREATE POLICY "front_desk_all" ON koto_front_desk_configs FOR ALL USING (true) WITH CHECK (true);

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_front_desk_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_front_desk_updated ON koto_front_desk_configs;
CREATE TRIGGER trg_front_desk_updated BEFORE UPDATE ON koto_front_desk_configs
  FOR EACH ROW EXECUTE FUNCTION update_front_desk_updated_at();
