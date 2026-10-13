-- Run this in the Supabase SQL editor after 001-003. It is safe to run more than once.

-- The pump now starts when the tank falls below 65% (it was 75%) and still stops at 95%.
alter table public.control_state alter column pump_on_threshold set default 65;

-- Move an untouched setting to the new level. A level the admin chose is left alone.
update public.control_state set pump_on_threshold = 65 where pump_on_threshold = 75;
