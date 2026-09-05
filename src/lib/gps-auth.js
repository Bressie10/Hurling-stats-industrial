import { getDB } from './db.js'
import { nowMs, timestampToMs } from './gps-core.js'
import { getLocalGpsSession, GPS_SESSION_STATUS } from './gps-local.js'

export const LOCAL_GPS_AUTH_CONTEXT_KEY = 'local_gps_auth_context'
export const LOCAL_GPS_AUTH_DEFAULT_MAX_AGE_MS = 12 * 60 * 60 * 1000

function normalizeIds(values = []) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))]
}

export async function recordLocalGpsAuthContext({
  userId,
  clubId = null,
  teamIds = [],
  authenticatedAt = nowMs(),
  maxAgeMs = LOCAL_GPS_AUTH_DEFAULT_MAX_AGE_MS,
} = {}) {
  if (!userId) return null
  const authenticatedAtMs = timestampToMs(authenticatedAt) ?? nowMs()
  const expiresAtMs = authenticatedAtMs + Math.max(0, Number(maxAgeMs) || 0)
  const context = {
    userId: String(userId),
    clubId: clubId == null ? null : String(clubId),
    teamIds: normalizeIds(teamIds),
    authenticatedAt: new Date(authenticatedAtMs).toISOString(),
    expiresAt: new Date(expiresAtMs).toISOString(),
    maxAgeMs: Math.max(0, Number(maxAgeMs) || 0),
  }
  const db = await getDB()
  await db.put('device_state', { key: LOCAL_GPS_AUTH_CONTEXT_KEY, value: context })
  return context
}

export async function getLocalGpsAuthContext({ now = nowMs() } = {}) {
  const db = await getDB()
  const row = await db.get('device_state', LOCAL_GPS_AUTH_CONTEXT_KEY)
  const context = row?.value ?? null
  if (!context?.userId) return null
  const expiresAtMs = timestampToMs(context.expiresAt)
  if (expiresAtMs != null && expiresAtMs <= (timestampToMs(now) ?? nowMs())) {
    await db.delete('device_state', LOCAL_GPS_AUTH_CONTEXT_KEY)
    return null
  }
  return context
}

export async function clearLocalGpsAuthContext() {
  const db = await getDB()
  await db.delete('device_state', LOCAL_GPS_AUTH_CONTEXT_KEY)
}

export async function canRecoverLocalGpsSessionOffline({
  userId,
  sessionId,
  teamId = null,
  clubId = null,
  now = nowMs(),
} = {}) {
  const context = await getLocalGpsAuthContext({ now })
  if (!context) return { allowed: false, reason: 'local_auth_expired_or_missing' }
  if (userId && context.userId !== String(userId)) {
    return { allowed: false, reason: 'user_mismatch' }
  }

  const session = sessionId ? await getLocalGpsSession(sessionId) : null
  if (!session) return { allowed: false, reason: 'session_not_found' }
  if (session.status !== GPS_SESSION_STATUS.ACTIVE) {
    return { allowed: false, reason: 'session_not_active' }
  }

  const wantedTeamId = String(teamId || session.teamId || '')
  const wantedClubId = String(clubId || session.clubId || '')
  if (!context.teamIds.includes(wantedTeamId)) {
    return { allowed: false, reason: 'team_not_authorized' }
  }
  if (context.clubId && wantedClubId && context.clubId !== wantedClubId) {
    return { allowed: false, reason: 'club_not_authorized' }
  }

  return { allowed: true, reason: 'local_auth_context_valid', context, session }
}
