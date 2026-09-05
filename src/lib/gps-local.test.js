import FDBFactory from 'fake-indexeddb/lib/FDBFactory'
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearAllData,
  getDB,
  getOutboxCount,
  loadMatches,
  loadSquad,
  saveMatch,
  saveSquad,
} from './db.js'
import {
  createLocalGpsSession,
  createLocalTrackerAssignment,
  cleanupSyncedGpsSession,
  endLocalGpsSession,
  endLocalTrackerAssignment,
  estimateGpsObjectCount,
  findGpsDataEligibleForCleanup,
  getGpsChunkCountForSession,
  getLocalGpsStorageStatus,
  getGpsSampleChunksForSession,
  getGpsSampleCountForSession,
  getGpsStorageSummary,
  getGpsSyncQueueItems,
  getLatestGpsStatesForSession,
  getLocalGpsAssignmentsForSession,
  getLocalGpsSession,
  getRecoverableGpsSessions,
  getTrackerStreamState,
  GPS_CLEANUP_REASON,
  GPS_INGEST_RESULT,
  GPS_SAMPLE_CHUNK_SIZE,
  GPS_SESSION_STATUS,
  ingestLocalGpsSample,
  markGpsSampleChunkSynced,
  startLocalGpsSession,
  upsertLocalGpsTracker,
} from './gps-local.js'
import { canRecoverLocalGpsSessionOffline, recordLocalGpsAuthContext } from './gps-auth.js'
import { createRosterPlayer, isUuid } from './team-players.js'

const CLUB_ID = '00000000-0000-4000-8000-0000000000c1'
const CLUB_B = '00000000-0000-4000-8000-0000000000c2'
const TEAM_A = '00000000-0000-4000-8000-0000000000a1'
const TEAM_B = '00000000-0000-4000-8000-0000000000b1'
const PLAYER_A = '00000000-0000-4000-8000-000000000101'
const PLAYER_B = '00000000-0000-4000-8000-000000000102'
const PLAYER_OTHER_TEAM = '00000000-0000-4000-8000-000000000201'
const TRACKER_4 = '00000000-0000-4000-8000-000000000004'
const TRACKER_17 = '00000000-0000-4000-8000-000000000017'
const STREAM_A = '00000000-0000-4000-8000-00000000aaa1'
const START = '2020-01-01T10:00:00.000Z'
const LATER = '2020-01-01T10:00:05.000Z'

function at(seconds) {
  return new Date(Date.parse(START) + seconds * 1000).toISOString()
}

function resetIndexedDb() {
  globalThis.indexedDB = new FDBFactory()
}

async function seedPlayers(teamId = TEAM_A) {
  await saveSquad(
    [
      createRosterPlayer({ id: PLAYER_A, name: 'John', number: 4 }),
      createRosterPlayer({ id: PLAYER_B, name: 'Mary', number: 17 }),
    ],
    { teamScope: teamId },
  )
}

async function seedTrackers() {
  await upsertLocalGpsTracker({
    trackerId: TRACKER_4,
    clubId: CLUB_ID,
    serialNumber: 'TRK-004',
    label: 'Tracker 4',
  })
  await upsertLocalGpsTracker({
    trackerId: TRACKER_17,
    clubId: CLUB_ID,
    serialNumber: 'TRK-017',
    label: 'Tracker 17',
  })
}

async function createStartedSession() {
  await seedPlayers()
  await seedTrackers()
  const session = await createLocalGpsSession({
    clubId: CLUB_ID,
    teamId: TEAM_A,
    sessionType: 'training',
    name: 'Tuesday Training',
    createdBy: 'coach-a',
    createdAt: START,
  })
  await startLocalGpsSession(session.sessionId, START)
  return getLocalGpsSession(session.sessionId)
}

async function createAssignedSession() {
  const session = await createStartedSession()
  const assignment = await createLocalTrackerAssignment({
    sessionId: session.sessionId,
    trackerId: TRACKER_4,
    teamPlayerId: PLAYER_A,
    assignedFrom: START,
  })
  return { session, assignment }
}

function sample(overrides = {}) {
  return {
    sessionId: overrides.sessionId,
    trackerId: overrides.trackerId ?? TRACKER_4,
    trackerStreamId: overrides.trackerStreamId ?? STREAM_A,
    sequence: overrides.sequence ?? 1,
    capturedAt: overrides.capturedAt ?? LATER,
    latitude: overrides.latitude ?? 53.3498,
    longitude: overrides.longitude ?? -6.2603,
    speedMps: overrides.speedMps ?? 6.5,
    accuracyM: overrides.accuracyM ?? 3.2,
    batteryPercent: overrides.batteryPercent ?? 88,
  }
}

describe('local GPS storage and domain model', () => {
  beforeEach(() => {
    resetIndexedDb()
  })

  it('creates an offline GPS session with a stable local UUID', async () => {
    const session = await createLocalGpsSession({
      clubId: CLUB_ID,
      teamId: TEAM_A,
      sessionType: 'training',
      name: 'Offline Training',
    })

    expect(isUuid(session.sessionId)).toBe(true)
    expect(session).toMatchObject({
      clubId: CLUB_ID,
      teamId: TEAM_A,
      status: GPS_SESSION_STATUS.PLANNED,
      syncStatus: 'not_synced',
    })
    expect(await getGpsSyncQueueItems()).toMatchObject([
      { kind: 'session', entityKey: `session:${session.sessionId}`, status: 'pending' },
    ])
  })

  it('starts a planned GPS session and keeps it recoverable after refresh', async () => {
    const session = await createLocalGpsSession({
      clubId: CLUB_ID,
      teamId: TEAM_A,
      sessionType: 'training',
      createdAt: START,
    })

    await startLocalGpsSession(session.sessionId, START)

    await expect(getLocalGpsSession(session.sessionId)).resolves.toMatchObject({
      status: GPS_SESSION_STATUS.ACTIVE,
      startedAt: START,
    })
    await expect(getRecoverableGpsSessions()).resolves.toMatchObject([
      { sessionId: session.sessionId },
    ])
  })

  it('assigns a tracker to a canonical team player', async () => {
    const session = await createStartedSession()

    const assignment = await createLocalTrackerAssignment({
      sessionId: session.sessionId,
      trackerId: TRACKER_4,
      teamPlayerId: PLAYER_A,
      assignedFrom: START,
    })

    expect(assignment).toMatchObject({
      sessionId: session.sessionId,
      clubId: CLUB_ID,
      teamId: TEAM_A,
      trackerId: TRACKER_4,
      teamPlayerId: PLAYER_A,
      status: 'active',
    })
    await expect(getLocalGpsAssignmentsForSession(session.sessionId)).resolves.toHaveLength(1)
  })

  it('accepts a valid GPS sample into chunked storage', async () => {
    const { session, assignment } = await createAssignedSession()

    const result = await ingestLocalGpsSample(sample({ sessionId: session.sessionId }))

    expect(result).toMatchObject({
      code: GPS_INGEST_RESULT.ACCEPTED,
      accepted: true,
      assignmentId: assignment.assignmentId,
      teamPlayerId: PLAYER_A,
    })
    expect(await getGpsSampleCountForSession(session.sessionId)).toBe(1)
    expect(await getGpsChunkCountForSession(session.sessionId)).toBe(1)
  })

  it('updates latest state for cheap session reads', async () => {
    const { session, assignment } = await createAssignedSession()

    await ingestLocalGpsSample(sample({ sessionId: session.sessionId, sequence: 9 }))

    await expect(getLatestGpsStatesForSession(session.sessionId)).resolves.toMatchObject([
      {
        sessionId: session.sessionId,
        trackerId: TRACKER_4,
        assignmentId: assignment.assignmentId,
        teamPlayerId: PLAYER_A,
        sequence: 9,
        latitude: 53.3498,
        batteryPercent: 88,
      },
    ])
  })

  it('treats a repeated sequence as idempotent and does not duplicate samples', async () => {
    const { session } = await createAssignedSession()

    await ingestLocalGpsSample(sample({ sessionId: session.sessionId, sequence: 2 }))
    const duplicate = await ingestLocalGpsSample(
      sample({ sessionId: session.sessionId, sequence: 2 }),
    )

    expect(duplicate).toMatchObject({ code: GPS_INGEST_RESULT.DUPLICATE, accepted: false })
    expect(await getGpsSampleCountForSession(session.sessionId)).toBe(1)
  })

  it('rejects telemetry from an unassigned tracker', async () => {
    const session = await createStartedSession()

    const result = await ingestLocalGpsSample(sample({ sessionId: session.sessionId }))

    expect(result).toMatchObject({
      code: GPS_INGEST_RESULT.REJECTED_UNASSIGNED_TRACKER,
      accepted: false,
    })
    expect(await getGpsSampleCountForSession(session.sessionId)).toBe(0)
  })

  it('rejects live telemetry when the session is not active', async () => {
    await seedPlayers()
    await seedTrackers()
    const session = await createLocalGpsSession({
      clubId: CLUB_ID,
      teamId: TEAM_A,
      sessionType: 'training',
      createdAt: START,
    })
    await createLocalTrackerAssignment({
      sessionId: session.sessionId,
      trackerId: TRACKER_4,
      teamPlayerId: PLAYER_A,
      assignedFrom: START,
    })

    const result = await ingestLocalGpsSample(sample({ sessionId: session.sessionId }))

    expect(result).toMatchObject({
      code: GPS_INGEST_RESULT.REJECTED_SESSION_INACTIVE,
      accepted: false,
    })
  })

  it('accepts a buffered pre-end sample after the session has ended', async () => {
    const { session } = await createAssignedSession()
    await endLocalGpsSession(session.sessionId, '2020-01-01T10:01:00.000Z')

    const result = await ingestLocalGpsSample(
      sample({
        sessionId: session.sessionId,
        sequence: 3,
        capturedAt: '2020-01-01T10:00:30.000Z',
      }),
      { receivedAt: '2020-01-01T10:03:00.000Z' },
    )

    expect(result).toMatchObject({ code: GPS_INGEST_RESULT.ACCEPTED, accepted: true })
    expect(await getGpsSampleCountForSession(session.sessionId)).toBe(1)
  })

  it('rejects samples captured after the session ended', async () => {
    const { session } = await createAssignedSession()
    await endLocalGpsSession(session.sessionId, '2020-01-01T10:01:00.000Z')

    const result = await ingestLocalGpsSample(
      sample({
        sessionId: session.sessionId,
        sequence: 4,
        capturedAt: '2020-01-01T10:01:01.000Z',
      }),
      { receivedAt: '2020-01-01T10:03:00.000Z' },
    )

    expect(result).toMatchObject({
      code: GPS_INGEST_RESULT.REJECTED_SESSION_INACTIVE,
      accepted: false,
    })
  })

  it('supports a tracker swap after closing the previous assignment', async () => {
    const { session, assignment } = await createAssignedSession()
    await ingestLocalGpsSample(sample({ sessionId: session.sessionId, sequence: 1 }))
    await endLocalTrackerAssignment(assignment.assignmentId, '2020-01-01T10:00:10.000Z')
    const replacement = await createLocalTrackerAssignment({
      sessionId: session.sessionId,
      trackerId: TRACKER_17,
      teamPlayerId: PLAYER_A,
      assignedFrom: '2020-01-01T10:00:10.000Z',
    })

    const result = await ingestLocalGpsSample(
      sample({
        sessionId: session.sessionId,
        trackerId: TRACKER_17,
        trackerStreamId: '00000000-0000-4000-8000-00000000aaa2',
        sequence: 1,
        capturedAt: '2020-01-01T10:00:11.000Z',
      }),
    )

    expect(result).toMatchObject({
      code: GPS_INGEST_RESULT.ACCEPTED,
      accepted: true,
      assignmentId: replacement.assignmentId,
      teamPlayerId: PLAYER_A,
    })
    expect(await getLatestGpsStatesForSession(session.sessionId)).toHaveLength(2)
  })

  it('requires a new stream boundary when a tracker is reassigned in the same session', async () => {
    const { session, assignment } = await createAssignedSession()
    await ingestLocalGpsSample(
      sample({ sessionId: session.sessionId, sequence: 0, capturedAt: at(1) }),
    )
    await endLocalTrackerAssignment(assignment.assignmentId, at(10))
    const replacement = await createLocalTrackerAssignment({
      sessionId: session.sessionId,
      trackerId: TRACKER_4,
      teamPlayerId: PLAYER_B,
      assignedFrom: at(10),
    })

    const oldStreamResult = await ingestLocalGpsSample(
      sample({
        sessionId: session.sessionId,
        sequence: 1,
        capturedAt: at(11),
      }),
    )
    const newStreamResult = await ingestLocalGpsSample(
      sample({
        sessionId: session.sessionId,
        trackerStreamId: '00000000-0000-4000-8000-00000000aaa9',
        sequence: 0,
        capturedAt: at(11),
      }),
    )

    expect(oldStreamResult).toMatchObject({
      code: GPS_INGEST_RESULT.REJECTED_INVALID_PAYLOAD,
      accepted: false,
    })
    expect(newStreamResult).toMatchObject({
      code: GPS_INGEST_RESULT.ACCEPTED,
      accepted: true,
      assignmentId: replacement.assignmentId,
      teamPlayerId: PLAYER_B,
    })
    expect(await getGpsSampleCountForSession(session.sessionId)).toBe(2)
  })

  it('prevents one tracker being actively assigned to two players in the same session', async () => {
    const { session } = await createAssignedSession()

    await expect(
      createLocalTrackerAssignment({
        sessionId: session.sessionId,
        trackerId: TRACKER_4,
        teamPlayerId: PLAYER_B,
        assignedFrom: START,
      }),
    ).rejects.toMatchObject({ code: GPS_INGEST_RESULT.REJECTED_UNASSIGNED_TRACKER })
  })

  it('prevents one player having overlapping active tracker assignments', async () => {
    const { session } = await createAssignedSession()

    await expect(
      createLocalTrackerAssignment({
        sessionId: session.sessionId,
        trackerId: TRACKER_17,
        teamPlayerId: PLAYER_A,
        assignedFrom: START,
      }),
    ).rejects.toMatchObject({ code: GPS_INGEST_RESULT.REJECTED_UNASSIGNED_TRACKER })
  })

  it('rejects invalid GPS latitude and longitude values', async () => {
    const { session } = await createAssignedSession()

    await expect(
      ingestLocalGpsSample(sample({ sessionId: session.sessionId, latitude: 91 })),
    ).resolves.toMatchObject({ code: GPS_INGEST_RESULT.REJECTED_INVALID_PAYLOAD })
    await expect(
      ingestLocalGpsSample(sample({ sessionId: session.sessionId, sequence: 2, longitude: -181 })),
    ).resolves.toMatchObject({ code: GPS_INGEST_RESULT.REJECTED_INVALID_PAYLOAD })
  })

  it('rejects assigning a player from a different team', async () => {
    await saveSquad(
      [createRosterPlayer({ id: PLAYER_OTHER_TEAM, name: 'Other Team Player', number: 8 })],
      { teamScope: TEAM_B },
    )
    await seedTrackers()
    const session = await createLocalGpsSession({
      clubId: CLUB_ID,
      teamId: TEAM_A,
      sessionType: 'training',
      createdAt: START,
    })

    await expect(
      createLocalTrackerAssignment({
        sessionId: session.sessionId,
        trackerId: TRACKER_4,
        teamPlayerId: PLAYER_OTHER_TEAM,
        assignedFrom: START,
      }),
    ).rejects.toMatchObject({ code: GPS_INGEST_RESULT.REJECTED_TEAM_MISMATCH })
  })

  it('rejects assigning a tracker from another club into the session', async () => {
    await seedPlayers()
    await upsertLocalGpsTracker({
      trackerId: TRACKER_4,
      clubId: CLUB_B,
      serialNumber: 'OTHER-004',
      label: 'Other Club Tracker',
    })
    const session = await createLocalGpsSession({
      clubId: CLUB_ID,
      teamId: TEAM_A,
      sessionType: 'training',
      createdAt: START,
    })

    await expect(
      createLocalTrackerAssignment({
        sessionId: session.sessionId,
        trackerId: TRACKER_4,
        teamPlayerId: PLAYER_A,
        assignedFrom: START,
      }),
    ).rejects.toMatchObject({ code: GPS_INGEST_RESULT.REJECTED_TEAM_MISMATCH })
  })

  it('keeps GPS state durable across an IndexedDB reopen', async () => {
    const { session } = await createAssignedSession()
    await ingestLocalGpsSample(sample({ sessionId: session.sessionId, sequence: 6 }))
    const db = await getDB()
    db.close()

    await expect(getLocalGpsSession(session.sessionId)).resolves.toMatchObject({
      sessionId: session.sessionId,
      status: GPS_SESSION_STATUS.ACTIVE,
    })
    await expect(getLatestGpsStatesForSession(session.sessionId)).resolves.toMatchObject([
      { sequence: 6, teamPlayerId: PLAYER_A },
    ])
  })

  it('does not interfere with existing match and squad local data', async () => {
    const { session } = await createAssignedSession()
    await saveMatch(
      { id: 7001, opposition: 'Cork', score: {}, stats: {}, events: [] },
      { teamScope: TEAM_A },
    )
    const outboxCountBeforeGps = await getOutboxCount()
    await ingestLocalGpsSample(sample({ sessionId: session.sessionId, sequence: 7 }))

    await expect(loadSquad({ teamScope: TEAM_A })).resolves.toMatchObject([
      { id: PLAYER_A, name: 'John' },
      { id: PLAYER_B, name: 'Mary' },
    ])
    await expect(loadMatches({ teamScope: TEAM_A })).resolves.toMatchObject([
      { id: 7001, opposition: 'Cork' },
    ])
    expect(outboxCountBeforeGps).toBeGreaterThan(0)
    expect(await getOutboxCount()).toBe(outboxCountBeforeGps)
    expect((await getGpsSyncQueueItems()).some((item) => item.kind === 'sample_chunk')).toBe(true)
  })

  it('tracks stream gaps for future reconnect handling', async () => {
    const { session } = await createAssignedSession()

    await ingestLocalGpsSample(sample({ sessionId: session.sessionId, sequence: 1 }))
    await ingestLocalGpsSample(sample({ sessionId: session.sessionId, sequence: 4 }))
    await expect(
      getTrackerStreamState(session.sessionId, TRACKER_4, STREAM_A),
    ).resolves.toMatchObject({
      lastReceivedSequence: 4,
      missingRanges: [{ from: 2, to: 3 }],
    })

    await ingestLocalGpsSample(sample({ sessionId: session.sessionId, sequence: 2 }))
    await expect(
      getTrackerStreamState(session.sessionId, TRACKER_4, STREAM_A),
    ).resolves.toMatchObject({
      lastReceivedSequence: 4,
      missingRanges: [{ from: 3, to: 3 }],
    })
  })

  it('uses chunking so a 162,000-sample session has practical object counts', async () => {
    const estimate = estimateGpsObjectCount({ trackerCount: 30, sampleCount: 162000 })

    expect(GPS_SAMPLE_CHUNK_SIZE).toBe(250)
    expect(estimate.chunkCount).toBe(660)
    expect(estimate.approximateObjectCount).toBeLessThan(800)
  })

  it('splits stored samples across chunks without creating one object per sample', async () => {
    const { session } = await createAssignedSession()
    for (let sequence = 0; sequence <= GPS_SAMPLE_CHUNK_SIZE; sequence += 1) {
      await ingestLocalGpsSample(
        sample({
          sessionId: session.sessionId,
          sequence,
          capturedAt: new Date(Date.parse(START) + sequence * 1000).toISOString(),
        }),
      )
    }

    expect(await getGpsSampleCountForSession(session.sessionId)).toBe(GPS_SAMPLE_CHUNK_SIZE + 1)
    expect(await getGpsChunkCountForSession(session.sessionId)).toBe(2)
    const chunks = await getGpsSampleChunksForSession(session.sessionId)
    expect(chunks.map((chunk) => chunk.samples.length).sort((a, b) => a - b)).toEqual([
      1,
      GPS_SAMPLE_CHUNK_SIZE,
    ])
    await expect(getGpsStorageSummary(session.sessionId)).resolves.toMatchObject({
      sampleCount: GPS_SAMPLE_CHUNK_SIZE + 1,
      chunkCount: 2,
      unsyncedChunks: 2,
    })
  })

  it('does not cleanup-delete unsynced local raw GPS data', async () => {
    const { session } = await createAssignedSession()
    await ingestLocalGpsSample(sample({ sessionId: session.sessionId, sequence: 20 }))
    await endLocalGpsSession(session.sessionId, '2020-01-01T10:01:00.000Z')

    const result = await cleanupSyncedGpsSession(session.sessionId)

    expect(result).toMatchObject({
      deletedRawChunkCount: 0,
      blockers: [GPS_CLEANUP_REASON.UNSYNCED_RAW_RETAINED],
    })
    expect(await getGpsSampleCountForSession(session.sessionId)).toBe(1)
  })

  it('does not cleanup-delete active session GPS data even when a chunk is synced', async () => {
    const { session } = await createAssignedSession()
    await ingestLocalGpsSample(sample({ sessionId: session.sessionId, sequence: 21 }))
    const [chunk] = await getGpsSampleChunksForSession(session.sessionId)
    await markGpsSampleChunkSynced(chunk.chunkKey, { uploadedAt: '2020-01-01T10:02:00.000Z' })

    const result = await cleanupSyncedGpsSession(session.sessionId)

    expect(result).toMatchObject({
      deletedRawChunkCount: 0,
      blockers: [GPS_CLEANUP_REASON.ACTIVE_SESSION],
    })
    expect(await getGpsSampleCountForSession(session.sessionId)).toBe(1)
  })

  it('marks synced ended raw GPS chunks as cleanup-eligible', async () => {
    const { session } = await createAssignedSession()
    await ingestLocalGpsSample(sample({ sessionId: session.sessionId, sequence: 22 }))
    const [chunk] = await getGpsSampleChunksForSession(session.sessionId)
    await markGpsSampleChunkSynced(chunk.chunkKey, { uploadedAt: '2020-01-01T10:02:00.000Z' })
    await endLocalGpsSession(session.sessionId, '2020-01-01T10:03:00.000Z')

    const cleanup = await findGpsDataEligibleForCleanup({ sessionId: session.sessionId })
    const status = await getLocalGpsStorageStatus({ sessionId: session.sessionId })

    expect(cleanup.eligibleRawChunkKeys).toEqual([chunk.chunkKey])
    expect(status.totals).toMatchObject({
      rawSampleCount: 1,
      syncedRawChunkCount: 1,
      unsyncedRawChunkCount: 0,
    })
  })

  it('cleans synced raw GPS chunks idempotently', async () => {
    const { session } = await createAssignedSession()
    await ingestLocalGpsSample(sample({ sessionId: session.sessionId, sequence: 23 }))
    const [chunk] = await getGpsSampleChunksForSession(session.sessionId)
    await markGpsSampleChunkSynced(chunk.chunkKey, { uploadedAt: '2020-01-01T10:02:00.000Z' })
    await endLocalGpsSession(session.sessionId, '2020-01-01T10:03:00.000Z')

    await expect(cleanupSyncedGpsSession(session.sessionId)).resolves.toMatchObject({
      deletedRawChunkCount: 1,
    })
    await expect(cleanupSyncedGpsSession(session.sessionId)).resolves.toMatchObject({
      deletedRawChunkCount: 0,
    })
    expect(await getGpsSampleCountForSession(session.sessionId)).toBe(0)
  })

  it('allows bounded offline recovery for an already authenticated coach session', async () => {
    const session = await createStartedSession()
    await recordLocalGpsAuthContext({
      userId: 'coach-a',
      clubId: CLUB_ID,
      teamIds: [TEAM_A],
      authenticatedAt: '2020-01-01T09:59:00.000Z',
      maxAgeMs: 10 * 60 * 1000,
    })

    await expect(
      canRecoverLocalGpsSessionOffline({
        userId: 'coach-a',
        sessionId: session.sessionId,
        now: '2020-01-01T10:05:00.000Z',
      }),
    ).resolves.toMatchObject({ allowed: true, reason: 'local_auth_context_valid' })
  })

  it('expires local GPS recovery instead of permanently trusting the device', async () => {
    const session = await createStartedSession()
    await recordLocalGpsAuthContext({
      userId: 'coach-a',
      clubId: CLUB_ID,
      teamIds: [TEAM_A],
      authenticatedAt: '2020-01-01T09:00:00.000Z',
      maxAgeMs: 60 * 1000,
    })

    await expect(
      canRecoverLocalGpsSessionOffline({
        userId: 'coach-a',
        sessionId: session.sessionId,
        now: '2020-01-01T10:00:00.000Z',
      }),
    ).resolves.toMatchObject({ allowed: false, reason: 'local_auth_expired_or_missing' })
  })

  it('clears GPS stores during a full local account wipe', async () => {
    const { session } = await createAssignedSession()
    await ingestLocalGpsSample(sample({ sessionId: session.sessionId, sequence: 12 }))

    await clearAllData()

    await expect(getLocalGpsSession(session.sessionId)).resolves.toBeUndefined()
    expect(await getGpsSyncQueueItems()).toEqual([])
  })
})
