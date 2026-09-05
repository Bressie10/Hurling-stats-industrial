export const ACTIVE_PLAYER_STATUS = 'active'
export const INACTIVE_PLAYER_STATUS = 'inactive'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuid(value) {
  return UUID_RE.test(String(value || ''))
}

export function createPlayerId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()

  const bytes = new Uint8Array(16)
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function playerIdentity(value) {
  if (value == null) return null
  if (typeof value !== 'object') return String(value)
  const id = value.team_player_id ?? value.teamPlayerId ?? value.playerId ?? value.id
  return id == null ? null : String(id)
}

export function playerName(player) {
  return player?.name ?? player?.display_name ?? ''
}

export function playerNumber(player) {
  return player?.number ?? player?.default_number ?? null
}

export function createRosterPlayer(overrides = {}) {
  const id = String(overrides.id ?? overrides.team_player_id ?? overrides.teamPlayerId ?? createPlayerId())
  const name = playerName(overrides)
  const number = playerNumber(overrides)
  return {
    id,
    team_player_id: id,
    name,
    display_name: name,
    number,
    default_number: number,
    position: overrides.position ?? null,
    status: overrides.status ?? ACTIVE_PLAYER_STATUS,
    joined_at: overrides.joined_at ?? null,
    left_at: overrides.left_at ?? null,
    updated_at: overrides.updated_at ?? Date.now(),
  }
}

export function normalizeRosterPlayer(player = {}, { updatedAt = Date.now() } = {}) {
  const candidateId = player.team_player_id ?? player.teamPlayerId ?? player.id
  const id = isUuid(candidateId) ? String(candidateId) : createPlayerId()
  const name = playerName(player)
  const number = playerNumber(player)
  return {
    ...player,
    id,
    team_player_id: id,
    name,
    display_name: name,
    number,
    default_number: number,
    position: player.position ?? null,
    status: player.status ?? ACTIVE_PLAYER_STATUS,
    joined_at: player.joined_at ?? null,
    left_at: player.left_at ?? null,
    updated_at: player.updated_at || updatedAt,
  }
}

export function playerHasDisplayName(player) {
  return Boolean(playerName(player).trim())
}

export function isActivePlayer(player) {
  return (player?.status || ACTIVE_PLAYER_STATUS) === ACTIVE_PLAYER_STATUS
}

export function playerSnapshot(player) {
  const id = playerIdentity(player)
  return {
    id,
    team_player_id: id,
    name: playerName(player),
    display_name: playerName(player),
    number: playerNumber(player),
    default_number: playerNumber(player),
    position: player?.position ?? null,
    status: player?.status ?? ACTIVE_PLAYER_STATUS,
  }
}

export function findPlayerById(players = [], id) {
  const wanted = playerIdentity(id)
  return (players || []).find((player) => playerIdentity(player) === wanted) || null
}

export function statsForPlayer(stats = {}, playerOrId) {
  const id = playerIdentity(playerOrId)
  return id == null ? {} : stats?.[id] || {}
}

export function playerLabel(playerOrMatch, maybeId = undefined) {
  const player = maybeId === undefined ? playerOrMatch : findPlayerById(playerOrMatch?.players || [], maybeId)
  if (!player) return maybeId == null ? 'Unknown' : `#${maybeId}`
  const name = playerName(player).trim()
  return name || `#${playerNumber(player) || playerIdentity(player)}`
}
