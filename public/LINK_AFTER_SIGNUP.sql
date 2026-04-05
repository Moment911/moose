-- Run this AFTER creating your account at hellokoto.com/signup
-- Replace the email below if different

INSERT INTO agency_members (agency_id, user_id, role, accepted_at)
SELECT 
  '00000000-0000-0000-0000-000000000099',
  id,
  'owner',
  now()
FROM auth.users 
WHERE email = 'adam@hellokoto.com'
ON CONFLICT (agency_id, user_id) DO NOTHING;

SELECT 
  'Linked ' || email || ' as owner of Koto Agency ✓' as result
FROM auth.users 
WHERE email = 'adam@hellokoto.com';
