import { getDB } from './db.js'
import { createGpsUuid, nowMs, timestampToMs, toIsoOrNull } from './gps-core.js'
import { playerIdentity } from './team-players.js'

export const GPS_SAMPLE_CHUNK_SIZE = 250
export const GPS_DEFAULT_FUTURE_TOLERANCE_MS = 2 * 60 * 1000

export const GPS_SESSION_STATUS = Object.freeze({
  PLANNED: 'planned',
  ACTIVE: 'active',
  ENDED: 'ended',
  CANCELLED: 'cancelled',
})

export const GPS_SYNC_STATUS = Object.freeze({
  NOT_SYNCED: 'not_synced',
  SYNCING: 'syncing',
  PARTIALLY_SYNCED: 'partially_synced',
  SYNCED: 'synced',
  SYNC_FAILED: 'sync_failed',
  BLOCKED_BY_PRIVACY: 'blocked_by_privacy',
})

export const GPS_ASSIGNMENT_STATUS = Object.freeze({
  ACTIVE: 'active',
  ENDED: 'ended',
  CANCELLED: 'cancelled',
})

export const GPS_CONNECTION_STATUS = Object.freeze({
  UNKNOWN: 'unknown',
  CONNECTED: 'connected',
  STALE: 'stale',
  OFFLINE: 'offline',
})

export const GPS_SYNC_QUEUE_STATUS = Object.freeze({
  PENDING: 'pending',
  SYNCING: 'syncing',
  SYNCED: 'synced',
  FAILED: 'failed',
})

export const GPS_SYNC_QUEUE_KIND = Object.freeze({
  SESSION: 'session',
  ASSIGNMENT: 'assignment',
  SAMPLE_CHUNK: 'sample_chunk',
  SUMMARY: 'summary',
})

export const GPS_INGEST_RESULT = Object.freeze({
  ACCEPTED: 'accepted',
  DUPLICATE: 'duplicate',
  REJECTED_SESSION_INACTIVE: 'rejected_session_inactive',
  REJECTED_UNASSIGNED_TRACKER: 'rejected_unassigned_tracker',
  REJECTED_INVALID_PAYLOAD: 'rejected_invalid_payload',
  REJECTED_TEAM_MISMATCH: 'rejected_team_mismatch',
  REJECTED_TRACKER_UNAVAILABLE: 'rejected_tracker_unavailable',
})

export const GPS_CLEANUP_REASON = Object.freeze({
  ACTIVE_SESSION: 'active_session',
  SESSION_NOT_FOUND: 'session_not_found',
  UNSYNCED_RAW_RETAINED: 'unsynced_raw_retained',
})

const GPS_TRACKERS_STORE = 'gps_trackers'
const GPS_SESSIONS_STORE = 'gps_sessions'
const GPS_ASSIGNMENTS_STORE = 'gps_tracker_assignments'
const GPS_SAMPLE_CHUNKS_STORE = 'gps_sample_chunks'
const GPS_LATEST_STORE = 'gps_latest'
const GPS_STREAM_STATE_STORE = 'gps_tracker_stream_state'
const GPS_SYNC_QUEUE_STORE = 'gps_sync_queue'
const TEAM_PLAYERS_STORE = 'team_players_by_team'

const SESSION_STATUSES = new Set(Object.values(GPS_SESSION_STATUS))
const SESSION_TYPES = new Set(['training', 'match'])
const TRACKER_UNAVAILABLE_STATUSES = new Set(['revoked', 'lost'])
const ASSIGNMENT_STATUSES = new Set(Object.values(GPS_ASSIGNMENT_STATUS))

export class GpsLocalError extends Error {
  constructor(code, message) {
    super(message || code)
    this.name = 'GpsLocalError'
    this.code = code
  }
}

function isoNow() {
  return new Date(nowMs()).toISOString()
}

function toIso(value) {
  return toIsoOrNull(value)
}

function assertRequired(value, code, message) {
  if (value == null || String(value).trim() === '') throw new GpsLocalError(code, message)
  return String(value)
}

function latestKey(sessionId, trackerId) {
  return `${sessionId}:${trackerId}`
}

function streamKey(sessionId, trackerId, trackerStreamId) {
  return `${sessionId}:${trackerId}:${trackerStreamId}`
}

function chunkStartForSequence(sequence, chunkSize = GPS_SAMPLE_CHUNK_SIZE) {
  return Math.floor(sequence / chunkSize) * chunkSize
}

function chunkKey(sessionId, trackerId, trackerStreamId, chunkStartSequence) {
  return `${sessionId}:${trackerId}:${trackerStreamId}:${chunkStartSequence}`
}

function syncQueueEntityKey(kind, entityKey) {
  return `${kind}:${entityKey}`
}

async function ensureGpsSyncQueueItem(queueStore, { kind, entityKey, createdAt = isoNow() }) {
  const key = syncQueueEntityKey(kind, entityKey)
  const existing = await queueStore.index('entityKey').getAll(key)
  if (existing.some((item) => item.status !== GPS_SYNC_QUEUE_STATUS.SYNCED)) return null

  return queueStore.add({
    kind,
    entityKey: key,
    createdAt,
    attempts: 0,
    nextRetryAt: 0,
    lastError: null,
    status: GPS_SYNC_QUEUE_STATUS.PENDING,
  })
}

function isCloudSyncedGpsChunk(chunk) {
  return chunk?.syncStatus === GPS_SYNC_STATUS.SYNCED && Boolean(chunk.uploadedAt)
}

function isOperationalGpsSession(session) {
  return [GPS_SESSION_STATUS.PLANNED, GPS_SESSION_STATUS.ACTIVE].includes(session?.status)
}

async function updateGpsSyncQueueEntityStatus(queueStore, entityKey, status, updatedAt = isoNow()) {
  const existing = await queueStore.index('entityKey').getAll(entityKey)
  await Promise.all(
    existing.map((item) =>
      queueStore.put({
        ...item,
        status,
        updatedAt,
        lastError: status === GPS_SYNC_QUEUE_STATUS.SYNCED ? null : item.lastError,
      }),
    ),
  )
}

function normalizeSessionInput(input = {}) {
  const createdAt = toIso(input.createdAt) || isoNow()
  const updatedAt = toIso(input.updatedAt) || createdAt
  const sessionType = input.sessionType || 'training'
  const status = input.status || GPS_SESSION_STATUS.PLANNED
  if (!SESSION_TYPES.has(sessionType)) {
    throw new GpsLocalError(GPS_INGEST_RESULT.REJECTED_INVALID_PAYLOAD, 'Invalid GPS session type.')
  }
  if (!SESSION_STATUSES.has(status)) {
    throw new GpsLocalError(
      GPS_INGEST_RESULT.REJECTED_INVALID_PAYLOAD,
      'Invalid GPS session status.',
    )
  }
  return {
    sessionId: String(input.sessionId || createGpsUuid()),
    clubId: assertRequired(
      input.clubId,
      GPS_INGEST_RESULT.REJECTED_INVALID_PAYLOAD,
      'clubId is required.',
    ),
    teamId: assertRequired(
      input.teamId,
      GPS_INGEST_RESULT.REJECTED_INVALID_PAYLOAD,
      'teamId is required.',
    ),
    sessionType,
    name: input.name ?? null,
    status,
    startedAt: toIso(input.startedAt),
    endedAt: toIso(input.endedAt),
    cancelledAt: toIso(input.cancelledAt),
    createdBy: input.createdBy ?? null,
    syncStatus: input.syncStatus || GPS_SYNC_STATUS.NOT_SYNCED,
    createdAt,
    updatedAt,
  }
}

function normalizeTrackerInput(input = {}) {
  const trackerId = String(input.trackerId || input.id || createGpsUuid())
  const status = input.status || 'active'
  return {
    trackerId,
    clubId: assertRequired(
      input.clubId,
      GPS_INGEST_RESULT.REJECTED_INVALID_PAYLOAD,
      'clubId is required.',
    ),
    serialNumber: assertRequired(
      input.serialNumber,
      GPS_INGEST_RESULT.REJECTED_INVALID_PAYLOAD,
      'serialNumber is required.',
    ),
    label: input.label ?? null,
    status,
    credentialKeyId: input.credentialKeyId ?? input.credential_key_id ?? null,
    credentialPublicKey: input.credentialPublicKey ?? input.credential_public_key ?? null,
    credentialAlgorithm: input.credentialAlgorithm ?? input.credential_algorithm ?? null,
    revokedAt: toIso(input.revokedAt ?? input.revoked_at),
    lastSyncedAt: toIso(input.lastSyncedAt ?? input.last_synced_at),
    updatedAt: toIso(input.updatedAt) || isoNow(),
  }
}

async function getTeamPlayer(db, teamId, teamPlayerId) {
  if (!teamPlayerId || !db.objectStoreNames.contains(TEAM_PLAYERS_STORE)) return null
  const row = await db.get(TEAM_PLAYERS_STORE, String(teamPlayerId))
  if (!row || row.teamId !== teamId) return null
  return row
}

async function getSessionAssignments(tx, sessionId) {
  return tx.objectStore(GPS_ASSIGNMENTS_STORE).index('sessionId').getAll(sessionId)
}

export function isOpenActiveGpsAssignment(assignment) {
  return assignment?.status === GPS_ASSIGNMENT_STATUS.ACTIVE && !assignment.assignedTo
}

function assignmentCoversTime(assignment, capturedAtMs) {
  if (!assignment || assignment.status === GPS_ASSIGNMENT_STATUS.CANCELLED) return false
  const fromMs = timestampToMs(assignment.assignedFrom)
  const toMs = timestampToMs(assignment.assignedTo)
  if (fromMs != null && capturedAtMs < fromMs) return false
  if (toMs != null && capturedAtMs > toMs) return false
  return true
}

function validatePayloadShape(input = {}, receivedAtMs, futureToleranceMs) {
  const sessionId = assertRequired(
    input.sessionId,
    GPS_INGEST_RESULT.REJECTED_INVALID_PAYLOAD,
    'sessionId is required.',
  )
  const trackerId = assertRequired(
    input.trackerId,
    GPS_INGEST_RESULT.REJECTED_INVALID_PAYLOAD,
    'trackerId is required.',
  )
  const trackerStreamId = assertRequired(
    input.trackerStreamId,
    GPS_INGEST_RESULT.REJECTED_INVALID_PAYLOAD,
    'trackerStreamId is required.',
  )
  const sequence = Number(input.sequence)
  const capturedAtMs = timestampToMs(input.capturedAt)
  const latitude = Number(input.latitude)
  const longitude = Number(input.longitude)
  const speedMps = input.speedMps == null ? null : Number(input.speedMps)
  const accuracyM = input.accuracyM == null ? null : Number(input.accuracyM)

  if (!Number.isInteger(sequence) || sequence < 0) {
    throw new GpsLocalError(GPS_INGEST_RESULT.REJECTED_INVALID_PAYLOAD, 'Invalid GPS sequence.')
  }
  if (capturedAtMs == null) {
    throw new GpsLocalError(
      GPS_INGEST_RESULT.REJECTED_INVALID_PAYLOAD,
      'Invalid capturedAt timestamp.',
    )
  }
  if (capturedAtMs > receivedAtMs + futureToleranceMs) {
    throw new GpsLocalError(
      GPS_INGEST_RESULT.REJECTED_INVALID_PAYLOAD,
      'GPS timestamp is too far in the future.',
    )
  }
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new GpsLocalError(GPS_INGEST_RESULT.REJECTED_INVALID_PAYLOAD, 'Invalid GPS latitude.')
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new GpsLocalError(GPS_INGEST_RESULT.REJECTED_INVALID_PAYLOAD, 'Invalid GPS longitude.')
  }
  if (speedMps != null && (!Number.isFinite(speedMps) || speedMps < 0)) {
    throw new GpsLocalError(GPS_INGEST_RESULT.REJECTED_INVALID_PAYLOAD, 'Invalid GPS speed.')
  }
  if (accuracyM != null && (!Number.isFinite(accuracyM) || accuracyM < 0)) {
    throw new GpsLocalError(GPS_INGEST_RESULT.REJECTED_INVALID_PAYLOAD, 'Invalid GPS accuracy.')
  }

  return {
    sessionId,
    trackerId,
    trackerStreamId,
    sequence,
    capturedAtMs,
    capturedAt: new Date(capturedAtMs).toISOString(),
    latitude,
    longitude,
    speedMps,
    accuracyM,
    batteryPercent: input.batteryPercent == null ? null : Number(input.batteryPercent),
  }
}

function sessionAcceptsCapturedAt(session, capturedAtMs) {
  if (session.status === GPS_SESSION_STATUS.ACTIVE) {
    const startedAtMs = timestampToMs(session.startedAt)
    return startedAtMs == null || capturedAtMs >= startedAtMs
  }
  if (session.status === GPS_SESSION_STATUS.ENDED) {
    const endedAtMs = timestampToMs(session.endedAt)
    return endedAtMs != null && capturedAtMs <= endedAtMs
  }
  return false
}

function removeSequenceFromMissingRanges(ranges = [], sequence) {
  const next = []
  for (const range of ranges) {
    if (sequence < range.from || sequence > range.to) {
      next.push(range)
    } else {
      if (sequence > range.from) next.push({ from: range.from, to: sequence - 1 })
      if (sequence < range.to) next.push({ from: sequence + 1, to: range.to })
    }
  }
  return next
}

function updateStreamState(existing, sample, receivedAt) {
  const lastReceivedSequence = existing?.lastReceivedSequence
  let missingRanges = removeSequenceFromMissingRanges(
    existing?.missingRanges || [],
    sample.sequence,
  )
  let nextLastReceived = sample.sequence
  if (Number.isInteger(lastReceivedSequence)) {
    nextLastReceived = Math.max(lastReceivedSequence, sample.sequence)
    if (sample.sequence > lastReceivedSequence + 1) {
      missingRanges = [
        ...missingRanges,
        { from: lastReceivedSequence + 1, to: sample.sequence - 1 },
      ]
    }
  }
  return {
    ...(existing || {}),
    streamKey: streamKey(sample.sessionId, sample.trackerId, sample.trackerStreamId),
    sessionId: sample.sessionId,
    trackerId: sample.trackerId,
    trackerStreamId: sample.trackerStreamId,
    lastReceivedSequence: nextLastReceived,
    missingRanges,
    lastAcknowledgedSequence: existing?.lastAcknowledgedSequence ?? null,
    acknowledgedRanges: existing?.acknowledgedRanges || [],
    connectionStatus: GPS_CONNECTION_STATUS.CONNECTED,
    lastSeenAt: receivedAt,
    updatedAt: receivedAt,
  }
}

async function appendSampleToChunk(tx, sample, assignment, session, receivedAt) {
  const sampleChunkStart = chunkStartForSequence(sample.sequence)
  const key = chunkKey(
    session.sessionId,
    sample.trackerId,
    sample.trackerStreamId,
    sampleChunkStart,
  )
  const chunkStore = tx.objectStore(GPS_SAMPLE_CHUNKS_STORE)
  const existing = await chunkStore.get(key)
  if (existing?.samples?.some((stored) => stored.sequence === sample.sequence)) {
    return { duplicate: true, chunk: existing }
  }
  if (existing && existing.assignmentId !== assignment.assignmentId) {
    throw new GpsLocalError(
      GPS_INGEST_RESULT.REJECTED_INVALID_PAYLOAD,
      'A GPS chunk cannot mix assignment identities. Use a new tracker stream after reassignment.',
    )
  }

  const storedSample = {
    sequence: sample.sequence,
    capturedAt: sample.capturedAt,
    latitude: sample.latitude,
    longitude: sample.longitude,
    speedMps: sample.speedMps,
    accuracyM: sample.accuracyM,
  }
  const samples = [...(existing?.samples || []), storedSample].sort(
    (a, b) => a.sequence - b.sequence,
  )
  const chunk = {
    ...(existing || {}),
    chunkKey: key,
    sessionId: session.sessionId,
    clubId: session.clubId,
    teamId: session.teamId,
    trackerId: sample.trackerId,
    trackerStreamId: sample.trackerStreamId,
    assignmentId: assignment.assignmentId,
    chunkStartSequence: sampleChunkStart,
    chunkEndSequence: Math.max(
      sample.sequence,
      existing?.chunkEndSequence ?? sampleChunkStart,
      ...samples.map((s) => s.sequence),
    ),
    samples,
    sealed: samples.length >= GPS_SAMPLE_CHUNK_SIZE,
    syncStatus: existing?.syncStatus || GPS_SYNC_STATUS.NOT_SYNCED,
    createdAt: existing?.createdAt || receivedAt,
    uploadedAt: existing?.uploadedAt ?? null,
    uploadAttempts: existing?.uploadAttempts || 0,
    lastError: existing?.lastError ?? null,
  }
  await chunkStore.put(chunk)
  await ensureGpsSyncQueueItem(tx.objectStore(GPS_SYNC_QUEUE_STORE), {
    kind: GPS_SYNC_QUEUE_KIND.SAMPLE_CHUNK,
    entityKey: key,
    createdAt: receivedAt,
  })
  return { duplicate: false, chunk }
}

async function updateLatestState(tx, sample, assignment, receivedAt) {
  const store = tx.objectStore(GPS_LATEST_STORE)
  const key = latestKey(sample.sessionId, sample.trackerId)
  const existing = await store.get(key)
  const existingCapturedAtMs = timestampToMs(existing?.capturedAt) ?? -Infinity
  if (existing && existingCapturedAtMs > sample.capturedAtMs) return existing

  const latest = {
    latestKey: key,
    sessionId: sample.sessionId,
    clubId: assignment.clubId,
    teamId: assignment.teamId,
    trackerId: sample.trackerId,
    assignmentId: assignment.assignmentId,
    teamPlayerId: assignment.teamPlayerId,
    trackerStreamId: sample.trackerStreamId,
    sequence: sample.sequence,
    capturedAt: sample.capturedAt,
    latitude: sample.latitude,
    longitude: sample.longitude,
    speedMps: sample.speedMps,
    accuracyM: sample.accuracyM,
    batteryPercent: Number.isFinite(sample.batteryPercent) ? sample.batteryPercent : null,
    connectionStatus: GPS_CONNECTION_STATUS.CONNECTED,
    updatedAt: receivedAt,
  }
  await store.put(latest)
  return latest
}

export async function upsertLocalGpsTracker(input) {
  const tracker = normalizeTrackerInput(input)
  const db = await getDB()
  await db.put(GPS_TRACKERS_STORE, tracker)
  return tracker
}

export async function getLocalGpsTracker(trackerId) {
  const db = await getDB()
  return db.get(GPS_TRACKERS_STORE, String(trackerId))
}

export async function getLocalGpsTrackersForClub(clubId) {
  const db = await getDB()
  const trackers = await db.getAllFromIndex(GPS_TRACKERS_STORE, 'clubId', String(clubId))
  return trackers.sort((a, b) =>
    String(a.label || a.serialNumber || a.trackerId).localeCompare(
      String(b.label || b.serialNumber || b.trackerId),
    ),
  )
}

export async function createLocalGpsSession(input) {
  const session = normalizeSessionInput(input)
  const db = await getDB()
  const tx = db.transaction([GPS_SESSIONS_STORE, GPS_SYNC_QUEUE_STORE], 'readwrite')
  await tx.objectStore(GPS_SESSIONS_STORE).put(session)
  await ensureGpsSyncQueueItem(tx.objectStore(GPS_SYNC_QUEUE_STORE), {
    kind: GPS_SYNC_QUEUE_KIND.SESSION,
    entityKey: session.sessionId,
    createdAt: session.createdAt,
  })
  await tx.done
  return session
}

export async function getLocalGpsSession(sessionId) {
  const db = await getDB()
  return db.get(GPS_SESSIONS_STORE, String(sessionId))
}

export async function getLocalGpsSessionsForTeam(teamId) {
  const db = await getDB()
  const sessions = await db.getAllFromIndex(GPS_SESSIONS_STORE, 'teamId', String(teamId))
  return sessions.sort((a, b) => {
    const aTime = timestampToMs(a.startedAt) ?? timestampToMs(a.createdAt) ?? 0
    const bTime = timestampToMs(b.startedAt) ?? timestampToMs(b.createdAt) ?? 0
    return bTime - aTime
  })
}

export async function getRecoverableGpsSessions() {
  const db = await getDB()
  return db.getAllFromIndex(GPS_SESSIONS_STORE, 'status', GPS_SESSION_STATUS.ACTIVE)
}

async function updateSessionStatus(sessionId, changes) {
  const db = await getDB()
  const tx = db.transaction(
    [GPS_SESSIONS_STORE, GPS_ASSIGNMENTS_STORE, GPS_SYNC_QUEUE_STORE],
    'readwrite',
  )
  const sessionStore = tx.objectStore(GPS_SESSIONS_STORE)
  const session = await sessionStore.get(String(sessionId))
  if (!session)
    throw new GpsLocalError(GPS_INGEST_RESULT.REJECTED_SESSION_INACTIVE, 'GPS session not found.')
  const updatedAt = isoNow()
  const updated = {
    ...session,
    ...changes,
    syncStatus: GPS_SYNC_STATUS.NOT_SYNCED,
    updatedAt,
  }
  await sessionStore.put(updated)

  if (changes.status === GPS_SESSION_STATUS.ENDED && changes.endedAt) {
    const assignments = await getSessionAssignments(tx, session.sessionId)
    await Promise.all(
      assignments.filter(isOpenActiveGpsAssignment).map((assignment) =>
        tx.objectStore(GPS_ASSIGNMENTS_STORE).put({
          ...assignment,
          assignedTo: changes.endedAt,
          status: GPS_ASSIGNMENT_STATUS.ENDED,
          updatedAt,
        }),
      ),
    )
  }

  await ensureGpsSyncQueueItem(tx.objectStore(GPS_SYNC_QUEUE_STORE), {
    kind: GPS_SYNC_QUEUE_KIND.SESSION,
    entityKey: session.sessionId,
    createdAt: updatedAt,
  })
  await tx.done
  return updated
}

export function startLocalGpsSession(sessionId, startedAt = isoNow()) {
  return updateSessionStatus(sessionId, {
    status: GPS_SESSION_STATUS.ACTIVE,
    startedAt: toIso(startedAt),
    endedAt: null,
    cancelledAt: null,
  })
}

export function endLocalGpsSession(sessionId, endedAt = isoNow()) {
  return updateSessionStatus(sessionId, {
    status: GPS_SESSION_STATUS.ENDED,
    endedAt: toIso(endedAt),
  })
}

export function cancelLocalGpsSession(sessionId, cancelledAt = isoNow()) {
  return updateSessionStatus(sessionId, {
    status: GPS_SESSION_STATUS.CANCELLED,
    cancelledAt: toIso(cancelledAt),
  })
}

export async function createLocalTrackerAssignment(input) {
  const sessionId = assertRequired(
    input?.sessionId,
    GPS_INGEST_RESULT.REJECTED_INVALID_PAYLOAD,
    'sessionId is required.',
  )
  const trackerId = assertRequired(
    input?.trackerId,
    GPS_INGEST_RESULT.REJECTED_INVALID_PAYLOAD,
    'trackerId is required.',
  )
  const teamPlayerId = playerIdentity(input?.teamPlayerId ?? input?.team_player_id)
  const db = await getDB()
  const tx = db.transaction(
    [
      GPS_SESSIONS_STORE,
      GPS_TRACKERS_STORE,
      GPS_ASSIGNMENTS_STORE,
      TEAM_PLAYERS_STORE,
      GPS_SYNC_QUEUE_STORE,
    ],
    'readwrite',
  )
  const session = await tx.objectStore(GPS_SESSIONS_STORE).get(sessionId)
  if (
    !session ||
    ![GPS_SESSION_STATUS.PLANNED, GPS_SESSION_STATUS.ACTIVE].includes(session.status)
  ) {
    throw new GpsLocalError(
      GPS_INGEST_RESULT.REJECTED_SESSION_INACTIVE,
      'GPS session is not assignable.',
    )
  }
  const tracker = await tx.objectStore(GPS_TRACKERS_STORE).get(trackerId)
  if (!tracker || TRACKER_UNAVAILABLE_STATUSES.has(tracker.status)) {
    throw new GpsLocalError(
      GPS_INGEST_RESULT.REJECTED_TRACKER_UNAVAILABLE,
      'Tracker is not available.',
    )
  }
  if (tracker.clubId !== session.clubId) {
    throw new GpsLocalError(
      GPS_INGEST_RESULT.REJECTED_TEAM_MISMATCH,
      'Tracker belongs to another club.',
    )
  }
  const teamPlayer = await getTeamPlayer(
    {
      objectStoreNames: db.objectStoreNames,
      get: (storeName, key) => tx.objectStore(storeName).get(key),
    },
    session.teamId,
    teamPlayerId,
  )
  if (!teamPlayer) {
    throw new GpsLocalError(
      GPS_INGEST_RESULT.REJECTED_TEAM_MISMATCH,
      'Player does not belong to this team.',
    )
  }

  const assignments = await getSessionAssignments(tx, sessionId)
  if (
    assignments.some(
      (assignment) => isOpenActiveGpsAssignment(assignment) && assignment.trackerId === trackerId,
    )
  ) {
    throw new GpsLocalError(
      GPS_INGEST_RESULT.REJECTED_UNASSIGNED_TRACKER,
      'Tracker already has an active assignment in this session.',
    )
  }
  if (
    assignments.some(
      (assignment) =>
        isOpenActiveGpsAssignment(assignment) && assignment.teamPlayerId === teamPlayerId,
    )
  ) {
    throw new GpsLocalError(
      GPS_INGEST_RESULT.REJECTED_UNASSIGNED_TRACKER,
      'Player already has an active tracker assignment in this session.',
    )
  }

  const assignedFrom = toIso(input.assignedFrom) || isoNow()
  const createdAt = toIso(input.createdAt) || isoNow()
  const assignment = {
    assignmentId: String(input.assignmentId || createGpsUuid()),
    sessionId,
    clubId: session.clubId,
    teamId: session.teamId,
    trackerId,
    teamPlayerId,
    assignedFrom,
    assignedTo: toIso(input.assignedTo),
    status: input.status || GPS_ASSIGNMENT_STATUS.ACTIVE,
    createdBy: input.createdBy ?? null,
    syncStatus: GPS_SYNC_STATUS.NOT_SYNCED,
    createdAt,
    updatedAt: createdAt,
  }
  if (!ASSIGNMENT_STATUSES.has(assignment.status)) {
    throw new GpsLocalError(
      GPS_INGEST_RESULT.REJECTED_INVALID_PAYLOAD,
      'Invalid assignment status.',
    )
  }

  await tx.objectStore(GPS_ASSIGNMENTS_STORE).put(assignment)
  await ensureGpsSyncQueueItem(tx.objectStore(GPS_SYNC_QUEUE_STORE), {
    kind: GPS_SYNC_QUEUE_KIND.ASSIGNMENT,
    entityKey: assignment.assignmentId,
    createdAt,
  })
  await tx.done
  return assignment
}

export async function endLocalTrackerAssignment(assignmentId, assignedTo = isoNow()) {
  const db = await getDB()
  const tx = db.transaction([GPS_ASSIGNMENTS_STORE, GPS_SYNC_QUEUE_STORE], 'readwrite')
  const store = tx.objectStore(GPS_ASSIGNMENTS_STORE)
  const assignment = await store.get(String(assignmentId))
  if (!assignment)
    throw new GpsLocalError(GPS_INGEST_RESULT.REJECTED_UNASSIGNED_TRACKER, 'Assignment not found.')
  const updatedAt = isoNow()
  const ended = {
    ...assignment,
    assignedTo: toIso(assignedTo),
    status: GPS_ASSIGNMENT_STATUS.ENDED,
    syncStatus: GPS_SYNC_STATUS.NOT_SYNCED,
    updatedAt,
  }
  await store.put(ended)
  await ensureGpsSyncQueueItem(tx.objectStore(GPS_SYNC_QUEUE_STORE), {
    kind: GPS_SYNC_QUEUE_KIND.ASSIGNMENT,
    entityKey: ended.assignmentId,
    createdAt: updatedAt,
  })
  await tx.done
  return ended
}

export async function getLocalGpsAssignmentsForSession(sessionId) {
  const db = await getDB()
  return db.getAllFromIndex(GPS_ASSIGNMENTS_STORE, 'sessionId', String(sessionId))
}

export async function ingestLocalGpsSample(input, options = {}) {
  const receivedAtMs = timestampToMs(options.receivedAt) ?? nowMs()
  const receivedAt = new Date(receivedAtMs).toISOString()
  const futureToleranceMs = options.futureToleranceMs ?? GPS_DEFAULT_FUTURE_TOLERANCE_MS
  let sample
  try {
    sample = validatePayloadShape(input, receivedAtMs, futureToleranceMs)
  } catch (error) {
    return {
      code: error.code || GPS_INGEST_RESULT.REJECTED_INVALID_PAYLOAD,
      accepted: false,
      reason: error.message,
    }
  }

  const db = await getDB()
  const stores = [
    GPS_SESSIONS_STORE,
    GPS_TRACKERS_STORE,
    GPS_ASSIGNMENTS_STORE,
    GPS_SAMPLE_CHUNKS_STORE,
    GPS_LATEST_STORE,
    GPS_STREAM_STATE_STORE,
    GPS_SYNC_QUEUE_STORE,
  ]
  const tx = db.transaction(stores, 'readwrite')

  try {
    const session = await tx.objectStore(GPS_SESSIONS_STORE).get(sample.sessionId)
    if (!session || !sessionAcceptsCapturedAt(session, sample.capturedAtMs)) {
      await tx.done
      return { code: GPS_INGEST_RESULT.REJECTED_SESSION_INACTIVE, accepted: false }
    }

    const tracker = await tx.objectStore(GPS_TRACKERS_STORE).get(sample.trackerId)
    if (!tracker) {
      await tx.done
      return { code: GPS_INGEST_RESULT.REJECTED_UNASSIGNED_TRACKER, accepted: false }
    }
    if (TRACKER_UNAVAILABLE_STATUSES.has(tracker.status)) {
      await tx.done
      return { code: GPS_INGEST_RESULT.REJECTED_TRACKER_UNAVAILABLE, accepted: false }
    }
    if (tracker.clubId !== session.clubId) {
      await tx.done
      return { code: GPS_INGEST_RESULT.REJECTED_TEAM_MISMATCH, accepted: false }
    }

    const assignments = await tx
      .objectStore(GPS_ASSIGNMENTS_STORE)
      .index('trackerSession')
      .getAll([sample.sessionId, sample.trackerId])
    const assignment = assignments
      .filter((row) => row.teamId === session.teamId && row.clubId === session.clubId)
      .find((row) => assignmentCoversTime(row, sample.capturedAtMs))
    if (!assignment) {
      await tx.done
      return { code: GPS_INGEST_RESULT.REJECTED_UNASSIGNED_TRACKER, accepted: false }
    }

    const appendResult = await appendSampleToChunk(tx, sample, assignment, session, receivedAt)
    if (appendResult.duplicate) {
      await tx.done
      return {
        code: GPS_INGEST_RESULT.DUPLICATE,
        accepted: false,
        sessionId: sample.sessionId,
        trackerId: sample.trackerId,
        trackerStreamId: sample.trackerStreamId,
        sequence: sample.sequence,
      }
    }

    const streamStore = tx.objectStore(GPS_STREAM_STATE_STORE)
    const key = streamKey(sample.sessionId, sample.trackerId, sample.trackerStreamId)
    const streamState = updateStreamState(await streamStore.get(key), sample, receivedAt)
    await streamStore.put(streamState)
    const latest = await updateLatestState(tx, sample, assignment, receivedAt)
    await tx.done

    return {
      code: GPS_INGEST_RESULT.ACCEPTED,
      accepted: true,
      sessionId: sample.sessionId,
      trackerId: sample.trackerId,
      trackerStreamId: sample.trackerStreamId,
      sequence: sample.sequence,
      assignmentId: assignment.assignmentId,
      teamPlayerId: assignment.teamPlayerId,
      chunkKey: appendResult.chunk.chunkKey,
      latest,
      streamState,
    }
  } catch (error) {
    tx.abort()
    await tx.done.catch(() => {})
    return {
      code: error.code || GPS_INGEST_RESULT.REJECTED_INVALID_PAYLOAD,
      accepted: false,
      reason: error.message,
    }
  }
}

export async function getLatestGpsStatesForSession(sessionId) {
  const db = await getDB()
  return db.getAllFromIndex(GPS_LATEST_STORE, 'sessionId', String(sessionId))
}

export async function getTrackerStreamState(sessionId, trackerId, trackerStreamId) {
  const db = await getDB()
  return db.get(GPS_STREAM_STATE_STORE, streamKey(sessionId, trackerId, trackerStreamId))
}

export async function getGpsSampleChunksForSession(sessionId) {
  const db = await getDB()
  return db.getAllFromIndex(GPS_SAMPLE_CHUNKS_STORE, 'sessionId', String(sessionId))
}

export async function getGpsSyncQueueItems() {
  const db = await getDB()
  return db.getAll(GPS_SYNC_QUEUE_STORE)
}

export async function markGpsSampleChunkSynced(chunkKey, { uploadedAt = isoNow() } = {}) {
  const db = await getDB()
  const tx = db.transaction([GPS_SAMPLE_CHUNKS_STORE, GPS_SYNC_QUEUE_STORE], 'readwrite')
  const chunkStore = tx.objectStore(GPS_SAMPLE_CHUNKS_STORE)
  const chunk = await chunkStore.get(String(chunkKey))
  if (!chunk) {
    await tx.done
    return null
  }

  const synced = {
    ...chunk,
    syncStatus: GPS_SYNC_STATUS.SYNCED,
    uploadedAt: toIso(uploadedAt) || isoNow(),
    lastError: null,
  }
  await chunkStore.put(synced)
  await updateGpsSyncQueueEntityStatus(
    tx.objectStore(GPS_SYNC_QUEUE_STORE),
    syncQueueEntityKey(GPS_SYNC_QUEUE_KIND.SAMPLE_CHUNK, synced.chunkKey),
    GPS_SYNC_QUEUE_STATUS.SYNCED,
    synced.uploadedAt,
  )
  await tx.done
  return synced
}

export async function getGpsSampleCountForSession(sessionId) {
  const chunks = await getGpsSampleChunksForSession(sessionId)
  return chunks.reduce((count, chunk) => count + (chunk.samples?.length || 0), 0)
}

export async function getGpsChunkCountForSession(sessionId) {
  const db = await getDB()
  return db.countFromIndex(GPS_SAMPLE_CHUNKS_STORE, 'sessionId', String(sessionId))
}

export async function getUnsyncedGpsChunkCount(sessionId) {
  const chunks = await getGpsSampleChunksForSession(sessionId)
  return chunks.filter((chunk) => !chunk.uploadedAt && chunk.syncStatus !== GPS_SYNC_STATUS.SYNCED)
    .length
}

export async function getGpsStorageSummary(sessionId) {
  const chunks = await getGpsSampleChunksForSession(sessionId)
  const latest = await getLatestGpsStatesForSession(sessionId)
  const assignments = await getLocalGpsAssignmentsForSession(sessionId)
  const sampleCount = chunks.reduce((count, chunk) => count + (chunk.samples?.length || 0), 0)
  const unsyncedChunks = chunks.filter(
    (chunk) => !chunk.uploadedAt && chunk.syncStatus !== GPS_SYNC_STATUS.SYNCED,
  ).length
  return {
    sessionId: String(sessionId),
    sampleCount,
    chunkCount: chunks.length,
    unsyncedChunks,
    latestCount: latest.length,
    assignmentCount: assignments.length,
    approximateObjectCount: 1 + assignments.length + chunks.length + latest.length,
  }
}

async function getGpsSessionStorageStatus(db, session) {
  const sessionId = String(session.sessionId)
  const [chunks, latest, assignments, streamStates, queueItems] = await Promise.all([
    db.getAllFromIndex(GPS_SAMPLE_CHUNKS_STORE, 'sessionId', sessionId),
    db.getAllFromIndex(GPS_LATEST_STORE, 'sessionId', sessionId),
    db.getAllFromIndex(GPS_ASSIGNMENTS_STORE, 'sessionId', sessionId),
    db.getAllFromIndex(GPS_STREAM_STATE_STORE, 'sessionId', sessionId),
    db.getAll(GPS_SYNC_QUEUE_STORE),
  ])
  const assignmentKeys = new Set(
    assignments.map((assignment) =>
      syncQueueEntityKey(GPS_SYNC_QUEUE_KIND.ASSIGNMENT, assignment.assignmentId),
    ),
  )
  const chunkKeys = new Set(
    chunks.map((chunk) => syncQueueEntityKey(GPS_SYNC_QUEUE_KIND.SAMPLE_CHUNK, chunk.chunkKey)),
  )
  const relatedQueueItems = queueItems.filter(
    (item) =>
      item.entityKey === syncQueueEntityKey(GPS_SYNC_QUEUE_KIND.SESSION, sessionId) ||
      assignmentKeys.has(item.entityKey) ||
      chunkKeys.has(item.entityKey),
  )
  const sampleCount = chunks.reduce((count, chunk) => count + (chunk.samples?.length || 0), 0)
  const syncedRawChunks = chunks.filter(isCloudSyncedGpsChunk)
  const unsyncedRawChunks = chunks.filter((chunk) => !isCloudSyncedGpsChunk(chunk))

  return {
    sessionId,
    clubId: session.clubId,
    teamId: session.teamId,
    sessionStatus: session.status,
    isActiveSession: session.status === GPS_SESSION_STATUS.ACTIVE,
    isOperationalSession: isOperationalGpsSession(session),
    rawSampleCount: sampleCount,
    rawChunkCount: chunks.length,
    syncedRawChunkCount: syncedRawChunks.length,
    unsyncedRawChunkCount: unsyncedRawChunks.length,
    latestCount: latest.length,
    assignmentCount: assignments.length,
    streamStateCount: streamStates.length,
    syncQueueCount: relatedQueueItems.length,
    rawSampleBytesApprox: JSON.stringify(chunks).length,
    metadataObjectCount: 1 + assignments.length + latest.length + streamStates.length,
    queueObjectCount: relatedQueueItems.length,
  }
}

export async function getLocalGpsStorageStatus({ sessionId = null } = {}) {
  const db = await getDB()
  const sessions = sessionId
    ? [await db.get(GPS_SESSIONS_STORE, String(sessionId))].filter(Boolean)
    : await db.getAll(GPS_SESSIONS_STORE)
  const sessionStatuses = await Promise.all(
    sessions.map((session) => getGpsSessionStorageStatus(db, session)),
  )

  return {
    sessionId: sessionId == null ? null : String(sessionId),
    sessions: sessionStatuses,
    totals: sessionStatuses.reduce(
      (totals, session) => ({
        rawSampleCount: totals.rawSampleCount + session.rawSampleCount,
        rawChunkCount: totals.rawChunkCount + session.rawChunkCount,
        syncedRawChunkCount: totals.syncedRawChunkCount + session.syncedRawChunkCount,
        unsyncedRawChunkCount: totals.unsyncedRawChunkCount + session.unsyncedRawChunkCount,
        latestCount: totals.latestCount + session.latestCount,
        assignmentCount: totals.assignmentCount + session.assignmentCount,
        streamStateCount: totals.streamStateCount + session.streamStateCount,
        syncQueueCount: totals.syncQueueCount + session.syncQueueCount,
      }),
      {
        rawSampleCount: 0,
        rawChunkCount: 0,
        syncedRawChunkCount: 0,
        unsyncedRawChunkCount: 0,
        latestCount: 0,
        assignmentCount: 0,
        streamStateCount: 0,
        syncQueueCount: 0,
      },
    ),
  }
}

async function findCleanupCandidateForSession(db, session) {
  if (!session) {
    return {
      sessionId: null,
      eligibleRawChunkKeys: [],
      eligibleLatestKeys: [],
      eligibleStreamStateKeys: [],
      retainedRawChunkKeys: [],
      blockers: [GPS_CLEANUP_REASON.SESSION_NOT_FOUND],
    }
  }

  const sessionId = String(session.sessionId)
  const [chunks, latest, streamStates] = await Promise.all([
    db.getAllFromIndex(GPS_SAMPLE_CHUNKS_STORE, 'sessionId', sessionId),
    db.getAllFromIndex(GPS_LATEST_STORE, 'sessionId', sessionId),
    db.getAllFromIndex(GPS_STREAM_STATE_STORE, 'sessionId', sessionId),
  ])
  const blockers = []
  if (session.status === GPS_SESSION_STATUS.ACTIVE) blockers.push(GPS_CLEANUP_REASON.ACTIVE_SESSION)

  const syncedChunks = chunks.filter(isCloudSyncedGpsChunk)
  const retainedChunks = chunks.filter((chunk) => !isCloudSyncedGpsChunk(chunk))
  if (retainedChunks.length > 0) blockers.push(GPS_CLEANUP_REASON.UNSYNCED_RAW_RETAINED)

  const canDeleteRaw = session.status !== GPS_SESSION_STATUS.ACTIVE
  const canDeleteDerivedCaches = canDeleteRaw && retainedChunks.length === 0

  return {
    sessionId,
    sessionStatus: session.status,
    eligibleRawChunkKeys: canDeleteRaw ? syncedChunks.map((chunk) => chunk.chunkKey) : [],
    eligibleLatestKeys: canDeleteDerivedCaches ? latest.map((row) => row.latestKey) : [],
    eligibleStreamStateKeys: canDeleteDerivedCaches ? streamStates.map((row) => row.streamKey) : [],
    retainedRawChunkKeys: retainedChunks.map((chunk) => chunk.chunkKey),
    blockers,
  }
}

export async function findGpsDataEligibleForCleanup({ sessionId = null } = {}) {
  const db = await getDB()
  const sessions = sessionId
    ? [await db.get(GPS_SESSIONS_STORE, String(sessionId))]
    : await db.getAll(GPS_SESSIONS_STORE)
  const candidates = await Promise.all(
    sessions.map((session) => findCleanupCandidateForSession(db, session)),
  )
  return {
    sessionId: sessionId == null ? null : String(sessionId),
    sessions: candidates,
    eligibleRawChunkKeys: candidates.flatMap((candidate) => candidate.eligibleRawChunkKeys),
    eligibleLatestKeys: candidates.flatMap((candidate) => candidate.eligibleLatestKeys),
    eligibleStreamStateKeys: candidates.flatMap((candidate) => candidate.eligibleStreamStateKeys),
  }
}

export async function cleanupSyncedGpsSession(sessionId, { includeDerivedCaches = true } = {}) {
  const db = await getDB()
  const session = await db.get(GPS_SESSIONS_STORE, String(sessionId))
  const candidate = await findCleanupCandidateForSession(db, session)
  if (candidate.blockers.includes(GPS_CLEANUP_REASON.ACTIVE_SESSION)) {
    return {
      sessionId: String(sessionId),
      deletedRawChunkCount: 0,
      deletedLatestCount: 0,
      deletedStreamStateCount: 0,
      deletedQueueItemCount: 0,
      blockers: candidate.blockers,
    }
  }

  const stores = [
    GPS_SAMPLE_CHUNKS_STORE,
    GPS_LATEST_STORE,
    GPS_STREAM_STATE_STORE,
    GPS_SYNC_QUEUE_STORE,
  ]
  const tx = db.transaction(stores, 'readwrite')
  const chunkStore = tx.objectStore(GPS_SAMPLE_CHUNKS_STORE)
  const latestStore = tx.objectStore(GPS_LATEST_STORE)
  const streamStore = tx.objectStore(GPS_STREAM_STATE_STORE)
  const queueStore = tx.objectStore(GPS_SYNC_QUEUE_STORE)
  let deletedRawChunkCount = 0
  let deletedLatestCount = 0
  let deletedStreamStateCount = 0
  let deletedQueueItemCount = 0

  for (const chunkKeyToDelete of candidate.eligibleRawChunkKeys) {
    if (await chunkStore.get(chunkKeyToDelete)) {
      await chunkStore.delete(chunkKeyToDelete)
      deletedRawChunkCount += 1
    }
    const entityKey = syncQueueEntityKey(GPS_SYNC_QUEUE_KIND.SAMPLE_CHUNK, chunkKeyToDelete)
    const queueRows = await queueStore.index('entityKey').getAll(entityKey)
    await Promise.all(
      queueRows
        .filter((item) => item.status === GPS_SYNC_QUEUE_STATUS.SYNCED)
        .map((item) => {
          deletedQueueItemCount += 1
          return queueStore.delete(item.id)
        }),
    )
  }

  if (includeDerivedCaches) {
    for (const latestKeyToDelete of candidate.eligibleLatestKeys) {
      if (await latestStore.get(latestKeyToDelete)) {
        await latestStore.delete(latestKeyToDelete)
        deletedLatestCount += 1
      }
    }
    for (const streamKeyToDelete of candidate.eligibleStreamStateKeys) {
      if (await streamStore.get(streamKeyToDelete)) {
        await streamStore.delete(streamKeyToDelete)
        deletedStreamStateCount += 1
      }
    }
  }

  await tx.done
  return {
    sessionId: String(sessionId),
    deletedRawChunkCount,
    deletedLatestCount,
    deletedStreamStateCount,
    deletedQueueItemCount,
    blockers: candidate.blockers,
  }
}

export function estimateGpsChunkCount(sampleCount, chunkSize = GPS_SAMPLE_CHUNK_SIZE) {
  const count = Math.max(0, Number(sampleCount) || 0)
  return Math.ceil(count / chunkSize)
}

export function estimateGpsObjectCount({
  trackerCount = 0,
  sampleCount = 0,
  samplesPerTracker = null,
  assignmentCount = trackerCount,
  chunkSize = GPS_SAMPLE_CHUNK_SIZE,
} = {}) {
  const trackers = Math.max(0, Number(trackerCount) || 0)
  const totalSamples = Math.max(0, Number(sampleCount) || 0)
  const perTrackerSamples =
    samplesPerTracker == null
      ? trackers > 0
        ? Math.ceil(totalSamples / trackers)
        : totalSamples
      : Math.max(0, Number(samplesPerTracker) || 0)
  const chunkCount =
    trackers > 0
      ? trackers * estimateGpsChunkCount(perTrackerSamples, chunkSize)
      : estimateGpsChunkCount(totalSamples, chunkSize)
  return {
    trackerCount: trackers,
    sampleCount: totalSamples,
    samplesPerTracker: trackers > 0 ? perTrackerSamples : totalSamples,
    assignmentCount,
    chunkCount,
    latestCount: trackers,
    streamStateCount: trackers,
    queueItemCountApprox: 1 + assignmentCount + chunkCount,
    approximateObjectCount: 1 + assignmentCount + chunkCount + trackers + trackers,
  }
}
