-- Run this once in the Supabase SQL editor on a database created from the older schema.sql.
-- It is safe to run more than once. New projects only need schema.sql.

-- 1. Admin pump command, kept apart from the pump state the device reports.
create table if not exists public.control_state (
  id integer primary key default 1 check (id = 1),
  pump_mode text not null default 'auto' check (pump_mode in ('auto', 'on', 'off')),
  updated_at timestamptz not null default now()
);

insert into public.control_state (id) values (1)
on conflict (id) do nothing;

alter table public.control_state enable row level security;

-- 2. Valves the ESP32 firmware listens for. Existing valves keep their current state.
insert into public.valve_status (valve_name, status)
select v.valve_name, true
from (values ('Main Distribution Valve'), ('House 1 Intake Valve'), ('House 2 Intake Valve')) as v(valve_name)
where not exists (select 1 from public.valve_status s where s.valve_name = v.valve_name);

-- Optional: the old seed valves are not wired to any relay. Uncomment to remove them from the dashboard.
-- delete from public.valve_status where valve_name in ('Street Zone A', 'Street Zone B');

-- 3. Admin policies queried public.users from inside a policy on public.users, which Postgres
--    rejects as infinite recursion for any non-service-role client.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'admin'
  );
$$;

drop policy if exists "Admins can view all users" on public.users;
create policy "Admins can view all users"
on public.users for select
using (public.is_admin());

drop policy if exists "Users can view own water usage" on public.water_usage;
create policy "Users can view own water usage"
on public.water_usage for select
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Users can view own bills" on public.billing;
create policy "Users can view own bills"
on public.billing for select
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Users can view own LPCD requests" on public.lpcd_requests;
create policy "Users can view own LPCD requests"
on public.lpcd_requests for select
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Admins manage LPCD requests" on public.lpcd_requests;
create policy "Admins manage LPCD requests"
on public.lpcd_requests for update
using (public.is_admin());

drop policy if exists "Admins view all device status" on public.device_status;
create policy "Admins view all device status"
on public.device_status for select
using (public.is_admin());

drop policy if exists "Admins view water quality" on public.water_quality;
create policy "Admins view water quality"
on public.water_quality for select
using (public.is_admin());
