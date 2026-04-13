-- SMS template settings for Front Desk
ALTER TABLE koto_front_desk_configs ADD COLUMN IF NOT EXISTS sms_post_call_enabled boolean DEFAULT false;
ALTER TABLE koto_front_desk_configs ADD COLUMN IF NOT EXISTS sms_post_call_template text;
ALTER TABLE koto_front_desk_configs ADD COLUMN IF NOT EXISTS sms_missed_call_enabled boolean DEFAULT false;
ALTER TABLE koto_front_desk_configs ADD COLUMN IF NOT EXISTS sms_missed_call_template text;
