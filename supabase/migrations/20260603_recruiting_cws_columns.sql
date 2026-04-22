-- Add CWS/regional enrichment columns to koto_recruiting_programs.
ALTER TABLE koto_recruiting_programs
  ADD COLUMN IF NOT EXISTS cws_appearances TEXT,
  ADD COLUMN IF NOT EXISTS regional_appearances_5yr INT;
