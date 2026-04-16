-- KotoIQ Client Activity — per-client audit log of bot-executed actions
-- Each row represents one bot-triggered API call; optionally references the
-- persisted artifact (brief, audit, map…) so the action can be reverted.
-- Migration: 20260427_kotoiq_client_activity

CREATE TABLE IF NOT EXISTS kotoiq_client_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE,
  bot_conversation_id uuid REFERENCES kotoiq_bot_conversations(id) ON DELETE SET NULL,
  bot_message_id uuid REFERENCES kotoiq_bot_messages(id) ON DELETE SET NULL,
  intent text NOT NULL,
  action_api text,
  inputs jsonb DEFAULT '{}'::jsonb,
  result jsonb DEFAULT '{}'::jsonb,
  result_ref_table text,
  result_ref_id uuid,
  status text DEFAULT 'success',
  reverted_at timestamptz,
  reverted_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_client ON kotoiq_client_activity(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_agency ON kotoiq_client_activity(agency_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_intent ON kotoiq_client_activity(intent);

ALTER TABLE kotoiq_client_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agency can read own activity" ON kotoiq_client_activity
  FOR SELECT USING (agency_id::text = current_setting('request.jwt.claims', true)::json->>'agency_id');
