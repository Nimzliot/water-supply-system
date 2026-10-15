-- Run this in the Supabase SQL editor after 001-006. It is safe to run more than once.

-- Where the borewell, pump, tank, main valve and houses sit on the Live Map, as set by the admin:
-- { "center": [lat, lng], "zoom": 18, "points": { "borewell": [lat, lng], "pump": [...], ... } }
alter table public.control_state
  add column if not exists map_layout jsonb;
