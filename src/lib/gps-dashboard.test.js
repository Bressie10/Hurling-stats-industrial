import FDBFactory from 'fake-indexeddb/lib/FDBFactory'
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { getDB, saveSquad } from './db.js'
import {
  createLocalGpsSession,
  createLocalTrackerAssignment,
  endLocalGpsSession,
  endLocalTrackerAssignment,
  getGpsSampleCountForSession,
  GPS_INGEST_RESULT,
  GPS_SESSION_STATUS,
  startLocalGpsSession,
  upsertLocalGpsTracker,
} from './gps-local.js'
import {
  GPS_DASHBOARD_CONNECTION,
  loadLocalGpsDashboardState,
  speedMpsToKmh,
} from './gps-dashboard.js'
import { createMockGpsReceiver } from './gps-receiver.js'
import { createRosterPlayer } from './team-players.js'

const CLUB_ID = '00000000-0000-4000-8000-0000000000c1'
const TEAM_A = '00000000-0000-4000-8000-0000000000a1'
const TEAM_B = '00000000-0000-4000-8000-0000000000b1'
const START = '2020-01-01T10:00:00.000Z'
const PLAYER_A = playerId(1)
const PLAYER_B = playerId(2)
const TRACKER_A = trackerId(1)
const TRACKER_B = trackerId(2)
const STREAM_B = streamId(2)

function resetIndexedDb() {
  globalThis.indexedDB = new FDBFactory()
}

function playerId(index) {
  return `00000000-0000-4000-8000-10aa${String(index).padStart(8, '0')}`
}

function trackerId(index) {
  return `00000000-0000-4000-8000-10bb${String(index).padStart(8, '0')}`
}

function streamId(index) {
  return `00000000-0000-4000-8000-10cc${String(index).padStart(8, '0')}`
}

function at(seconds) {
  return new Date(Date.parse(START) + seconds * 1000).toISOString()
}

async function seedPlayers(teamId = TEAM_A, count = 2) {
  await saveSquad(
    Array.from({ length: count }, (_, index) =>
      createRosterPlayer({
        id: playerId(index + 1),
        name: `Player ${index + 1}`,
        number: index + 1,
      }),
    ),
    { teamScope: teamId },
  )
}

async function seedTrackers(count = 2) {
  for (let index = 1; index <= count; index += 1) {
    await upsertLocalGpsTracker({
      trackerId: trackerId(index),
      clubId: CLUB_ID,
      serialNumber: `MOCK-${String(index).padStart(2, '0')}`,
      label: `Tracker ${String(index).padStart(2, '0')}`,
    })
  }
}

async function createSession({
  teamId = TEAM_A,
  active = false,
  playerCount = 2,
  trackerCount = 2,
} = {}) {
  await seedPlayers(teamId, playerCount)
  await seedTrackers(trackerCount)
  const session = await createLocalGpsSession({
    clubId: CLUB_ID,
    teamId,
    sessionType: 'training',
    name: 'Dashboard Test',
    createdAt: START,
  })
  if (active) await startLocalGpsSession(session.sessionId, START)
  return session
}

async function createAssignedSession(count = 1) {
  const session = await createSession({ active: true, playerCount: count, trackerCount: count })
  const assignments = []
  for (let index = 1; index <= count; index += 1) {
    assignments.push(
      await createLocalTrackerAssignment({
        sessionId: session.sessionId,
        trackerId: trackerId(index),
        teamPlayerId: playerId(index),
        assignedFrom: START,
      }),
    )
  }
  return { session, assignments }
}

function addReceiverTrackers(receiver, session, count = 1) {
  for (let index = 1; index <= count; index += 1) {
    receiver.createMockTracker({
      trackerId: trackerId(index),
      trackerStreamId: streamId(index),
      sessionId: session.sessionId,
      latitude: 53.34 + index * 0.0001,
      longitude: -6.26,
      speedMps: 5 + index,
      accuracyM: 3,
      batteryPercent: 90 - index,
    })
  }
}

async function loadState(session, receiver = null, overrides = {}) {
  return loadLocalGpsDashboardState({
    sessionId: session.sessionId,
    teamId: session.teamId,
    clubId: CLUB_ID,
    receiverSnapshots: receiver?.getMockTrackerSnapshots() || [],
    nowMs: Date.parse(overrides.now ?? at(2)),
    staleThresholdMs: overrides.staleThresholdMs ?? 5000,
  })
}

describe('offline GPS dashboard state', () => {
  beforeEach(() => {
    resetIndexedDb()
  })

  it('loads a local planned session', async () => {
    const session = await createSession()

    const state = await loadState(session)

    expect(state.session).toMatchObject({
      sessionId: session.sessionId,
      status: GPS_SESSION_STATUS.PLANNED,
    })
    expect(state.players).toHaveLength(2)
    expect(state.trackers).toHaveLength(2)
  })

  it('reflects session start', async () => {
    const session = await createSession()
    await startLocalGpsSession(session.sessionId, START)

    await expect(loadState(session)).resolves.toMatchObject({
      session: { status: GPS_SESSION_STATUS.ACTIVE },
    })
  })

  it('builds assignment rows from canonical team players', async () => {
    const { session } = await createAssignedSession()

    const state = await loadState(session)

    expect(state.rows).toMatchObject([
      {
        teamPlayerId: PLAYER_A,
        playerName: 'Player 1',
        trackerId: TRACKER_A,
      },
    ])
  })

  it('shows valid mock telemetry from gps_latest', async () => {
    const { session } = await createAssignedSession()
    const receiver = createMockGpsReceiver()
    addReceiverTrackers(receiver, session)

    await receiver.tickTracker(TRACKER_A, { capturedAt: at(1), receivedAt: at(1) })
    const state = await loadState(session, receiver, { now: at(1) })

    expect(state.rows[0]).toMatchObject({
      connection: GPS_DASHBOARD_CONNECTION.LIVE,
      trackerId: TRACKER_A,
      latest: { sequence: 0 },
    })
  })

  it('converts speed display to km/h without changing stored m/s values', async () => {
    const { session } = await createAssignedSession()
    const receiver = createMockGpsReceiver()
    addReceiverTrackers(receiver, session)

    await receiver.tickTracker(TRACKER_A, {
      capturedAt: at(1),
      receivedAt: at(1),
      overrides: { speedMps: 5 },
    })
    const state = await loadState(session, receiver, { now: at(1) })

    expect(speedMpsToKmh(5)).toBe(18)
    expect(state.rows[0].latest.speedMps).toBe(5)
    expect(state.rows[0].speedDisplay).toBe('18.0 km/h')
  })

  it('keeps multiple trackers isolated', async () => {
    const { session } = await createAssignedSession(2)
    const receiver = createMockGpsReceiver()
    addReceiverTrackers(receiver, session, 2)

    await receiver.tickAll({ capturedAt: at(1), receivedAt: at(1) })
    const state = await loadState(session, receiver, { now: at(1) })

    expect(state.rows).toHaveLength(2)
    expect(new Set(state.rows.map((row) => row.trackerId))).toEqual(new Set([TRACKER_A, TRACKER_B]))
    expect(new Set(state.rows.map((row) => row.teamPlayerId))).toEqual(
      new Set([PLAYER_A, PLAYER_B]),
    )
  })

  it('uses receiver state to show disconnected trackers', async () => {
    const { session } = await createAssignedSession()
    const receiver = createMockGpsReceiver()
    addReceiverTrackers(receiver, session)

    await receiver.tickTracker(TRACKER_A, { capturedAt: at(1), receivedAt: at(1) })
    receiver.disconnectMockTracker(TRACKER_A)
    const state = await loadState(session, receiver, { now: at(2) })

    expect(state.rows[0].connection).toBe(GPS_DASHBOARD_CONNECTION.DISCONNECTED)
  })

  it('reconnects and catches latest state up with buffered telemetry', async () => {
    const { session } = await createAssignedSession()
    const receiver = createMockGpsReceiver()
    addReceiverTrackers(receiver, session)

    await receiver.tickTracker(TRACKER_A, { capturedAt: at(1), receivedAt: at(1) })
    receiver.disconnectMockTracker(TRACKER_A)
    await receiver.tickTracker(TRACKER_A, { capturedAt: at(2) })
    await receiver.tickTracker(TRACKER_A, { capturedAt: at(3) })
    await receiver.reconnectMockTracker(TRACKER_A, { receivedAt: at(4) })
    const state = await loadState(session, receiver, { now: at(4) })

    expect(state.rows[0]).toMatchObject({
      connection: GPS_DASHBOARD_CONNECTION.LIVE,
      latest: { sequence: 2 },
    })
  })

  it('keeps dashboard state valid after duplicate resend', async () => {
    const { session } = await createAssignedSession()
    const receiver = createMockGpsReceiver()
    addReceiverTrackers(receiver, session)

    await receiver.tickTracker(TRACKER_A, { capturedAt: at(1), receivedAt: at(1) })
    const duplicate = await receiver.resendTrackerSample(TRACKER_A, 0, { receivedAt: at(2) })
    const state = await loadState(session, receiver, { now: at(2) })

    expect(duplicate.ingestion).toMatchObject({ code: GPS_INGEST_RESULT.DUPLICATE })
    expect(await getGpsSampleCountForSession(session.sessionId)).toBe(1)
    expect(state.rows[0].latest.sequence).toBe(0)
  })

  it('keeps post-end telemetry rejected while displaying existing latest state', async () => {
    const { session } = await createAssignedSession()
    const receiver = createMockGpsReceiver()
    addReceiverTrackers(receiver, session)

    await receiver.tickTracker(TRACKER_A, { capturedAt: at(1), receivedAt: at(1) })
    await endLocalGpsSession(session.sessionId, at(2))
    const rejected = await receiver.tickTracker(TRACKER_A, { capturedAt: at(3), receivedAt: at(3) })
    const state = await loadState(session, receiver, { now: at(3) })

    expect(rejected.ingestion).toMatchObject({
      code: GPS_INGEST_RESULT.REJECTED_SESSION_INACTIVE,
    })
    expect(state.rows[0].latest.sequence).toBe(0)
  })

  it('accepts pre-end buffered telemetry after session end', async () => {
    const { session } = await createAssignedSession()
    const receiver = createMockGpsReceiver()
    addReceiverTrackers(receiver, session)

    receiver.disconnectMockTracker(TRACKER_A)
    await receiver.tickTracker(TRACKER_A, { capturedAt: at(1) })
    await endLocalGpsSession(session.sessionId, at(2))
    await receiver.reconnectMockTracker(TRACKER_A, { receivedAt: at(4) })
    const state = await loadState(session, receiver, { now: at(4) })

    expect(await getGpsSampleCountForSession(session.sessionId)).toBe(1)
    expect(state.rows[0].latest.sequence).toBe(0)
  })

  it('maps a tracker swap back to the same player identity', async () => {
    const session = await createSession({ active: true, playerCount: 2, trackerCount: 2 })
    const original = await createLocalTrackerAssignment({
      sessionId: session.sessionId,
      trackerId: TRACKER_A,
      teamPlayerId: PLAYER_A,
      assignedFrom: START,
    })
    const receiver = createMockGpsReceiver()
    addReceiverTrackers(receiver, session, 2)

    await receiver.tickTracker(TRACKER_A, { capturedAt: at(1), receivedAt: at(1) })
    await endLocalTrackerAssignment(original.assignmentId, at(2))
    await createLocalTrackerAssignment({
      sessionId: session.sessionId,
      trackerId: TRACKER_B,
      teamPlayerId: PLAYER_A,
      assignedFrom: at(2),
    })
    receiver.restartMockTrackerStream(TRACKER_B, { trackerStreamId: STREAM_B })
    await receiver.tickTracker(TRACKER_B, { capturedAt: at(3), receivedAt: at(3) })
    const state = await loadState(session, receiver, { now: at(3) })

    expect(state.rows.find((row) => row.teamPlayerId === PLAYER_A)).toMatchObject({
      trackerId: TRACKER_B,
      teamPlayerId: PLAYER_A,
    })
  })

  it('does not show Team A GPS rows in a Team B session', async () => {
    const { session: sessionA } = await createAssignedSession()
    const sessionB = await createSession({ teamId: TEAM_B, active: true })
    const receiver = createMockGpsReceiver()
    addReceiverTrackers(receiver, sessionA)

    await receiver.tickTracker(TRACKER_A, { capturedAt: at(1), receivedAt: at(1) })
    const stateB = await loadLocalGpsDashboardState({
      sessionId: sessionB.sessionId,
      teamId: TEAM_B,
      clubId: CLUB_ID,
      receiverSnapshots: receiver.getMockTrackerSnapshots(),
      nowMs: Date.parse(at(1)),
    })

    expect(stateB.rows).toEqual([])
    expect(stateB.latestStates).toEqual([])
  })

  it('recovers an active session and latest state after IndexedDB reopen', async () => {
    const { session } = await createAssignedSession()
    const receiver = createMockGpsReceiver()
    addReceiverTrackers(receiver, session)
    await receiver.tickTracker(TRACKER_A, { capturedAt: at(1), receivedAt: at(1) })
    const db = await getDB()
    db.close()

    const state = await loadLocalGpsDashboardState({
      teamId: TEAM_A,
      clubId: CLUB_ID,
      nowMs: Date.parse(at(1)),
    })

    expect(state.session).toMatchObject({
      sessionId: session.sessionId,
      status: GPS_SESSION_STATUS.ACTIVE,
    })
    expect(state.rows[0].latest.sequence).toBe(0)
  })

  it('runs the local live path without Supabase or Realtime calls', async () => {
    const { session } = await createAssignedSession()
    const receiver = createMockGpsReceiver()
    addReceiverTrackers(receiver, session)

    await receiver.tickTracker(TRACKER_A, { capturedAt: at(1), receivedAt: at(1) })
    const state = await loadState(session, receiver, { now: at(1) })

    expect(state.rows).toHaveLength(1)
    expect(state.rows[0].connection).toBe(GPS_DASHBOARD_CONNECTION.LIVE)
  })

  it('builds 30-tracker dashboard state from accelerated mock updates', async () => {
    const { session } = await createAssignedSession(30)
    const receiver = createMockGpsReceiver()
    addReceiverTrackers(receiver, session, 30)

    const results = await receiver.runAcceleratedTicks(2, {
      startAt: at(1),
      stepMs: 1000,
    })
    const state = await loadState(session, receiver, { now: at(2) })

    expect(results).toHaveLength(60)
    expect(state.rows).toHaveLength(30)
    expect(state.latestStates).toHaveLength(30)
    expect(new Set(state.rows.map((row) => row.trackerId)).size).toBe(30)
    expect(state.rows.every((row) => row.latest.sequence === 1)).toBe(true)
  })
})
