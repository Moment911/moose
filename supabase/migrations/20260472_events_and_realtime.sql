-- ─────────────────────────────────────────────────────────────
-- koto_events + realtime publication
--
-- Creates the koto_events table used for the activity/timeline
-- feed (e.g. voice call_started, proposal_accepted, provision
-- completed) and enables Supabase realtime on both koto_events
-- and koto_token_usage so the dashboard can stream live updates.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS koto_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text NOT NULL,
  title text NOT NULL,
  description text,
  timestamp timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_timestamp ON koto_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_type ON koto_events(event_type);

ALTER TABLE koto_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "events_all" ON koto_events;
CREATE POLICY "events_all" ON koto_events FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime streams (run was done via Management API —
-- this file is the canonical record so fresh clones stay in sync).
-- Wrap in a DO block so re-runs don't error if already added.
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE koto_token_usage;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE koto_events;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
