CREATE TABLE IF NOT EXISTS koto_proof_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  file_id uuid,
  signer_name text NOT NULL,
  signer_email text,
  signer_ip text,
  signature_data text,
  approval_type text DEFAULT 'approve',
  notes text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_proof_approvals_project ON koto_proof_approvals(project_id);
CREATE INDEX IF NOT EXISTS idx_proof_approvals_file ON koto_proof_approvals(file_id);
ALTER TABLE koto_proof_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "proof_approvals_all" ON koto_proof_approvals FOR ALL USING (true) WITH CHECK (true);
