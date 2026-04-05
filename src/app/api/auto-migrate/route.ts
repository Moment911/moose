import { NextResponse } from 'next/server'

const SUPABASE_URL    = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SERVICE_KEY     = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const ACCESS_TOKEN    = process.env.SUPABASE_ACCESS_TOKEN || ''  // from app.supabase.com/account/tokens

// Extract project ref from URL: https://xyz.supabase.co → xyz
const PROJECT_REF = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || ''

// Run SQL via Supabase Management API (requires SUPABASE_ACCESS_TOKEN)
async function runSQLViaManagementAPI(sql: string) {
  if (!ACCESS_TOKEN || !PROJECT_REF) return { ok: false, reason: 'no_token' }
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ query: sql }),
  })
  return { ok: res.ok, status: res.status, body: await res.text() }
}

// Check if a table exists via REST API
async function tableExists(name: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${name}?select=count&limit=0`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
  })
  return res.ok
}

const ALL_TABLES = [
  'perf_snapshots','perf_campaigns','perf_keywords','perf_recommendations',
  'perf_alerts','perf_pages','perf_execution_log','perf_ad_groups','perf_ads','perf_search_terms',
  'local_rank_scans','local_rank_grid_scans','reviews','client_portal_sessions','subscriptions',
  'seo_keyword_tracking','seo_connections','seo_reports','wp_seo_sites',
]

// The full SQL to create everything
const FULL_SQL = `
CREATE TABLE IF NOT EXISTS perf_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  agency_id uuid, snapshot_date date NOT NULL,
  spend numeric DEFAULT 0, impressions int DEFAULT 0, clicks int DEFAULT 0,
  conversions numeric DEFAULT 0, revenue numeric DEFAULT 0,
  roas numeric, cpc numeric, ctr numeric, cpa numeric,
  organic_sessions int DEFAULT 0, organic_clicks int DEFAULT 0,
  gsc_impressions int DEFAULT 0, gmb_searches int DEFAULT 0, gmb_views int DEFAULT 0,
  source text DEFAULT 'manual', created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_perf_snapshots_client ON perf_snapshots(client_id);
CREATE INDEX IF NOT EXISTS idx_perf_snapshots_date ON perf_snapshots(client_id, snapshot_date DESC);
CREATE TABLE IF NOT EXISTS perf_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  campaign_id text, campaign_name text, status text DEFAULT 'enabled',
  budget_amount numeric, channel text DEFAULT 'google_ads',
  spend numeric DEFAULT 0, impressions int DEFAULT 0, clicks int DEFAULT 0,
  conversions numeric DEFAULT 0, roas numeric, cpc numeric, ctr numeric,
  last_synced_at timestamptz, created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_perf_campaigns_client ON perf_campaigns(client_id);
CREATE TABLE IF NOT EXISTS perf_keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  campaign_id text, keyword_text text, match_type text DEFAULT 'broad',
  status text DEFAULT 'enabled', quality_score int,
  spend numeric DEFAULT 0, impressions int DEFAULT 0, clicks int DEFAULT 0,
  conversions numeric DEFAULT 0, cpc numeric, ctr numeric,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_perf_keywords_client ON perf_keywords(client_id);
CREATE TABLE IF NOT EXISTS perf_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  type text, title text, description text, impact text,
  priority text DEFAULT 'medium', status text DEFAULT 'pending',
  estimated_value numeric, applied_at timestamptz, dismissed_at timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_perf_recs_client ON perf_recommendations(client_id);
CREATE TABLE IF NOT EXISTS perf_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  type text, message text, severity text DEFAULT 'info',
  metric text, current_value numeric, threshold_value numeric,
  is_read boolean DEFAULT false, created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_perf_alerts_client ON perf_alerts(client_id);
CREATE TABLE IF NOT EXISTS perf_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  url text, title text, ai_score int,
  organic_clicks int DEFAULT 0, impressions int DEFAULT 0,
  avg_position numeric, recommendations jsonb DEFAULT '[]',
  analyzed_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_perf_pages_client ON perf_pages(client_id);
CREATE TABLE IF NOT EXISTS perf_execution_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  action text, status text DEFAULT 'success',
  details jsonb DEFAULT '{}', applied_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_perf_exec_client ON perf_execution_log(client_id);
CREATE TABLE IF NOT EXISTS perf_ad_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  campaign_id text, ad_group_id text, ad_group_name text,
  status text DEFAULT 'enabled', spend numeric DEFAULT 0,
  impressions int DEFAULT 0, clicks int DEFAULT 0, conversions numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS perf_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  campaign_id text, ad_id text, headline_1 text, headline_2 text,
  description_1 text, final_url text, status text DEFAULT 'enabled',
  impressions int DEFAULT 0, clicks int DEFAULT 0, conversions numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS perf_search_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  campaign_id text, search_term text, match_type text,
  impressions int DEFAULT 0, clicks int DEFAULT 0, spend numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS local_rank_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  agency_id uuid, keyword text NOT NULL, location text NOT NULL,
  target_business text, radius_km int DEFAULT 16, target_rank int,
  total_results int DEFAULT 0, results jsonb DEFAULT '[]',
  ai_analysis jsonb DEFAULT '{}', scanned_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rank_scans_client ON local_rank_scans(client_id);
CREATE TABLE IF NOT EXISTS local_rank_grid_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  agency_id uuid, keyword text NOT NULL, center_location text NOT NULL,
  center_lat numeric, center_lng numeric, target_business text,
  grid_size int DEFAULT 3, grid_spacing_km numeric DEFAULT 1.5,
  grid_results jsonb DEFAULT '[]', avg_rank numeric,
  best_rank int, worst_rank int, ranked_cells int, total_cells int,
  scanned_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_grid_scans_client ON local_rank_grid_scans(client_id);
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  agency_id uuid, platform text NOT NULL DEFAULT 'google',
  reviewer_name text, reviewer_photo text, rating int,
  review_text text, review_date timestamptz, review_id text,
  response_text text, responded_at timestamptz,
  ai_response text, sentiment text, is_responded boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reviews_client ON reviews(client_id);
CREATE TABLE IF NOT EXISTS client_portal_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  agency_id uuid, token text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  email text, name text,
  expires_at timestamptz DEFAULT now() + interval '30 days',
  last_accessed_at timestamptz, created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_portal_token ON client_portal_sessions(token);
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid REFERENCES agencies(id) ON DELETE CASCADE,
  stripe_customer_id text, stripe_subscription_id text,
  plan text DEFAULT 'starter', status text DEFAULT 'trialing',
  current_period_start timestamptz, current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS google_place_id text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS google_rating numeric;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS google_review_count int;
`

export async function GET() {
  // Check which tables already exist
  const tableStatus: Record<string, boolean> = {}
  for (const t of ALL_TABLES) {
    tableStatus[t] = await tableExists(t)
  }
  const missing = Object.entries(tableStatus).filter(([,v]) => !v).map(([k]) => k)

  if (missing.length === 0) {
    return NextResponse.json({ status: 'all_ready', message: 'All tables exist', tables: tableStatus })
  }

  // Try Management API if token available
  if (ACCESS_TOKEN && PROJECT_REF) {
    const result = await runSQLViaManagementAPI(FULL_SQL)
    if (result.ok) {
      return NextResponse.json({ 
        status: 'migrated', 
        message: `Created ${missing.length} missing tables via Management API`,
        missing_before: missing,
      })
    }
  }

  // No token — return status so UI can show instructions
  return NextResponse.json({
    status: 'needs_migration',
    missing,
    total_missing: missing.length,
    has_token: !!ACCESS_TOKEN,
    project_ref: PROJECT_REF,
    instructions: ACCESS_TOKEN 
      ? 'Management API call failed — check SUPABASE_ACCESS_TOKEN'
      : 'Add SUPABASE_ACCESS_TOKEN to Vercel env vars to enable auto-migration. Get it from app.supabase.com/account/tokens',
    supabase_sql_url: PROJECT_REF 
      ? `https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new`
      : 'https://supabase.com/dashboard',
  })
}

export const POST = GET
