import FDBFactory from 'fake-indexeddb/lib/FDBFactory'
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { saveSquad } from './db.js'
import {
  createLocalGpsSession,
  createLocalTrackerAssignment,
  endLocalGpsSession,
  endLocalTrackerAssignment,
  getGpsChunkCountForSession,
  getGpsSampleChunksForSession,
  getGpsSampleCountForSession,
  getLatestGpsStatesForSession,
  getLocalGpsAssignmentsForSession,
  getTrackerStreamState,
  GPS_INGEST_RESULT,
  GPS_SAMPLE_CHUNK_SIZE,
  startLocalGpsSession,
  upsertLocalGpsTracker,
} from './gps-local.js'
import {
  createMockGpsReceiver,
  estimateMockGpsSimulation,
  MOCK_GPS_DELIVERY_STATUS,
} from './gps-receiver.js'
import { createRosterPlayer } from './team-players.js'

const CLUB_ID = '00000000-0000-4000-8000-0000000000c1'
const TEAM_A = '00000000-0000-4000-8000-0000000000a1'
const START = '2020-01-01T10:00:00.000Z'
const FIRST_SAMPLE_AT = '2020-01-01T10:00:01.000Z'
const PLAYER_A = playerId(1)
const TRACKER_A = trackerId(1)
const TRACKER_B = trackerId(2)
const STREAM_A = streamId(1)

function resetIndexedDb() {
  globalThis.indexedDB = new FDBFactory()
}

function playerId(index) {
  return `00000000-0000-4000-8000-00aa${String(index).padStart(8, '0')}`
}

function trackerId(index) {
  return `00000000-0000-4000-8000-00bb${String(index).padStart(8, '0')}`
}

function streamId(index) {
  return `00000000-0000-4000-8000-00cc${String(index).padStart(8, '0')}`
}

function at(seconds) {
  return new Date(Date.parse(START) + seconds * 1000).toISOString()
}

async function seedPlayers(count = 2) {
  await saveSquad(
    Array.from({ length: count }, (_, index) =>
      createRosterPlayer({
        id: playerId(index + 1),
        name: `Player ${index + 1}`,
        number: index + 1,
      }),
    ),
    { teamScope: TEAM_A },
  )
}

async function seedTrackers(count = 2) {
  for (let index = 1; index <= count; index += 1) {
    await upsertLocalGpsTracker({
      trackerId: trackerId(index),
      clubId: CLUB_ID,
      serialNumber: `TRK-${String(index).padStart(3, '0')}`,
      label: `Tracker ${index}`,
    })
  }
}

async function createSession({ playerCount = 2, trackerCount = 2, active = true } = {}) {
  await seedPlayers(playerCount)
  await seedTrackers(trackerCount)
  const session = await createLocalGpsSession({
    clubId: CLUB_ID,
    teamId: TEAM_A,
    sessionType: 'training',
    name: 'Mock GPS Test',
    createdAt: START,
  })
  if (active) await startLocalGpsSession(session.sessionId, START)
  return session
}

async function createAssignedSession(count = 1) {
  const session = await createSession({ playerCount: count, trackerCount: count })
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

function addMockTrackers(receiver, session, count = 1, overrides = {}) {
  return Array.from({ length: count }, (_, index) =>
    receiver.createMockTracker({
      trackerId: trackerId(index + 1),
      trackerStreamId: streamId(index + 1),
      sessionId: session.sessionId,
      latitude: 53.34 + index * 0.0001,
      longitude: -6.26,
      speedMps: 4 + (index % 3),
      accuracyM: 3,
      batteryPercent: 90 - index,
      headingDegrees: 90,
      ...overrides,
    }),
  )
}

describe('mock GPS receiver', () => {
  beforeEach(() => {
    resetIndexedDb()
  })

  it('feeds one valid mock tracker sample through local ingestion', async () => {
    const { session } = await createAssignedSession()
    const receiver = createMockGpsReceiver()
    addMockTrackers(receiver, session)

    const result = await receiver.tickTracker(TRACKER_A, { capturedAt: FIRST_SAMPLE_AT })

    expect(result.status).toBe(MOCK_GPS_DELIVERY_STATUS.DELIVERED)
    expect(result.ingestion).toMatchObject({
      code: GPS_INGEST_RESULT.ACCEPTED,
      accepted: true,
      trackerId: TRACKER_A,
      teamPlayerId: PLAYER_A,
    })
    expect(await getGpsSampleCountForSession(session.sessionId)).toBe(1)
  })

  it('handles multiple mock trackers with independent latest states', async () => {
    const { session } = await createAssignedSession(3)
    const receiver = createMockGpsReceiver()
    addMockTrackers(receiver, session, 3)

    const results = await receiver.tickAll({ capturedAt: FIRST_SAMPLE_AT })

    expect(results).toHaveLength(3)
    expect(results.every((result) => result.ingestion.code === GPS_INGEST_RESULT.ACCEPTED)).toBe(
      true,
    )
    const latest = await getLatestGpsStatesForSession(session.sessionId)
    expect(latest).toHaveLength(3)
    expect(new Set(latest.map((state) => state.trackerId)).size).toBe(3)
    expect(new Set(latest.map((state) => state.teamPlayerId)).size).toBe(3)
  })

  it('increments mock tracker sequences deterministically', async () => {
    const { session } = await createAssignedSession()
    const receiver = createMockGpsReceiver()
    addMockTrackers(receiver, session)

    const results = await receiver.runAcceleratedTicks(3, {
      trackerIds: [TRACKER_A],
      startAt: FIRST_SAMPLE_AT,
      stepMs: 1000,
    })

    expect(results.map((result) => result.telemetry.sequence)).toEqual([0, 1, 2])
    expect(receiver.getMockTracker(TRACKER_A).sequence).toBe(3)
  })

  it('passes mock telemetry to the configured ingestion adapter', async () => {
    const ingest = vi.fn(async () => ({ code: GPS_INGEST_RESULT.ACCEPTED, accepted: true }))
    const receiver = createMockGpsReceiver({ ingest })
    receiver.createMockTracker({
      trackerId: TRACKER_A,
      trackerStreamId: STREAM_A,
      sessionId: 'session-a',
      latitude: 53.34,
      longitude: -6.26,
    })

    const result = await receiver.tickTracker(TRACKER_A, { capturedAt: FIRST_SAMPLE_AT })

    expect(result.ingestion).toMatchObject({ code: GPS_INGEST_RESULT.ACCEPTED })
    expect(ingest).toHaveBeenCalledTimes(1)
    expect(ingest.mock.calls[0][0]).toMatchObject({
      sessionId: 'session-a',
      trackerId: TRACKER_A,
      trackerStreamId: STREAM_A,
      sequence: 0,
    })
  })

  it('updates gps_latest from mock movement', async () => {
    const { session } = await createAssignedSession()
    const receiver = createMockGpsReceiver()
    addMockTrackers(receiver, session, 1, { latitude: 53.34, longitude: -6.26, speedMps: 10 })

    await receiver.runAcceleratedTicks(2, {
      trackerIds: [TRACKER_A],
      startAt: FIRST_SAMPLE_AT,
      stepMs: 1000,
    })

    await expect(getLatestGpsStatesForSession(session.sessionId)).resolves.toMatchObject([
      {
        trackerId: TRACKER_A,
        teamPlayerId: PLAYER_A,
        trackerStreamId: STREAM_A,
        sequence: 1,
      },
    ])
    const latest = (await getLatestGpsStatesForSession(session.sessionId))[0]
    expect(latest.longitude).toBeGreaterThan(-6.26)
  })

  it('fills and seals sample chunks through mock telemetry', async () => {
    const { session } = await createAssignedSession()
    const receiver = createMockGpsReceiver()
    addMockTrackers(receiver, session)

    await receiver.runAcceleratedTicks(GPS_SAMPLE_CHUNK_SIZE + 1, {
      trackerIds: [TRACKER_A],
      startAt: FIRST_SAMPLE_AT,
      stepMs: 1000,
    })

    expect(await getGpsSampleCountForSession(session.sessionId)).toBe(GPS_SAMPLE_CHUNK_SIZE + 1)
    expect(await getGpsChunkCountForSession(session.sessionId)).toBe(2)
    const chunks = await getGpsSampleChunksForSession(session.sessionId)
    expect(chunks.find((chunk) => chunk.samples.length === GPS_SAMPLE_CHUNK_SIZE)).toMatchObject({
      sealed: true,
    })
  })

  it('buffers samples while disconnected and flushes them on reconnect', async () => {
    const { session } = await createAssignedSession()
    const receiver = createMockGpsReceiver()
    addMockTrackers(receiver, session)
    const streamBeforeLoss = receiver.getMockTracker(TRACKER_A).trackerStreamId

    await receiver.tickTracker(TRACKER_A, { capturedAt: at(1) })
    receiver.disconnectMockTracker(TRACKER_A)
    await receiver.tickTracker(TRACKER_A, { capturedAt: at(2) })
    await receiver.tickTracker(TRACKER_A, { capturedAt: at(3) })

    expect(receiver.getMockTracker(TRACKER_A).trackerStreamId).toBe(streamBeforeLoss)
    expect(receiver.getMockTracker(TRACKER_A).buffer.length).toBe(2)
    expect(await getGpsSampleCountForSession(session.sessionId)).toBe(1)

    const flushed = await receiver.reconnectMockTracker(TRACKER_A, {
      receivedAt: at(4),
    })

    expect(flushed.map((result) => result.ingestion.code)).toEqual([
      GPS_INGEST_RESULT.ACCEPTED,
      GPS_INGEST_RESULT.ACCEPTED,
    ])
    expect(flushed.map((result) => result.telemetry.trackerStreamId)).toEqual([
      streamBeforeLoss,
      streamBeforeLoss,
    ])
    expect(await getGpsSampleCountForSession(session.sessionId)).toBe(3)
    await expect(
      getTrackerStreamState(session.sessionId, TRACKER_A, streamBeforeLoss),
    ).resolves.toMatchObject({
      lastReceivedSequence: 2,
    })
    await expect(getLatestGpsStatesForSession(session.sessionId)).resolves.toMatchObject([
      { sequence: 2 },
    ])
  })

  it('allows an explicit new tracker stream to restart sequence at zero', async () => {
    const { session } = await createAssignedSession()
    const receiver = createMockGpsReceiver()
    addMockTrackers(receiver, session)

    await receiver.tickTracker(TRACKER_A, { capturedAt: at(1) })
    const streamAfterRestart = '00000000-0000-4000-8000-00cc99999999'
    receiver.restartMockTrackerStream(TRACKER_A, { trackerStreamId: streamAfterRestart })
    const restarted = await receiver.tickTracker(TRACKER_A, { capturedAt: at(2) })

    expect(restarted.ingestion).toMatchObject({
      code: GPS_INGEST_RESULT.ACCEPTED,
      accepted: true,
      trackerStreamId: streamAfterRestart,
      sequence: 0,
    })
    expect(await getGpsSampleCountForSession(session.sessionId)).toBe(2)
    await expect(
      getTrackerStreamState(session.sessionId, TRACKER_A, streamAfterRestart),
    ).resolves.toMatchObject({
      lastReceivedSequence: 0,
    })
  })

  it('keeps duplicate resend idempotent', async () => {
    const { session } = await createAssignedSession()
    const receiver = createMockGpsReceiver()
    addMockTrackers(receiver, session)

    await receiver.tickTracker(TRACKER_A, { capturedAt: at(1) })
    const duplicate = await receiver.resendTrackerSample(TRACKER_A, 0, {
      receivedAt: at(2),
    })

    expect(duplicate.ingestion).toMatchObject({
      code: GPS_INGEST_RESULT.DUPLICATE,
      accepted: false,
    })
    expect(await getGpsSampleCountForSession(session.sessionId)).toBe(1)
  })

  it('handles out-of-order mock delivery and repairs missing ranges', async () => {
    const { session } = await createAssignedSession()
    const receiver = createMockGpsReceiver()
    addMockTrackers(receiver, session)
    const samples = [1, 2, 3, 4, 5].map((second) =>
      receiver.generateTrackerSample(TRACKER_A, { capturedAt: at(second) }),
    )

    for (const sample of [samples[0], samples[1], samples[3], samples[4]]) {
      await receiver.deliverTelemetry(sample, { receivedAt: at(6) })
    }
    await expect(
      getTrackerStreamState(session.sessionId, TRACKER_A, STREAM_A),
    ).resolves.toMatchObject({
      lastReceivedSequence: 4,
      missingRanges: [{ from: 2, to: 2 }],
    })

    await receiver.deliverTelemetry(samples[2], { receivedAt: at(7) })
    await expect(
      getTrackerStreamState(session.sessionId, TRACKER_A, STREAM_A),
    ).resolves.toMatchObject({
      lastReceivedSequence: 4,
      missingRanges: [],
    })
    expect(await getGpsSampleCountForSession(session.sessionId)).toBe(5)
  })

  it('rejects mock telemetry for a planned session', async () => {
    const session = await createSession({ active: false })
    await createLocalTrackerAssignment({
      sessionId: session.sessionId,
      trackerId: TRACKER_A,
      teamPlayerId: PLAYER_A,
      assignedFrom: START,
    })
    const receiver = createMockGpsReceiver()
    addMockTrackers(receiver, session)

    const result = await receiver.tickTracker(TRACKER_A, { capturedAt: FIRST_SAMPLE_AT })

    expect(result.ingestion).toMatchObject({
      code: GPS_INGEST_RESULT.REJECTED_SESSION_INACTIVE,
      accepted: false,
    })
  })

  it('rejects post-end mock samples but accepts pre-end buffered samples delivered later', async () => {
    const { session } = await createAssignedSession()
    const receiver = createMockGpsReceiver()
    addMockTrackers(receiver, session)

    receiver.disconnectMockTracker(TRACKER_A)
    await receiver.tickTracker(TRACKER_A, { capturedAt: at(10) })
    await endLocalGpsSession(session.sessionId, at(20))
    const flushed = await receiver.reconnectMockTracker(TRACKER_A, { receivedAt: at(30) })
    const postEnd = await receiver.tickTracker(TRACKER_A, {
      capturedAt: at(21),
      receivedAt: at(31),
    })

    expect(flushed[0].ingestion).toMatchObject({
      code: GPS_INGEST_RESULT.ACCEPTED,
      accepted: true,
    })
    expect(postEnd.ingestion).toMatchObject({
      code: GPS_INGEST_RESULT.REJECTED_SESSION_INACTIVE,
      accepted: false,
    })
    expect(await getGpsSampleCountForSession(session.sessionId)).toBe(1)
  })

  it('rejects an unassigned mock tracker', async () => {
    const session = await createSession()
    const receiver = createMockGpsReceiver()
    addMockTrackers(receiver, session)

    const result = await receiver.tickTracker(TRACKER_A, { capturedAt: FIRST_SAMPLE_AT })

    expect(result.ingestion).toMatchObject({
      code: GPS_INGEST_RESULT.REJECTED_UNASSIGNED_TRACKER,
      accepted: false,
    })
  })

  it('supports tracker swaps with a fresh stream identity', async () => {
    const session = await createSession({ playerCount: 2, trackerCount: 2 })
    const original = await createLocalTrackerAssignment({
      sessionId: session.sessionId,
      trackerId: TRACKER_A,
      teamPlayerId: PLAYER_A,
      assignedFrom: START,
    })
    const receiver = createMockGpsReceiver()
    addMockTrackers(receiver, session, 2)

    await receiver.tickTracker(TRACKER_A, { capturedAt: at(1) })
    await endLocalTrackerAssignment(original.assignmentId, at(10))
    const replacement = await createLocalTrackerAssignment({
      sessionId: session.sessionId,
      trackerId: TRACKER_B,
      teamPlayerId: PLAYER_A,
      assignedFrom: at(10),
    })
    receiver.restartMockTrackerStream(TRACKER_B, { trackerStreamId: 'swap-stream-b' })
    const result = await receiver.tickTracker(TRACKER_B, { capturedAt: at(11) })

    expect(result.ingestion).toMatchObject({
      code: GPS_INGEST_RESULT.ACCEPTED,
      assignmentId: replacement.assignmentId,
      teamPlayerId: PLAYER_A,
      trackerStreamId: 'swap-stream-b',
    })
    const assignmentsAfterSwap = await getLocalGpsAssignmentsForSession(session.sessionId)
    expect(assignmentsAfterSwap).toHaveLength(2)
  })

  it('runs an accelerated 30-tracker simulation without state leakage', async () => {
    const { session } = await createAssignedSession(30)
    const receiver = createMockGpsReceiver()
    addMockTrackers(receiver, session, 30)

    const results = await receiver.runAcceleratedTicks(10, {
      startAt: FIRST_SAMPLE_AT,
      stepMs: 1000,
    })

    expect(results).toHaveLength(300)
    expect(results.every((result) => result.ingestion.code === GPS_INGEST_RESULT.ACCEPTED)).toBe(
      true,
    )
    expect(await getGpsSampleCountForSession(session.sessionId)).toBe(300)
    expect(await getGpsChunkCountForSession(session.sessionId)).toBe(30)

    const latest = await getLatestGpsStatesForSession(session.sessionId)
    expect(latest).toHaveLength(30)
    expect(new Set(latest.map((state) => state.trackerId)).size).toBe(30)
    expect(new Set(latest.map((state) => state.teamPlayerId)).size).toBe(30)
    expect(latest.every((state) => state.sequence === 9)).toBe(true)

    expect(
      estimateMockGpsSimulation({
        trackerCount: 30,
        durationSeconds: 90 * 60,
        sampleIntervalMs: 1000,
      }),
    ).toMatchObject({
      trackerCount: 30,
      samplesPerTracker: 5400,
      totalSamples: 162000,
      chunkCount: 660,
      latestStateCount: 30,
      streamStateCount: 30,
    })
  })
})
