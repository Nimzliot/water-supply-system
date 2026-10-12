create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'user')),
  name text not null,
  email text not null unique,
  mobile text,
  password_hash text,
  address text,
  family_members integer default 1,
  service_number text unique not null,
  device_id text unique,
  created_at timestamptz not null default now()
);

create table if not exists public.water_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  flow_sensor_id text not null,
  liters_used numeric(12,2) not null default 0,
  lpcd_used numeric(12,2) not null default 0,
  timestamp timestamptz not null default now()
);

create table if not exists public.tank_status (
  id uuid primary key default gen_random_uuid(),
  tank_percentage numeric(5,2) not null default 0,
  water_level numeric(10,2) not null default 0,
  pump_status boolean not null default false,
  lpcd_limit numeric(10,2) not null default 135,
  timestamp timestamptz not null default now()
);

create table if not exists public.valve_status (
  id uuid primary key default gen_random_uuid(),
  valve_name text not null,
  status boolean not null default false,
  timestamp timestamptz not null default now()
);

create table if not exists public.leakage_alerts (
  id uuid primary key default gen_random_uuid(),
  affected_house text not null,
  severity text not null check (severity in ('low', 'medium', 'high')),
  detected_at timestamptz not null default now(),
  resolved boolean not null default false
);

create table if not exists public.billing (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  month text not null,
  total_usage numeric(12,2) not null default 0,
  tariff numeric(10,4) not null default 0.02,
  total_amount numeric(12,2) generated always as (total_usage * tariff) stored,
  paid_status boolean not null default false
);

create table if not exists public.lpcd_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  requested_extra_liters numeric(10,2) not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  required_date date,
  requested_date timestamptz not null default now()
);

create table if not exists public.distribution_schedules (
  id uuid primary key default gen_random_uuid(),
  zone_name text not null,
  start_time text not null,
  end_time text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.device_status (
  device_key text primary key,
  service_number text,
  scope text not null check (scope in ('admin', 'user')),
  device_label text not null,
  status text not null default 'offline',
  wifi_rssi integer,
  heartbeat_interval_seconds integer not null default 15,
  last_seen_at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb
);

create table if not exists public.water_quality (
  id uuid primary key default gen_random_uuid(),
  tds_value numeric(10,2) not null,
  ph_value numeric(5,2) not null,
  turbidity_value numeric(10,2) not null,
  is_safe boolean not null,
  timestamp timestamptz not null default now()
);

-- Single row holding what the admin has commanded. tank_status.pump_status is what the device reports.
create table if not exists public.control_state (
  id integer primary key default 1 check (id = 1),
  pump_mode text not null default 'auto' check (pump_mode in ('auto', 'on', 'off')),
  -- auto: the controller runs its cycle. manual: pump and valves follow the dashboard switches.
  control_mode text not null default 'auto' check (control_mode in ('auto', 'manual')),
  tariff numeric(10,4) not null default 0.02,
  pump_on_threshold numeric(5,2) not null default 75,
  pump_off_threshold numeric(5,2) not null default 95,
  updated_at timestamptz not null default now()
);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  subject text not null,
  message text not null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  admin_reply text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists water_usage_user_time_idx on public.water_usage (user_id, timestamp desc);
create index if not exists water_usage_time_idx on public.water_usage (timestamp desc);
create index if not exists tank_status_time_idx on public.tank_status (timestamp desc);
create index if not exists valve_status_time_idx on public.valve_status (timestamp desc);
create index if not exists water_quality_time_idx on public.water_quality (timestamp desc);

-- Policies on public.users cannot query public.users directly (infinite recursion),
-- so the admin check runs through a security definer function.
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

alter table public.control_state enable row level security;
alter table public.support_tickets enable row level security;

drop policy if exists "Users view own support tickets" on public.support_tickets;
create policy "Users view own support tickets"
on public.support_tickets for select
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Users create own support tickets" on public.support_tickets;
create policy "Users create own support tickets"
on public.support_tickets for insert
with check (user_id = auth.uid());

drop policy if exists "Admins manage support tickets" on public.support_tickets;
create policy "Admins manage support tickets"
on public.support_tickets for update
using (public.is_admin());
alter table public.users enable row level security;
alter table public.water_usage enable row level security;
alter table public.tank_status enable row level security;
alter table public.valve_status enable row level security;
alter table public.leakage_alerts enable row level security;
alter table public.billing enable row level security;
alter table public.lpcd_requests enable row level security;
alter table public.distribution_schedules enable row level security;
alter table public.device_status enable row level security;
alter table public.water_quality enable row level security;

drop policy if exists "Users can view own profile" on public.users;
create policy "Users can view own profile"
on public.users for select
using (auth.uid() = id);

drop policy if exists "Admins can view all users" on public.users;
create policy "Admins can view all users"
on public.users for select
using (
  public.is_admin()
);

drop policy if exists "Users can view own water usage" on public.water_usage;
create policy "Users can view own water usage"
on public.water_usage for select
using (
  user_id = auth.uid()
  or public.is_admin()
);

drop policy if exists "Users can view own bills" on public.billing;
create policy "Users can view own bills"
on public.billing for select
using (
  user_id = auth.uid()
  or public.is_admin()
);

drop policy if exists "Users can create own LPCD requests" on public.lpcd_requests;
create policy "Users can create own LPCD requests"
on public.lpcd_requests for insert
with check (user_id = auth.uid());

drop policy if exists "Users can view own LPCD requests" on public.lpcd_requests;
create policy "Users can view own LPCD requests"
on public.lpcd_requests for select
using (
  user_id = auth.uid()
  or public.is_admin()
);

drop policy if exists "Admins manage LPCD requests" on public.lpcd_requests;
create policy "Admins manage LPCD requests"
on public.lpcd_requests for update
using (
  public.is_admin()
);

drop policy if exists "Authenticated users view tank status" on public.tank_status;
create policy "Authenticated users view tank status"
on public.tank_status for select
using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users view valve status" on public.valve_status;
create policy "Authenticated users view valve status"
on public.valve_status for select
using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users view leakage alerts" on public.leakage_alerts;
create policy "Authenticated users view leakage alerts"
on public.leakage_alerts for select
using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users view schedules" on public.distribution_schedules;
create policy "Authenticated users view schedules"
on public.distribution_schedules for select
using (auth.role() = 'authenticated');

drop policy if exists "Admins view all device status" on public.device_status;
create policy "Admins view all device status"
on public.device_status for select
using (
  public.is_admin()
);

drop policy if exists "Users view own device status" on public.device_status;
create policy "Users view own device status"
on public.device_status for select
using (
  exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.service_number = device_status.service_number
  )
);

drop policy if exists "Admins view water quality" on public.water_quality;
create policy "Admins view water quality"
on public.water_quality for select
using (
  public.is_admin()
);

insert into public.control_state (id) values (1)
on conflict (id) do nothing;

-- Valve names must match the ones the ESP32 firmware looks for in /api/esp32/commands.
-- A valve that is "open" here is enabled; the firmware still only opens it during distribution.
insert into public.valve_status (valve_name, status)
select v.valve_name, true
from (values ('Main Distribution Valve'), ('House 1 Intake Valve'), ('House 2 Intake Valve')) as v(valve_name)
where not exists (select 1 from public.valve_status s where s.valve_name = v.valve_name);

insert into public.tank_status (tank_percentage, water_level, pump_status, lpcd_limit)
select 0, 0, false, 135
where not exists (select 1 from public.tank_status);

insert into public.distribution_schedules (zone_name, start_time, end_time, is_active)
select s.zone_name, s.start_time, s.end_time, true
from (values ('Morning Distribution', '06:00', '08:00'), ('Evening Distribution', '18:00', '20:00')) as s(zone_name, start_time, end_time)
where not exists (select 1 from public.distribution_schedules);

insert into public.device_status (device_key, service_number, scope, device_label, status, heartbeat_interval_seconds, meta)
values
  ('SYSTEM-ESP32', null, 'admin', 'Village Controller ESP32', 'offline', 15, '{"component":"control-room"}'::jsonb),
  ('SRV-001', 'SRV-001', 'user', 'Household Device SRV-001', 'offline', 60, '{"component":"household"}'::jsonb),
  ('SRV-002', 'SRV-002', 'user', 'Household Device SRV-002', 'offline', 60, '{"component":"household"}'::jsonb)
on conflict (device_key) do nothing;
