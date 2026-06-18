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
const failures = []
const created = {
  users: [],
  clubs: [],
  teams: [],
  liveSessions: [],
  matches: [],
  squad: [],
  teamMembers: [],
  clubMembers: [],
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
  const email = `pitchnote-delete-${label}-${runId}@example.com`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { purpose: 'account_deletion_live_check' },
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

async function seedAccountGraph(user, label) {
  const club = await insert('clubs', {
    name: `PitchNote Delete ${label} ${runId}`,
    code: `PD${label[0].toUpperCase()}${shortRunId}`.slice(0, 8),
    owner_id: user.id,
  })
  created.clubs.push(club.id)

  const team = await insert('teams', {
    club_id: club.id,
    name: `Delete ${label} ${runId}`,
    code: `${label[0].toUpperCase()}${shortRunId}`.slice(0, 8),
  })
  created.teams.push(team.id)

  await insert('club_members', { club_id: club.id, user_id: user.id, role: 'owner' })
  created.clubMembers.push({ club_id: club.id, user_id: user.id })

  await insert('team_members', {
    club_id: club.id,
    team_id: team.id,
    user_id: user.id,
    role: 'coach',
  })
  created.teamMembers.push({ team_id: team.id, user_id: user.id })

  await upsert('profiles', { id: user.id, club_id: club.id }, 'id')
  created.profileIds.push(user.id)

  await upsert(
    'subscriptions',
    {
      user_id: user.id,
      club_id: club.id,
      plan: 'club_pro',
      status: 'active',
      seat_limit: 999,
      custom_features: {},
    },
    'user_id',
  )
  created.subscriptionUserIds.push(user.id)

  const match = {
    id: `delete-match-${label}-${runId}`,
    user_id: user.id,
    team_id: team.id,
    data: { opposition: `Delete ${label}`, teamId: team.id, updated_at: Date.now() },
  }
  await insert('matches', match)
  created.matches.push({ id: match.id, user_id: user.id })

  const squad = {
    id: `${user.id}:delete-${runId}`,
    user_id: user.id,
    team_id: team.id,
    data: {
      local_id: 1,
      name: `Delete ${label} Player`,
      number: 1,
      teamId: team.id,
      updated_at: Date.now(),
    },
  }
  await insert('squad', squad)
  created.squad.push({ id: squad.id, user_id: user.id })

  const live = await insert('live_sessions', {
    team_id: team.id,
    host_user_id: user.id,
    match_data: {
      opposition: `Delete Live ${label}`,
      score: { home: { goals: 0, points: 0 }, away: { goals: 0, points: 0 } },
    },
  })
  created.liveSessions.push(live.id)

  return { clubId: club.id, teamId: team.id, liveSessionId: live.id, match, squad }
}

async function rowCount(table, filters, select = '*') {
  let query = admin.from(table).select(select, { count: 'exact', head: true })
  for (const [column, value] of filters) query = query.eq(column, value)
  const { count, error } = await query
  if (error) throw error
  return count ?? 0
}

async function expectCount(table, filters, expected, message, select = '*') {
  try {
    const count = await rowCount(table, filters, select)
    if (count === expected) pass(message)
    else fail(`${message}: expected ${expected}, got ${count}`)
  } catch (error) {
    fail(`${message}: ${error.message}`)
  }
}

async function expectAuthUserMissing(userId, message) {
  const { data, error } = await admin.auth.admin.getUserById(userId)
  if (data?.user) {
    fail(`${message}: user still exists`)
    return
  }
  if (error) {
    pass(message)
    return
  }
  pass(message)
}

async function expectAuthUserPresent(userId, message) {
  const { data, error } = await admin.auth.admin.getUserById(userId)
  if (!error && data?.user) pass(message)
  else fail(`${message}: ${error?.message || 'user missing'}`)
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
    for (const match of created.matches) {
      await admin.from('matches').delete().eq('id', match.id).eq('user_id', match.user_id)
    }
  })
  await remove('squad', async () => {
    for (const squad of created.squad) {
      await admin.from('squad').delete().eq('id', squad.id).eq('user_id', squad.user_id)
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
    if (created.subscriptionUserIds.length)
      await admin.from('subscriptions').delete().in('user_id', created.subscriptionUserIds)
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
    for (const userId of created.users) {
      const { error } = await admin.auth.admin.deleteUser(userId)
      if (error && !/not found|does not exist/i.test(error.message)) throw error
    }
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
  const anonymous = anonClient()
  const anonymousDelete = await anonymous.rpc('delete_own_account')
  if (anonymousDelete.error) pass('anonymous users cannot call delete_own_account')
  else fail('anonymous users cannot call delete_own_account: RPC unexpectedly succeeded')

  const target = await createUser('target')
  const control = await createUser('control')
  const targetGraph = await seedAccountGraph(target, 'target')
  const controlGraph = await seedAccountGraph(control, 'control')

  const { error: deleteError } = await target.client.rpc('delete_own_account')
  if (deleteError) throw deleteError
  pass('authenticated user can call delete_own_account for their own account')

  await expectAuthUserMissing(target.id, 'target auth user is deleted')
  await expectCount('profiles', [['id', target.id]], 0, 'target profile is deleted', 'id')
  await expectCount(
    'subscriptions',
    [['user_id', target.id]],
    0,
    'target subscription is deleted',
    'user_id',
  )
  await expectCount(
    'matches',
    [
      ['id', targetGraph.match.id],
      ['user_id', target.id],
    ],
    0,
    'target match rows are deleted',
    'id,user_id',
  )
  await expectCount(
    'squad',
    [
      ['id', targetGraph.squad.id],
      ['user_id', target.id],
    ],
    0,
    'target squad rows are deleted',
    'id,user_id',
  )
  await expectCount(
    'live_sessions',
    [['id', targetGraph.liveSessionId]],
    0,
    'target live sessions are deleted',
    'id',
  )
  await expectCount(
    'teams',
    [['id', targetGraph.teamId]],
    0,
    'target-owned teams are deleted',
    'id',
  )
  await expectCount(
    'clubs',
    [['id', targetGraph.clubId]],
    0,
    'target-owned clubs are deleted',
    'id',
  )

  await expectAuthUserPresent(control.id, 'control auth user remains')
  await expectCount('profiles', [['id', control.id]], 1, 'control profile remains', 'id')
  await expectCount(
    'subscriptions',
    [['user_id', control.id]],
    1,
    'control subscription remains',
    'user_id',
  )
  await expectCount(
    'matches',
    [
      ['id', controlGraph.match.id],
      ['user_id', control.id],
    ],
    1,
    'control match remains',
    'id,user_id',
  )
  await expectCount(
    'squad',
    [
      ['id', controlGraph.squad.id],
      ['user_id', control.id],
    ],
    1,
    'control squad remains',
    'id,user_id',
  )
  await expectCount(
    'live_sessions',
    [['id', controlGraph.liveSessionId]],
    1,
    'control live session remains',
    'id',
  )
  await expectCount('teams', [['id', controlGraph.teamId]], 1, 'control team remains', 'id')
  await expectCount('clubs', [['id', controlGraph.clubId]], 1, 'control club remains', 'id')
} catch (error) {
  fail(error.message)
} finally {
  await cleanup()
}

if (failures.length) {
  console.error('')
  console.error(`Account deletion live check failed with ${failures.length} issue(s).`)
  process.exitCode = 1
} else {
  console.log('')
  console.log('Account deletion live check passed')
}
