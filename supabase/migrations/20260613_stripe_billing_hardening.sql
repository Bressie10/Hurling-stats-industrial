-- Stripe billing sync hardening.
-- Safe to run more than once; it only fills missing columns/indexes.

alter table subscriptions
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists current_period_end timestamptz,
  add column if not exists cancel_at_period_end boolean default false,
  add column if not exists seat_limit integer default 1,
  add column if not exists custom_features jsonb default '{}'::jsonb;

create index if not exists idx_subscriptions_stripe_customer_id
  on subscriptions(stripe_customer_id);

create unique index if not exists subscriptions_stripe_subscription_id_unique
  on subscriptions(stripe_subscription_id)
  where stripe_subscription_id is not null;
