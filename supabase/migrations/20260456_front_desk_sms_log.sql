-- SMS conversation log for Front Desk AI texting
CREATE TABLE IF NOT EXISTS koto_front_desk_sms (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       uuid NOT NULL,
  client_id       uuid NOT NULL,
  config_id       uuid REFERENCES koto_front_desk_configs(id) ON DELETE CASCADE,
  direction       text NOT NULL DEFAULT 'outbound',  -- inbound, outbound
  from_number     text,
  to_number       text,
  message         text NOT NULL,
  message_type    text DEFAULT 'general',  -- general, post_call, missed_call, ai_response, link, campaign
  link_url        text,
  link_type       text,
  ai_generated    boolean DEFAULT false,
  ghl_message_id  text,
  ghl_contact_id  text,
  call_id         uuid,  -- reference to koto_front_desk_calls if tied to a call
  status          text DEFAULT 'sent',  -- sent, delivered, failed, received
  sent_via        text DEFAULT 'ghl',  -- ghl, twilio
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fd_sms_client ON koto_front_desk_sms(client_id);
CREATE INDEX IF NOT EXISTS idx_fd_sms_agency ON koto_front_desk_sms(agency_id);
CREATE INDEX IF NOT EXISTS idx_fd_sms_to ON koto_front_desk_sms(to_number);
CREATE INDEX IF NOT EXISTS idx_fd_sms_created ON koto_front_desk_sms(created_at DESC);

ALTER TABLE koto_front_desk_sms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fd_sms_all" ON koto_front_desk_sms;
CREATE POLICY "fd_sms_all" ON koto_front_desk_sms FOR ALL USING (true) WITH CHECK (true);

-- AI SMS settings on the config
ALTER TABLE koto_front_desk_configs ADD COLUMN IF NOT EXISTS ai_sms_enabled boolean DEFAULT false;
ALTER TABLE koto_front_desk_configs ADD COLUMN IF NOT EXISTS ai_sms_hours jsonb DEFAULT '{"start":"09:00","end":"19:00","timezone":"America/New_York"}'::jsonb;
ALTER TABLE koto_front_desk_configs ADD COLUMN IF NOT EXISTS ai_sms_escalation_keywords text[] DEFAULT ARRAY['emergency','urgent','911','help me','severe pain'];
ALTER TABLE koto_front_desk_configs ADD COLUMN IF NOT EXISTS ai_sms_auto_reply_delay_seconds int DEFAULT 30;
