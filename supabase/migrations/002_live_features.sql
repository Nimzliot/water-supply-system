-- Run this in the Supabase SQL editor after 001_control_state.sql.
-- It is safe to run more than once. New projects only need schema.sql.

-- 1. System settings the admin edits and the ESP32 reads.
alter table public.control_state add column if not exists tariff numeric(10,4) not null default 0.02;
alter table public.control_state add column if not exists pump_on_threshold numeric(5,2) not null default 75;
alter table public.control_state add column if not exists pump_off_threshold numeric(5,2) not null default 95;

-- 2. The day an extra-water request is for. An approved request raises that household's
--    limit on this date only.
alter table public.lpcd_requests add column if not exists required_date date;

-- 3. Household complaints and the admin's reply.
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

-- 4. The dashboards read the newest rows of these tables constantly.
create index if not exists water_usage_user_time_idx on public.water_usage (user_id, timestamp desc);
create index if not exists water_usage_time_idx on public.water_usage (timestamp desc);
create index if not exists tank_status_time_idx on public.tank_status (timestamp desc);
create index if not exists valve_status_time_idx on public.valve_status (timestamp desc);
create index if not exists water_quality_time_idx on public.water_quality (timestamp desc);
