-- KotoIQ Budget Forecasting — spend projection + pacing alerts

CREATE TABLE IF NOT EXISTS kotoiq_budget_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  agency_id uuid REFERENCES agencies(id) ON DELETE SET NULL,
  forecast_date date NOT NULL DEFAULT CURRENT_DATE,
  horizon_days integer NOT NULL DEFAULT 30,
  ad_spend_projected numeric(12,2),
  ai_cost_projected numeric(10,4),
  api_cost_projected numeric(10,4),
  total_projected numeric(12,2),
  pacing_status text CHECK (pacing_status IN ('on_track','over_pace','under_pace','critical')),
  pacing_detail jsonb DEFAULT '{}',
  breakdown jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  UNIQUE (client_id, forecast_date, horizon_days)
);

CREATE INDEX IF NOT EXISTS idx_budget_forecasts_client ON kotoiq_budget_forecasts(client_id);

ALTER TABLE kotoiq_budget_forecasts ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'kotoiq_budget_forecasts' AND policyname = 'kotoiq_budget_forecasts_all') THEN
    CREATE POLICY kotoiq_budget_forecasts_all ON kotoiq_budget_forecasts FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
