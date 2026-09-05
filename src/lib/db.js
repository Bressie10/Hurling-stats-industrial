import { openDB } from 'idb'
import {
  PERSONAL_TEAM_SCOPE,
  currentTeamScope,
  normalizeTeamScope,
  scopeMatches,
  teamIdFromScope,
} from './team-scope.js'
import {
  INACTIVE_PLAYER_STATUS,
  isActivePlayer,
  normalizeRosterPlayer,
  playerHasDisplayName,
  playerIdentity,
} from './team-players.js'

const DB_NAME = 'doora-stats'
// IMPORTANT: bump DB_VERSION whenever you add a new store or index.
// Add a `case N:` block in the upgrade switch below — never remove old cases.
// idb runs all cases from oldVersion+1 up to newVersion, so migrations are cumulative.
const DB_VERSION = 6
const LEGACY_SQUAD_STORE = 'squad'
const SQUAD_BY_TEAM_STORE = 'squad_by_team'
const TEAM_PLAYERS_STORE = 'team_players_by_team'
const GPS_STORE_NAMES = [
  'gps_trackers',
  'gps_sessions',
  'gps_tracker_assignments',
  'gps_sample_chunks',
  'gps_latest',
  'gps_tracker_stream_state',
  'gps_sync_queue',
]
const PRIVACY_TOMBSTONES_STORE = 'privacy_tombstones'

export async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains('squad')) {
          db.createObjectStore('squad', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('matches')) {
          db.createObjectStore('matches', { keyPath: 'id' })
        }
      }
      // v2: durable outbox + device sentinel. The outbox queues entity
      // mutations for upstream sync; device_state holds the last-authenticated
      // user id so the login flow can detect a real account change without
      // depending on localStorage (which iOS evicts long before IDB).
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains('sync_outbox')) {
          db.createObjectStore('sync_outbox', { keyPath: 'id', autoIncrement: true })
        }
        if (!db.objectStoreNames.contains('device_state')) {
          db.createObjectStore('device_state', { keyPath: 'key' })
        }
      }
      // v3: team-scoped data. Matches can share the existing keyPath because
      // finished match IDs are timestamp-based, but squad local IDs repeat per
      // team. Store team squads under a composite storage key while returning
      // the original player id to the rest of the app.
      if (oldVersion < 3) {
        if (!db.objectStoreNames.contains(SQUAD_BY_TEAM_STORE)) {
          const store = db.createObjectStore(SQUAD_BY_TEAM_STORE, { keyPath: 'storeKey' })
          store.createIndex('teamScope', 'teamScope')
        }
      }
      // v4: canonical stable player identities. The old squad stores are kept
      // as legacy local data only; active reads/writes use UUID-backed players.
      if (oldVersion < 4) {
        if (!db.objectStoreNames.contains(TEAM_PLAYERS_STORE)) {
          const store = db.createObjectStore(TEAM_PLAYERS_STORE, { keyPath: 'id' })
          store.createIndex('teamScope', 'teamScope')
          store.createIndex('teamId', 'teamId')
        }
      }
      // v5: local-first GPS foundation. Raw GPS samples use chunked storage and
      // a GPS-specific sync queue so high-volume telemetry never goes through
      // the generic match/player sync_outbox.
      if (oldVersion < 5) {
        if (!db.objectStoreNames.contains('gps_trackers')) {
          const store = db.createObjectStore('gps_trackers', { keyPath: 'trackerId' })
          store.createIndex('clubId', 'clubId')
          store.createIndex('status', 'status')
        }
        if (!db.objectStoreNames.contains('gps_sessions')) {
          const store = db.createObjectStore('gps_sessions', { keyPath: 'sessionId' })
          store.createIndex('clubId', 'clubId')
          store.createIndex('teamId', 'teamId')
          store.createIndex('status', 'status')
          store.createIndex('syncStatus', 'syncStatus')
        }
        if (!db.objectStoreNames.contains('gps_tracker_assignments')) {
          const store = db.createObjectStore('gps_tracker_assignments', { keyPath: 'assignmentId' })
          store.createIndex('sessionId', 'sessionId')
          store.createIndex('teamId', 'teamId')
          store.createIndex('trackerSession', ['sessionId', 'trackerId'])
          store.createIndex('playerSession', ['sessionId', 'teamPlayerId'])
        }
        if (!db.objectStoreNames.contains('gps_sample_chunks')) {
          const store = db.createObjectStore('gps_sample_chunks', { keyPath: 'chunkKey' })
          store.createIndex('sessionId', 'sessionId')
          store.createIndex('assignmentId', 'assignmentId')
          store.createIndex('trackerStream', ['sessionId', 'trackerId', 'trackerStreamId'])
          store.createIndex('syncStatus', 'syncStatus')
        }
        if (!db.objectStoreNames.contains('gps_latest')) {
          const store = db.createObjectStore('gps_latest', { keyPath: 'latestKey' })
          store.createIndex('sessionId', 'sessionId')
          store.createIndex('teamId', 'teamId')
          store.createIndex('teamPlayerId', 'teamPlayerId')
        }
        if (!db.objectStoreNames.contains('gps_tracker_stream_state')) {
          const store = db.createObjectStore('gps_tracker_stream_state', { keyPath: 'streamKey' })
          store.createIndex('sessionId', 'sessionId')
          store.createIndex('trackerSession', ['sessionId', 'trackerId'])
        }
        if (!db.objectStoreNames.contains('gps_sync_queue')) {
          const store = db.createObjectStore('gps_sync_queue', {
            keyPath: 'id',
            autoIncrement: true,
          })
          store.createIndex('kind', 'kind')
          store.createIndex('status', 'status')
          store.createIndex('entityKey', 'entityKey')
          store.createIndex('nextRetryAt', 'nextRetryAt')
        }
      }
      // v6: privacy tombstones. These are local guards used by deletion/export
      // workflows to stop stale queued writes from recreating revoked player
      // data after the cloud has moved on.
      if (oldVersion < 6) {
        if (!db.objectStoreNames.contains(PRIVACY_TOMBSTONES_STORE)) {
          const store = db.createObjectStore(PRIVACY_TOMBSTONES_STORE, {
            keyPath: 'tombstoneKey',
          })
          store.createIndex('entity', ['entityType', 'entityId'])
          store.createIndex('teamId', 'teamId')
          store.createIndex('createdAt', 'createdAt')
        }
      }
    },
  })
}

function now() {
  return Date.now()
}

function dataScope(options = {}) {
  return normalizeTeamScope(options.teamScope ?? currentTeamScope())
}

function playerStorageRow(player, teamScope, updatedAt = now()) {
  const normalized = normalizeRosterPlayer(player, { updatedAt })
  const id = playerIdentity(normalized)
  return {
    ...normalized,
    id,
    team_player_id: id,
    teamScope,
    teamId: teamIdFromScope(teamScope),
    updated_at: normalized.updated_at || updatedAt,
  }
}

function publicPlayerRow(row) {
  const { teamScope: _teamScope, teamId: _teamId, ...rest } = row
  const id = playerIdentity(rest)
  return {
    ...rest,
    id,
    team_player_id: id,
    teamScope: _teamScope,
    teamId: _teamId ?? teamIdFromScope(_teamScope),
  }
}

function sortRosterRows(rows) {
  return [...rows].sort((a, b) => {
    const numberA = Number(a.number ?? a.default_number ?? 9999)
    const numberB = Number(b.number ?? b.default_number ?? 9999)
    return numberA - numberB || String(a.name || '').localeCompare(String(b.name || ''))
  })
}

function draftIdForScope(teamScope) {
  const scope = normalizeTeamScope(teamScope)
  return scope === PERSONAL_TEAM_SCOPE ? 'draft' : `draft:${scope}`
}

// ── Team players / roster ───────────────────────────────────────────────────
// The public API keeps the historical saveSquad/loadSquad names because the UI
// still calls the roster "squad", but the records are canonical team players.
export async function saveSquad(players, options = {}) {
  const teamScope = dataScope(options)
  const db = await getDB()
  const stampedAt = now()
  const activeRows = players.map((p) => playerStorageRow(p, teamScope, stampedAt))
  const activeIds = new Set(activeRows.map((p) => playerIdentity(p)))
  const tx = db.transaction([TEAM_PLAYERS_STORE, 'sync_outbox'], 'readwrite')
  const store = tx.objectStore(TEAM_PLAYERS_STORE)
  const existingRows = await store.index('teamScope').getAll(teamScope)
  const inactiveRows = existingRows
    .filter((row) => isActivePlayer(row) && !activeIds.has(playerIdentity(row)))
    .map((row) => ({
      ...row,
      status: INACTIVE_PLAYER_STATUS,
      left_at: row.left_at || new Date(stampedAt).toISOString().slice(0, 10),
      updated_at: stampedAt,
    }))
  const syncPayload = [...activeRows, ...inactiveRows]
    .filter((player) => teamIdFromScope(teamScope) && playerHasDisplayName(player))
    .map(publicPlayerRow)
  const writes = [...inactiveRows.map((p) => store.put(p)), ...activeRows.map((p) => store.put(p))]
  if (syncPayload.length > 0) {
    writes.push(
      tx.objectStore('sync_outbox').add({
        op: 'upsert_team_players',
        teamScope,
        team_id: teamIdFromScope(teamScope),
        payload: syncPayload,
        created_at: now(),
        attempts: 0,
        last_error: null,
        next_retry_at: 0,
      }),
    )
  }
  await Promise.all([...writes, tx.done])
}

export async function loadSquad(options = {}) {
  const teamScope = dataScope(options)
  const db = await getDB()
  if (db.objectStoreNames.contains(TEAM_PLAYERS_STORE)) {
    const rows = await db.getAllFromIndex(TEAM_PLAYERS_STORE, 'teamScope', teamScope)
    if (rows.length > 0 || teamScope !== PERSONAL_TEAM_SCOPE) {
      return sortRosterRows(rows.filter(isActivePlayer).map(publicPlayerRow))
    }
  }
  const legacy = await db.getAll(LEGACY_SQUAD_STORE)
  return teamScope === PERSONAL_TEAM_SCOPE
    ? sortRosterRows(
        legacy.map((p) => publicPlayerRow(playerStorageRow(p, teamScope, p.updated_at || 0))),
      )
    : []
}

export async function replaceSquadForScope(players, teamScope) {
  const scope = normalizeTeamScope(teamScope)
  const db = await getDB()
  const tx = db.transaction(TEAM_PLAYERS_STORE, 'readwrite')
  const playerStore = tx.objectStore(TEAM_PLAYERS_STORE)
  const existing = await playerStore.index('teamScope').getAllKeys(scope)
  const writes = [
    ...existing.map((key) => playerStore.delete(key)),
    ...players.map((player) =>
      playerStore.put(playerStorageRow(player, scope, player.updated_at || 0)),
    ),
  ]
  await Promise.all([...writes, tx.done])
}

// ── Matches ─────────────────────────────────────────────────────────────────
// Drafts (id === 'draft' or isDraft === true) never enqueue — they're
// device-local by design. Real matches enqueue an upsert_match mutation.
export async function saveMatch(match, options = {}) {
  const teamScope = dataScope(options)
  const isDraft = match.isDraft === true || match.id === 'draft'
  const stamped = {
    ...match,
    teamScope,
    teamId: teamIdFromScope(teamScope),
    updated_at: now(),
  }
  let lastErr
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const db = await getDB()
      if (isDraft) {
        await db.put('matches', { ...stamped, id: draftIdForScope(teamScope), draftId: 'draft' })
      } else {
        const tx = db.transaction(['matches', 'sync_outbox'], 'readwrite')
        tx.objectStore('matches').put(stamped)
        tx.objectStore('sync_outbox').add({
          op: 'upsert_match',
          entity_id: String(stamped.id),
          teamScope,
          team_id: teamIdFromScope(teamScope),
          payload: stamped,
          created_at: now(),
          attempts: 0,
          last_error: null,
          next_retry_at: 0,
        })
        await tx.done
      }
      return
    } catch (e) {
      lastErr = e
      await new Promise((r) => setTimeout(r, 150 * (attempt + 1)))
    }
  }
  throw lastErr
}

export async function loadMatches(options = {}) {
  const teamScope = dataScope(options)
  const db = await getDB()
  const all = await db.getAll('matches')
  return all.filter((m) => !m.isDraft && scopeMatches(m, teamScope))
}

export async function countFinishedMatches() {
  const db = await getDB()
  const all = await db.getAll('matches')
  return all.filter((m) => !m.isDraft).length
}

// Atomic local delete + cloud-delete intent.
export async function deleteMatch(matchId, options = {}) {
  const db = await getDB()
  const existing = await db.get('matches', matchId)
  const teamScope = normalizeTeamScope(
    options.teamScope ?? existing?.teamScope ?? currentTeamScope(),
  )
  const tx = db.transaction(['matches', 'sync_outbox'], 'readwrite')
  tx.objectStore('matches').delete(matchId)
  tx.objectStore('sync_outbox').add({
    op: 'delete_match',
    entity_id: String(matchId),
    teamScope,
    team_id: teamIdFromScope(teamScope),
    payload: null,
    created_at: now(),
    attempts: 0,
    last_error: null,
    next_retry_at: 0,
  })
  await tx.done
}

// ── Drafts (device-local) ───────────────────────────────────────────────────
export async function saveDraftMatch(match, options = {}) {
  const teamScope = dataScope(options)
  let lastErr
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const db = await getDB()
      await db.put('matches', {
        ...match,
        id: draftIdForScope(teamScope),
        draftId: 'draft',
        isDraft: true,
        teamScope,
        teamId: teamIdFromScope(teamScope),
        updated_at: now(),
      })
      return
    } catch (e) {
      lastErr = e
      await new Promise((r) => setTimeout(r, 100 * (attempt + 1)))
    }
  }
  console.warn('saveDraftMatch failed after 3 attempts:', lastErr)
}

export async function loadDraftMatch(options = {}) {
  const teamScope = dataScope(options)
  const db = await getDB()
  const scoped = await db.get('matches', draftIdForScope(teamScope))
  if (scoped || teamScope !== PERSONAL_TEAM_SCOPE) return scoped
  return db.get('matches', 'draft')
}

export async function clearDraftMatch(options = {}) {
  const teamScope = dataScope(options)
  const db = await getDB()
  await db.delete('matches', draftIdForScope(teamScope))
}

// Poison the draft record so it won't be auto-resumed even if clearDraftMatch
// hasn't run yet. Called immediately after saveMatch succeeds in finishMatch()
// to prevent duplicate matches if the app crashes between saveMatch and clearDraftMatch.
export async function markDraftSaved(options = {}) {
  const teamScope = dataScope(options)
  try {
    const db = await getDB()
    const key = draftIdForScope(teamScope)
    const draft = await db.get('matches', key)
    if (draft) {
      await db.put('matches', { ...draft, _saved: true })
    }
  } catch (e) {
    console.warn('markDraftSaved failed:', e)
  }
}

// ── Wipes ───────────────────────────────────────────────────────────────────
// Used on sign-out and on real user change. Wipes entity data AND outbox AND
// device sentinel so the next login starts from a clean slate. NEVER call this
// "just in case" during a normal login — that's the bug that destroyed drafts.
// Use the login flow in +layout.svelte which only wipes on a real user change.
export async function clearAllData() {
  const db = await getDB()
  const stores = [LEGACY_SQUAD_STORE, 'matches', 'sync_outbox', 'device_state']
  if (db.objectStoreNames.contains(SQUAD_BY_TEAM_STORE)) stores.push(SQUAD_BY_TEAM_STORE)
  if (db.objectStoreNames.contains(TEAM_PLAYERS_STORE)) stores.push(TEAM_PLAYERS_STORE)
  if (db.objectStoreNames.contains(PRIVACY_TOMBSTONES_STORE)) {
    stores.push(PRIVACY_TOMBSTONES_STORE)
  }
  for (const storeName of GPS_STORE_NAMES) {
    if (db.objectStoreNames.contains(storeName)) stores.push(storeName)
  }
  const tx = db.transaction(stores, 'readwrite')
  tx.objectStore(LEGACY_SQUAD_STORE).clear()
  if (db.objectStoreNames.contains(SQUAD_BY_TEAM_STORE)) tx.objectStore(SQUAD_BY_TEAM_STORE).clear()
  if (db.objectStoreNames.contains(TEAM_PLAYERS_STORE)) tx.objectStore(TEAM_PLAYERS_STORE).clear()
  if (db.objectStoreNames.contains(PRIVACY_TOMBSTONES_STORE)) {
    tx.objectStore(PRIVACY_TOMBSTONES_STORE).clear()
  }
  for (const storeName of GPS_STORE_NAMES) {
    if (db.objectStoreNames.contains(storeName)) tx.objectStore(storeName).clear()
  }
  tx.objectStore('matches').clear()
  tx.objectStore('sync_outbox').clear()
  tx.objectStore('device_state').clear()
  await tx.done
}

// ── Outbox ──────────────────────────────────────────────────────────────────
// FIFO by auto-increment id. Items with a future next_retry_at are skipped
// until their backoff window elapses.
export async function getReadyMutations(limit = 100) {
  const db = await getDB()
  const all = await db.getAll('sync_outbox')
  const t = now()
  return all
    .filter((m) => (m.next_retry_at || 0) <= t)
    .sort((a, b) => a.id - b.id)
    .slice(0, limit)
}

export async function markMutationDone(id) {
  const db = await getDB()
  await db.delete('sync_outbox', id)
}

export async function markMutationFailed(id, errMsg) {
  const db = await getDB()
  const row = await db.get('sync_outbox', id)
  if (!row) return
  const attempts = (row.attempts || 0) + 1
  // 1s, 2s, 4s, 8s, … capped at 5 minutes
  const delay = Math.min(1000 * Math.pow(2, attempts - 1), 5 * 60 * 1000)
  await db.put('sync_outbox', {
    ...row,
    attempts,
    last_error: String(errMsg).slice(0, 500),
    next_retry_at: now() + delay,
  })
}

export async function getOutboxCount() {
  const db = await getDB()
  return db.count('sync_outbox')
}

export async function getOutboxSummary() {
  const db = await getDB()
  const all = await db.getAll('sync_outbox')
  const failed = all.filter((m) => m.last_error).length
  return {
    pending: all.length,
    failed,
    lastError: all.find((m) => m.last_error)?.last_error || null,
  }
}

// ── Device state ────────────────────────────────────────────────────────────
// The login flow reads/writes last_user_id here instead of localStorage.
// IDB survives iOS Safari's localStorage eviction, which is the root cause of
// the "data wiped on relaunch" bug.
const DEVICE_USER_KEY = 'last_user_id'

export async function getLastUserId() {
  const db = await getDB()
  const row = await db.get('device_state', DEVICE_USER_KEY)
  return row?.value ?? null
}

export async function setLastUserId(userId) {
  const db = await getDB()
  await db.put('device_state', { key: DEVICE_USER_KEY, value: userId })
}

// ── Privacy tombstones ──────────────────────────────────────────────────────
export function privacyTombstoneKey(entityType, entityId) {
  return `${String(entityType)}:${String(entityId)}`
}

export async function putPrivacyTombstone({
  entityType,
  entityId,
  teamId = null,
  reason = null,
  createdAt = new Date().toISOString(),
  createdBy = null,
  version = 1,
} = {}) {
  if (!entityType || !entityId) throw new Error('entityType and entityId are required.')
  const tombstone = {
    tombstoneKey: privacyTombstoneKey(entityType, entityId),
    entityType: String(entityType),
    entityId: String(entityId),
    teamId: teamId == null ? null : String(teamId),
    reason,
    createdAt,
    createdBy,
    version,
  }
  const db = await getDB()
  await db.put(PRIVACY_TOMBSTONES_STORE, tombstone)
  return tombstone
}

export async function getPrivacyTombstone(entityType, entityId) {
  const db = await getDB()
  if (!db.objectStoreNames.contains(PRIVACY_TOMBSTONES_STORE)) return null
  return db.get(PRIVACY_TOMBSTONES_STORE, privacyTombstoneKey(entityType, entityId))
}

export async function getPrivacyTombstonesForEntityIds(entityType, entityIds = []) {
  const ids = [...new Set(entityIds.map((id) => String(id)).filter(Boolean))]
  if (ids.length === 0) return new Map()
  const db = await getDB()
  if (!db.objectStoreNames.contains(PRIVACY_TOMBSTONES_STORE)) return new Map()
  const rows = await Promise.all(
    ids.map((entityId) =>
      db.get(PRIVACY_TOMBSTONES_STORE, privacyTombstoneKey(entityType, entityId)),
    ),
  )
  return new Map(rows.filter(Boolean).map((row) => [row.entityId, row]))
}

export async function getPrivacyTombstones() {
  const db = await getDB()
  if (!db.objectStoreNames.contains(PRIVACY_TOMBSTONES_STORE)) return []
  return db.getAll(PRIVACY_TOMBSTONES_STORE)
}
