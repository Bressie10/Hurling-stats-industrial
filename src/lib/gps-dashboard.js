import { loadSquad } from './db.js'
import { timestampToMs } from './gps-core.js'
import {
  getLatestGpsStatesForSession,
  getLocalGpsAssignmentsForSession,
  getLocalGpsSession,
  getLocalGpsSessionsForTeam,
  getLocalGpsTrackersForClub,
  GPS_SESSION_STATUS,
  isOpenActiveGpsAssignment,
} from './gps-local.js'
import { playerIdentity, playerName } from './team-players.js'

export const GPS_DASHBOARD_STALE_THRESHOLD_MS = 5000

export const GPS_DASHBOARD_CONNECTION = Object.freeze({
  LIVE: 'LIVE',
  DISCONNECTED: 'DISCONNECTED',
  STALE: 'STALE',
  NO_DATA: 'NO DATA',
})

function sortByTimeDesc(a, b, field) {
  return (timestampToMs(b?.[field]) ?? 0) - (timestampToMs(a?.[field]) ?? 0)
}

function latestForAssignments(assignments, latestByTrackerId) {
  return assignments
    .map((assignment) => latestByTrackerId.get(assignment.trackerId))
    .filter(Boolean)
    .sort((a, b) => sortByTimeDesc(a, b, 'capturedAt'))[0]
}

function activeAssignment(assignments) {
  return [...assignments]
    .filter(isOpenActiveGpsAssignment)
    .sort((a, b) => sortByTimeDesc(a, b, 'assignedFrom'))[0]
}

function assignmentWithLatest(assignments, latestByTrackerId) {
  const latest = latestForAssignments(assignments, latestByTrackerId)
  if (latest) return assignments.find((assignment) => assignment.trackerId === latest.trackerId)
  return [...assignments].sort((a, b) => sortByTimeDesc(a, b, 'assignedFrom'))[0]
}

export function speedMpsToKmh(speedMps) {
  const speed = Number(speedMps)
  return Number.isFinite(speed) ? speed * 3.6 : null
}

export function gpsDashboardConnectionState({
  latest = null,
  receiverSnapshot = null,
  nowMs = Date.now(),
  staleThresholdMs = GPS_DASHBOARD_STALE_THRESHOLD_MS,
} = {}) {
  if (receiverSnapshot?.connected === false) return GPS_DASHBOARD_CONNECTION.DISCONNECTED
  if (!latest) return GPS_DASHBOARD_CONNECTION.NO_DATA
  const updatedAt = timestampToMs(latest.updatedAt ?? latest.capturedAt)
  if (updatedAt == null) return GPS_DASHBOARD_CONNECTION.NO_DATA
  if (nowMs - updatedAt > staleThresholdMs) return GPS_DASHBOARD_CONNECTION.STALE
  return GPS_DASHBOARD_CONNECTION.LIVE
}

export function buildGpsDashboardRows({
  players = [],
  trackers = [],
  assignments = [],
  latestStates = [],
  receiverSnapshots = [],
  nowMs = Date.now(),
  staleThresholdMs = GPS_DASHBOARD_STALE_THRESHOLD_MS,
} = {}) {
  const playerById = new Map(players.map((player) => [playerIdentity(player), player]))
  const trackerById = new Map(trackers.map((tracker) => [tracker.trackerId, tracker]))
  const latestByTrackerId = new Map(latestStates.map((latest) => [latest.trackerId, latest]))
  const snapshotByTrackerId = new Map(
    receiverSnapshots.map((snapshot) => [snapshot.trackerId, snapshot]),
  )
  const playerIds = [
    ...new Set(assignments.map((assignment) => assignment.teamPlayerId).filter(Boolean)),
  ]

  return playerIds
    .map((teamPlayerId) => {
      const playerAssignments = assignments.filter(
        (assignment) => assignment.teamPlayerId === teamPlayerId,
      )
      const currentAssignment =
        activeAssignment(playerAssignments) ||
        assignmentWithLatest(playerAssignments, latestByTrackerId) ||
        null
      const latest =
        (currentAssignment && latestByTrackerId.get(currentAssignment.trackerId)) ||
        latestForAssignments(playerAssignments, latestByTrackerId) ||
        null
      const trackerId = currentAssignment?.trackerId ?? latest?.trackerId ?? null
      const tracker = trackerId ? trackerById.get(trackerId) : null
      const receiverSnapshot = trackerId ? snapshotByTrackerId.get(trackerId) : null
      const speedKmh = speedMpsToKmh(latest?.speedMps)

      return {
        teamPlayerId,
        player: playerById.get(teamPlayerId) || null,
        playerName: playerName(playerById.get(teamPlayerId)) || 'Unknown player',
        assignment: currentAssignment,
        assignmentId: currentAssignment?.assignmentId ?? latest?.assignmentId ?? null,
        tracker,
        trackerId,
        trackerLabel: tracker?.label || tracker?.serialNumber || trackerId || 'No tracker',
        receiverSnapshot,
        latest,
        connection: gpsDashboardConnectionState({
          latest,
          receiverSnapshot,
          nowMs,
          staleThresholdMs,
        }),
        speedKmh,
        speedDisplay: speedKmh == null ? '—' : `${speedKmh.toFixed(1)} km/h`,
        accuracyDisplay:
          latest?.accuracyM == null || !Number.isFinite(Number(latest.accuracyM))
            ? '—'
            : `${Number(latest.accuracyM).toFixed(1)} m`,
        batteryDisplay:
          latest?.batteryPercent == null || !Number.isFinite(Number(latest.batteryPercent))
            ? '—'
            : `${Math.round(Number(latest.batteryPercent))}%`,
        lastUpdateDisplay: latest?.capturedAt
          ? new Date(latest.capturedAt).toLocaleTimeString()
          : '—',
      }
    })
    .sort((a, b) => a.playerName.localeCompare(b.playerName))
}

export function normalizeGpsPitchPoints(rows = []) {
  const rowsWithLatest = rows.filter(
    (row) =>
      Number.isFinite(Number(row.latest?.latitude)) &&
      Number.isFinite(Number(row.latest?.longitude)),
  )
  if (rowsWithLatest.length === 0) return []

  const latitudes = rowsWithLatest.map((row) => Number(row.latest.latitude))
  const longitudes = rowsWithLatest.map((row) => Number(row.latest.longitude))
  const minLat = Math.min(...latitudes)
  const maxLat = Math.max(...latitudes)
  const minLon = Math.min(...longitudes)
  const maxLon = Math.max(...longitudes)
  const latRange = maxLat - minLat
  const lonRange = maxLon - minLon

  return rowsWithLatest.map((row, index) => {
    const x = lonRange === 0 ? 50 : 8 + ((Number(row.latest.longitude) - minLon) / lonRange) * 84
    const y = latRange === 0 ? 50 : 92 - ((Number(row.latest.latitude) - minLat) / latRange) * 84
    return {
      key: `${row.teamPlayerId}:${row.trackerId || index}`,
      label: row.playerName,
      connection: row.connection,
      x: Math.min(94, Math.max(6, x)),
      y: Math.min(94, Math.max(6, y)),
    }
  })
}

export async function loadLocalGpsDashboardState({
  sessionId = null,
  teamId = null,
  clubId = null,
  receiverSnapshots = [],
  nowMs = Date.now(),
  staleThresholdMs = GPS_DASHBOARD_STALE_THRESHOLD_MS,
} = {}) {
  const teamSessions = teamId ? await getLocalGpsSessionsForTeam(teamId) : []
  const recoveredSession =
    (sessionId ? await getLocalGpsSession(sessionId) : null) ||
    teamSessions.find((session) => session.status === GPS_SESSION_STATUS.ACTIVE) ||
    teamSessions.find((session) => session.status === GPS_SESSION_STATUS.PLANNED) ||
    null
  const activeTeamId = recoveredSession?.teamId || teamId
  const activeClubId = recoveredSession?.clubId || clubId
  const players = activeTeamId ? await loadSquad({ teamScope: activeTeamId }) : []
  const trackers = activeClubId ? await getLocalGpsTrackersForClub(activeClubId) : []
  const assignments = recoveredSession
    ? await getLocalGpsAssignmentsForSession(recoveredSession.sessionId)
    : []
  const latestStates = recoveredSession
    ? await getLatestGpsStatesForSession(recoveredSession.sessionId)
    : []
  const rows = buildGpsDashboardRows({
    players,
    trackers,
    assignments,
    latestStates,
    receiverSnapshots,
    nowMs,
    staleThresholdMs,
  })

  return {
    session: recoveredSession,
    sessions: teamSessions,
    players,
    trackers,
    assignments,
    latestStates,
    rows,
    pitchPoints: normalizeGpsPitchPoints(rows),
  }
}
