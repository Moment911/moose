-- Add transfer_number for main call bridging (speak to a person)
ALTER TABLE koto_front_desk_configs ADD COLUMN IF NOT EXISTS transfer_number text;
