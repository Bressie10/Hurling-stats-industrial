#!/usr/bin/env node

import { spawnSync } from 'node:child_process'

const migrations = [
  'supabase/migrations/20260617000200_team_scoped_data_and_rls.sql',
  'supabase/migrations/20260617000300_team_scoped_policy_reset.sql',
  'supabase/migrations/20260618_free_match_quota.sql',
  'supabase/migrations/20260619_team_players_canonical.sql',
  'supabase/migrations/20260620_gps_cloud_foundation.sql',
  'supabase/migrations/20260621_gps_privacy_hardening.sql',
]

for (const migration of migrations) {
  console.log(`Applying ${migration}`)
  const result = spawnSync(process.execPath, ['scripts/apply-supabase-migration.mjs', migration], {
    stdio: 'inherit',
    env: process.env,
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

console.log('Applied release-required Supabase migrations.')
