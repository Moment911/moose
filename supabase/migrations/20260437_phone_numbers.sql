CREATE TABLE IF NOT EXISTS koto_phone_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL,
  client_id uuid,
  phone_number text NOT NULL UNIQUE,
  friendly_name text,
  type text DEFAULT 'local' CHECK (type IN ('local', 'tollfree', 'mobile')),
  provider text DEFAULT 'twilio',
  provider_sid text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'released', 'pending')),
  purpose text DEFAULT 'voice' CHECK (purpose IN ('voice', 'sms', 'both', 'answering', 'outbound')),
  monthly_cost numeric DEFAULT 1.45,
  assigned_agent_id uuid,
  assigned_agent_type text, -- 'voice' or 'inbound'
  capabilities jsonb DEFAULT '{"voice":true,"sms":true,"mms":false}',
  last_used_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_phone_agency ON koto_phone_numbers(agency_id);
CREATE INDEX IF NOT EXISTS idx_phone_status ON koto_phone_numbers(status);

ALTER TABLE koto_phone_numbers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_all_phone_numbers ON koto_phone_numbers;
CREATE POLICY allow_all_phone_numbers ON koto_phone_numbers FOR ALL USING (true) WITH CHECK (true);
