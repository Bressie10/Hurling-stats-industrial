import FDBFactory from 'fake-indexeddb/lib/FDBFactory'
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { getDB, saveMatch, saveSquad } from './db.js'
import {
  createLocalGpsSession,
  createLocalTrackerAssignment,
  getGpsSampleCountForSession,
  getGpsSyncQueueItems,
  getLatestGpsStatesForSession,
  ingestLocalGpsSample,
  startLocalGpsSession,
  upsertLocalGpsTracker,
} from './gps-local.js'
import {
  buildPlayerDataExportPlan,
  getLocalPlayerDataInventory,
  sanitizeTeamPlayerUpsertPayload,
  stageLocalPlayerDataRevocation,
} from './player-data-privacy.js'
import { createRosterPlayer } from './team-players.js'

const CLUB_ID = '00000000-0000-4000-8000-0000000000c1'
const TEAM_A = '00000000-0000-4000-8000-0000000000a1'
const PLAYER_A = '00000000-0000-4000-8000-000000000101'
const PLAYER_B = '00000000-0000-4000-8000-000000000102'
const TRACKER_A = '00000000-0000-4000-8000-000000000004'
const STREAM_A = '00000000-0000-4000-8000-00000000aaa1'
const START = '2020-01-01T10:00:00.000Z'

function resetIndexedDb() {
  globalThis.indexedDB = new FDBFactory()
}

async function seedPlayerGpsData() {
  await saveSquad(
    [
      createRosterPlayer({ id: PLAYER_A, name: 'Player A', number: 4 }),
      createRosterPlayer({ id: PLAYER_B, name: 'Player B', number: 5 }),
    ],
    { teamScope: TEAM_A },
  )
  await saveMatch(
    {
      id: 8801,
      opposition: 'Waterford',
      score: {},
      stats: { [PLAYER_A]: { points: 1 } },
      events: [{ type: 'score', team_player_id: PLAYER_A }],
      players: [createRosterPlayer({ id: PLAYER_A, name: 'Player A', number: 4 })],
      lineup: { 4: PLAYER_A },
    },
    { teamScope: TEAM_A },
  )
  await upsertLocalGpsTracker({
    trackerId: TRACKER_A,
    clubId: CLUB_ID,
    serialNumber: 'TRK-004',
  })
  const session = await createLocalGpsSession({
    clubId: CLUB_ID,
    teamId: TEAM_A,
    sessionType: 'training',
    createdAt: START,
  })
  await startLocalGpsSession(session.sessionId, START)
  await createLocalTrackerAssignment({
    sessionId: session.sessionId,
    trackerId: TRACKER_A,
    teamPlayerId: PLAYER_A,
    assignedFrom: START,
  })
  await ingestLocalGpsSample({
    sessionId: session.sessionId,
    trackerId: TRACKER_A,
    trackerStreamId: STREAM_A,
    sequence: 1,
    capturedAt: '2020-01-01T10:00:05.000Z',
    latitude: 53.3498,
    longitude: -6.2603,
    speedMps: 6.5,
    accuracyM: 3.2,
  })
  return session
}

describe('player data privacy inventory and revocation', () => {
  beforeEach(() => {
    resetIndexedDb()
  })

  it('builds an export traversal plan from stable team_player.id', () => {
    const plan = buildPlayerDataExportPlan(PLAYER_A)

    expect(plan.teamPlayerId).toBe(PLAYER_A)
    expect(plan.cloudTables.map((item) => item.table)).toEqual(
      expect.arrayContaining([
        'team_players',
        'tracker_player_assignments',
        'gps_samples',
        'gps_latest',
        'gps_player_session_summaries',
        'gps_sessions',
        'matches',
      ]),
    )
  })

  it('identifies local match and GPS data associated with a stable player ID', async () => {
    const session = await seedPlayerGpsData()

    const inventory = await getLocalPlayerDataInventory(PLAYER_A)

    expect(inventory).toMatchObject({
      teamPlayerId: PLAYER_A,
      teamId: TEAM_A,
      counts: {
        matches: 1,
        gpsSessions: 1,
        gpsAssignments: 1,
        gpsSampleChunks: 1,
        rawSamples: 1,
        gpsLatest: 1,
      },
    })
    expect(inventory.gpsSessions[0].sessionId).toBe(session.sessionId)
  })

  it('stages a tombstone so stale local sync does not recreate revoked player data', async () => {
    const session = await seedPlayerGpsData()

    const result = await stageLocalPlayerDataRevocation({
      teamPlayerId: PLAYER_A,
      reason: 'test_revocation',
    })

    const db = await getDB()
    const outboxRows = await db.getAll('sync_outbox')
    const remainingPayloadText = JSON.stringify(
      outboxRows.filter((row) => row.op === 'upsert_team_players'),
    )
    const sanitized = await sanitizeTeamPlayerUpsertPayload([
      createRosterPlayer({ id: PLAYER_A, name: 'Player A' }),
      createRosterPlayer({ id: PLAYER_B, name: 'Player B' }),
    ])

    expect(result.tombstone).toMatchObject({
      entityType: 'team_player',
      entityId: PLAYER_A,
      reason: 'test_revocation',
    })
    expect(result.removed).toMatchObject({
      playerCache: 1,
      gpsLatest: 1,
      gpsSyncQueueItems: 2,
      teamPlayerOutboxRows: 1,
    })
    expect(result.retainedForPolicy).toMatchObject({ matches: 1, gpsRawChunks: 1 })
    expect(remainingPayloadText).not.toContain(PLAYER_A)
    expect(sanitized.map((player) => player.id)).toEqual([PLAYER_B])
    expect(await getLatestGpsStatesForSession(session.sessionId)).toEqual([])
    expect(await getGpsSampleCountForSession(session.sessionId)).toBe(1)
    expect((await getGpsSyncQueueItems()).map((item) => item.kind)).toEqual(['session'])
  })
})
