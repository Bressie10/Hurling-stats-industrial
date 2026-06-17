export const PERSONAL_TEAM_SCOPE = 'personal'
export const ACTIVE_TEAM_KEY = 'active-team-id'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function normalizeTeamScope(value) {
  const text = String(value || '').trim()
  return text || PERSONAL_TEAM_SCOPE
}

export function teamIdFromScope(scope) {
  const normalized = normalizeTeamScope(scope)
  return UUID_RE.test(normalized) ? normalized : null
}

export function currentTeamScope() {
  if (typeof localStorage === 'undefined') return PERSONAL_TEAM_SCOPE
  return normalizeTeamScope(localStorage.getItem(ACTIVE_TEAM_KEY))
}

export function scopeFromRecord(record) {
  return normalizeTeamScope(record?.teamScope ?? record?.team_id ?? record?.teamId)
}

export function scopeMatches(record, scope = currentTeamScope()) {
  return scopeFromRecord(record) === normalizeTeamScope(scope)
}

export function shouldPromptForTeamSelection({
  hasClubAccess,
  needsTeamSetup,
  teams,
  activeTeamId,
  rememberLastTeam,
} = {}) {
  if (!hasClubAccess || needsTeamSetup) return false
  if (!Array.isArray(teams) || teams.length <= 1) return false
  if (!activeTeamId) return true
  return !rememberLastTeam
}
