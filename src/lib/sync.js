import { supabase } from './supabase.js'
import {
  loadSquad,
  replaceSquadForScope,
  getReadyMutations,
  markMutationDone,
  markMutationFailed,
  getOutboxCount,
  getDB,
} from './db.js'
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public'
import {
  BACKGROUND_SYNC_AUTH_KEY,
  BACKGROUND_SYNC_TAG,
  matchToData,
  normalizePayloadTeamScope,
  rowTeamScope,
  squadCloudId,
  squadLocalIdFromRow,
} from './sync-payloads.js'

// ── Public API ──────────────────────────────────────────────────────────────
// scheduleAutoSync, syncToSupabase, syncFromSupabase, deleteMatchFromCloud
// are kept as exports for backward compatibility with existing callers. Under
// the hood they all funnel through the outbox + merge pipeline below.

// Tracked as a promise (not a bool) so that concurrent callers — Squad.svelte
// after a save, signOut, the visibility listener — all await the same in-flight
// drain instead of getting a bare `false` and racing with clearAllData.
let drainPromise = null
let pulling = false
let listenersInstalled = false
let activeUserId = null

// Cheap, idempotent. Call this from any mutation site after persisting locally.
// The local write has already enqueued an outbox entry atomically, so this just
// nudges the drain worker.
export function scheduleAutoSync(userId) {
  if (!userId) return
  activeUserId = userId
  installListeners()
  requestBackgroundOutboxSync(userId).catch((e) =>
    console.warn('Background sync registration failed:', e),
  )
  drainOutbox(userId).catch((e) => console.warn('Auto-sync drain failed:', e))
}

// Manual Sync button — drain pending mutations, then merge cloud → local.
// Returns true only if everything completed cleanly.
export async function syncToSupabase(userId) {
  if (!userId) return false
  activeUserId = userId
  installListeners()
  await saveBackgroundSyncAuth(userId)
  const drained = await drainOutbox(userId)
  if (!drained) return false
  return pullFromCloud(userId)
}

// Login pull. Non-destructive merge by updated_at — never wipes local state.
export async function syncFromSupabase(userId) {
  if (!userId) return false
  activeUserId = userId
  installListeners()
  await saveBackgroundSyncAuth(userId)
  return pullFromCloud(userId)
}

// History.svelte calls this after its local delete. The actual delete is
// already enqueued via db.deleteMatch — this just kicks the drain.
export function deleteMatchFromCloud(userId, _matchId) {
  scheduleAutoSync(userId)
}

// Public flush — used by signOut to make sure pending mutations reach Supabase
// before clearAllData wipes the outbox. Returns a promise that resolves to true
// iff the outbox is empty when we finish.
export async function flushOutbox(userId) {
  if (!userId) return false
  activeUserId = userId
  installListeners()
  try {
    await saveBackgroundSyncAuth(userId)
  } catch (e) {
    console.warn('Background sync auth save failed:', e)
  }
  return drainOutbox(userId)
}

async function saveBackgroundSyncAuth(userId) {
  if (!userId || typeof window === 'undefined') return false
  if (!PUBLIC_SUPABASE_URL || !PUBLIC_SUPABASE_ANON_KEY) return false

  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  const session = data?.session
  if (!session?.access_token || session.user?.id !== userId) return false

  const db = await getDB()
  await db.put('device_state', {
    key: BACKGROUND_SYNC_AUTH_KEY,
    value: {
      user_id: userId,
      access_token: session.access_token,
      expires_at: session.expires_at || 0,
      supabase_url: PUBLIC_SUPABASE_URL,
      supabase_anon_key: PUBLIC_SUPABASE_ANON_KEY,
      saved_at: Date.now(),
    },
  })
  return true
}

async function requestBackgroundOutboxSync(userId) {
  if (!userId || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false
  await saveBackgroundSyncAuth(userId)

  const registration = await navigator.serviceWorker.ready
  if (!registration || !('sync' in registration)) return false

  await registration.sync.register(BACKGROUND_SYNC_TAG)
  return true
}

// ── Drain worker ────────────────────────────────────────────────────────────
// Processes outbox mutations in FIFO order. On per-item failure, marks the row
// with attempts++/last_error/next_retry_at (exponential backoff up to 5 min)
// and moves on. Returns true iff the outbox is empty when we finish.
function drainOutbox(userId) {
  if (drainPromise) return drainPromise
  drainPromise = (async () => {
    try {
      while (true) {
        const ready = await getReadyMutations(50)
        if (ready.length === 0) break
        let progressed = false
        for (const m of ready) {
          try {
            await applyMutation(userId, m)
            await markMutationDone(m.id)
            progressed = true
          } catch (e) {
            await markMutationFailed(m.id, e?.message || String(e))
          }
        }
        // No item in this batch succeeded — every ready item is now backed off.
        // Stop; the online/visibility listeners or the next mutation will retrigger.
        if (!progressed) break
      }
      return (await getOutboxCount()) === 0
    } finally {
      drainPromise = null
    }
  })()
  return drainPromise
}

async function applyMutation(userId, m) {
  if (m.op === 'upsert_match') {
    const data = matchToData(m.payload)
    const { error } = await supabase.from('matches').upsert(
      {
        id: String(m.payload.id),
        user_id: userId,
        team_id: m.team_id ?? data.teamId ?? null,
        data,
      },
      { onConflict: 'id,user_id' },
    )
    if (error) throw error
    return
  }

  if (m.op === 'delete_match') {
    const { error } = await supabase
      .from('matches')
      .delete()
      .eq('id', String(m.entity_id))
      .eq('user_id', userId)
    if (error) throw error
    return
  }

  if (m.op === 'upsert_squad') {
    const teamScope = normalizePayloadTeamScope(m.teamScope ?? m.team_id)
    const players = m.payload || []

    if (players.length > 0) {
      const rows = players.map((p) => ({
        id: squadCloudId(userId, p.id, teamScope),
        user_id: userId,
        team_id: m.team_id ?? null,
        data: {
          local_id: p.id,
          name: p.name,
          number: p.number,
          position: p.position,
          teamScope,
          teamId: m.team_id ?? null,
          updated_at: p.updated_at || 0,
        },
      }))
      const { error } = await supabase.from('squad').upsert(rows, { onConflict: 'id,user_id' })
      if (error) throw error
    }

    // Reconcile deletions: anything in cloud but not in our roster is gone.
    const { data: remote, error: selErr } = await supabase
      .from('squad')
      .select('id,data,team_id')
      .eq('user_id', userId)
    if (selErr) throw selErr
    if (remote) {
      const keep = new Set(players.map((p) => squadCloudId(userId, p.id, teamScope)))
      const toDelete = remote
        .filter((r) => rowTeamScope(r) === teamScope && !keep.has(String(r.id)))
        .map((r) => r.id)
      if (toDelete.length > 0) {
        const { error } = await supabase
          .from('squad')
          .delete()
          .eq('user_id', userId)
          .in('id', toDelete)
        if (error) throw error
      }
    }
    return
  }

  throw new Error(`Unknown mutation op: ${m.op}`)
}

async function getPendingDeleteMatchIds(db) {
  const all = await db.getAll('sync_outbox')
  return new Set(
    all
      .filter((m) => m.op === 'delete_match')
      .map((m) => matchMergeKey(m.entity_id, normalizePayloadTeamScope(m.teamScope ?? m.team_id))),
  )
}

function matchScope(record) {
  return normalizePayloadTeamScope(record?.teamScope ?? record?.team_id ?? record?.teamId)
}

function matchMergeKey(id, teamScope) {
  return `${String(id)}:${normalizePayloadTeamScope(teamScope)}`
}

function matchLocalIdFromCloud(rowId, localMatch) {
  if (localMatch) return localMatch.id
  const id = String(rowId)
  return /^\d+$/.test(id) ? Number(id) : rowId
}

// ── Cloud → local merge ─────────────────────────────────────────────────────
// Per-entity: if cloud.updated_at strictly exceeds local.updated_at, accept the
// cloud row; otherwise leave local alone. Writes go through IDB directly (NOT
// through saveMatch/saveSquad) so we don't loop back into the outbox.
async function pullFromCloud(userId) {
  if (pulling) return false
  pulling = true
  try {
    const [matchRes, squadRes] = await Promise.all([
      supabase.from('matches').select('*').eq('user_id', userId),
      supabase.from('squad').select('*').eq('user_id', userId),
    ])
    if (matchRes.error) throw matchRes.error
    if (squadRes.error) throw squadRes.error

    const db = await getDB()

    // Matches: per-id merge by updated_at.
    if (matchRes.data) {
      const localMatches = (await db.getAll('matches')).filter((m) => !m.isDraft)
      const localByKey = new Map(localMatches.map((m) => [matchMergeKey(m.id, matchScope(m)), m]))
      const pendingDeletes = await getPendingDeleteMatchIds(db)
      const tx = db.transaction('matches', 'readwrite')
      for (const row of matchRes.data) {
        const d = row.data || {}
        const teamScope = normalizePayloadTeamScope(d.teamScope ?? row.team_id)
        if (pendingDeletes.has(matchMergeKey(row.id, teamScope))) continue
        const cloudTs = d.updated_at || 0
        const localM = localByKey.get(matchMergeKey(row.id, teamScope))
        const localTs = localM?.updated_at || 0
        if (!localM || cloudTs > localTs) {
          tx.store.put({
            id: matchLocalIdFromCloud(row.id, localM),
            date: d.date,
            opposition: d.opposition,
            venue: d.venue,
            competition: d.competition ?? null,
            period: d.period ?? null,
            score: d.score,
            stats: d.stats,
            events: d.events,
            notes: d.notes,
            customStats: d.customStats,
            players: d.players,
            subs_log: d.subs_log,
            puckouts: d.puckouts ?? [],
            oppScores: d.oppScores ?? [],
            lineup: d.lineup ?? {},
            coachSummary: d.coachSummary ?? '',
            workOns: d.workOns ?? [],
            teamScope,
            teamId: d.teamId ?? row.team_id ?? null,
            updated_at: cloudTs,
          })
        }
      }
      await tx.done
    }

    // Squad: roster-level updated_at (max over players). Cloud wins when
    // strictly newer, OR when local is empty and cloud has data — that second
    // clause is what restores squads after a sign-out wipe on legacy rows
    // (which have no data.updated_at and would otherwise tie at 0 forever).
    // Local edits aren't squashed; they sit in the outbox until the next drain.
    if (squadRes.data) {
      const byScope = new Map()
      for (const row of squadRes.data) {
        const scope = rowTeamScope(row)
        if (!byScope.has(scope)) byScope.set(scope, [])
        byScope.get(scope).push(row)
      }

      for (const [teamScope, rows] of byScope) {
        const localSquad = await loadSquad({ teamScope })
        const localMax = localSquad.reduce((m, p) => Math.max(m, p.updated_at || 0), 0)
        const cloudMax = rows.reduce((m, r) => Math.max(m, r.data?.updated_at || 0), 0)
        const localEmpty = localSquad.length === 0
        if (rows.length > 0 && (localEmpty || cloudMax > localMax)) {
          await replaceSquadForScope(
            rows.map((row) => ({
              id: squadLocalIdFromRow(row),
              name: row.data?.name,
              number: row.data?.number,
              position: row.data?.position,
              teamScope,
              teamId: row.data?.teamId ?? row.team_id ?? null,
              updated_at: row.data?.updated_at || 0,
            })),
            teamScope,
          )
        }
      }
    }

    return true
  } catch (e) {
    console.error('Pull from cloud failed:', e)
    return false
  } finally {
    pulling = false
  }
}

// ── Event wiring ────────────────────────────────────────────────────────────
// Install once. We re-drain on online (network came back), on visibilitychange
// (tab/PWA came back to foreground), and on pagehide (best-effort flush before
// the OS suspends or kills the app).
function installListeners() {
  if (listenersInstalled || typeof window === 'undefined') return
  listenersInstalled = true

  const kick = () => {
    if (activeUserId) drainOutbox(activeUserId).catch(() => {})
  }

  window.addEventListener('online', kick)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') kick()
  })
  navigator.serviceWorker?.addEventListener?.('message', (event) => {
    if (event.data?.type === 'PITCHNOTE_DRAIN_OUTBOX') kick()
  })
  // pagehide fires reliably on iOS Safari (where beforeunload doesn't) when the
  // app is backgrounded or the tab is closed. Sync work may not complete, but
  // any in-flight fetch will be honored by the browser for a short window.
  window.addEventListener('pagehide', kick)
}
