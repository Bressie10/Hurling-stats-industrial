import { supabase } from './supabase.js'
import {
  loadMatches, loadSquad,
  getReadyMutations, markMutationDone, markMutationFailed, getOutboxCount,
  getDB
} from './db.js'

// ── Public API ──────────────────────────────────────────────────────────────
// scheduleAutoSync, syncToSupabase, syncFromSupabase, deleteMatchFromCloud
// are kept as exports for backward compatibility with existing callers. Under
// the hood they all funnel through the outbox + merge pipeline below.

let draining = false
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
  drainOutbox(userId).catch(e => console.warn('Auto-sync drain failed:', e))
}

// Manual Sync button — drain pending mutations, then merge cloud → local.
// Returns true only if everything completed cleanly.
export async function syncToSupabase(userId) {
  if (!userId) return false
  activeUserId = userId
  installListeners()
  const drained = await drainOutbox(userId)
  if (!drained) return false
  return pullFromCloud(userId)
}

// Login pull. Non-destructive merge by updated_at — never wipes local state.
export async function syncFromSupabase(userId) {
  if (!userId) return false
  activeUserId = userId
  installListeners()
  return pullFromCloud(userId)
}

// History.svelte calls this after its local delete. The actual delete is
// already enqueued via db.deleteMatch — this just kicks the drain.
export function deleteMatchFromCloud(userId, _matchId) {
  scheduleAutoSync(userId)
}

// ── Drain worker ────────────────────────────────────────────────────────────
// Processes outbox mutations in FIFO order. On per-item failure, marks the row
// with attempts++/last_error/next_retry_at (exponential backoff up to 5 min)
// and moves on. Returns true iff the outbox is empty when we finish.
async function drainOutbox(userId) {
  if (draining) return false
  draining = true
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
      // Stop here; we'll be retriggered by the online/visibility listeners or
      // by the next mutation.
      if (!progressed) break
    }
    return (await getOutboxCount()) === 0
  } finally {
    draining = false
  }
}

async function applyMutation(userId, m) {
  if (m.op === 'upsert_match') {
    const { error } = await supabase
      .from('matches')
      .upsert({
        id: String(m.payload.id),
        user_id: userId,
        data: matchToData(m.payload)
      }, { onConflict: 'id' })
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
    const players = m.payload || []
    if (players.length > 0) {
      const rows = players.map(p => ({
        id: String(p.id),
        user_id: userId,
        data: {
          name: p.name,
          number: p.number,
          position: p.position,
          updated_at: p.updated_at || 0
        }
      }))
      const { error } = await supabase
        .from('squad')
        .upsert(rows, { onConflict: 'id,user_id' })
      if (error) throw error
    }
    // Reconcile deletions: anything in cloud but not in our roster is gone.
    const { data: remote, error: selErr } = await supabase
      .from('squad').select('id').eq('user_id', userId)
    if (selErr) throw selErr
    if (remote) {
      const keep = new Set(players.map(p => String(p.id)))
      const toDelete = remote.filter(r => !keep.has(String(r.id))).map(r => r.id)
      if (toDelete.length > 0) {
        const { error } = await supabase
          .from('squad').delete().eq('user_id', userId).in('id', toDelete)
        if (error) throw error
      }
    }
    return
  }

  throw new Error(`Unknown mutation op: ${m.op}`)
}

function matchToData(m) {
  return {
    date: m.date,
    opposition: m.opposition,
    venue: m.venue,
    competition: m.competition ?? null,
    period: m.period ?? null,
    score: m.score,
    stats: m.stats,
    events: m.events,
    notes: m.notes,
    customStats: m.customStats,
    players: m.players,
    subs_log: m.subs_log,
    puckouts: m.puckouts ?? [],
    oppScores: m.oppScores ?? [],
    lineup: m.lineup ?? {},
    updated_at: m.updated_at || 0
  }
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
      supabase.from('squad').select('*').eq('user_id', userId)
    ])
    if (matchRes.error) throw matchRes.error
    if (squadRes.error) throw squadRes.error

    const db = await getDB()

    // Matches: per-id merge by updated_at.
    if (matchRes.data) {
      const localMatches = await loadMatches()
      const localById = new Map(localMatches.map(m => [String(m.id), m]))
      const tx = db.transaction('matches', 'readwrite')
      for (const row of matchRes.data) {
        const d = row.data || {}
        const cloudTs = d.updated_at || 0
        const localM = localById.get(String(row.id))
        const localTs = localM?.updated_at || 0
        if (!localM || cloudTs > localTs) {
          tx.store.put({
            id: row.id,
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
            updated_at: cloudTs
          })
        }
      }
      await tx.done
    }

    // Squad: roster-level updated_at (max over players). Cloud wins only when
    // strictly newer than the freshest local player. Local edits won't be
    // squashed; they're already queued in the outbox and will push up next drain.
    if (squadRes.data) {
      const localSquad = await loadSquad()
      const localMax = localSquad.reduce((m, p) => Math.max(m, p.updated_at || 0), 0)
      const cloudMax = squadRes.data.reduce((m, r) => Math.max(m, r.data?.updated_at || 0), 0)
      if (squadRes.data.length > 0 && cloudMax > localMax) {
        const tx = db.transaction('squad', 'readwrite')
        tx.store.clear()
        for (const row of squadRes.data) {
          tx.store.put({
            id: row.id,
            name: row.data?.name,
            number: row.data?.number,
            position: row.data?.position,
            updated_at: row.data?.updated_at || 0
          })
        }
        await tx.done
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
  // pagehide fires reliably on iOS Safari (where beforeunload doesn't) when the
  // app is backgrounded or the tab is closed. Sync work may not complete, but
  // any in-flight fetch will be honored by the browser for a short window.
  window.addEventListener('pagehide', kick)
}
