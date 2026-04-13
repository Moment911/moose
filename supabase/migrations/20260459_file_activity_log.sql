-- Per-file activity log for KotoProof
-- Tracks views, comments, approvals, version uploads, status changes
CREATE TABLE IF NOT EXISTS koto_file_activity (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id     uuid NOT NULL,
  project_id  uuid NOT NULL,
  action      text NOT NULL,  -- viewed, commented, replied, approved, status_changed, version_uploaded, renamed
  actor_name  text,
  actor_email text,
  detail      text,
  metadata    jsonb DEFAULT '{}'::jsonb,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_file_activity_file ON koto_file_activity(file_id);
CREATE INDEX IF NOT EXISTS idx_file_activity_project ON koto_file_activity(project_id);
CREATE INDEX IF NOT EXISTS idx_file_activity_created ON koto_file_activity(created_at DESC);

ALTER TABLE koto_file_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "file_activity_all" ON koto_file_activity FOR ALL USING (true) WITH CHECK (true);
