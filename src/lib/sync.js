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

    // Sync matches
    if (matches.length > 0) {
      const matchRows = matches.map(m => ({
        id: m.id,
        user_id: userId,
        date: m.date,
        opposition: m.opposition,
        venue: m.venue,
        score: m.score,
        stats: m.stats,
        events: m.events,
        notes: m.notes,
        custom_stats: m.customStats,
        players: m.players,
        subs_log: m.subs_log
      }))
      await supabase.from('matches').upsert(matchRows, { onConflict: 'id' })
    }

    // Sync squad
    if (squad.length > 0) {
      const squadRows = squad.map(p => ({
        id: p.id,
        user_id: userId,
        name: p.name,
        number: p.number,
        position: p.position
      }))
      await supabase.from('squad').upsert(squadRows, { onConflict: 'id,user_id' })
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

    if (matchRes.data) {
      for (const m of matchRes.data) {
        await saveMatch({
          id: m.id,
          date: m.date,
          opposition: m.opposition,
          venue: m.venue,
          score: m.score,
          stats: m.stats,
          events: m.events,
          notes: m.notes,
          customStats: m.custom_stats,
          players: m.players,
          subs_log: m.subs_log
        })
      }
    }

    if (squadRes.data && squadRes.data.length > 0) {
      await saveSquad(squadRes.data.map(p => ({
        id: p.id,
        name: p.name,
        number: p.number,
        position: p.position
      })))
    }

    return true
  } catch (e) {
    console.error('Sync from cloud failed:', e)
    return false
  }
}