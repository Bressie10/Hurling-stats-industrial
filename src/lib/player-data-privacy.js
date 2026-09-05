import {
  getDB,
  getPrivacyTombstone,
  getPrivacyTombstonesForEntityIds,
  putPrivacyTombstone,
} from './db.js'
import { playerIdentity } from './team-players.js'

export const PLAYER_PRIVACY_ENTITY_TYPE = 'team_player'

export const PLAYER_DATA_EXPORT_PLAN = Object.freeze([
  {
    table: 'team_players',
    lookup: 'id',
    containsIdentity: true,
    note: 'Canonical team-owned player profile.',
  },
  {
    table: 'tracker_player_assignments',
    lookup: 'team_player_id',
    containsIdentity: true,
    note: 'GPS tracker-to-player assignment history.',
  },
  {
    table: 'gps_samples',
    lookup: 'assignment_id from tracker_player_assignments',
    containsIdentity: false,
    note: 'Raw telemetry is linked through assignment_id, not repeated names.',
  },
  {
    table: 'gps_latest',
    lookup: 'team_player_id',
    containsIdentity: true,
    note: 'Rebuildable latest-location cache.',
  },
  {
    table: 'gps_player_session_summaries',
    lookup: 'team_player_id',
    containsIdentity: true,
    note: 'Derived GPS summaries.',
  },
  {
    table: 'gps_sessions',
    lookup: 'session_id from assignments/summaries',
    containsIdentity: false,
    note: 'Team session metadata associated with the player through GPS rows.',
  },
  {
    table: 'matches',
    lookup: 'JSON data references to team_player.id',
    containsIdentity: true,
    note: 'Current match storage is JSON; stable IDs must be used inside stats/events/lineups.',
  },
])

function containsPlayerId(value, teamPlayerId, seen = new Set()) {
  if (value == null) return false
  if (typeof value === 'string') return value === teamPlayerId
  if (typeof value === 'number' || typeof value === 'boolean') return false
  if (typeof value !== 'object') return false
  if (seen.has(value)) return false
  seen.add(value)

  if (Array.isArray(value)) {
    return value.some((item) => containsPlayerId(item, teamPlayerId, seen))
  }

  return Object.entries(value).some(
    ([key, entry]) => key === teamPlayerId || containsPlayerId(entry, teamPlayerId, seen),
  )
}

function syncQueueEntityKey(kind, entityKey) {
  return `${kind}:${entityKey}`
}

function uniqueStrings(values = []) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))]
}

export function buildPlayerDataExportPlan(teamPlayerId) {
  const id = String(teamPlayerId || '').trim()
  if (!id) throw new Error('teamPlayerId is required.')
  return {
    teamPlayerId: id,
    cloudTables: PLAYER_DATA_EXPORT_PLAN,
  }
}

export async function getLocalPlayerDataInventory(teamPlayerId) {
  const id = String(teamPlayerId || '').trim()
  if (!id) throw new Error('teamPlayerId is required.')
  const db = await getDB()
  const [player, matches, assignments, latestStates, chunks, gpsQueue, syncOutbox, tombstone] =
    await Promise.all([
      db.get('team_players_by_team', id),
      db.getAll('matches'),
      db.getAll('gps_tracker_assignments'),
      db.getAllFromIndex('gps_latest', 'teamPlayerId', id),
      db.getAll('gps_sample_chunks'),
      db.getAll('gps_sync_queue'),
      db.getAll('sync_outbox'),
      getPrivacyTombstone(PLAYER_PRIVACY_ENTITY_TYPE, id),
    ])

  const playerAssignments = assignments.filter((assignment) => assignment.teamPlayerId === id)
  const assignmentIds = new Set(playerAssignments.map((assignment) => assignment.assignmentId))
  const sessionIds = new Set(playerAssignments.map((assignment) => assignment.sessionId))
  const playerChunks = chunks.filter((chunk) => assignmentIds.has(chunk.assignmentId))
  const playerMatches = matches.filter((match) => containsPlayerId(match, id))
  const sessions = (
    await Promise.all([...sessionIds].map((sessionId) => db.get('gps_sessions', sessionId)))
  ).filter(Boolean)
  const relatedGpsQueueKeys = new Set([
    ...playerAssignments.map((assignment) =>
      syncQueueEntityKey('assignment', assignment.assignmentId),
    ),
    ...playerChunks.map((chunk) => syncQueueEntityKey('sample_chunk', chunk.chunkKey)),
  ])
  const relatedGpsQueueItems = gpsQueue.filter((item) => relatedGpsQueueKeys.has(item.entityKey))
  const relatedOutboxItems = syncOutbox.filter((item) => containsPlayerId(item, id))
  const rawSampleCount = playerChunks.reduce(
    (count, chunk) => count + (chunk.samples?.length || 0),
    0,
  )

  return {
    teamPlayerId: id,
    teamId: player?.teamId ?? playerAssignments[0]?.teamId ?? null,
    player: player ?? null,
    tombstone: tombstone ?? null,
    matches: playerMatches,
    gpsSessions: sessions,
    gpsAssignments: playerAssignments,
    gpsSampleChunks: playerChunks,
    gpsLatest: latestStates,
    gpsSyncQueueItems: relatedGpsQueueItems,
    syncOutboxItems: relatedOutboxItems,
    counts: {
      matches: playerMatches.length,
      gpsSessions: sessions.length,
      gpsAssignments: playerAssignments.length,
      gpsSampleChunks: playerChunks.length,
      rawSamples: rawSampleCount,
      gpsLatest: latestStates.length,
      gpsSyncQueueItems: relatedGpsQueueItems.length,
      syncOutboxItems: relatedOutboxItems.length,
    },
  }
}

export async function sanitizeTeamPlayerUpsertPayload(players = []) {
  const ids = uniqueStrings(players.map((player) => playerIdentity(player)))
  const tombstones = await getPrivacyTombstonesForEntityIds(PLAYER_PRIVACY_ENTITY_TYPE, ids)
  return players.filter((player) => !tombstones.has(String(playerIdentity(player))))
}

export async function stageLocalPlayerDataRevocation({
  teamPlayerId,
  teamId = null,
  reason = 'player_data_revoked',
  createdAt = new Date().toISOString(),
  createdBy = null,
  purgeLocalGpsRaw = false,
} = {}) {
  const id = String(teamPlayerId || '').trim()
  if (!id) throw new Error('teamPlayerId is required.')
  const inventory = await getLocalPlayerDataInventory(id)
  const tombstone = await putPrivacyTombstone({
    entityType: PLAYER_PRIVACY_ENTITY_TYPE,
    entityId: id,
    teamId: teamId ?? inventory.teamId,
    reason,
    createdAt,
    createdBy,
  })
  const db = await getDB()
  const stores = [
    'team_players_by_team',
    'gps_latest',
    'gps_sample_chunks',
    'gps_tracker_assignments',
    'gps_sync_queue',
    'sync_outbox',
  ]
  const tx = db.transaction(stores, 'readwrite')
  const latestStore = tx.objectStore('gps_latest')
  const chunkStore = tx.objectStore('gps_sample_chunks')
  const assignmentStore = tx.objectStore('gps_tracker_assignments')
  const gpsQueueStore = tx.objectStore('gps_sync_queue')
  const syncOutboxStore = tx.objectStore('sync_outbox')
  let removedPlayerCache = 0
  let removedGpsLatest = 0
  let removedGpsRawChunks = 0
  let blockedAssignments = 0
  let removedGpsQueueItems = 0
  let removedTeamPlayerOutboxRows = 0

  if (await tx.objectStore('team_players_by_team').get(id)) {
    await tx.objectStore('team_players_by_team').delete(id)
    removedPlayerCache = 1
  }

  for (const latest of inventory.gpsLatest) {
    if (await latestStore.get(latest.latestKey)) {
      await latestStore.delete(latest.latestKey)
      removedGpsLatest += 1
    }
  }

  for (const assignment of inventory.gpsAssignments) {
    const current = await assignmentStore.get(assignment.assignmentId)
    if (current) {
      await assignmentStore.put({
        ...current,
        syncStatus: 'blocked_by_privacy',
        privacyTombstonedAt: createdAt,
      })
      blockedAssignments += 1
    }
  }

  for (const chunk of inventory.gpsSampleChunks) {
    if (purgeLocalGpsRaw && (await chunkStore.get(chunk.chunkKey))) {
      await chunkStore.delete(chunk.chunkKey)
      removedGpsRawChunks += 1
    }
  }

  for (const item of inventory.gpsSyncQueueItems) {
    if (await gpsQueueStore.get(item.id)) {
      await gpsQueueStore.delete(item.id)
      removedGpsQueueItems += 1
    }
  }

  const outboxRows = await syncOutboxStore.getAll()
  for (const item of outboxRows) {
    if (item.op !== 'upsert_team_players' || !containsPlayerId(item.payload, id)) continue
    const payload = (item.payload || []).filter((player) => playerIdentity(player) !== id)
    if (payload.length === 0) {
      await syncOutboxStore.delete(item.id)
    } else {
      await syncOutboxStore.put({ ...item, payload })
    }
    removedTeamPlayerOutboxRows += 1
  }

  await tx.done
  return {
    tombstone,
    removed: {
      playerCache: removedPlayerCache,
      gpsLatest: removedGpsLatest,
      gpsRawChunks: removedGpsRawChunks,
      gpsSyncQueueItems: removedGpsQueueItems,
      teamPlayerOutboxRows: removedTeamPlayerOutboxRows,
    },
    blocked: {
      gpsAssignments: blockedAssignments,
    },
    retainedForPolicy: {
      matches: inventory.counts.matches,
      gpsRawChunks: purgeLocalGpsRaw ? 0 : inventory.counts.gpsSampleChunks,
    },
  }
}
