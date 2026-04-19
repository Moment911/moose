-- Scout spine — extend koto_opportunities to be the canonical revenue object.
-- Additive only. No drops, no data migration. Existing rows keep working.
-- Backfill of persona/health/last_touch happens lazily via triggers + cron.

-- ── Core spine columns ────────────────────────────────────────────────────

ALTER TABLE koto_opportunities ADD COLUMN IF NOT EXISTS persona_json jsonb DEFAULT '{}'::jsonb;
ALTER TABLE koto_opportunities ADD COLUMN IF NOT EXISTS health_score integer DEFAULT 0;
ALTER TABLE koto_opportunities ADD COLUMN IF NOT EXISTS last_touch_at timestamptz;
ALTER TABLE koto_opportunities ADD COLUMN IF NOT EXISTS next_action_at timestamptz;
ALTER TABLE koto_opportunities ADD COLUMN IF NOT EXISTS next_action_type text;
ALTER TABLE koto_opportunities ADD COLUMN IF NOT EXISTS assigned_user_id uuid;

-- Pipeline economics
ALTER TABLE koto_opportunities ADD COLUMN IF NOT EXISTS deal_value numeric(12,2);
ALTER TABLE koto_opportunities ADD COLUMN IF NOT EXISTS close_probability integer DEFAULT 0;
ALTER TABLE koto_opportunities ADD COLUMN IF NOT EXISTS expected_close_date date;
ALTER TABLE koto_opportunities ADD COLUMN IF NOT EXISTS stage_changed_at timestamptz;

-- Call-derived fields (rolled up from voice pipeline)
ALTER TABLE koto_opportunities ADD COLUMN IF NOT EXISTS pain_point text;
ALTER TABLE koto_opportunities ADD COLUMN IF NOT EXISTS objection text;
ALTER TABLE koto_opportunities ADD COLUMN IF NOT EXISTS last_contact_attempt_at timestamptz;
ALTER TABLE koto_opportunities ADD COLUMN IF NOT EXISTS contact_attempt_count integer DEFAULT 0;

-- Compliance (TCPA / DNC) — before any outbound campaign touches this record
ALTER TABLE koto_opportunities ADD COLUMN IF NOT EXISTS dnc_status text DEFAULT 'unchecked';
ALTER TABLE koto_opportunities ADD COLUMN IF NOT EXISTS dnc_checked_at timestamptz;
ALTER TABLE koto_opportunities ADD COLUMN IF NOT EXISTS tcpa_consent_at timestamptz;
ALTER TABLE koto_opportunities ADD COLUMN IF NOT EXISTS tcpa_consent_source text;

-- Appointment + client linkage
ALTER TABLE koto_opportunities ADD COLUMN IF NOT EXISTS appointment_id uuid;
ALTER TABLE koto_opportunities ADD COLUMN IF NOT EXISTS client_id uuid;

CREATE INDEX IF NOT EXISTS idx_opps_assigned ON koto_opportunities(assigned_user_id) WHERE assigned_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_opps_next_action ON koto_opportunities(next_action_at) WHERE next_action_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_opps_last_touch ON koto_opportunities(last_touch_at DESC);
CREATE INDEX IF NOT EXISTS idx_opps_health ON koto_opportunities(health_score DESC);
CREATE INDEX IF NOT EXISTS idx_opps_client ON koto_opportunities(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_opps_appointment ON koto_opportunities(appointment_id) WHERE appointment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_opps_close_date ON koto_opportunities(expected_close_date) WHERE expected_close_date IS NOT NULL;

-- ── Unified document registry ─────────────────────────────────────────────
-- One table to link proposals, invoices, discovery docs, agreements, NDAs, SOWs.
-- document_id is the FK to the specific table; document_type tells you which.

CREATE TABLE IF NOT EXISTS koto_opportunity_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES koto_opportunities(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  document_id uuid,
  external_url text,
  title text,
  status text DEFAULT 'draft',
  sent_at timestamptz,
  viewed_at timestamptz,
  accepted_at timestamptz,
  total_value numeric(12,2),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opp_docs_opp ON koto_opportunity_documents(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opp_docs_type ON koto_opportunity_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_opp_docs_status ON koto_opportunity_documents(status);
CREATE INDEX IF NOT EXISTS idx_opp_docs_doc_id ON koto_opportunity_documents(document_id) WHERE document_id IS NOT NULL;

ALTER TABLE koto_opportunity_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "agency_opp_docs" ON koto_opportunity_documents;
CREATE POLICY "agency_opp_docs" ON koto_opportunity_documents FOR ALL
  USING (opportunity_id IN (SELECT id FROM koto_opportunities WHERE agency_id = auth.uid()));

-- Recommended document_type values (not CHECK-enforced to avoid breaking future types):
--   proposal, agreement, sow, nda, invoice, discovery_doc, quote, contract, receipt
-- Recommended status values:
--   draft, sent, viewed, accepted, rejected, signed, paid, expired, void

-- ── Activity type taxonomy (advisory, not enforced) ───────────────────────
-- Recommended activity_type values for koto_opportunity_activities:
--   call_inbound, call_outbound, call_missed, call_voicemail
--   email_sent, email_opened, email_replied, email_forwarded, email_bounced
--   sms_sent, sms_received, sms_delivered, sms_failed
--   meeting_scheduled, meeting_rescheduled, meeting_held, meeting_no_show
--   proposal_sent, proposal_viewed, proposal_accepted, proposal_rejected
--   invoice_sent, invoice_viewed, invoice_paid
--   document_signed, document_viewed
--   stage_changed, assigned, tag_added, tag_removed, note_added
--   intent_signal, enrichment_update, score_change, dnc_scrub, consent_captured
-- No CHECK added — existing rows may have free-form types.

CREATE INDEX IF NOT EXISTS idx_opp_activities_type ON koto_opportunity_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_opp_activities_created ON koto_opportunity_activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_opp_activities_opp_created ON koto_opportunity_activities(opportunity_id, created_at DESC);

-- ── Trigger: maintain last_touch_at + stage_changed_at automatically ─────

CREATE OR REPLACE FUNCTION touch_opportunity_on_activity()
RETURNS TRIGGER AS $fn$
BEGIN
  UPDATE koto_opportunities
  SET last_touch_at = NEW.created_at,
      updated_at = now()
  WHERE id = NEW.opportunity_id
    AND (last_touch_at IS NULL OR last_touch_at < NEW.created_at);
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_opp_touch_on_activity ON koto_opportunity_activities;
CREATE TRIGGER trg_opp_touch_on_activity
  AFTER INSERT ON koto_opportunity_activities
  FOR EACH ROW EXECUTE FUNCTION touch_opportunity_on_activity();

CREATE OR REPLACE FUNCTION mark_stage_changed()
RETURNS TRIGGER AS $fn$
BEGIN
  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    NEW.stage_changed_at = now();
    INSERT INTO koto_opportunity_activities (opportunity_id, activity_type, description, metadata)
    VALUES (
      NEW.id,
      'stage_changed',
      OLD.stage || ' -> ' || NEW.stage,
      jsonb_build_object('from', OLD.stage, 'to', NEW.stage)
    );
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_opp_stage_changed ON koto_opportunities;
CREATE TRIGGER trg_opp_stage_changed
  BEFORE UPDATE OF stage ON koto_opportunities
  FOR EACH ROW EXECUTE FUNCTION mark_stage_changed();

-- ── Scout-branded view (zero-cost alias for the new product surface) ─────
-- Lets Scout UI/API query `scout_opportunities` while keeping the physical
-- table name consistent with existing migrations and RLS.

CREATE OR REPLACE VIEW scout_opportunities AS
  SELECT * FROM koto_opportunities;

COMMENT ON VIEW scout_opportunities IS
  'Scout product alias for koto_opportunities. Use this in Scout-scoped code.';

-- ── Lazy backfill helper (run manually or via cron) ──────────────────────
-- Computes last_touch_at from existing activities for rows missing it.
-- Safe to re-run. Not auto-executed in migration to keep it fast on prod.

CREATE OR REPLACE FUNCTION scout_backfill_last_touch()
RETURNS integer AS $$
DECLARE
  updated_count integer;
BEGIN
  WITH touches AS (
    SELECT opportunity_id, MAX(created_at) AS max_at
    FROM koto_opportunity_activities
    GROUP BY opportunity_id
  )
  UPDATE koto_opportunities o
  SET last_touch_at = t.max_at
  FROM touches t
  WHERE o.id = t.opportunity_id
    AND o.last_touch_at IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;
