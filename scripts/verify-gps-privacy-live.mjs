#!/usr/bin/env node

import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
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

const runId = randomUUID().slice(0, 8)
const shortRunId = runId.slice(0, 5).toUpperCase()
const password = `PitchNote-Gps-${randomUUID()}!`
const failures = []
const observations = []
const created = {
  users: [],
  clubs: [],
  teams: [],
  teamMembers: [],
  clubMembers: [],
  profiles: [],
  subscriptions: [],
  teamPlayers: [],
  trackers: [],
  sessions: [],
  assignments: [],
  samples: [],
  latest: [],
  summaries: [],
}

function pass(message, detail = '') {
  observations.push({ status: 'ok', message, detail })
  console.log(`ok - ${message}${detail ? ` (${detail})` : ''}`)
}

function fail(message, detail = '') {
  failures.push(`${message}${detail ? `: ${detail}` : ''}`)
  observations.push({ status: 'fail', message, detail })
  console.error(`fail - ${message}${detail ? `: ${detail}` : ''}`)
}

function requireValue(name, value) {
  if (!value) throw new Error(`Missing ${name}`)
}

function readProjectRef() {
  if (process.env.SUPABASE_PROJECT_REF) return process.env.SUPABASE_PROJECT_REF
  if (!existsSync('supabase/.temp/project-ref')) return ''
  return readFileSync('supabase/.temp/project-ref', 'utf8').trim()
}

function loadApiKeysFromCli(projectRef) {
  if (!projectRef) return {}
  const cli = './node_modules/.bin/supabase'
  if (!existsSync(cli)) return {}
  const output = execFileSync(
    cli,
    ['projects', 'api-keys', '--project-ref', projectRef, '--output', 'json'],
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  const keys = JSON.parse(output)
  const anon =
    keys.find((key) => key.id === 'anon') ||
    keys.find((key) => key.name === 'anon') ||
    keys.find((key) => key.type === 'publishable')
  const service =
    keys.find((key) => key.id === 'service_role') ||
    keys.find((key) => key.name === 'service_role') ||
    keys.find((key) => key.secret_jwt_template?.role === 'service_role')

  return {
    anonKey: anon?.api_key?.includes('...') || anon?.api_key?.includes('··') ? '' : anon?.api_key,
    serviceKey:
      service?.api_key?.includes('...') || service?.api_key?.includes('··') ? '' : service?.api_key,
  }
}

function resolveSupabaseConfig() {
  const projectRef = readProjectRef()
  const cliKeys =
    process.env.PUBLIC_SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY
      ? {}
      : loadApiKeysFromCli(projectRef)

  return {
    url:
      process.env.PUBLIC_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      (projectRef ? `https://${projectRef}.supabase.co` : ''),
    anonKey: process.env.PUBLIC_SUPABASE_ANON_KEY || cliKeys.anonKey,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || cliKeys.serviceKey,
    projectRef,
  }
}

const { url: supabaseUrl, anonKey, serviceKey, projectRef } = resolveSupabaseConfig()
requireValue('PUBLIC_SUPABASE_URL or SUPABASE_URL', supabaseUrl)
requireValue('PUBLIC_SUPABASE_ANON_KEY', anonKey)
requireValue('SUPABASE_SERVICE_ROLE_KEY', serviceKey)

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function anonClient() {
  return createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function detailOf(error) {
  if (!error) return ''
  return [error.message, error.details, error.hint].filter(Boolean).join(' | ')
}

function isBlockedError(error) {
  const message = detailOf(error)
  return /row-level security|permission denied|violates foreign key constraint|violates check constraint|duplicate key value|not allowed|Unauthorized/i.test(
    message,
  )
}

async function createUser(label) {
  const email = `pitchnote-gps-${label}-${runId}@example.com`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { purpose: 'gps_privacy_live_check' },
  })
  if (error) throw error
  created.users.push(data.user.id)

  const client = anonClient()
  const signIn = await client.auth.signInWithPassword({ email, password })
  if (signIn.error) throw signIn.error
  return { id: data.user.id, email, client }
}

async function insertAdmin(table, payload, select = '*') {
  const { data, error } = await admin.from(table).insert(payload).select(select).single()
  if (error) throw error
  return data
}

async function upsertAdmin(table, payload, onConflict, select = '*') {
  const { data, error } = await admin
    .from(table)
    .upsert(payload, { onConflict })
    .select(select)
    .single()
  if (error) throw error
  return data
}

async function countAdmin(table, filters, select = '*') {
  let query = admin.from(table).select(select, { count: 'exact', head: true })
  for (const [column, value] of filters) query = query.eq(column, value)
  const { count, error } = await query
  if (error) throw error
  return count ?? 0
}

async function expectAdminCount(table, filters, expected, message, select = '*') {
  try {
    const count = await countAdmin(table, filters, select)
    if (count === expected) pass(message)
    else fail(message, `expected ${expected}, got ${count}`)
  } catch (error) {
    fail(message, detailOf(error))
  }
}

async function expectVisible(client, table, filters, expected, message, select = '*') {
  let query = client.from(table).select(select)
  for (const [column, value] of filters) query = query.eq(column, value)
  const { data, error } = await query
  if (error) {
    fail(message, detailOf(error))
    return []
  }
  const count = data?.length ?? 0
  if (count === expected) pass(message)
  else fail(message, `expected ${expected}, got ${count}`)
  return data ?? []
}

async function expectInsert(client, table, payload, shouldPass, message, select = '*') {
  const { data, error } = await client.from(table).insert(payload).select(select)
  if (shouldPass) {
    if (error) {
      fail(message, detailOf(error))
      return []
    }
    if ((data?.length ?? 0) > 0) {
      pass(message)
      return data
    }
    fail(message, 'insert returned no rows')
    return []
  }

  if (error && isBlockedError(error)) {
    pass(message, detailOf(error))
    return []
  }
  if (error) {
    pass(message, detailOf(error))
    return []
  }
  fail(message, 'insert unexpectedly succeeded')
  return data ?? []
}

async function expectUpdate(client, table, filters, payload, shouldAffect, message, select = '*') {
  let query = client.from(table).update(payload).select(select)
  for (const [column, value] of filters) query = query.eq(column, value)
  const { data, error } = await query
  const count = data?.length ?? 0

  if (shouldAffect) {
    if (!error && count > 0) {
      pass(message)
      return data
    }
    fail(message, error ? detailOf(error) : `expected rows affected, got ${count}`)
    return []
  }

  if (error) {
    pass(message, detailOf(error))
    return []
  }
  if (count === 0) {
    pass(message, 'RLS returned zero affected rows')
    return []
  }
  fail(message, `update unexpectedly affected ${count} row(s)`)
  return data
}

async function expectDelete(client, table, filters, shouldAffect, message, select = '*') {
  let query = client.from(table).delete().select(select)
  for (const [column, value] of filters) query = query.eq(column, value)
  const { data, error } = await query
  const count = data?.length ?? 0

  if (shouldAffect) {
    if (!error && count > 0) {
      pass(message)
      return data
    }
    fail(message, error ? detailOf(error) : `expected rows affected, got ${count}`)
    return []
  }

  if (error) {
    pass(message, detailOf(error))
    return []
  }
  if (count === 0) {
    pass(message, 'RLS returned zero affected rows')
    return []
  }
  fail(message, `delete unexpectedly affected ${count} row(s)`)
  return data
}

async function expectAdminInsertBlocked(table, payload, message, constraintName, select = '*') {
  const { data, error } = await admin.from(table).insert(payload).select(select)
  if (!error) {
    fail(message, 'admin insert unexpectedly succeeded')
    return data ?? []
  }
  const detail = detailOf(error)
  if (constraintName && !detail.includes(constraintName)) {
    fail(message, `expected ${constraintName}, got ${detail}`)
    return []
  }
  pass(message, detail)
  return []
}

function trackUserRow(kind, row) {
  if (!row) return
  if (kind === 'teamPlayers') created.teamPlayers.push(row.id)
  if (kind === 'trackers') created.trackers.push(row.id)
  if (kind === 'sessions') created.sessions.push(row.id)
  if (kind === 'assignments') created.assignments.push(row.id)
}

function assignmentPayload({ session, tracker, teamPlayerId = null, createdBy }) {
  return {
    id: randomUUID(),
    session_id: session.id,
    club_id: session.club_id,
    team_id: session.team_id,
    tracker_id: tracker.id,
    team_player_id: teamPlayerId,
    assigned_from: '2026-06-21T10:00:00.000Z',
    status: 'active',
    created_by: createdBy,
  }
}

function samplePayload({ session, tracker, assignment, sequence }) {
  return {
    session_id: session.id,
    club_id: session.club_id,
    team_id: session.team_id,
    tracker_id: tracker.id,
    tracker_stream_id: randomUUID(),
    assignment_id: assignment.id,
    sequence,
    captured_at: '2026-06-21T10:00:05.000Z',
    latitude: 53.3498,
    longitude: -6.2603,
    speed_mps: 6.5,
    accuracy_m: 3.2,
  }
}

function latestPayload({ session, tracker, assignment, teamPlayerId = null, sequence = 1 }) {
  return {
    session_id: session.id,
    club_id: session.club_id,
    team_id: session.team_id,
    tracker_id: tracker.id,
    tracker_stream_id: randomUUID(),
    assignment_id: assignment.id,
    team_player_id: teamPlayerId,
    sequence,
    captured_at: '2026-06-21T10:00:05.000Z',
    latitude: 53.3498,
    longitude: -6.2603,
    speed_mps: 6.5,
    accuracy_m: 3.2,
    battery_percent: 95,
    connection_status: 'connected',
  }
}

function summaryPayload({ session, teamPlayerId }) {
  return {
    id: randomUUID(),
    session_id: session.id,
    club_id: session.club_id,
    team_id: session.team_id,
    team_player_id: teamPlayerId,
    total_distance_m: 1200,
    max_speed_mps: 8.2,
    average_speed_mps: 4.4,
    moving_time_seconds: 900,
    sprint_count: 3,
    sample_count: 10,
    first_sample_at: '2026-06-21T10:00:05.000Z',
    last_sample_at: '2026-06-21T10:10:05.000Z',
    algorithm_version: 'gps-privacy-live-check',
  }
}

async function createGraph(label, user) {
  const club = await insertAdmin('clubs', {
    name: `GPS Privacy ${label} ${runId}`,
    code: `GP${label}${shortRunId}`.slice(0, 8),
    owner_id: user.id,
  })
  created.clubs.push(club.id)

  await insertAdmin('club_members', { club_id: club.id, user_id: user.id, role: 'owner' })
  created.clubMembers.push({ club_id: club.id, user_id: user.id })
  await upsertAdmin('profiles', { id: user.id, club_id: club.id }, 'id')
  created.profiles.push(user.id)

  const team = await insertAdmin('teams', {
    club_id: club.id,
    name: `GPS Team ${label} ${runId}`,
    code: `${label}${shortRunId}`.slice(0, 6),
  })
  created.teams.push(team.id)

  await insertAdmin('team_members', {
    club_id: club.id,
    team_id: team.id,
    user_id: user.id,
    role: 'coach',
  })
  created.teamMembers.push({ team_id: team.id, user_id: user.id })

  const [player] = await expectInsert(
    user.client,
    'team_players',
    {
      id: randomUUID(),
      team_id: team.id,
      display_name: `GPS Privacy Player ${label}`,
      default_number: label === 'A' ? 11 : 12,
      position: 'MF',
      status: 'active',
      created_by: user.id,
    },
    true,
    `Coach ${label} can create own team player`,
  )
  trackUserRow('teamPlayers', player)

  const [tracker] = await expectInsert(
    user.client,
    'trackers',
    {
      id: randomUUID(),
      club_id: club.id,
      serial_number: `GPS-${label}-${runId}`,
      label: `Tracker ${label}`,
      hardware_model: 'privacy-test',
      status: 'active',
      created_by: user.id,
    },
    true,
    `Coach ${label} can create own club tracker`,
  )
  trackUserRow('trackers', tracker)

  const [tracker2] = await expectInsert(
    user.client,
    'trackers',
    {
      id: randomUUID(),
      club_id: club.id,
      serial_number: `GPS-${label}2-${runId}`,
      label: `Tracker ${label}2`,
      hardware_model: 'privacy-test',
      status: 'active',
      created_by: user.id,
    },
    true,
    `Coach ${label} can create second own club tracker`,
  )
  trackUserRow('trackers', tracker2)

  const [tracker3] = await expectInsert(
    user.client,
    'trackers',
    {
      id: randomUUID(),
      club_id: club.id,
      serial_number: `GPS-${label}3-${runId}`,
      label: `Tracker ${label}3`,
      hardware_model: 'privacy-test',
      status: 'active',
      created_by: user.id,
    },
    true,
    `Coach ${label} can create third own club tracker`,
  )
  trackUserRow('trackers', tracker3)

  const [session] = await expectInsert(
    user.client,
    'gps_sessions',
    {
      id: randomUUID(),
      club_id: club.id,
      team_id: team.id,
      session_type: 'training',
      name: `GPS Session ${label} ${runId}`,
      status: 'active',
      started_at: '2026-06-21T10:00:00.000Z',
      created_by: user.id,
    },
    true,
    `Coach ${label} can create own team GPS session`,
  )
  trackUserRow('sessions', session)

  const [session2] = await expectInsert(
    user.client,
    'gps_sessions',
    {
      id: randomUUID(),
      club_id: club.id,
      team_id: team.id,
      session_type: 'training',
      name: `GPS Session ${label}2 ${runId}`,
      status: 'active',
      started_at: '2026-06-21T11:00:00.000Z',
      created_by: user.id,
    },
    true,
    `Coach ${label} can create second own team GPS session`,
  )
  trackUserRow('sessions', session2)

  const [assignment] = await expectInsert(
    user.client,
    'tracker_player_assignments',
    assignmentPayload({ session, tracker, teamPlayerId: player.id, createdBy: user.id }),
    true,
    `Coach ${label} can assign own tracker to own player in own session`,
  )
  trackUserRow('assignments', assignment)

  const [assignment2] = await expectInsert(
    user.client,
    'tracker_player_assignments',
    assignmentPayload({ session, tracker: tracker2, createdBy: user.id }),
    true,
    `Coach ${label} can assign second own tracker in own session`,
  )
  trackUserRow('assignments', assignment2)

  const [assignmentOtherSession] = await expectInsert(
    user.client,
    'tracker_player_assignments',
    assignmentPayload({ session: session2, tracker, teamPlayerId: player.id, createdBy: user.id }),
    true,
    `Coach ${label} can assign own tracker in second own session`,
  )
  trackUserRow('assignments', assignmentOtherSession)

  return {
    club,
    team,
    player,
    tracker,
    tracker2,
    tracker3,
    session,
    session2,
    assignment,
    assignment2,
    assignmentOtherSession,
  }
}

async function seedReadableGpsRows(graph, sequence) {
  const sample = await insertAdmin(
    'gps_samples',
    samplePayload({
      session: graph.session,
      tracker: graph.tracker,
      assignment: graph.assignment,
      sequence,
    }),
    'session_id,tracker_id,tracker_stream_id,sequence',
  )
  created.samples.push({
    session_id: sample.session_id,
    tracker_id: sample.tracker_id,
    tracker_stream_id: sample.tracker_stream_id,
    sequence: sample.sequence,
  })

  const latest = await insertAdmin(
    'gps_latest',
    latestPayload({
      session: graph.session,
      tracker: graph.tracker,
      assignment: graph.assignment,
      teamPlayerId: graph.player.id,
      sequence,
    }),
    'session_id,tracker_id',
  )
  created.latest.push({ session_id: latest.session_id, tracker_id: latest.tracker_id })

  const summary = await insertAdmin(
    'gps_player_session_summaries',
    summaryPayload({ session: graph.session, teamPlayerId: graph.player.id }),
  )
  created.summaries.push(summary.id)
}

async function createDeletionGraph(label) {
  const user = await createUser(`delete-${label}`)
  const club = await insertAdmin('clubs', {
    name: `GPS Delete ${label} ${runId}`,
    code: `GD${label}${shortRunId}`.slice(0, 8),
    owner_id: user.id,
  })
  created.clubs.push(club.id)
  await insertAdmin('club_members', { club_id: club.id, user_id: user.id, role: 'owner' })
  created.clubMembers.push({ club_id: club.id, user_id: user.id })
  await upsertAdmin('profiles', { id: user.id, club_id: club.id }, 'id')
  created.profiles.push(user.id)
  const team = await insertAdmin('teams', {
    club_id: club.id,
    name: `GPS Delete Team ${label} ${runId}`,
    code: `D${label[0]}${shortRunId}`.slice(0, 6),
  })
  created.teams.push(team.id)
  await insertAdmin('team_members', {
    club_id: club.id,
    team_id: team.id,
    user_id: user.id,
    role: 'coach',
  })
  created.teamMembers.push({ team_id: team.id, user_id: user.id })
  const tracker = await insertAdmin('trackers', {
    club_id: club.id,
    serial_number: `GPS-DEL-${label}-${runId}`,
    label: `Delete Tracker ${label}`,
    status: 'active',
    created_by: user.id,
  })
  created.trackers.push(tracker.id)
  const player = await insertAdmin('team_players', {
    team_id: team.id,
    display_name: `GPS Delete Player ${label}`,
    default_number: 20,
    status: 'active',
    created_by: user.id,
  })
  created.teamPlayers.push(player.id)
  const session = await insertAdmin('gps_sessions', {
    club_id: club.id,
    team_id: team.id,
    created_by: user.id,
    session_type: 'training',
    name: `GPS Delete Session ${label}`,
    status: 'active',
    started_at: '2026-06-21T10:00:00.000Z',
  })
  created.sessions.push(session.id)
  const assignment = await insertAdmin('tracker_player_assignments', {
    session_id: session.id,
    club_id: club.id,
    team_id: team.id,
    tracker_id: tracker.id,
    team_player_id: player.id,
    assigned_from: '2026-06-21T10:00:00.000Z',
    status: 'active',
    created_by: user.id,
  })
  created.assignments.push(assignment.id)
  const sample = await insertAdmin(
    'gps_samples',
    samplePayload({ session, tracker, assignment, sequence: 700 + created.samples.length }),
    'session_id,tracker_id,tracker_stream_id,sequence',
  )
  created.samples.push(sample)
  const latest = await insertAdmin(
    'gps_latest',
    latestPayload({ session, tracker, assignment, teamPlayerId: player.id, sequence: 1 }),
    'session_id,tracker_id',
  )
  created.latest.push(latest)
  const summary = await insertAdmin(
    'gps_player_session_summaries',
    summaryPayload({ session, teamPlayerId: player.id }),
  )
  created.summaries.push(summary.id)
  return { user, club, team, tracker, player, session, assignment, sample, latest, summary }
}

async function expectAuthUserMissing(userId, message) {
  const { data, error } = await admin.auth.admin.getUserById(userId)
  if (data?.user && !error) fail(message, 'auth user still exists')
  else pass(message)
}

async function expectAuthUserPresent(userId, message) {
  const { data, error } = await admin.auth.admin.getUserById(userId)
  if (!error && data?.user) pass(message)
  else fail(message, detailOf(error) || 'auth user missing')
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

  await remove('gps_player_session_summaries', async () => {
    if (created.summaries.length)
      await admin.from('gps_player_session_summaries').delete().in('id', created.summaries)
  })
  await remove('gps_latest', async () => {
    for (const row of created.latest) {
      await admin
        .from('gps_latest')
        .delete()
        .eq('session_id', row.session_id)
        .eq('tracker_id', row.tracker_id)
    }
  })
  await remove('gps_samples', async () => {
    for (const row of created.samples) {
      await admin
        .from('gps_samples')
        .delete()
        .eq('session_id', row.session_id)
        .eq('tracker_id', row.tracker_id)
        .eq('tracker_stream_id', row.tracker_stream_id)
        .eq('sequence', row.sequence)
    }
  })
  await remove('tracker_player_assignments', async () => {
    if (created.assignments.length)
      await admin.from('tracker_player_assignments').delete().in('id', created.assignments)
  })
  await remove('gps_sessions', async () => {
    if (created.sessions.length)
      await admin.from('gps_sessions').delete().in('id', created.sessions)
  })
  await remove('trackers', async () => {
    if (created.trackers.length) await admin.from('trackers').delete().in('id', created.trackers)
  })
  await remove('team_players', async () => {
    if (created.teamPlayers.length)
      await admin.from('team_players').delete().in('id', created.teamPlayers)
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
  await remove('profiles', async () => {
    if (created.profiles.length) await admin.from('profiles').delete().in('id', created.profiles)
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
    console.error(`Created IDs only: ${JSON.stringify(created, null, 2)}`)
    process.exitCode = 1
  }
}

async function run() {
  pass(`Supabase live project resolved for GPS privacy check`, projectRef || supabaseUrl)

  const coachA = await createUser('coach-a')
  const coachB = await createUser('coach-b')
  const graphA = await createGraph('A', coachA)
  const graphB = await createGraph('B', coachB)

  await expectVisible(
    coachA.client,
    'trackers',
    [['id', graphA.tracker.id]],
    1,
    'Coach A can read authorised Tracker A',
  )
  await expectVisible(
    coachA.client,
    'trackers',
    [['id', graphB.tracker.id]],
    0,
    'Coach A cannot read Tracker B by UUID',
  )
  await expectUpdate(
    coachA.client,
    'trackers',
    [['id', graphB.tracker.id]],
    { label: `Blocked ${runId}` },
    false,
    'Coach A cannot update Tracker B by UUID',
  )
  await expectUpdate(
    coachA.client,
    'trackers',
    [['id', graphB.tracker.id]],
    { status: 'revoked', revoked_at: '2026-06-21T10:20:00.000Z' },
    false,
    'Coach A cannot revoke Tracker B by UUID',
  )
  await expectInsert(
    coachA.client,
    'tracker_player_assignments',
    {
      ...assignmentPayload({
        session: graphA.session,
        tracker: graphB.tracker,
        createdBy: coachA.id,
      }),
      club_id: graphA.club.id,
      team_id: graphA.team.id,
    },
    false,
    'Coach A cannot assign Tracker B into Team A session by UUID substitution',
  )

  await expectVisible(
    coachA.client,
    'gps_sessions',
    [['id', graphA.session.id]],
    1,
    'Coach A can read authorised Team A GPS session',
  )
  await expectVisible(
    coachA.client,
    'gps_sessions',
    [['id', graphB.session.id]],
    0,
    'Coach A cannot read Team B GPS session by UUID',
  )
  await expectUpdate(
    coachA.client,
    'gps_sessions',
    [['id', graphB.session.id]],
    { name: `Blocked ${runId}` },
    false,
    'Coach A cannot update Team B GPS session by UUID',
  )
  await expectUpdate(
    coachA.client,
    'gps_sessions',
    [['id', graphB.session.id]],
    { status: 'ended', ended_at: '2026-06-21T10:30:00.000Z' },
    false,
    'Coach A cannot end Team B GPS session by UUID',
  )
  await expectUpdate(
    coachA.client,
    'gps_sessions',
    [['id', graphB.session.id]],
    { status: 'cancelled', cancelled_at: '2026-06-21T10:31:00.000Z' },
    false,
    'Coach A cannot cancel Team B GPS session by UUID',
  )
  await expectInsert(
    coachA.client,
    'tracker_player_assignments',
    assignmentPayload({
      session: graphB.session,
      tracker: graphB.tracker2,
      teamPlayerId: graphB.player.id,
      createdBy: coachA.id,
    }),
    false,
    'Coach A cannot create assignments inside Team B session',
  )

  await expectVisible(
    coachA.client,
    'team_players',
    [['id', graphA.player.id]],
    1,
    'Coach A can read authorised Player A',
  )
  await expectVisible(
    coachA.client,
    'team_players',
    [['id', graphB.player.id]],
    0,
    'Coach A cannot read Player B by UUID',
  )
  await expectInsert(
    coachA.client,
    'tracker_player_assignments',
    assignmentPayload({
      session: graphA.session,
      tracker: graphA.tracker3,
      teamPlayerId: graphB.player.id,
      createdBy: coachA.id,
    }),
    false,
    'Team A session cannot reference Player B through manipulated player UUID',
  )
  await expectInsert(
    coachB.client,
    'tracker_player_assignments',
    assignmentPayload({
      session: graphB.session,
      tracker: graphB.tracker3,
      teamPlayerId: graphA.player.id,
      createdBy: coachB.id,
    }),
    false,
    'Team B authorised path cannot reference Player A',
  )

  await expectInsert(
    coachB.client,
    'tracker_player_assignments',
    assignmentPayload({
      session: graphB.session,
      tracker: graphA.tracker,
      createdBy: coachB.id,
    }),
    false,
    'Tracker A cannot be assigned into Club B / Team B session',
  )

  await expectAdminInsertBlocked(
    'gps_latest',
    latestPayload({
      session: graphA.session,
      tracker: graphA.tracker,
      assignment: graphA.assignmentOtherSession,
      teamPlayerId: graphA.player.id,
      sequence: 201,
    }),
    'gps_latest rejects assignment from another session',
    'gps_latest_assignment_fk',
    'session_id,tracker_id',
  )
  await expectAdminInsertBlocked(
    'gps_latest',
    latestPayload({
      session: graphA.session,
      tracker: graphA.tracker,
      assignment: graphA.assignment2,
      sequence: 202,
    }),
    'gps_latest rejects assignment from another tracker',
    'gps_latest_assignment_fk',
    'session_id,tracker_id',
  )
  await expectAdminInsertBlocked(
    'gps_latest',
    latestPayload({
      session: graphA.session,
      tracker: graphA.tracker,
      assignment: graphB.assignment,
      teamPlayerId: graphA.player.id,
      sequence: 203,
    }),
    'gps_latest rejects assignment from another tenant',
    'gps_latest_assignment_fk',
    'session_id,tracker_id',
  )

  await expectInsert(
    coachA.client,
    'gps_samples',
    samplePayload({
      session: graphA.session,
      tracker: graphA.tracker,
      assignment: graphA.assignment,
      sequence: 501,
    }),
    false,
    'Authenticated browser user cannot directly insert gps_samples',
    'session_id,tracker_id,sequence',
  )
  await expectInsert(
    coachA.client,
    'gps_latest',
    latestPayload({
      session: graphA.session,
      tracker: graphA.tracker2,
      assignment: graphA.assignment2,
      sequence: 502,
    }),
    false,
    'Authenticated browser user cannot directly insert gps_latest',
    'session_id,tracker_id',
  )
  await expectInsert(
    coachA.client,
    'gps_player_session_summaries',
    summaryPayload({ session: graphA.session, teamPlayerId: graphA.player.id }),
    false,
    'Authenticated browser user cannot directly insert gps_player_session_summaries',
    'id',
  )

  await seedReadableGpsRows(graphA, 1)
  await seedReadableGpsRows(graphB, 2)

  await expectVisible(
    coachA.client,
    'gps_samples',
    [['session_id', graphA.session.id]],
    1,
    'Coach A can read authorised Team A gps_samples',
    'session_id,tracker_id,sequence',
  )
  await expectVisible(
    coachA.client,
    'gps_samples',
    [['session_id', graphB.session.id]],
    0,
    'Coach A cannot read Team B gps_samples by UUID',
    'session_id,tracker_id,sequence',
  )
  await expectVisible(
    coachA.client,
    'gps_latest',
    [['session_id', graphA.session.id]],
    1,
    'Coach A can read authorised Team A gps_latest',
    'session_id,tracker_id',
  )
  await expectVisible(
    coachA.client,
    'gps_latest',
    [['session_id', graphB.session.id]],
    0,
    'Coach A cannot read Team B gps_latest by UUID',
    'session_id,tracker_id',
  )
  await expectVisible(
    coachA.client,
    'gps_player_session_summaries',
    [['session_id', graphA.session.id]],
    1,
    'Coach A can read authorised Team A GPS summaries',
  )
  await expectVisible(
    coachA.client,
    'gps_player_session_summaries',
    [['session_id', graphB.session.id]],
    0,
    'Coach A cannot read Team B GPS summaries by UUID',
  )

  await expectDelete(
    coachA.client,
    'tracker_player_assignments',
    [['id', graphB.assignment.id]],
    false,
    'Coach A cannot delete/revoke Team B tracker assignment',
  )

  const deleteTarget = await createDeletionGraph('target')
  const deleteControl = await createDeletionGraph('control')
  const deletedTargetSessionId = deleteTarget.session.id
  const deletedTargetTrackerId = deleteTarget.tracker.id
  const deletedTargetSummaryId = deleteTarget.summary.id
  const controlSessionId = deleteControl.session.id
  const controlTrackerId = deleteControl.tracker.id
  const controlSummaryId = deleteControl.summary.id

  const deleteResult = await deleteTarget.user.client.rpc('delete_own_account')
  if (deleteResult.error)
    fail('Test user can call delete_own_account for GPS cleanup', detailOf(deleteResult.error))
  else pass('Test user can call delete_own_account for GPS cleanup')

  await expectAuthUserMissing(deleteTarget.user.id, 'Deleted GPS test auth user is removed')
  await expectAdminCount(
    'gps_samples',
    [['session_id', deletedTargetSessionId]],
    0,
    'Owned-account deletion removes target gps_samples before session/team cleanup',
    'session_id',
  )
  await expectAdminCount(
    'gps_latest',
    [
      ['session_id', deletedTargetSessionId],
      ['tracker_id', deletedTargetTrackerId],
    ],
    0,
    'Owned-account deletion removes target gps_latest before session/team cleanup',
    'session_id,tracker_id',
  )
  await expectAdminCount(
    'gps_player_session_summaries',
    [['id', deletedTargetSummaryId]],
    0,
    'Owned-account deletion removes target GPS summary before player/team cleanup',
    'id',
  )
  await expectAdminCount(
    'tracker_player_assignments',
    [['id', deleteTarget.assignment.id]],
    0,
    'Owned-account deletion removes target tracker assignment before player/team cleanup',
    'id',
  )
  await expectAdminCount(
    'gps_sessions',
    [['id', deletedTargetSessionId]],
    0,
    'Owned-account deletion removes target GPS session',
    'id',
  )
  await expectAdminCount(
    'trackers',
    [['id', deletedTargetTrackerId]],
    0,
    'Owned-account deletion removes target tracker',
    'id',
  )
  await expectAuthUserPresent(deleteControl.user.id, 'Unrelated GPS control auth user remains')
  await expectAdminCount(
    'gps_samples',
    [['session_id', controlSessionId]],
    1,
    'Unrelated GPS control gps_samples remain after target deletion',
    'session_id',
  )
  await expectAdminCount(
    'gps_latest',
    [
      ['session_id', controlSessionId],
      ['tracker_id', controlTrackerId],
    ],
    1,
    'Unrelated GPS control gps_latest remains after target deletion',
    'session_id,tracker_id',
  )
  await expectAdminCount(
    'gps_player_session_summaries',
    [['id', controlSummaryId]],
    1,
    'Unrelated GPS control summary remains after target deletion',
    'id',
  )
}

try {
  await run()
} catch (error) {
  fail(error.message)
} finally {
  await cleanup()
}

if (failures.length) {
  console.error('')
  console.error(`GPS privacy live check failed with ${failures.length} issue(s).`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  console.log('')
  console.log(`GPS privacy live check passed with ${observations.length} assertions.`)
}
