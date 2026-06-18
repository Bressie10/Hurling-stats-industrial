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
const missingCompositeKeyError = 'there is no unique or exclusion constraint matching'
const failures = []
const created = {
  users: [],
  clubs: [],
  teams: [],
  liveSessions: [],
  matchIds: [],
  squadIds: [],
  clubMemberKeys: [],
  teamMemberKeys: [],
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
  const email = `pitchnote-${label}-${runId}@example.com`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
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

async function expectSelectCount(client, table, filters, expected, message) {
  let query = client.from(table).select('id')
  for (const [column, value] of filters) query = query.eq(column, value)
  const { data, error } = await query
  if (error) {
    fail(`${message}: ${error.message}`)
    return
  }
  if ((data || []).length === expected) pass(message)
  else fail(`${message}: expected ${expected}, got ${(data || []).length}`)
}

async function expectInsert(client, table, payload, shouldPass, message) {
  const { data, error } = await client.from(table).insert(payload).select('id').single()
  if (shouldPass && !error) {
    pass(message)
    return data
  }
  if (!shouldPass && error) {
    pass(message)
    return null
  }
  fail(`${message}: ${shouldPass ? error?.message : 'insert unexpectedly succeeded'}`)
  return data || null
}

async function expectUpsert(client, table, payload, onConflict, shouldPass, message) {
  const { data, error } = await client
    .from(table)
    .upsert(payload, { onConflict })
    .select('id')
    .single()
  if (shouldPass && !error) {
    pass(message)
    return data
  }
  if (!shouldPass && error) {
    pass(message)
    return null
  }
  const detail = error?.message?.includes(missingCompositeKeyError)
    ? `${error.message}; apply supabase/migrations/20260617_team_scoped_data_and_rls.sql and supabase/migrations/20260617_team_scoped_policy_reset.sql`
    : error?.message
  fail(`${message}: ${shouldPass ? detail : 'upsert unexpectedly succeeded'}`)
  return data || null
}

function trackMatch(payload) {
  created.matchIds.push({ id: payload.id, user_id: payload.user_id })
}

function trackSquad(payload) {
  created.squadIds.push({ id: payload.id, user_id: payload.user_id })
}

function trackLiveSession(row) {
  if (row?.id) created.liveSessions.push(row.id)
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

  await remove('live_sessions', async () => {
    if (created.liveSessions.length)
      await admin.from('live_sessions').delete().in('id', created.liveSessions)
  })
  await remove('matches', async () => {
    for (const match of created.matchIds) {
      await admin.from('matches').delete().eq('id', match.id).eq('user_id', match.user_id)
    }
  })
  await remove('squad', async () => {
    for (const squad of created.squadIds) {
      await admin.from('squad').delete().eq('id', squad.id).eq('user_id', squad.user_id)
    }
  })
  await remove('team_members', async () => {
    for (const member of created.teamMemberKeys) {
      await admin
        .from('team_members')
        .delete()
        .eq('team_id', member.team_id)
        .eq('user_id', member.user_id)
    }
  })
  await remove('club_members', async () => {
    for (const member of created.clubMemberKeys) {
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
  const owner = await createUser('owner')
  const coach = await createUser('coach')
  const outsider = await createUser('outsider')

  const club = await insert('clubs', {
    name: `PitchNote RLS ${runId}`,
    code: `PN${runId.toUpperCase()}`.slice(0, 8),
    owner_id: owner.id,
  })
  created.clubs.push(club.id)

  await upsert(
    'subscriptions',
    {
      user_id: owner.id,
      club_id: club.id,
      plan: 'club_pro',
      status: 'active',
      seat_limit: 999,
      custom_features: {},
    },
    'user_id',
  )
  created.subscriptionUserIds.push(owner.id)

  await insert('club_members', { club_id: club.id, user_id: owner.id, role: 'owner' })
  created.clubMemberKeys.push({ club_id: club.id, user_id: owner.id })
  await insert('club_members', { club_id: club.id, user_id: coach.id, role: 'coach' })
  created.clubMemberKeys.push({ club_id: club.id, user_id: coach.id })
  await upsert(
    'profiles',
    {
      id: owner.id,
      club_id: club.id,
    },
    'id',
  )
  created.profileIds.push(owner.id)
  await upsert(
    'profiles',
    {
      id: coach.id,
      club_id: club.id,
    },
    'id',
  )
  created.profileIds.push(coach.id)
  await upsert(
    'profiles',
    {
      id: outsider.id,
    },
    'id',
  )
  created.profileIds.push(outsider.id)

  const teamA = await insert('teams', {
    club_id: club.id,
    name: `Seniors ${runId}`,
    code: `${shortRunId}A`,
  })
  const teamB = await insert('teams', {
    club_id: club.id,
    name: `Minors ${runId}`,
    code: `${shortRunId}B`,
  })
  created.teams.push(teamA.id, teamB.id)

  await insert('team_members', {
    club_id: club.id,
    team_id: teamA.id,
    user_id: coach.id,
    role: 'coach',
  })
  created.teamMemberKeys.push({ team_id: teamA.id, user_id: coach.id })

  await expectSelectCount(
    owner.client,
    'teams',
    [['club_id', club.id]],
    2,
    'club owner can read all club teams',
  )
  await expectSelectCount(
    coach.client,
    'teams',
    [['club_id', club.id]],
    1,
    'team coach can read assigned team only',
  )
  await expectSelectCount(
    coach.client,
    'teams',
    [['id', teamA.id]],
    1,
    'team coach can read the assigned team',
  )
  await expectSelectCount(
    coach.client,
    'teams',
    [['id', teamB.id]],
    0,
    'team coach cannot read an unassigned same-club team',
  )
  await expectSelectCount(
    outsider.client,
    'teams',
    [['club_id', club.id]],
    0,
    'outsider cannot read club teams',
  )

  const ownerMatch = {
    id: `rls-owner-${runId}`,
    user_id: owner.id,
    team_id: teamA.id,
    data: { opposition: 'RLS Owner', teamId: teamA.id, updated_at: Date.now() },
  }
  const coachMatch = {
    id: `rls-coach-${runId}`,
    user_id: coach.id,
    team_id: teamA.id,
    data: { opposition: 'RLS Coach', teamId: teamA.id, updated_at: Date.now() },
  }
  const outsiderMatch = {
    id: `rls-outsider-${runId}`,
    user_id: outsider.id,
    team_id: teamA.id,
    data: { opposition: 'RLS Outsider', teamId: teamA.id, updated_at: Date.now() },
  }
  const coachWrongTeamMatch = {
    id: `rls-coach-wrong-team-${runId}`,
    user_id: coach.id,
    team_id: teamB.id,
    data: { opposition: 'RLS Wrong Team', teamId: teamB.id, updated_at: Date.now() },
  }

  if (
    await expectInsert(
      owner.client,
      'matches',
      ownerMatch,
      true,
      'owner can write own team-scoped match',
    )
  ) {
    trackMatch(ownerMatch)
  }
  if (
    await expectUpsert(
      owner.client,
      'matches',
      {
        ...ownerMatch,
        data: { ...ownerMatch.data, opposition: 'RLS Owner Upsert', updated_at: Date.now() },
      },
      'id,user_id',
      true,
      'owner can sync-upsert existing own team-scoped match by id,user_id',
    )
  ) {
    trackMatch(ownerMatch)
  }
  if (
    await expectInsert(
      coach.client,
      'matches',
      coachMatch,
      true,
      'coach can write own assigned-team match',
    )
  ) {
    trackMatch(coachMatch)
  }
  if (
    await expectInsert(
      coach.client,
      'matches',
      coachWrongTeamMatch,
      false,
      'coach cannot tag match to unassigned same-club team',
    )
  ) {
    trackMatch(coachWrongTeamMatch)
  }
  if (
    await expectInsert(
      outsider.client,
      'matches',
      outsiderMatch,
      false,
      'outsider cannot tag match to inaccessible team',
    )
  ) {
    trackMatch(outsiderMatch)
  }
  await expectSelectCount(
    owner.client,
    'matches',
    [['id', coachMatch.id]],
    0,
    'user-owned match rows remain private',
  )

  const coachSquad = {
    id: `${coach.id}:1`,
    user_id: coach.id,
    team_id: teamA.id,
    data: { local_id: 1, name: 'RLS Player', number: 1, teamId: teamA.id, updated_at: Date.now() },
  }
  const coachWrongTeamSquad = {
    id: `${coach.id}:2`,
    user_id: coach.id,
    team_id: teamB.id,
    data: {
      local_id: 2,
      name: 'RLS Blocked Player',
      number: 2,
      teamId: teamB.id,
      updated_at: Date.now(),
    },
  }
  if (
    await expectInsert(
      coach.client,
      'squad',
      coachSquad,
      true,
      'coach can write own team-scoped squad',
    )
  ) {
    trackSquad(coachSquad)
  }
  if (
    await expectInsert(
      coach.client,
      'squad',
      coachWrongTeamSquad,
      false,
      'coach cannot tag squad to unassigned same-club team',
    )
  ) {
    trackSquad(coachWrongTeamSquad)
  }
  await expectSelectCount(
    owner.client,
    'squad',
    [['id', coachSquad.id]],
    0,
    'user-owned squad rows remain private',
  )

  const livePayload = {
    team_id: teamA.id,
    host_user_id: owner.id,
    match_data: {
      opposition: 'Live RLS',
      score: { home: { goals: 0, points: 0 }, away: { goals: 0, points: 0 } },
    },
  }
  const live = await expectInsert(
    owner.client,
    'live_sessions',
    livePayload,
    true,
    'Club Pro owner can start live session',
  )
  trackLiveSession(live)
  await expectSelectCount(
    coach.client,
    'live_sessions',
    [['id', live?.id]],
    1,
    'team member can read live session',
  )
  await expectSelectCount(
    outsider.client,
    'live_sessions',
    [['id', live?.id]],
    0,
    'outsider cannot read live session',
  )

  const outsiderLive = {
    team_id: teamA.id,
    host_user_id: outsider.id,
    match_data: { opposition: 'Blocked Live' },
  }
  const coachWrongTeamLive = {
    team_id: teamB.id,
    host_user_id: coach.id,
    match_data: { opposition: 'Blocked Wrong Team Live' },
  }
  trackLiveSession(
    await expectInsert(
      coach.client,
      'live_sessions',
      coachWrongTeamLive,
      false,
      'coach cannot start live session for unassigned same-club team',
    ),
  )
  trackLiveSession(
    await expectInsert(
      outsider.client,
      'live_sessions',
      outsiderLive,
      false,
      'outsider cannot start live session',
    ),
  )
} catch (error) {
  fail(error.message)
} finally {
  await cleanup()
}

if (failures.length) {
  console.error('')
  console.error(`Team-scope live check failed with ${failures.length} issue(s).`)
  process.exitCode = 1
} else {
  console.log('')
  console.log('Team-scope live check passed')
}
