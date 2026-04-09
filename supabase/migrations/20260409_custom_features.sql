-- ============================================================
-- Custom features column on subscriptions
-- Allows per-club bespoke feature overrides without code changes.
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS custom_features jsonb;

COMMENT ON COLUMN subscriptions.custom_features IS
  'Per-subscription feature overrides. Keys: isPro, isClub, isClubPro (bool), maxTeams (int). '
  'Set directly in the dashboard for custom-plan customers. '
  'Example: {"isPro": true, "isClub": true, "maxTeams": 8, "liveViewer": true}';
