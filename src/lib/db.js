import { openDB } from 'idb'
import {
  PERSONAL_TEAM_SCOPE,
  currentTeamScope,
  normalizeTeamScope,
  scopeMatches,
  teamIdFromScope,
} from './team-scope.js'

const DB_NAME = 'doora-stats'
// IMPORTANT: bump DB_VERSION whenever you add a new store or index.
// Add a `case N:` block in the upgrade switch below — never remove old cases.
// idb runs all cases from oldVersion+1 up to newVersion, so migrations are cumulative.
const DB_VERSION = 3
const LEGACY_SQUAD_STORE = 'squad'
const SQUAD_BY_TEAM_STORE = 'squad_by_team'

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
    },
  })
}

function now() {
  return Date.now()
}

function dataScope(options = {}) {
  return normalizeTeamScope(options.teamScope ?? currentTeamScope())
}

function squadStoreKey(teamScope, localId) {
  return `${normalizeTeamScope(teamScope)}:${localId}`
}

function playerLocalId(player) {
  return player?.local_id ?? player?.localId ?? player?.id
}

function squadStorageRow(player, teamScope, updatedAt = now()) {
  const localId = playerLocalId(player)
  return {
    ...player,
    id: localId,
    storeKey: squadStoreKey(teamScope, localId),
    local_id: localId,
    teamScope,
    teamId: teamIdFromScope(teamScope),
    updated_at: player.updated_at || updatedAt,
  }
}

function publicSquadRow(row) {
  const { storeKey: _storeKey, teamScope: _teamScope, teamId: _teamId, local_id, ...rest } = row
  return {
    ...rest,
    id: local_id ?? rest.id,
    teamScope: _teamScope,
    teamId: _teamId ?? teamIdFromScope(_teamScope),
  }
}

function draftIdForScope(teamScope) {
  const scope = normalizeTeamScope(teamScope)
  return scope === PERSONAL_TEAM_SCOPE ? 'draft' : `draft:${scope}`
}

// ── Squad ───────────────────────────────────────────────────────────────────
// Squad is stored as the full roster (replace-on-save). Every save enqueues
// an upsert_squad mutation in the same transaction so the local write and
// the sync intent are atomically committed together.
export async function saveSquad(players, options = {}) {
  const teamScope = dataScope(options)
  const db = await getDB()
  const stampedAt = now()
  const stamped = players.map((p) => squadStorageRow(p, teamScope, stampedAt))
  const tx = db.transaction([SQUAD_BY_TEAM_STORE, 'sync_outbox'], 'readwrite')
  const squad = tx.objectStore(SQUAD_BY_TEAM_STORE)
  const existing = await squad.index('teamScope').getAllKeys(teamScope)
  const writes = [
    ...existing.map((key) => squad.delete(key)),
    ...stamped.map((p) => squad.put(p)),
    tx.objectStore('sync_outbox').add({
      op: 'upsert_squad',
      teamScope,
      team_id: teamIdFromScope(teamScope),
      payload: stamped.map(publicSquadRow),
      created_at: now(),
      attempts: 0,
      last_error: null,
      next_retry_at: 0,
    }),
  ]
  await Promise.all([...writes, tx.done])
}

export async function loadSquad(options = {}) {
  const teamScope = dataScope(options)
  const db = await getDB()
  if (db.objectStoreNames.contains(SQUAD_BY_TEAM_STORE)) {
    const rows = await db.getAllFromIndex(SQUAD_BY_TEAM_STORE, 'teamScope', teamScope)
    if (rows.length > 0 || teamScope !== PERSONAL_TEAM_SCOPE) return rows.map(publicSquadRow)
  }
  const legacy = await db.getAll(LEGACY_SQUAD_STORE)
  return teamScope === PERSONAL_TEAM_SCOPE ? legacy.map((p) => ({ ...p, teamScope })) : []
}

export async function replaceSquadForScope(players, teamScope) {
  const scope = normalizeTeamScope(teamScope)
  const db = await getDB()
  const tx = db.transaction(SQUAD_BY_TEAM_STORE, 'readwrite')
  const store = tx.objectStore(SQUAD_BY_TEAM_STORE)
  const existing = await store.index('teamScope').getAllKeys(scope)
  const writes = [
    ...existing.map((key) => store.delete(key)),
    ...players.map((player) => store.put(squadStorageRow(player, scope, player.updated_at || 0))),
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
  const tx = db.transaction(stores, 'readwrite')
  tx.objectStore(LEGACY_SQUAD_STORE).clear()
  if (db.objectStoreNames.contains(SQUAD_BY_TEAM_STORE)) tx.objectStore(SQUAD_BY_TEAM_STORE).clear()
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
