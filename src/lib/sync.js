import { supabase } from './supabase.js'
import { loadMatches, loadSquad, saveMatch, saveSquad } from './db.js'

let _autoSyncTimer = null

export function scheduleAutoSync(userId) {
  if (!userId) return
  clearTimeout(_autoSyncTimer)
  _autoSyncTimer = setTimeout(() => {
    syncToSupabase(userId).catch(e => console.warn('Auto-sync failed:', e))
  }, 10000)
}

export async function syncToSupabase(userId) {
  try {
    const [matches, squad] = await Promise.all([loadMatches(), loadSquad()])

    // ── Sync matches ──────────────────────────────────────────────────────────
    if (matches.length > 0) {
      const matchRows = matches.map(m => ({
        id: String(m.id),
        user_id: userId,
        data: {
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
          lineup: m.lineup ?? {}
        }
      }))

      const { error } = await supabase
        .from('matches')
        .upsert(matchRows, { onConflict: 'id' })
      if (error) throw error
    }

    // Delete from cloud any matches no longer local
    const { data: remoteMatches } = await supabase
      .from('matches').select('id').eq('user_id', userId)
    if (remoteMatches) {
      const localIds = new Set(matches.map(m => String(m.id)))
      const toDelete = remoteMatches
        .filter(r => !localIds.has(String(r.id)))
        .map(r => r.id)
      if (toDelete.length > 0) {
        const { error } = await supabase
          .from('matches').delete().eq('user_id', userId).in('id', toDelete)
        if (error) console.warn('Failed to delete removed matches from cloud:', error)
      }
    }

    // ── Sync squad ────────────────────────────────────────────────────────────
    if (squad.length > 0) {
      const squadRows = squad.map(p => ({
        id: String(p.id),
        user_id: userId,
        data: {
          name: p.name,
          number: p.number,
          position: p.position
        }
      }))
      const { error } = await supabase
        .from('squad')
        .upsert(squadRows, { onConflict: 'id' })
      if (error) throw error
    }

    // Delete from cloud any squad players no longer local
    const { data: remoteSquad } = await supabase
      .from('squad').select('id').eq('user_id', userId)
    if (remoteSquad) {
      const localIds = new Set(squad.map(p => String(p.id)))
      const toDelete = remoteSquad
        .filter(r => !localIds.has(String(r.id)))
        .map(r => r.id)
      if (toDelete.length > 0) {
        const { error } = await supabase
          .from('squad').delete().eq('user_id', userId).in('id', toDelete)
        if (error) console.warn('Failed to delete removed squad from cloud:', error)
      }
    }

    return true
  } catch (e) {
    console.error('Sync failed:', e)
    return false
  }
}

export async function syncFromSupabase(userId) {
  try {
    const [matchRes, squadRes] = await Promise.all([
      supabase.from('matches').select('*').eq('user_id', userId),
      supabase.from('squad').select('*').eq('user_id', userId)
    ])

    if (matchRes.error) throw matchRes.error
    if (squadRes.error) throw squadRes.error

    if (matchRes.data) {
      for (const row of matchRes.data) {
        const d = row.data || {}
        await saveMatch({
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
          lineup: d.lineup ?? {}
        })
      }
    }

    if (squadRes.data && squadRes.data.length > 0) {
      await saveSquad(squadRes.data.map(row => ({
        id: row.id,
        name: row.data?.name,
        number: row.data?.number,
        position: row.data?.position
      })))
    }

    return true
  } catch (e) {
    console.error('Sync from cloud failed:', e)
    return false
  }
}

export async function deleteMatchFromCloud(userId, matchId) {
  if (!userId) return
  try {
    const { error } = await supabase
      .from('matches')
      .delete()
      .eq('id', String(matchId))
      .eq('user_id', userId)
    if (error) throw error
  } catch (e) {
    console.warn('Failed to delete match from cloud:', e)
  }
}
