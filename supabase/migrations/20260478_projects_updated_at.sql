-- ProofListPage orders by updated_at but the column didn't exist,
-- causing a silent Supabase error that returned 0 rows.
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
UPDATE public.projects SET updated_at = created_at WHERE updated_at IS NULL;
