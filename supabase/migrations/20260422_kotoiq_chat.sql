-- ────────────────────────────────────────────────────────────────────
-- KotoIQ Chat — persistent "Ask KotoIQ" conversations
-- ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kotoiq_chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE,
  title text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kotoiq_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES kotoiq_chat_conversations(id) ON DELETE CASCADE,
  role text NOT NULL, -- 'user' | 'assistant' | 'system'
  content text NOT NULL,
  data_used jsonb DEFAULT '[]',
  suggested_actions jsonb DEFAULT '[]',
  tokens_input integer,
  tokens_output integer,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_conv_client ON kotoiq_chat_conversations(client_id);
CREATE INDEX IF NOT EXISTS idx_chat_msg_conv ON kotoiq_chat_messages(conversation_id);
