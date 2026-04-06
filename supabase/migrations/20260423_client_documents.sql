-- Custom document categories per agency (created first for FK reference)
CREATE TABLE IF NOT EXISTS document_categories (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id       uuid REFERENCES agencies(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  icon            text DEFAULT '📄',
  sort_order      int DEFAULT 0,
  is_system       boolean DEFAULT false,
  created_at      timestamptz DEFAULT now()
);

-- Client document repository
CREATE TABLE IF NOT EXISTS client_documents (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id       uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  agency_id       uuid REFERENCES agencies(id) ON DELETE CASCADE,
  category_id     uuid REFERENCES document_categories(id) ON DELETE SET NULL,
  label           text NOT NULL,
  description     text,
  file_name       text NOT NULL,
  file_type       text,
  file_size       bigint,
  storage_path    text NOT NULL,
  public_url      text,
  is_sensitive     boolean DEFAULT false,
  tags            text[] DEFAULT '{}',
  uploaded_by     text,
  uploaded_by_email text,
  metadata        jsonb DEFAULT '{}',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Seed default categories
INSERT INTO document_categories (agency_id, name, description, icon, sort_order, is_system) VALUES
  (NULL, 'Tax & Legal', 'CP575, EIN letters, business licenses, incorporation docs', '📋', 1, true),
  (NULL, 'Google Verification', 'Google Ads verification, A2P registration, identity docs', '🔐', 2, true),
  (NULL, 'Brand Assets', 'Logos, brand guides, color palettes, fonts', '🎨', 3, true),
  (NULL, 'Print & Collateral', 'Business cards, brochures, flyers, signage', '🖨️', 4, true),
  (NULL, 'Media & Photos', 'Product photos, headshots, office photos, videos', '📸', 5, true),
  (NULL, 'Contracts & Agreements', 'Service agreements, NDAs, vendor contracts', '📝', 6, true),
  (NULL, 'Ad Accounts', 'Account screenshots, billing docs, access credentials', '💳', 7, true),
  (NULL, 'Other', 'Miscellaneous documents', '📎', 99, true)
ON CONFLICT DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_client_docs_client ON client_documents(client_id);
CREATE INDEX IF NOT EXISTS idx_client_docs_agency ON client_documents(agency_id);
CREATE INDEX IF NOT EXISTS idx_client_docs_category ON client_documents(category_id);
CREATE INDEX IF NOT EXISTS idx_doc_categories_agency ON document_categories(agency_id);

-- RLS
ALTER TABLE client_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all_client_documents" ON client_documents;
CREATE POLICY "allow_all_client_documents" ON client_documents FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "allow_all_document_categories" ON document_categories;
CREATE POLICY "allow_all_document_categories" ON document_categories FOR ALL USING (true) WITH CHECK (true);
