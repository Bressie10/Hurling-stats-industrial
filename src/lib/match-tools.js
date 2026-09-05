import { findPlayerById, playerIdentity, statsForPlayer } from './team-players.js'

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

function formatZoneLabel(key) {
  if (!key) return 'Unknown'
  return String(key).split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
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

function getAvailableStatKeys(context) {
  const keys = new Set(context.allStats || context.availableStats || [])
  Object.values(context.stats || {}).forEach(row => {
    Object.keys(row || {}).forEach(key => keys.add(key))
  })
  return [...keys].filter(Boolean)
}

function nonZeroStats(row = {}) {
  return Object.fromEntries(
    Object.entries(row || {}).filter(([, value]) => Number(value) > 0)
  )
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
      label: formatZoneLabel(zone.key),
      winPct: zone.total ? Math.round((zone.won / zone.total) * 100) : 0
    }))
    .filter(zone => zone.total >= 2)
    .sort((a, b) => b.winPct - a.winPct || b.total - a.total)[0] ?? null

  const weakZone = Object.values(byZone)
    .map(zone => ({
      ...zone,
      label: formatZoneLabel(zone.key),
      winPct: zone.total ? Math.round((zone.won / zone.total) * 100) : 0
    }))
    .filter(zone => zone.total >= 2)
    .sort((a, b) => a.winPct - b.winPct || b.total - a.total)[0] ?? null

  return {
    total: puckouts.length,
    won,
    lost,
    winPercentage: puckouts.length ? Math.round((won / puckouts.length) * 100) : null,
    byPlayer: Object.values(byPlayer).sort((a, b) => b.total - a.total).slice(0, 5),
    bestZone,
    weakZone
  }
}

export function getShotSummary(context) {
  const goals = getTeamTotal(context, 'Goal')
  const points = getTeamTotal(context, 'Point')
  const wides = getTeamTotal(context, 'Wide')
  const scores = goals + points
  const attempts = scores + wides
  const accuracy = attempts ? Math.round((scores / attempts) * 100) : null

  return {
    goals,
    points,
    wides,
    scores,
    attempts,
    accuracy,
    totalPoints: goals * 3 + points,
    formatted: formatScore({ goals, points }),
    summary: attempts
      ? `${formatScore({ goals, points })}, ${wides} wide${wides === 1 ? '' : 's'}, ${accuracy}% shot conversion.`
      : 'No shots logged yet.'
  }
}

export function getConcededSummary(context) {
  const tracked = context.oppScores || []
  const scoreboard = context.matchScore?.away || { goals: 0, points: 0 }
  const trackedGoals = tracked.filter(score => score.type === 'goal').length
  const trackedPoints = tracked.filter(score => score.type === 'point').length
  const goals = scoreboard.goals || trackedGoals
  const points = scoreboard.points || trackedPoints
  const byMarker = {}
  const byOpposition = {}

  tracked.forEach(score => {
    const value = score.type === 'goal' ? 3 : 1
    const marker = score.marker || 'Unknown marker'
    if (!byMarker[marker]) byMarker[marker] = { marker, goals: 0, points: 0, totalPoints: 0 }
    if (score.type === 'goal') byMarker[marker].goals++
    else byMarker[marker].points++
    byMarker[marker].totalPoints += value

    const opp = score.oppPlayerNum ? `#${score.oppPlayerNum}` : 'Unknown scorer'
    if (!byOpposition[opp]) byOpposition[opp] = { player: opp, goals: 0, points: 0, totalPoints: 0 }
    if (score.type === 'goal') byOpposition[opp].goals++
    else byOpposition[opp].points++
    byOpposition[opp].totalPoints += value
  })

  const markerRows = Object.values(byMarker).sort((a, b) => b.totalPoints - a.totalPoints).slice(0, 5)
  const oppositionRows = Object.values(byOpposition).sort((a, b) => b.totalPoints - a.totalPoints).slice(0, 5)

  return {
    goals,
    points,
    formatted: formatScore({ goals, points }),
    totalPoints: goals * 3 + points,
    trackedEvents: tracked.length,
    byMarker: markerRows,
    byOpposition: oppositionRows,
    topMarker: markerRows[0] || null,
    topOppositionScorer: oppositionRows[0] || null,
    summary: tracked.length
      ? `Opposition score ${formatScore({ goals, points })}. Main tracked scorer: ${oppositionRows[0]?.player || 'unknown'}.`
      : `Opposition score is ${formatScore(scoreboard)}. No detailed conceded events tracked.`
  }
}

export function getRecentEvents(context, { limit = 5 } = {}) {
  const max = Math.max(1, Math.min(Number(limit) || 5, 10))
  const players = context.players || []

  return (context.events || []).slice(-max).reverse().map(event => {
    const player = findPlayerById(players, event.playerId)
    return {
      time: formatTime(event.time ?? 0),
      period: event.period,
      stat: event.stat,
      player: playerLabel(player),
      location: event.x != null && event.y != null ? { x: event.x, y: event.y, end: event.end } : null
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
      const playerStats = statsForPlayer(stats, player)
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

export function getPlayerImpactLeaders(context, { limit = 5 } = {}) {
  const max = Math.max(1, Math.min(Number(limit) || 5, 10))
  const rows = (context.players || [])
    .filter(player => player.name?.trim())
    .map(player => {
      const row = statsForPlayer(context.stats, player)
      const score = (row['Goal'] || 0) * 3 + (row['Point'] || 0)
      const positive = score + (row['Tackle'] || 0) + (row['Block'] || 0) + (row['Turnover Won'] || 0) + (row['Free Won'] || 0)
      const negative = (row['Wide'] || 0) + (row['Turnover Lost'] || 0) + (row['Yellow Card'] || 0) + ((row['Red Card'] || 0) * 2)
      const involvement = Object.values(row).reduce((sum, value) => sum + (Number(value) || 0), 0)
      return {
        player: playerLabel(player),
        number: player.number,
        position: player.position || '',
        score,
        goals: row['Goal'] || 0,
        points: row['Point'] || 0,
        wides: row['Wide'] || 0,
        positive,
        negative,
        involvement,
        impact: positive - negative,
        stats: nonZeroStats(row)
      }
    })
    .filter(row => row.involvement > 0)
    .sort((a, b) => b.impact - a.impact || b.involvement - a.involvement)
    .slice(0, max)

  return { leaders: rows }
}

export function getPlayerQuickStats(context, { playerNumber } = {}) {
  const { player, number, error } = resolvePlayerByNumber(context, playerNumber)
  if (error) return { ok: false, error }

  const playerStats = statsForPlayer(context.stats, player)
  const goals = playerStats['Goal'] || 0
  const points = playerStats['Point'] || 0
  const wides = playerStats['Wide'] || 0
  const otherStats = Object.entries(playerStats)
    .filter(([stat, count]) => !['Goal', 'Point', 'Wide'].includes(stat) && Number(count) > 0)
    .map(([stat, count]) => ({ stat, count }))
  const recentEvents = (context.events || [])
    .filter(event => String(event.playerId) === String(playerIdentity(player)))
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

export function getCoachingRecommendations(context) {
  const score = getScore(context)
  const shots = getShotSummary(context)
  const puckouts = getPuckoutSummary(context)
  const turnovers = getTeamStatTotal(context, { stat: 'turnovers' })
  const conceded = getConcededSummary(context)
  const impact = getPlayerImpactLeaders(context, { limit: 3 }).leaders
  const margin = score.home.totalPoints - score.away.totalPoints
  const recommendations = []

  if (margin <= -4) {
    recommendations.push(`Chase scores with control: down ${Math.abs(margin)}, so prioritize high-percentage shots and frees before forcing goals.`)
  } else if (margin >= 4) {
    recommendations.push(`Protect the lead: up ${margin}, value possession and avoid low-percentage shots.`)
  } else {
    recommendations.push(`The game is within ${Math.abs(margin)} point${Math.abs(margin) === 1 ? '' : 's'}; next clean possession and shot quality matter most.`)
  }

  if (shots.attempts >= 4 && shots.accuracy !== null && shots.accuracy < 55) {
    recommendations.push(`Improve shot selection: ${shots.accuracy}% from ${shots.attempts} attempts, with ${shots.wides} wide${shots.wides === 1 ? '' : 's'}.`)
  } else if (shots.wides >= 4) {
    recommendations.push(`Settle the shooting: ${shots.wides} wides logged, so work the ball one pass closer before shooting.`)
  }

  if (puckouts.total >= 3 && puckouts.winPercentage !== null && puckouts.winPercentage < 50) {
    const zone = puckouts.bestZone ? ` Best return so far is ${puckouts.bestZone.label} at ${puckouts.bestZone.winPct}%.` : ''
    recommendations.push(`Stabilize puckouts: ${puckouts.won} won from ${puckouts.total}.${zone}`)
  } else if (puckouts.bestZone) {
    recommendations.push(`Lean into the puckout pattern that is working: ${puckouts.bestZone.label}, ${puckouts.bestZone.won}/${puckouts.bestZone.total} won.`)
  }

  if (turnovers.total >= 3 && turnovers.lost > turnovers.won) {
    recommendations.push(`Protect possession after contact: ${turnovers.lost} turnovers lost versus ${turnovers.won} won.`)
  } else if (turnovers.won >= 3) {
    recommendations.push(`Keep pressing the ball carrier: ${turnovers.won} turnovers won is a useful platform.`)
  }

  if (conceded.goals >= 1) {
    recommendations.push(`Tighten goal protection: ${conceded.goals} goal${conceded.goals === 1 ? '' : 's'} conceded.`)
  } else if (conceded.topOppositionScorer) {
    recommendations.push(`Check the main scorer: ${conceded.topOppositionScorer.player} has ${conceded.topOppositionScorer.goals}-${String(conceded.topOppositionScorer.points).padStart(2, '0')}.`)
  }

  if (impact[0]) {
    recommendations.push(`Keep ${impact[0].player} involved; they lead impact with ${impact[0].impact} from ${impact[0].involvement} involvements.`)
  }

  return {
    recommendations: recommendations.slice(0, 5),
    primary: recommendations[0] || 'Keep logging more events so the recommendation has enough data.'
  }
}

export function getMatchSummary(context) {
  return {
    score: getScore(context),
    periodAndTime: getCurrentPeriodAndTime(context),
    topScorers: getPlayerStatLeaders(context, { stat: 'score', limit: 3 }).leaders,
    shots: getShotSummary(context),
    wides: getTeamTotal(context, 'Wide'),
    turnovers: getTeamStatTotal(context, { stat: 'turnovers' }),
    conceded: getConcededSummary(context),
    puckouts: getPuckoutSummary(context),
    recentEvents: getRecentEvents(context, { limit: 5 }),
    recommendations: getCoachingRecommendations(context).recommendations
  }
}

export function getSidelineAnalysis(context) {
  return {
    score: getScore(context),
    periodAndTime: getCurrentPeriodAndTime(context),
    shots: getShotSummary(context),
    puckouts: getPuckoutSummary(context),
    turnovers: getTeamStatTotal(context, { stat: 'turnovers' }),
    conceded: getConcededSummary(context),
    topScorers: getPlayerStatLeaders(context, { stat: 'score', limit: 5 }).leaders,
    impactLeaders: getPlayerImpactLeaders(context, { limit: 5 }).leaders,
    recentEvents: getRecentEvents(context, { limit: 5 }),
    recommendations: getCoachingRecommendations(context).recommendations
  }
}

export function buildSidelineAnswerSnapshot(context = {}) {
  const analysis = getSidelineAnalysis(context)
  const statKeys = getAvailableStatKeys(context)
  const players = (context.players || [])
    .filter(player => player.name?.trim())
    .map(player => {
      const row = statsForPlayer(context.stats, player)
      const visibleStats = nonZeroStats(row)
      const involvement = Object.values(row).reduce((sum, value) => sum + (Number(value) || 0), 0)
      return {
        number: player.number,
        name: player.name?.trim(),
        position: player.position || '',
        score: formatScore({ goals: row['Goal'] || 0, points: row['Point'] || 0 }),
        totalPoints: (row['Goal'] || 0) * 3 + (row['Point'] || 0),
        involvement,
        stats: visibleStats
      }
    })
    .sort((a, b) => Number(a.number || 999) - Number(b.number || 999))
    .slice(0, 30)

  const teamTotals = Object.fromEntries(
    statKeys.map(stat => [stat, getTeamTotal(context, stat)])
  )

  return {
    match: {
      activeMatch: Boolean(context.activeMatch),
      teamName: context.teamName || 'Home',
      opposition: context.opposition || 'Opposition',
      competition: context.competition || '',
      venue: context.venue || '',
      date: context.date || ''
    },
    score: analysis.score,
    clock: analysis.periodAndTime,
    teamTotals,
    shots: analysis.shots,
    puckouts: analysis.puckouts,
    turnovers: analysis.turnovers,
    conceded: analysis.conceded,
    topScorers: analysis.topScorers,
    impactLeaders: analysis.impactLeaders,
    players,
    recentEvents: analysis.recentEvents,
    recommendations: analysis.recommendations
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
    get_current_period_and_time: withContext((context) => getCurrentPeriodAndTime(context)),
    get_shot_summary: withContext((context) => getShotSummary(context)),
    get_conceded_summary: withContext((context) => getConcededSummary(context)),
    get_player_impact_leaders: withContext((context, args) => getPlayerImpactLeaders(context, args)),
    get_coaching_recommendations: withContext((context) => getCoachingRecommendations(context)),
    get_sideline_analysis: withContext((context) => getSidelineAnalysis(context))
  }
}
