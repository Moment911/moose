
-- ══════════════════════════════════════════════════════════════════════
-- REVIEW REQUEST CAMPAIGNS
-- ══════════════════════════════════════════════════════════════════════

-- Campaign definitions (reusable templates per client)
CREATE TABLE IF NOT EXISTS review_campaigns (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id       uuid REFERENCES agencies(id) ON DELETE CASCADE,
  client_id       uuid REFERENCES clients(id) ON DELETE CASCADE,
  name            text NOT NULL,
  status          text DEFAULT 'draft',   -- draft|active|paused|archived
  channel         text DEFAULT 'email',   -- email|sms|both
  subject         text,                   -- email subject
  message_email   text,                   -- email body (HTML allowed)
  message_sms     text,                   -- SMS body (max 160 chars)
  review_url      text,                   -- direct Google review link
  send_delay_days int DEFAULT 1,          -- days after job completion to send
  auto_send       boolean DEFAULT false,  -- send automatically vs manually
  total_sent      int DEFAULT 0,
  total_opened    int DEFAULT 0,
  total_clicked   int DEFAULT 0,
  total_reviews   int DEFAULT 0,          -- estimated from clicks
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Individual contacts to send review requests to
CREATE TABLE IF NOT EXISTS review_request_contacts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     uuid REFERENCES review_campaigns(id) ON DELETE CASCADE,
  client_id       uuid REFERENCES clients(id) ON DELETE CASCADE,
  agency_id       uuid,
  name            text NOT NULL,
  email           text,
  phone           text,
  status          text DEFAULT 'pending', -- pending|sent|opened|clicked|bounced|unsubscribed
  channel_used    text,                   -- email|sms
  sent_at         timestamptz,
  opened_at       timestamptz,
  clicked_at      timestamptz,
  token           text UNIQUE DEFAULT replace(gen_random_uuid()::text,'-',''),
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_review_req_campaign ON review_request_contacts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_review_req_token    ON review_request_contacts(token);
CREATE INDEX IF NOT EXISTS idx_review_req_client   ON review_request_contacts(client_id, status);

SELECT 'Review campaign tables created ✓' as result;
