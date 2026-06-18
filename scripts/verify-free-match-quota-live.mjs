#!/usr/bin/env node

import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

function loadDotEnv(file) {
  if (!existsSync(file)) return
  const text = readFileSync(file, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
    const index = trimmed.indexOf('=')
    const key = trimmed.slice(0, index).trim()
    let value = trimmed.slice(index + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (key && process.env[key] == null) process.env[key] = value
  }
}

loadDotEnv('.env.local')
loadDotEnv('.env')

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const anonKey = process.env.PUBLIC_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const runId = randomUUID().slice(0, 8)
const shortRunId = runId.slice(0, 5).toUpperCase()
const password = `PitchNote-${randomUUID()}!`
const quotaError = 'Free accounts can save 2 matches'
const missingCompositeKeyError = 'there is no unique or exclusion constraint matching'
const failures = []
const created = {
  users: [],
  clubs: [],
  teams: [],
  matches: [],
  clubMembers: [],
  teamMembers: [],
  subscriptionUserIds: [],
  profileIds: [],
}

function pass(message) {
  console.log(`ok - ${message}`)
}

function fail(message) {
  failures.push(message)
  console.error(`fail - ${message}`)
}

function requireEnv(name, value) {
  if (!value) {
    console.error(`Missing ${name}`)
    process.exit(1)
  }
}

requireEnv('PUBLIC_SUPABASE_URL or SUPABASE_URL', supabaseUrl)
requireEnv('PUBLIC_SUPABASE_ANON_KEY', anonKey)
requireEnv('SUPABASE_SERVICE_ROLE_KEY', serviceKey)

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function anonClient() {
  return createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function createUser(label) {
  const email = `pitchnote-quota-${label}-${runId}@example.com`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { purpose: 'free_match_quota_live_check' },
  })
  if (error) throw error
  created.users.push(data.user.id)

  const client = anonClient()
  const signIn = await client.auth.signInWithPassword({ email, password })
  if (signIn.error) throw signIn.error
  return { id: data.user.id, email, client }
}

async function insert(table, payload) {
  const { data, error } = await admin.from(table).insert(payload).select().single()
  if (error) throw error
  return data
}

async function upsert(table, payload, onConflict) {
  const { data, error } = await admin.from(table).upsert(payload, { onConflict }).select().single()
  if (error) throw error
  return data
}

function trackMatch(payload) {
  if (
    !created.matches.some((match) => match.id === payload.id && match.user_id === payload.user_id)
  ) {
    created.matches.push({ id: payload.id, user_id: payload.user_id })
  }
}

function explainWriteError(error) {
  if (error?.message?.includes(missingCompositeKeyError)) {
    return `${error.message}; apply supabase/migrations/20260617_team_scoped_data_and_rls.sql and supabase/migrations/20260617_team_scoped_policy_reset.sql before rerunning live checks`
  }
  return error?.message
}

async function expectMatchInsert(client, payload, shouldPass, message, options = {}) {
  const write =
    options.mode === 'upsert'
      ? client.from('matches').upsert(payload, { onConflict: 'id,user_id' })
      : client.from('matches').insert(payload)
  const { data, error } = await write.select('id').single()
  if (shouldPass && !error) {
    trackMatch(payload)
    pass(message)
    return
  }
  if (!shouldPass && error) {
    if (!options.expectedError || error.message.includes(options.expectedError)) {
      pass(message)
    } else {
      fail(`${message}: expected "${options.expectedError}", got "${explainWriteError(error)}"`)
    }
    return
  }
  if (data) trackMatch(payload)
  fail(
    `${message}: ${
      shouldPass
        ? explainWriteError(error)
        : 'write unexpectedly succeeded; apply supabase/migrations/20260618_free_match_quota.sql and rerun npm run free-quota:check:live'
    }`,
  )
}

function matchPayload(user, index, teamId = null) {
  return {
    id: `quota-${runId}-${user.id.slice(0, 6)}-${index}`,
    user_id: user.id,
    team_id: teamId,
    data: {
      opposition: `Quota ${index}`,
      teamId,
      updated_at: Date.now(),
    },
  }
}

async function createSubscription(user, plan, clubId = null) {
  await upsert(
    'subscriptions',
    {
      user_id: user.id,
      club_id: clubId,
      plan,
      status: 'active',
      seat_limit: 999,
      custom_features: {},
    },
    'user_id',
  )
  created.subscriptionUserIds.push(user.id)
}

async function cleanup() {
  const errors = []
  async function remove(label, fn) {
    try {
      await fn()
    } catch (error) {
      errors.push(`${label}: ${error.message}`)
    }
  }

  await remove('matches', async () => {
    for (const match of created.matches) {
      await admin.from('matches').delete().eq('id', match.id).eq('user_id', match.user_id)
    }
  })
  await remove('team_members', async () => {
    for (const member of created.teamMembers) {
      await admin
        .from('team_members')
        .delete()
        .eq('team_id', member.team_id)
        .eq('user_id', member.user_id)
    }
  })
  await remove('club_members', async () => {
    for (const member of created.clubMembers) {
      await admin
        .from('club_members')
        .delete()
        .eq('club_id', member.club_id)
        .eq('user_id', member.user_id)
    }
  })
  await remove('subscriptions', async () => {
    if (created.subscriptionUserIds.length) {
      await admin.from('subscriptions').delete().in('user_id', created.subscriptionUserIds)
    }
  })
  await remove('profiles', async () => {
    if (created.profileIds.length)
      await admin.from('profiles').delete().in('id', created.profileIds)
  })
  await remove('teams', async () => {
    if (created.teams.length) await admin.from('teams').delete().in('id', created.teams)
  })
  await remove('clubs', async () => {
    if (created.clubs.length) await admin.from('clubs').delete().in('id', created.clubs)
  })
  await remove('users', async () => {
    for (const userId of created.users) await admin.auth.admin.deleteUser(userId)
  })

  if (errors.length) {
    console.error('')
    console.error('Cleanup had errors:')
    for (const error of errors) console.error(`- ${error}`)
    console.error(`Created IDs: ${JSON.stringify(created, null, 2)}`)
    process.exitCode = 1
  }
}

try {
  const freeUser = await createUser('free')
  const proUser = await createUser('pro')
  const clubOwner = await createUser('owner')
  const clubCoach = await createUser('coach')

  await createSubscription(freeUser, 'free')
  await createSubscription(proUser, 'personal')

  const freeMatchOne = matchPayload(freeUser, 1)
  const freeMatchTwo = matchPayload(freeUser, 2)
  const freeMatchThree = matchPayload(freeUser, 3)

  await expectMatchInsert(
    freeUser.client,
    freeMatchOne,
    true,
    'free account can save first cloud match',
  )
  await expectMatchInsert(
    freeUser.client,
    freeMatchTwo,
    true,
    'free account can save second cloud match',
  )
  await expectMatchInsert(
    freeUser.client,
    {
      ...freeMatchOne,
      data: { ...freeMatchOne.data, opposition: 'Quota Existing Update', updated_at: Date.now() },
    },
    true,
    'free account can sync-upsert an existing cloud match',
    { mode: 'upsert' },
  )
  await expectMatchInsert(
    freeUser.client,
    freeMatchThree,
    false,
    'free account cannot sync-upsert a third cloud match',
    { expectedError: quotaError, mode: 'upsert' },
  )

  await expectMatchInsert(
    proUser.client,
    matchPayload(proUser, 1),
    true,
    'paid account can save first cloud match',
  )
  await expectMatchInsert(
    proUser.client,
    matchPayload(proUser, 2),
    true,
    'paid account can save second cloud match',
  )
  await expectMatchInsert(
    proUser.client,
    matchPayload(proUser, 3),
    true,
    'paid account can save third cloud match',
  )

  const club = await insert('clubs', {
    name: `PitchNote Quota ${runId}`,
    code: `PQ${runId.toUpperCase()}`.slice(0, 8),
    owner_id: clubOwner.id,
  })
  created.clubs.push(club.id)
  const team = await insert('teams', {
    club_id: club.id,
    name: `Quota Team ${runId}`,
    code: `Q${shortRunId}`.slice(0, 6),
  })
  created.teams.push(team.id)

  await createSubscription(clubOwner, 'club', club.id)
  await insert('club_members', { club_id: club.id, user_id: clubOwner.id, role: 'owner' })
  created.clubMembers.push({ club_id: club.id, user_id: clubOwner.id })
  await insert('club_members', { club_id: club.id, user_id: clubCoach.id, role: 'coach' })
  created.clubMembers.push({ club_id: club.id, user_id: clubCoach.id })
  await insert('team_members', {
    club_id: club.id,
    team_id: team.id,
    user_id: clubCoach.id,
    role: 'coach',
  })
  created.teamMembers.push({ team_id: team.id, user_id: clubCoach.id })
  await upsert('profiles', { id: clubOwner.id, club_id: club.id }, 'id')
  created.profileIds.push(clubOwner.id)
  await upsert('profiles', { id: clubCoach.id, club_id: club.id }, 'id')
  created.profileIds.push(clubCoach.id)

  await expectMatchInsert(
    clubCoach.client,
    matchPayload(clubCoach, 1, team.id),
    true,
    'club coach can save first club-entitled match',
  )
  await expectMatchInsert(
    clubCoach.client,
    matchPayload(clubCoach, 2, team.id),
    true,
    'club coach can save second club-entitled match',
  )
  await expectMatchInsert(
    clubCoach.client,
    matchPayload(clubCoach, 3, team.id),
    true,
    'club coach can save third club-entitled match',
  )
} catch (error) {
  fail(error.message)
} finally {
  await cleanup()
}

if (failures.length) {
  console.error('')
  console.error('Free-match quota live verification failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('')
console.log('Free-match quota live verification passed.')
