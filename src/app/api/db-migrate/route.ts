import { NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Run SQL via Supabase's REST API using the pg endpoint
async function runSQL(sql: string) {
  // Use the Supabase SQL over REST endpoint
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_migration`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Prefer':        'return=representation',
    },
    body: JSON.stringify({ query: sql }),
  })
  return res
}

// Check if a table exists by querying it
async function tableExists(name: string) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${name}?select=count&limit=0`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  )
  return res.ok
}

const TABLES_SQL: Record<string, string> = {
  local_rank_scans: `
    CREATE TABLE IF NOT EXISTS local_rank_scans (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
      agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE,
      keyword text NOT NULL, location text NOT NULL,
      target_business text, target_domain text,
      radius_km int DEFAULT 16, target_rank int,
      total_results int DEFAULT 0, results jsonb DEFAULT '[]',
      ai_analysis jsonb DEFAULT '{}', scanned_at timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_rank_scans_client  ON local_rank_scans(client_id);
    CREATE INDEX IF NOT EXISTS idx_rank_scans_keyword ON local_rank_scans(client_id, keyword, location);
    CREATE INDEX IF NOT EXISTS idx_rank_scans_scanned ON local_rank_scans(scanned_at DESC);
    ALTER TABLE local_rank_scans ENABLE ROW LEVEL SECURITY;
  `,
  local_rank_grid_scans: `
    CREATE TABLE IF NOT EXISTS local_rank_grid_scans (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
      agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE,
      keyword text NOT NULL, center_location text NOT NULL,
      center_lat numeric, center_lng numeric, target_business text,
      grid_size int DEFAULT 3, grid_spacing_km numeric DEFAULT 1.5,
      grid_results jsonb DEFAULT '[]', avg_rank numeric,
      best_rank int, worst_rank int, ranked_cells int, total_cells int,
      scanned_at timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_grid_scans_client  ON local_rank_grid_scans(client_id);
    CREATE INDEX IF NOT EXISTS idx_grid_scans_keyword ON local_rank_grid_scans(client_id, keyword);
    CREATE INDEX IF NOT EXISTS idx_grid_scans_date    ON local_rank_grid_scans(scanned_at DESC);
    ALTER TABLE local_rank_grid_scans ENABLE ROW LEVEL SECURITY;
  `,
  reviews: `
    CREATE TABLE IF NOT EXISTS reviews (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
      agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE,
      platform text NOT NULL DEFAULT 'google',
      reviewer_name text, reviewer_photo text,
      rating int, review_text text,
      review_date timestamptz, review_id text,
      response_text text, responded_at timestamptz,
      ai_response text, sentiment text,
      is_responded boolean DEFAULT false,
      source_url text,
      created_at timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_reviews_client   ON reviews(client_id);
    CREATE INDEX IF NOT EXISTS idx_reviews_platform ON reviews(client_id, platform);
    CREATE INDEX IF NOT EXISTS idx_reviews_rating   ON reviews(client_id, rating);
    ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reviews' AND policyname='allow_all_reviews') THEN
    CREATE POLICY "allow_all_reviews" ON reviews FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
  `,
  client_portal_sessions: `
    CREATE TABLE IF NOT EXISTS client_portal_sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
      agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE,
      token text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
      email text, name text,
      expires_at timestamptz DEFAULT now() + interval '30 days',
      last_accessed_at timestamptz,
      created_at timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_portal_sessions_client ON client_portal_sessions(client_id);
    CREATE INDEX IF NOT EXISTS idx_portal_sessions_token  ON client_portal_sessions(token);
    ALTER TABLE client_portal_sessions ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='client_portal_sessions' AND policyname='allow_all_portal_sessions') THEN
    CREATE POLICY "allow_all_portal_sessions" ON client_portal_sessions FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
  `,
  subscriptions: `
    CREATE TABLE IF NOT EXISTS subscriptions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE,
      stripe_customer_id text, stripe_subscription_id text,
      plan text DEFAULT 'starter',
      status text DEFAULT 'trialing',
      current_period_start timestamptz,
      current_period_end timestamptz,
      cancel_at_period_end boolean DEFAULT false,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
    ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='subscriptions' AND policyname='allow_all_subscriptions') THEN
    CREATE POLICY "allow_all_subscriptions" ON subscriptions FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
  `,
}

export async function GET() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json({ error: 'Missing env vars' }, { status: 500 })
  }

  const results: Record<string, any> = {}

  for (const [table, sql] of Object.entries(TABLES_SQL)) {
    const exists = await tableExists(table)
    results[table] = { existed: exists }

    if (!exists) {
      // Try to create via Supabase SQL endpoint
      // Supabase exposes a /pg endpoint for direct SQL (requires service role)
      const res = await fetch(`${SUPABASE_URL}/pg`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'apikey':        SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({ query: sql }),
      })

      if (res.ok) {
        results[table].created = true
      } else {
        // /pg not available — fallback message
        results[table].created = false
        results[table].note = 'Run RUN_THIS_NOW_consolidated.sql in Supabase SQL Editor'
      }
    }
  }

  return NextResponse.json({ results, timestamp: new Date().toISOString() })
}

export const POST = GET
