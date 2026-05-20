import { openDB } from 'idb'

const DB_NAME = 'doora-stats'
// IMPORTANT: bump DB_VERSION whenever you add a new store or index.
// Add a `case N:` block in the upgrade switch below — never remove old cases.
// idb runs all cases from oldVersion+1 up to newVersion, so migrations are cumulative.
const DB_VERSION = 2

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
    }
  })
}

function now() { return Date.now() }

// ── Squad ───────────────────────────────────────────────────────────────────
// Squad is stored as the full roster (replace-on-save). Every save enqueues
// an upsert_squad mutation in the same transaction so the local write and
// the sync intent are atomically committed together.
export async function saveSquad(players) {
  const db = await getDB()
  const stamped = players.map(p => ({ ...p, updated_at: now() }))
  const tx = db.transaction(['squad', 'sync_outbox'], 'readwrite')
  const squad = tx.objectStore('squad')
  squad.clear()
  stamped.forEach(p => squad.put(p))
  tx.objectStore('sync_outbox').add({
    op: 'upsert_squad',
    payload: stamped,
    created_at: now(),
    attempts: 0,
    last_error: null,
    next_retry_at: 0
  })
  await tx.done
}

export async function loadSquad() {
  const db = await getDB()
  return db.getAll('squad')
}

// ── Matches ─────────────────────────────────────────────────────────────────
// Drafts (id === 'draft' or isDraft === true) never enqueue — they're
// device-local by design. Real matches enqueue an upsert_match mutation.
export async function saveMatch(match) {
  const isDraft = match.isDraft === true || match.id === 'draft'
  const stamped = { ...match, updated_at: now() }
  let lastErr
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const db = await getDB()
      if (isDraft) {
        await db.put('matches', stamped)
      } else {
        const tx = db.transaction(['matches', 'sync_outbox'], 'readwrite')
        tx.objectStore('matches').put(stamped)
        tx.objectStore('sync_outbox').add({
          op: 'upsert_match',
          entity_id: String(stamped.id),
          payload: stamped,
          created_at: now(),
          attempts: 0,
          last_error: null,
          next_retry_at: 0
        })
        await tx.done
      }
      return
    } catch (e) {
      lastErr = e
      await new Promise(r => setTimeout(r, 150 * (attempt + 1)))
    }
  }
  throw lastErr
}

export async function loadMatches() {
  const db = await getDB()
  const all = await db.getAll('matches')
  return all.filter(m => !m.isDraft)
}

// Atomic local delete + cloud-delete intent.
export async function deleteMatch(matchId) {
  const db = await getDB()
  const tx = db.transaction(['matches', 'sync_outbox'], 'readwrite')
  tx.objectStore('matches').delete(matchId)
  tx.objectStore('sync_outbox').add({
    op: 'delete_match',
    entity_id: String(matchId),
    payload: null,
    created_at: now(),
    attempts: 0,
    last_error: null,
    next_retry_at: 0
  })
  await tx.done
}

// ── Drafts (device-local) ───────────────────────────────────────────────────
export async function saveDraftMatch(match) {
  let lastErr
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const db = await getDB()
      await db.put('matches', { ...match, id: 'draft', isDraft: true, updated_at: now() })
      return
    } catch (e) {
      lastErr = e
      await new Promise(r => setTimeout(r, 100 * (attempt + 1)))
    }
  }
  console.warn('saveDraftMatch failed after 3 attempts:', lastErr)
}

export async function loadDraftMatch() {
  const db = await getDB()
  return db.get('matches', 'draft')
}

export async function clearDraftMatch() {
  const db = await getDB()
  await db.delete('matches', 'draft')
}

// Poison the draft record so it won't be auto-resumed even if clearDraftMatch
// hasn't run yet. Called immediately after saveMatch succeeds in finishMatch()
// to prevent duplicate matches if the app crashes between saveMatch and clearDraftMatch.
export async function markDraftSaved() {
  try {
    const db = await getDB()
    const draft = await db.get('matches', 'draft')
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
  const tx = db.transaction(['squad', 'matches', 'sync_outbox', 'device_state'], 'readwrite')
  tx.objectStore('squad').clear()
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
    .filter(m => (m.next_retry_at || 0) <= t)
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
    next_retry_at: now() + delay
  })
}

export async function getOutboxCount() {
  const db = await getDB()
  return db.count('sync_outbox')
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
