-- 1. First create the admin user manually in Supabase Authentication:
--    Authentication -> Users -> Add user
--    Email: your-admin@example.com
--    Password: choose your admin password there
--
-- 2. Copy the UUID of that auth user and replace ADMIN_AUTH_USER_ID below.
-- 3. Run this SQL in the Supabase SQL editor.

insert into public.users (
  id,
  role,
  name,
  email,
  mobile,
  address,
  family_members,
  service_number
) values (
  'ADMIN_AUTH_USER_ID',
  'admin',
  'System Admin',
  'your-admin@example.com',
  '9999999999',
  'Control Room',
  1,
  'ADMIN-CTRL-001'
)
on conflict (id) do update set
  role = excluded.role,
  name = excluded.name,
  email = excluded.email,
  mobile = excluded.mobile,
  address = excluded.address,
  family_members = excluded.family_members,
  service_number = excluded.service_number;

-- After this insert, the admin can access all admin routes because:
-- - the backend checks req.user.role === 'admin'
-- - RLS admin policies allow full read access where defined
