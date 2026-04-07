-- Koto Billing Platform

-- Stripe integration / billing accounts
CREATE TABLE IF NOT EXISTS koto_billing_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL UNIQUE,
  stripe_customer_id text UNIQUE,
  stripe_subscription_id text,
  plan text DEFAULT 'starter',
  plan_price numeric DEFAULT 297.00,
  billing_cycle text DEFAULT 'monthly',
  status text DEFAULT 'active' CHECK (status IN ('active','past_due','cancelled','trialing')),
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  credit_balance numeric DEFAULT 0,
  auto_recharge boolean DEFAULT false,
  auto_recharge_threshold numeric DEFAULT 20.00,
  auto_recharge_amount numeric DEFAULT 100.00,
  payment_method_last4 text,
  payment_method_brand text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Credit transactions
CREATE TABLE IF NOT EXISTS koto_credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('purchase','usage','refund','adjustment','bonus')),
  amount numeric NOT NULL,
  balance_after numeric NOT NULL,
  description text,
  feature text,
  feature_id uuid,
  stripe_payment_intent_id text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Usage tracking
CREATE TABLE IF NOT EXISTS koto_usage_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL,
  client_id uuid,
  feature text NOT NULL,
  quantity numeric NOT NULL,
  unit text NOT NULL,
  unit_cost numeric NOT NULL,
  total_cost numeric NOT NULL,
  credits_deducted numeric NOT NULL,
  billing_period text,
  recorded_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'
);

-- Agency invoices (Koto → Agency)
CREATE TABLE IF NOT EXISTS koto_agency_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL,
  stripe_invoice_id text,
  invoice_number text UNIQUE,
  status text DEFAULT 'draft' CHECK (status IN ('draft','open','paid','void','uncollectible')),
  billing_period_start date,
  billing_period_end date,
  subtotal numeric DEFAULT 0,
  tax numeric DEFAULT 0,
  total numeric DEFAULT 0,
  amount_paid numeric DEFAULT 0,
  amount_due numeric DEFAULT 0,
  line_items jsonb DEFAULT '[]',
  pdf_url text,
  paid_at timestamptz,
  due_date date,
  created_at timestamptz DEFAULT now()
);

-- Client invoices (Agency → Client)
CREATE TABLE IF NOT EXISTS koto_client_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL,
  client_id uuid NOT NULL,
  invoice_number text UNIQUE,
  status text DEFAULT 'draft' CHECK (status IN ('draft','sent','paid','overdue','void')),
  billing_period_start date,
  billing_period_end date,
  subtotal numeric DEFAULT 0,
  tax_rate numeric DEFAULT 0,
  tax numeric DEFAULT 0,
  total numeric DEFAULT 0,
  amount_paid numeric DEFAULT 0,
  amount_due numeric DEFAULT 0,
  line_items jsonb DEFAULT '[]',
  notes text,
  payment_terms text DEFAULT 'Net 30',
  stripe_invoice_id text,
  pdf_url text,
  sent_at timestamptz,
  paid_at timestamptz,
  due_date date,
  created_at timestamptz DEFAULT now()
);

-- Agency pricing for clients
CREATE TABLE IF NOT EXISTS koto_client_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL,
  client_id uuid NOT NULL UNIQUE,
  monthly_retainer numeric DEFAULT 0,
  setup_fee numeric DEFAULT 0,
  voice_call_rate numeric DEFAULT 0.10,
  sms_rate numeric DEFAULT 0.02,
  phone_number_rate numeric DEFAULT 3.00,
  page_build_rate numeric DEFAULT 50.00,
  billing_cycle text DEFAULT 'monthly',
  auto_invoice boolean DEFAULT true,
  payment_method text,
  stripe_customer_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Phone number billing
CREATE TABLE IF NOT EXISTS koto_phone_billing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text,
  agency_id uuid NOT NULL,
  client_id uuid,
  koto_cost numeric DEFAULT 1.45,
  agency_price numeric DEFAULT 3.00,
  billing_cycle_start date,
  billing_cycle_end date,
  invoiced boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Platform pricing (super admin)
CREATE TABLE IF NOT EXISTS koto_platform_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature text NOT NULL UNIQUE,
  unit text NOT NULL,
  cost_per_unit numeric NOT NULL,
  description text,
  updated_at timestamptz DEFAULT now()
);

-- Default pricing
INSERT INTO koto_platform_pricing (feature, unit, cost_per_unit, description) VALUES
('voice_outbound', 'minute', 0.05, 'Outbound AI voice call per minute'),
('voice_inbound', 'minute', 0.02, 'Inbound AI answering service per minute'),
('sms_outbound', 'message', 0.0075, 'Outbound SMS message'),
('sms_inbound', 'message', 0.005, 'Inbound SMS message'),
('phone_local', 'month', 1.45, 'Local phone number per month'),
('phone_tollfree', 'month', 2.50, 'Toll-free phone number per month'),
('ai_words', 'thousand_words', 0.02, 'AI content generation per 1000 words'),
('page_deploy', 'page', 0.10, 'WordPress page deployment')
ON CONFLICT (feature) DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_credit_tx_agency ON koto_credit_transactions(agency_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_agency ON koto_usage_records(agency_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_agency_inv ON koto_agency_invoices(agency_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_inv ON koto_client_invoices(agency_id, client_id);
CREATE INDEX IF NOT EXISTS idx_phone_bill ON koto_phone_billing(agency_id);

-- RLS: allow all via anon key
ALTER TABLE koto_billing_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY allow_all_billing ON koto_billing_accounts FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE koto_credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY allow_all_credits ON koto_credit_transactions FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE koto_usage_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY allow_all_usage ON koto_usage_records FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE koto_agency_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY allow_all_agency_inv ON koto_agency_invoices FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE koto_client_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY allow_all_client_inv ON koto_client_invoices FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE koto_client_pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY allow_all_client_pricing ON koto_client_pricing FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE koto_phone_billing ENABLE ROW LEVEL SECURITY;
CREATE POLICY allow_all_phone_bill ON koto_phone_billing FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE koto_platform_pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY allow_all_platform_pricing ON koto_platform_pricing FOR ALL USING (true) WITH CHECK (true);
