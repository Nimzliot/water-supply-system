-- Run this in the Supabase SQL editor after 001 and 002. It is safe to run more than once.

-- Who decides when the pump and valves switch:
--   auto   - the controller runs its cycle (schedules, tank level, daily limits)
--   manual - the pump and every valve follow the dashboard switches directly
alter table public.control_state
  add column if not exists control_mode text not null default 'auto';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'control_state_control_mode_check') then
    alter table public.control_state
      add constraint control_state_control_mode_check check (control_mode in ('auto', 'manual'));
  end if;
end $$;
