const STAT_ALIASES = {
  score: 'score',
  scores: 'score',
  scoring: 'score',
  point: 'Point',
  points: 'Point',
  goal: 'Goal',
  goals: 'Goal',
  wide: 'Wide',
  wides: 'Wide',
  tackle: 'Tackle',
  tackles: 'Tackle',
  block: 'Block',
  blocks: 'Block',
  'turnover won': 'Turnover Won',
  'turnovers won': 'Turnover Won',
  'turnover lost': 'Turnover Lost',
  'turnovers lost': 'Turnover Lost',
  turnover: 'turnovers',
  turnovers: 'turnovers',
  'free won': 'Free Won',
  'frees won': 'Free Won',
  free: 'Free Won',
  frees: 'Free Won',
  'yellow card': 'Yellow Card',
  'yellow cards': 'Yellow Card',
  yellow: 'Yellow Card',
  'red card': 'Red Card',
  'red cards': 'Red Card',
  red: 'Red Card',
  'penalty won': 'Penalty Won',
  'penalties won': 'Penalty Won',
  'penalty scored': 'Penalty Scored',
  'penalties scored': 'Penalty Scored'
}

function formatScore(score = {}) {
  return `${score.goals || 0}-${String(score.points || 0).padStart(2, '0')}`
}

function formatTime(seconds = 0) {
  const safeSeconds = Math.max(0, Number(seconds) || 0)
  return `${String(Math.floor(safeSeconds / 60)).padStart(2, '0')}:${String(safeSeconds % 60).padStart(2, '0')}`
}

function playerLabel(player) {
  if (!player) return 'Unknown'
  return player.name?.trim() || `#${player.number}`
}

function resolvePlayerByNumber(context, playerNumber) {
  const number = Number(playerNumber)
  if (!Number.isInteger(number) || number <= 0) {
    return { error: 'Need number.' }
  }

  const matches = (context.players || []).filter(player => Number(player.number) === number)
  if (matches.length === 0) return { error: `No #${number}.` }
  if (matches.length > 1) return { error: `Duplicate #${number}. Use manual.` }
  return { player: matches[0], number }
}

export function normalizeStatName(context, stat) {
  const value = String(stat || '').trim().toLowerCase()
  return STAT_ALIASES[value] || (context.allStats || []).find(s => s.toLowerCase() === value) || stat
}

function getTeamTotal(context, statName) {
  return Object.values(context.stats || {}).reduce((sum, playerStats) => sum + (playerStats?.[statName] || 0), 0)
}

export function getScore(context) {
  const home = context.matchScore?.home || { goals: 0, points: 0 }
  const away = context.matchScore?.away || { goals: 0, points: 0 }

  return {
    teamName: context.teamName || 'Home',
    opposition: context.opposition || 'Opposition',
    home: {
      ...home,
      formatted: formatScore(home),
      totalPoints: (home.goals || 0) * 3 + (home.points || 0)
    },
    away: {
      ...away,
      formatted: formatScore(away),
      totalPoints: (away.goals || 0) * 3 + (away.points || 0)
    }
  }
}

export function getPuckoutSummary(context) {
  const puckouts = context.puckouts || []
  const won = puckouts.filter(p => p.outcome === 'won').length
  const lost = puckouts.filter(p => p.outcome === 'lost').length
  const byPlayer = {}
  const byZone = {}

  puckouts.forEach(p => {
    const key = p.ourPlayer || 'Unknown'
    if (!byPlayer[key]) byPlayer[key] = { player: key, won: 0, lost: 0, total: 0 }
    byPlayer[key].total++
    if (p.outcome === 'won') byPlayer[key].won++
    else byPlayer[key].lost++

    const zone = p.section || 'no-zone'
    if (zone !== 'no-zone') {
      if (!byZone[zone]) byZone[zone] = { key: zone, won: 0, lost: 0, total: 0 }
      byZone[zone].total++
      if (p.outcome === 'won') byZone[zone].won++
      else byZone[zone].lost++
    }
  })

  const bestZone = Object.values(byZone)
    .map(zone => ({
      ...zone,
      label: zone.key.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      winPct: zone.total ? Math.round((zone.won / zone.total) * 100) : 0
    }))
    .sort((a, b) => b.won - a.won)[0] ?? null

  return {
    total: puckouts.length,
    won,
    lost,
    winPercentage: puckouts.length ? Math.round((won / puckouts.length) * 100) : null,
    byPlayer: Object.values(byPlayer).sort((a, b) => b.total - a.total).slice(0, 5),
    bestZone
  }
}

export function getRecentEvents(context, { limit = 5 } = {}) {
  const max = Math.max(1, Math.min(Number(limit) || 5, 10))
  const players = context.players || []

  return (context.events || []).slice(-max).reverse().map(event => {
    const player = players.find(p => p.id === event.playerId)
    return {
      time: formatTime(event.time ?? 0),
      period: event.period,
      stat: event.stat,
      player: playerLabel(player),
      location: event.x !== null && event.y !== null ? { x: event.x, y: event.y, end: event.end } : null
    }
  })
}

export function getPlayerStatLeaders(context, { stat = 'score', limit = 5 } = {}) {
  const statName = normalizeStatName(context, stat)
  const max = Math.max(1, Math.min(Number(limit) || 5, 10))
  const stats = context.stats || {}

  const rows = (context.players || [])
    .filter(p => p.name?.trim())
    .map(player => {
      const playerStats = stats[player.id] || {}
      if (statName === 'score') {
        const goals = playerStats['Goal'] || 0
        const points = playerStats['Point'] || 0
        return {
          player: playerLabel(player),
          stat: 'score',
          goals,
          points,
          totalPoints: goals * 3 + points,
          formatted: `${goals}-${String(points).padStart(2, '0')}`
        }
      }
      if (statName === 'turnovers') {
        return {
          player: playerLabel(player),
          stat: 'turnovers',
          won: playerStats['Turnover Won'] || 0,
          lost: playerStats['Turnover Lost'] || 0,
          total: (playerStats['Turnover Won'] || 0) + (playerStats['Turnover Lost'] || 0)
        }
      }
      return {
        player: playerLabel(player),
        stat: statName,
        value: playerStats[statName] || 0
      }
    })
    .filter(row => statName === 'score' ? row.totalPoints > 0 : statName === 'turnovers' ? row.total > 0 : row.value > 0)
    .sort((a, b) => {
      const av = statName === 'score' ? a.totalPoints : statName === 'turnovers' ? a.total : a.value
      const bv = statName === 'score' ? b.totalPoints : statName === 'turnovers' ? b.total : b.value
      return bv - av
    })
    .slice(0, max)

  return { stat: statName, leaders: rows }
}

export function getPlayerQuickStats(context, { playerNumber } = {}) {
  const { player, number, error } = resolvePlayerByNumber(context, playerNumber)
  if (error) return { ok: false, error }

  const playerStats = context.stats?.[player.id] || {}
  const goals = playerStats['Goal'] || 0
  const points = playerStats['Point'] || 0
  const wides = playerStats['Wide'] || 0
  const otherStats = Object.entries(playerStats)
    .filter(([stat, count]) => !['Goal', 'Point', 'Wide'].includes(stat) && Number(count) > 0)
    .map(([stat, count]) => ({ stat, count }))
  const recentEvents = (context.events || [])
    .filter(event => event.playerId === player.id)
    .slice(-5)
    .reverse()
    .map(event => ({
      stat: event.stat,
      period: event.period,
      time: formatTime(event.time ?? 0)
    }))

  const hasStats = goals > 0 || points > 0 || wides > 0 || otherStats.length > 0
  const summaryParts = []
  if (goals || points) summaryParts.push(formatScore({ goals, points }))
  if (wides) summaryParts.push(`${wides} wide${wides === 1 ? '' : 's'}`)
  otherStats.forEach(({ stat, count }) => summaryParts.push(`${count} ${stat.toLowerCase()}`))
  const playerPrefix = `#${number} ${player.name?.trim() || ''}`.trim()

  return {
    ok: true,
    playerNumber: number,
    playerName: player.name?.trim() || null,
    label: playerLabel(player),
    score: {
      goals,
      points,
      formatted: formatScore({ goals, points }),
      totalPoints: goals * 3 + points
    },
    goals,
    points,
    wides,
    otherStats,
    recentEvents,
    hasStats,
    summary: hasStats
      ? `${playerPrefix}: ${summaryParts.join(', ')}.`
      : `${playerPrefix}: no stats.`
  }
}

export function getTeamStatTotal(context, { stat } = {}) {
  const statName = normalizeStatName(context, stat)
  const home = context.matchScore?.home || { goals: 0, points: 0 }

  if (statName === 'score') {
    return {
      stat: 'score',
      goals: home.goals || 0,
      points: home.points || 0,
      totalPoints: (home.goals || 0) * 3 + (home.points || 0),
      formatted: formatScore(home)
    }
  }
  if (statName === 'turnovers') {
    return {
      stat: 'turnovers',
      won: getTeamTotal(context, 'Turnover Won'),
      lost: getTeamTotal(context, 'Turnover Lost'),
      total: getTeamTotal(context, 'Turnover Won') + getTeamTotal(context, 'Turnover Lost')
    }
  }
  return { stat: statName, total: getTeamTotal(context, statName) }
}

export function getCurrentPeriodAndTime(context) {
  return {
    period: context.period,
    clock: formatTime(context.timerSeconds),
    seconds: context.timerSeconds,
    running: context.timerRunning,
    overtime: context.timerOverTime
  }
}

export function getMatchSummary(context) {
  return {
    score: getScore(context),
    periodAndTime: getCurrentPeriodAndTime(context),
    topScorers: getPlayerStatLeaders(context, { stat: 'score', limit: 3 }).leaders,
    wides: getTeamTotal(context, 'Wide'),
    turnovers: getTeamStatTotal(context, { stat: 'turnovers' }),
    puckouts: getPuckoutSummary(context),
    recentEvents: getRecentEvents(context, { limit: 5 })
  }
}

export function buildSidelineToolHandlers(getContext) {
  const withContext = (handler) => (args = {}) => handler(getContext(), args)

  return {
    get_match_summary: withContext((context) => getMatchSummary(context)),
    get_score: withContext((context) => getScore(context)),
    get_player_stat_leaders: withContext((context, args) => getPlayerStatLeaders(context, args)),
    get_player_quick_stats: withContext((context, args) => getPlayerQuickStats(context, args)),
    get_team_stat_total: withContext((context, args) => getTeamStatTotal(context, args)),
    get_puckout_summary: withContext((context) => getPuckoutSummary(context)),
    get_recent_events: withContext((context, args) => getRecentEvents(context, args)),
    get_current_period_and_time: withContext((context) => getCurrentPeriodAndTime(context))
  }
}
