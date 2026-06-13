export const BACKGROUND_SYNC_TAG = 'pitchnote-sync-outbox'
export const BACKGROUND_SYNC_AUTH_KEY = 'background_sync_auth'

export function squadCloudId(userId, localId) {
  return `${userId}:${localId}`
}

export function squadLocalIdFromRow(row) {
  const localId = row?.data?.local_id ?? row?.id
  if (typeof localId === 'string' && /^\d+$/.test(localId)) return Number(localId)
  return localId
}

export function matchToData(m) {
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
    coachSummary: m.coachSummary ?? '',
    workOns: m.workOns ?? [],
    updated_at: m.updated_at || 0
  }
}

