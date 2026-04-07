-- Tier 3 — Revenue attribution + coaching + intelligence columns
ALTER TABLE koto_voice_appointments ADD COLUMN IF NOT EXISTS deal_closed boolean DEFAULT false;
ALTER TABLE koto_voice_appointments ADD COLUMN IF NOT EXISTS closed_at timestamptz;
ALTER TABLE koto_voice_appointments ADD COLUMN IF NOT EXISTS closure_notes text;

-- Inbound callers: last reason + last agent
ALTER TABLE koto_inbound_callers ADD COLUMN IF NOT EXISTS last_reason_for_call text;
ALTER TABLE koto_inbound_callers ADD COLUMN IF NOT EXISTS last_agent_id uuid;
