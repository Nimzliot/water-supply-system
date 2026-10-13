-- Run this in the Supabase SQL editor after 001-004. It is safe to run more than once.

-- How and when a bill was paid. Online payments record Razorpay's own references, so a
-- payment can be looked up in the Razorpay dashboard.
alter table public.billing add column if not exists paid_at timestamptz;
alter table public.billing add column if not exists payment_method text;
alter table public.billing add column if not exists payment_id text;
alter table public.billing add column if not exists payment_order_id text;
