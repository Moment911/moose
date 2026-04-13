-- Front desk directives — individual instruction entries that get injected into the LLM prompt
CREATE TABLE IF NOT EXISTS koto_front_desk_directives (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id     uuid REFERENCES koto_front_desk_configs(id) ON DELETE CASCADE,
  agency_id     uuid NOT NULL,
  client_id     uuid NOT NULL,
  category      text DEFAULT 'general' CHECK (category IN ('greeting','scheduling','medical','objection','transfer','insurance','general','learned')),
  directive     text NOT NULL,
  source        text DEFAULT 'manual' CHECK (source IN ('manual','ai_suggested','call_learned')),
  source_call_id uuid,
  status        text DEFAULT 'active' CHECK (status IN ('active','pending','dismissed','archived')),
  priority      int DEFAULT 0,
  times_used    int DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fd_directives_config ON koto_front_desk_directives(config_id);
CREATE INDEX IF NOT EXISTS idx_fd_directives_client ON koto_front_desk_directives(client_id);
CREATE INDEX IF NOT EXISTS idx_fd_directives_status ON koto_front_desk_directives(status);

ALTER TABLE koto_front_desk_directives ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fd_directives_all" ON koto_front_desk_directives;
CREATE POLICY "fd_directives_all" ON koto_front_desk_directives FOR ALL USING (true) WITH CHECK (true);
