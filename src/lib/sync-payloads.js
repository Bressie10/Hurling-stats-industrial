export const BACKGROUND_SYNC_TAG = 'pitchnote-sync-outbox'
export const BACKGROUND_SYNC_AUTH_KEY = 'background_sync_auth'
export const PERSONAL_TEAM_SCOPE = 'personal'

export function normalizePayloadTeamScope(value) {
  const text = String(value || '').trim()
  return text || PERSONAL_TEAM_SCOPE
}

export function squadCloudId(userId, localId, teamScope = PERSONAL_TEAM_SCOPE) {
  const scope = normalizePayloadTeamScope(teamScope)
  return scope === PERSONAL_TEAM_SCOPE ? `${userId}:${localId}` : `${userId}:${scope}:${localId}`
}

export function squadLocalIdFromRow(row) {
  const localId = row?.data?.local_id ?? row?.id
  if (typeof localId === 'string' && /^\d+$/.test(localId)) return Number(localId)
  if (typeof localId === 'string' && localId.includes(':')) {
    const tail = localId.split(':').at(-1)
    return /^\d+$/.test(tail) ? Number(tail) : tail
  }
  return localId
}

export function rowTeamScope(row) {
  return normalizePayloadTeamScope(
    row?.data?.teamScope ?? row?.team_scope ?? row?.team_id ?? row?.data?.teamId,
  )
}

export function matchToData(m) {
  const teamScope = normalizePayloadTeamScope(m.teamScope ?? m.team_id ?? m.teamId)
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
    teamScope,
    teamId: m.teamId ?? m.team_id ?? null,
    updated_at: m.updated_at || 0,
  }
}
