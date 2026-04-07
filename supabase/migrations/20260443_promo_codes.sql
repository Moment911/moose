-- Promo code system

CREATE TABLE IF NOT EXISTS koto_promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text,
  type text NOT NULL,
  value numeric DEFAULT 0,
  plan text,
  duration_days integer,
  max_uses integer,
  current_uses integer DEFAULT 0,
  bypass_billing boolean DEFAULT false,
  bypass_subscription boolean DEFAULT false,
  free_credits numeric DEFAULT 0,
  valid_from timestamptz DEFAULT now(),
  valid_until timestamptz,
  created_by text,
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS koto_promo_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id uuid REFERENCES koto_promo_codes(id),
  agency_id uuid NOT NULL,
  redeemed_by_email text,
  redeemed_at timestamptz DEFAULT now(),
  credits_added numeric DEFAULT 0,
  plan_unlocked text,
  expires_at timestamptz,
  is_active boolean DEFAULT true
);

INSERT INTO koto_promo_codes (code, description, type, bypass_billing, bypass_subscription, free_credits, duration_days, created_by) VALUES
('KOTO2026', 'Koto internal bypass - full access', 'bypass_subscription', true, true, 500, 365, 'system'),
('MOMENTA', 'Momenta Marketing agency code', 'bypass_subscription', true, true, 250, 365, 'system'),
('BETA2026', 'Beta tester code - 3 months free', 'free_plan', false, true, 100, 90, 'system'),
('TRIAL30', '30-day free trial', 'free_trial', false, true, 50, 30, 'system'),
('LAUNCH50', '50% off first 3 months', 'discount_percent', false, false, 0, 90, 'system')
ON CONFLICT (code) DO NOTHING;

-- Auto-apply KOTO2026 to the main agency
INSERT INTO koto_promo_redemptions (code_id, agency_id, redeemed_by_email, expires_at, is_active)
SELECT id, '00000000-0000-0000-0000-000000000099', 'adam@hellokoto.com', now() + interval '365 days', true
FROM koto_promo_codes WHERE code = 'KOTO2026'
ON CONFLICT DO NOTHING;

ALTER TABLE koto_promo_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_all_promo ON koto_promo_codes;
CREATE POLICY allow_all_promo ON koto_promo_codes FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE koto_promo_redemptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_all_promo_redemptions ON koto_promo_redemptions;
CREATE POLICY allow_all_promo_redemptions ON koto_promo_redemptions FOR ALL USING (true) WITH CHECK (true);
