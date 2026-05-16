-- ============================================================
-- KotoIQ — Today / Action Center routines (Phase: UX layer)
--
-- Tracks per-user, per-client completion of cadence routines.
-- Routines come from a code-defined catalog (todayEngine.ts);
-- this table just stores which ones the user has marked done
-- and when, so daily/weekly/monthly cadences can reset cleanly.
-- ============================================================

CREATE TABLE IF NOT EXISTS kotoiq_routine_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  agency_id uuid,                                    -- attribution
  user_id uuid,                                      -- who marked it done (auth.users id)
  routine_id text NOT NULL,                          -- 'review_pulse' | 'reply_to_reviews' | ...
  cadence text NOT NULL,                             -- 'initial' | 'daily' | 'weekly' | 'monthly'
  completed_at timestamptz DEFAULT now(),
  notes text
);

CREATE INDEX IF NOT EXISTS idx_routine_completions_client_routine_time
  ON kotoiq_routine_completions(client_id, routine_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_routine_completions_client_cadence_time
  ON kotoiq_routine_completions(client_id, cadence, completed_at DESC);

ALTER TABLE kotoiq_routine_completions ENABLE ROW LEVEL SECURITY;
