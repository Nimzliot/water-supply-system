-- Run this in the Supabase SQL editor after 001-005. It is safe to run more than once.

-- Which days of the week a supply window runs on. One bit per day: 1 = Sunday, 2 = Monday,
-- 4 = Tuesday, 8 = Wednesday, 16 = Thursday, 32 = Friday, 64 = Saturday. 127 = every day.
alter table public.distribution_schedules
  add column if not exists days_mask smallint not null default 127;

-- Which houses the window supplies.
alter table public.distribution_schedules
  add column if not exists target text not null default 'all';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'distribution_schedules_target_check') then
    alter table public.distribution_schedules
      add constraint distribution_schedules_target_check check (target in ('all', 'house1', 'house2'));
  end if;
end $$;
