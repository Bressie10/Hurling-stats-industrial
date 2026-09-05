export const BACKGROUND_SYNC_TAG = 'pitchnote-sync-outbox'
export const BACKGROUND_SYNC_AUTH_KEY = 'background_sync_auth'
export const PERSONAL_TEAM_SCOPE = 'personal'

export function normalizePayloadTeamScope(value) {
  const text = String(value || '').trim()
  return text || PERSONAL_TEAM_SCOPE
}

export function rowTeamScope(row) {
  return normalizePayloadTeamScope(
    row?.data?.teamScope ?? row?.team_scope ?? row?.team_id ?? row?.data?.teamId,
  )
}

export function timestampToMs(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function msToIso(value) {
  const ms = typeof value === 'number' && Number.isFinite(value) ? value : Date.now()
  return new Date(ms).toISOString()
}

export function teamPlayerFromRow(row, teamScope = row?.team_id) {
  const updatedAt = timestampToMs(row?.updated_at)
  return {
    id: row.id,
    team_player_id: row.id,
    name: row.display_name,
    display_name: row.display_name,
    number: row.default_number,
    default_number: row.default_number,
    position: row.position,
    status: row.status || 'active',
    joined_at: row.joined_at ?? null,
    left_at: row.left_at ?? null,
    teamScope: normalizePayloadTeamScope(teamScope),
    teamId: row.team_id ?? null,
    updated_at: updatedAt,
  }
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
