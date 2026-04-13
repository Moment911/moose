ALTER TABLE koto_front_desk_configs ADD COLUMN IF NOT EXISTS sendable_links jsonb DEFAULT '[]'::jsonb;
ALTER TABLE koto_front_desk_configs ADD COLUMN IF NOT EXISTS gmb_url text;
