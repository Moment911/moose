ALTER TABLE clients ADD COLUMN IF NOT EXISTS google_place_id text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS google_photo_url text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS lat numeric;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS lng numeric;
