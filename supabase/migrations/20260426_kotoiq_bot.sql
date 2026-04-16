-- KotoIQ Conversational Bot — persistent conversations + messages
-- Migration: 20260426_kotoiq_bot

CREATE TABLE IF NOT EXISTS kotoiq_bot_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE,
  title text,
  status text DEFAULT 'active',
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kotoiq_bot_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES kotoiq_bot_conversations(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  action_intent text,
  action_data jsonb,
  action_executed boolean DEFAULT false,
  action_result jsonb,
  tokens_input integer,
  tokens_output integer,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_conv_client ON kotoiq_bot_conversations(client_id);
CREATE INDEX IF NOT EXISTS idx_bot_conv_agency ON kotoiq_bot_conversations(agency_id);
CREATE INDEX IF NOT EXISTS idx_bot_msg_conv ON kotoiq_bot_messages(conversation_id);

INSERT INTO storage.buckets (id, name, public)
VALUES ('kotoiq-bot-uploads', 'kotoiq-bot-uploads', true)
ON CONFLICT (id) DO NOTHING;
