CREATE TABLE IF NOT EXISTS koto_stripe_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_product_id text UNIQUE,
  stripe_price_id_monthly text,
  stripe_price_id_annual text,
  name text NOT NULL,
  description text,
  type text DEFAULT 'subscription',
  category text DEFAULT 'plan',
  monthly_price numeric,
  annual_price numeric,
  currency text DEFAULT 'usd',
  features jsonb DEFAULT '[]',
  is_active boolean DEFAULT true,
  is_featured boolean DEFAULT false,
  display_order integer DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS koto_stripe_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_coupon_id text UNIQUE,
  name text NOT NULL,
  type text DEFAULT 'percent',
  percent_off numeric,
  amount_off numeric,
  currency text DEFAULT 'usd',
  duration text DEFAULT 'once',
  duration_in_months integer,
  max_redemptions integer,
  times_redeemed integer DEFAULT 0,
  applies_to_products text[] DEFAULT '{}',
  valid_until timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE koto_stripe_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_all_stripe_products ON koto_stripe_products;
CREATE POLICY allow_all_stripe_products ON koto_stripe_products FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE koto_stripe_coupons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_all_stripe_coupons ON koto_stripe_coupons;
CREATE POLICY allow_all_stripe_coupons ON koto_stripe_coupons FOR ALL USING (true) WITH CHECK (true);
