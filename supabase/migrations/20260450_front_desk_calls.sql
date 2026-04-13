-- Front desk call log
CREATE TABLE IF NOT EXISTS koto_front_desk_calls (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id         uuid REFERENCES koto_front_desk_configs(id) ON DELETE CASCADE,
  agency_id         uuid NOT NULL,
  client_id         uuid NOT NULL,
  retell_call_id    text,
  caller_phone      text,
  caller_name       text,
  direction         text DEFAULT 'inbound',
  duration_seconds  int DEFAULT 0,
  outcome           text DEFAULT 'answered',  -- answered, voicemail, missed, transferred, appointment
  transfer_to       text,                      -- phone number transferred to
  transfer_accepted boolean,                   -- did the office pick up
  sentiment         text DEFAULT 'neutral',
  transcript        text,
  ai_summary        text,
  recording_url     text,
  voicemail         boolean DEFAULT false,
  voicemail_url     text,
  voicemail_transcript text,
  links_sent        jsonb DEFAULT '[]'::jsonb,  -- which sendable_links were texted/emailed
  ghl_synced        boolean DEFAULT false,
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fd_calls_config ON koto_front_desk_calls(config_id);
CREATE INDEX IF NOT EXISTS idx_fd_calls_agency ON koto_front_desk_calls(agency_id);
CREATE INDEX IF NOT EXISTS idx_fd_calls_client ON koto_front_desk_calls(client_id);
CREATE INDEX IF NOT EXISTS idx_fd_calls_created ON koto_front_desk_calls(created_at DESC);

-- Front desk voicemail settings
ALTER TABLE koto_front_desk_configs ADD COLUMN IF NOT EXISTS voicemail_greeting text;
ALTER TABLE koto_front_desk_configs ADD COLUMN IF NOT EXISTS voicemail_max_seconds int DEFAULT 120;
ALTER TABLE koto_front_desk_configs ADD COLUMN IF NOT EXISTS transfer_timeout_seconds int DEFAULT 30;
ALTER TABLE koto_front_desk_configs ADD COLUMN IF NOT EXISTS transfer_announce_template text DEFAULT 'You have an incoming call from {caller}. Press 1 to connect.';

ALTER TABLE koto_front_desk_calls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fd_calls_all" ON koto_front_desk_calls;
CREATE POLICY "fd_calls_all" ON koto_front_desk_calls FOR ALL USING (true) WITH CHECK (true);
