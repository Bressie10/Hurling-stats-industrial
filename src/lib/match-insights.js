const STAT_LABELS = {
  Point: 'Points scored',
  Goal: 'Goals scored',
  Wide: 'Wides',
  Tackle: 'Tackles',
  Block: 'Blocks',
  'Turnover Won': 'Turnovers won',
  'Turnover Lost': 'Turnovers lost',
  'Free Won': 'Frees won',
  'Yellow Card': 'Yellow cards',
  'Red Card': 'Red cards',
  'Penalty Won': 'Penalties won',
  'Penalty Scored': 'Penalties scored'
}

const TARGET_STATS = [
  { key: 'Point', label: 'Points scored' },
  { key: 'Goal', label: 'Goals scored' },
  { key: 'Wide', label: 'Wides', lowerIsBetter: true },
  { key: 'Tackle', label: 'Tackles' },
  { key: 'Block', label: 'Blocks' },
  { key: 'Turnover Won', label: 'Turnovers won' },
  { key: 'Turnover Lost', label: 'Turnovers lost', lowerIsBetter: true },
  { key: 'Free Won', label: 'Frees won' }
]

const TREND_STATS = ['Point', 'Goal', 'Wide', 'Tackle', 'Block', 'Turnover Won', 'Turnover Lost', 'Free Won']
const LOWER_IS_BETTER = new Set(['Wide', 'Turnover Lost', 'Yellow Card', 'Red Card'])
const DEFAULT_PERIOD_ORDER = ['Warm-up', '1st Half', '2nd Half', 'Extra Time']

function num(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0
}

function totalScore(score = {}) {
  return num(score.goals) * 3 + num(score.points)
}

export function formatMatchScore(score) {
  if (!score) return '0-00'
  return `${num(score.goals)}-${String(num(score.points)).padStart(2, '0')}`
}

export function getTeamStatTotal(match, stat) {
  return Object.values(match?.stats || {}).reduce((sum, row) => sum + num(row?.[stat]), 0)
}

function getPlayer(match, playerId) {
  return (match?.players || []).find(p => String(p.id) === String(playerId)) || null
}

function getPlayerLabel(match, playerId) {
  const player = getPlayer(match, playerId)
  if (!player) return `#${playerId}`
  return player.name?.trim() || `#${player.number || playerId}`
}

function periodIndex(period) {
  const index = DEFAULT_PERIOD_ORDER.indexOf(period)
  return index === -1 ? DEFAULT_PERIOD_ORDER.length + 1 : index
}

function compareByPeriodTime(a, b) {
  return periodIndex(a.period) - periodIndex(b.period) ||
    (a.time ?? 999999) - (b.time ?? 999999)
}

function scoreOutcome(match) {
  const home = totalScore(match?.score?.home)
  const away = totalScore(match?.score?.away)
  const margin = Math.abs(home - away)
  const result = home > away ? 'W' : home < away ? 'L' : 'D'
  const marginText = result === 'D' ? 'Drew level' : `${result === 'W' ? 'Won' : 'Lost'} by ${margin}`
  return { home, away, margin, result, marginText }
}

function getAllStatKeys(match) {
  const keys = new Set(TREND_STATS)
  Object.values(match?.stats || {}).forEach(row => {
    Object.keys(row || {}).forEach(key => {
      if (num(row[key]) > 0) keys.add(key)
    })
  })
  ;(match?.customStats || []).forEach(key => keys.add(key))
  return [...keys]
}

function buildShotSummary(match) {
  const points = getTeamStatTotal(match, 'Point')
  const goals = getTeamStatTotal(match, 'Goal')
  const wides = getTeamStatTotal(match, 'Wide')
  const scores = points + goals
  const attempts = scores + wides
  const accuracy = attempts ? Math.round((scores / attempts) * 100) : null
  return { points, goals, wides, scores, attempts, accuracy }
}

function buildPuckoutSummary(match) {
  const total = match?.puckouts?.length || 0
  const won = (match?.puckouts || []).filter(p => p.outcome === 'won').length
  const lost = total - won
  const winPct = total ? Math.round((won / total) * 100) : null
  const zones = {}
  const players = {}

  ;(match?.puckouts || []).forEach(p => {
    if (p.section) {
      if (!zones[p.section]) zones[p.section] = { key: p.section, won: 0, lost: 0, total: 0, winPct: 0 }
      zones[p.section][p.outcome === 'won' ? 'won' : 'lost']++
      zones[p.section].total++
    }
    const player = p.ourPlayer || 'Unknown'
    if (!players[player]) players[player] = { name: player, won: 0, lost: 0, total: 0, winPct: 0 }
    players[player][p.outcome === 'won' ? 'won' : 'lost']++
    players[player].total++
  })

  const zoneRows = Object.values(zones)
    .map(z => ({ ...z, label: formatZoneLabel(z.key), winPct: Math.round((z.won / z.total) * 100) }))
    .sort((a, b) => b.total - a.total)
  const playerRows = Object.values(players)
    .map(p => ({ ...p, winPct: Math.round((p.won / p.total) * 100) }))
    .sort((a, b) => b.total - a.total)

  const bestZone = zoneRows.filter(z => z.total >= 2).sort((a, b) => b.winPct - a.winPct || b.total - a.total)[0] || null
  const weakZone = zoneRows.filter(z => z.total >= 2).sort((a, b) => a.winPct - b.winPct || b.total - a.total)[0] || null

  return { total, won, lost, winPct, zoneRows, playerRows, bestZone, weakZone }
}

function formatZoneLabel(key) {
  if (!key) return 'Unknown'
  return String(key).split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

function buildConcededSummary(match) {
  const goals = (match?.oppScores || []).filter(s => s.type === 'goal').length
  const points = (match?.oppScores || []).filter(s => s.type === 'point').length
  const total = goals * 3 + points
  const byMarker = {}
  const byOpp = {}

  ;(match?.oppScores || []).forEach(score => {
    const marker = score.marker || 'Unknown'
    if (!byMarker[marker]) byMarker[marker] = { name: marker, goals: 0, points: 0, total: 0 }
    if (score.type === 'goal') byMarker[marker].goals++
    else byMarker[marker].points++
    byMarker[marker].total += score.type === 'goal' ? 3 : 1

    const opp = score.oppPlayerNum ? `#${score.oppPlayerNum}` : 'Unknown'
    if (!byOpp[opp]) byOpp[opp] = { name: opp, goals: 0, points: 0, total: 0 }
    if (score.type === 'goal') byOpp[opp].goals++
    else byOpp[opp].points++
    byOpp[opp].total += score.type === 'goal' ? 3 : 1
  })

  return {
    goals,
    points,
    total,
    topMarker: Object.values(byMarker).sort((a, b) => b.total - a.total)[0] || null,
    topOppositionScorer: Object.values(byOpp).sort((a, b) => b.total - a.total)[0] || null
  }
}

function buildPeriodRows(match) {
  const map = {}
  const order = []

  function ensure(period) {
    const key = period || 'Unassigned'
    if (!map[key]) {
      map[key] = {
        period: key,
        home: 0,
        away: 0,
        points: 0,
        goals: 0,
        wides: 0,
        tackles: 0,
        turnoversWon: 0,
        turnoversLost: 0,
        margin: 0
      }
      order.push(key)
    }
    return map[key]
  }

  ;(match?.events || []).forEach(event => {
    const row = ensure(event.period)
    if (event.stat === 'Point') { row.points++; row.home += 1 }
    if (event.stat === 'Goal') { row.goals++; row.home += 3 }
    if (event.stat === 'Wide') row.wides++
    if (event.stat === 'Tackle') row.tackles++
    if (event.stat === 'Turnover Won') row.turnoversWon++
    if (event.stat === 'Turnover Lost') row.turnoversLost++
  })

  ;(match?.oppScores || []).forEach(score => {
    const row = ensure(score.period)
    row.away += score.type === 'goal' ? 3 : 1
  })

  return order.map(key => {
    const row = map[key]
    return { ...row, margin: row.home - row.away }
  })
}

function buildScoringRun(match) {
  const scores = []
  ;(match?.events || [])
    .filter(e => e.stat === 'Point' || e.stat === 'Goal')
    .forEach(e => scores.push({
      team: 'home',
      value: e.stat === 'Goal' ? 3 : 1,
      time: e.time ?? 999999,
      period: e.period,
      label: getPlayerLabel(match, e.playerId)
    }))
  ;(match?.oppScores || []).forEach(s => scores.push({
    team: 'away',
    value: s.type === 'goal' ? 3 : 1,
    time: s.time ?? 999999,
    period: s.period,
    label: s.oppPlayerNum ? `#${s.oppPlayerNum}` : 'Opposition'
  }))

  scores.sort(compareByPeriodTime)

  let currentTeam = null
  let currentPoints = 0
  let currentCount = 0
  let currentStart = null
  const best = {
    home: { points: 0, count: 0, start: null, end: null },
    away: { points: 0, count: 0, start: null, end: null }
  }

  scores.forEach(score => {
    if (score.team !== currentTeam) {
      currentTeam = score.team
      currentPoints = 0
      currentCount = 0
      currentStart = score
    }
    currentPoints += score.value
    currentCount++
    if (currentPoints > best[score.team].points) {
      best[score.team] = {
        points: currentPoints,
        count: currentCount,
        start: currentStart,
        end: score
      }
    }
  })

  return {
    scores,
    bestHomeRun: best.home.points ? best.home : null,
    bestAwayRun: best.away.points ? best.away : null
  }
}

function buildPlayerImpact(match) {
  return (match?.players || [])
    .map(player => {
      const stats = match?.stats?.[player.id] || {}
      const score = num(stats.Goal) * 3 + num(stats.Point)
      const positive = score + num(stats.Tackle) + num(stats.Block) + num(stats['Turnover Won']) + num(stats['Free Won'])
      const negative = num(stats.Wide) + num(stats['Turnover Lost']) + num(stats['Yellow Card']) + num(stats['Red Card']) * 2
      const involvement = Object.values(stats).reduce((sum, value) => sum + num(value), 0)
      const impact = positive - negative
      return {
        id: player.id,
        number: player.number,
        name: player.name?.trim() || `#${player.number || player.id}`,
        position: player.position || '',
        score,
        positive,
        negative,
        involvement,
        impact,
        stats
      }
    })
    .filter(row => row.involvement > 0)
    .sort((a, b) => b.impact - a.impact || b.involvement - a.involvement)
}

function zoneForEvent(event) {
  if (event.x == null || event.y == null) return null
  const x = num(event.x)
  const y = num(event.y)
  const third = x < 33 ? 'Own third' : x < 66 ? 'Middle third' : 'Attacking third'
  const channel = y < 33 ? 'Top channel' : y < 66 ? 'Central channel' : 'Bottom channel'
  return `${third} - ${channel}`
}

function buildShotZones(match) {
  const map = {}
  const locatedEvents = []

  ;(match?.events || []).forEach(event => {
    if (event.x == null || event.y == null) return
    const player = getPlayer(match, event.playerId)
    const located = {
      ...event,
      x: num(event.x),
      y: num(event.y),
      playerName: player?.name?.trim() || `#${player?.number || event.playerId}`,
      color: event.stat === 'Wide' ? '#e53935' : event.stat === 'Goal' || event.stat === 'Point' ? '#2d7a2d' : '#1565c0'
    }
    locatedEvents.push(located)

    if (!['Point', 'Goal', 'Wide'].includes(event.stat)) return
    const zone = zoneForEvent(event)
    if (!zone) return
    if (!map[zone]) map[zone] = { zone, goals: 0, points: 0, wides: 0, attempts: 0, accuracy: 0 }
    if (event.stat === 'Goal') map[zone].goals++
    if (event.stat === 'Point') map[zone].points++
    if (event.stat === 'Wide') map[zone].wides++
    map[zone].attempts++
  })

  return {
    locatedEvents,
    shotZones: Object.values(map)
      .map(row => ({ ...row, accuracy: Math.round(((row.goals + row.points) / row.attempts) * 100) }))
      .sort((a, b) => b.attempts - a.attempts)
  }
}

function targetDefinitions(targetConfig = {}) {
  const custom = (targetConfig.customStats || []).map(key => ({
    key,
    label: STAT_LABELS[key] || key,
    lowerIsBetter: LOWER_IS_BETTER.has(key)
  }))
  const defs = [...TARGET_STATS, ...custom]
  const seen = new Set()
  return defs.filter(def => {
    if (seen.has(def.key)) return false
    seen.add(def.key)
    return true
  })
}

function targetMet(value, target, lowerIsBetter) {
  if (!target || target <= 0) return false
  return lowerIsBetter ? value <= target : value >= target
}

function buildTargetRows(match, seasonMatches, targetConfig) {
  const targets = targetConfig?.targets || {}
  return targetDefinitions(targetConfig)
    .map(def => {
      const target = num(targets[def.key])
      if (!target) return null
      const matchValue = getTeamStatTotal(match, def.key)
      const seasonValues = (seasonMatches || []).map(m => getTeamStatTotal(m, def.key))
      const seasonTotal = seasonValues.length
      const seasonMet = seasonValues.filter(value => targetMet(value, target, def.lowerIsBetter)).length
      const avg = seasonTotal
        ? Math.round((seasonValues.reduce((sum, value) => sum + value, 0) / seasonTotal) * 10) / 10
        : 0
      return {
        ...def,
        target,
        matchValue,
        status: targetMet(matchValue, target, def.lowerIsBetter) ? 'met' : 'missed',
        seasonMet,
        seasonTotal,
        seasonRate: seasonTotal ? Math.round((seasonMet / seasonTotal) * 100) : 0,
        avg
      }
    })
    .filter(Boolean)
}

function buildTrendRows(seasonMatches) {
  const ordered = [...(seasonMatches || [])].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
  if (ordered.length < 2) return []
  const recent = ordered.slice(0, Math.min(3, ordered.length))
  const comparison = ordered.slice(recent.length, recent.length + Math.min(3, Math.max(0, ordered.length - recent.length)))
  if (comparison.length === 0) return []

  return TREND_STATS.map(stat => {
    const recentAvg = recent.reduce((sum, match) => sum + getTeamStatTotal(match, stat), 0) / recent.length
    const previousAvg = comparison.reduce((sum, match) => sum + getTeamStatTotal(match, stat), 0) / comparison.length
    const delta = recentAvg - previousAvg
    const lowerIsBetter = LOWER_IS_BETTER.has(stat)
    let direction = 'stable'
    if (Math.abs(delta) >= 0.5) {
      direction = lowerIsBetter
        ? (delta < 0 ? 'improving' : 'slipping')
        : (delta > 0 ? 'improving' : 'slipping')
    }
    return {
      stat,
      label: STAT_LABELS[stat] || stat,
      recentAvg: Math.round(recentAvg * 10) / 10,
      previousAvg: Math.round(previousAvg * 10) / 10,
      delta: Math.round(delta * 10) / 10,
      direction
    }
  }).filter(row => row.recentAvg > 0 || row.previousAvg > 0)
}

function buildStory(match, parts) {
  const { outcome, shots, puckouts, conceded, targets, periods, scoringRun } = parts
  const bullets = []

  bullets.push(`${outcome.marginText}: ${formatMatchScore(match?.score?.home)} to ${formatMatchScore(match?.score?.away)}.`)

  if (shots.attempts > 0) {
    bullets.push(`Shot ${shots.accuracy}% from ${shots.attempts} attempts with ${shots.wides} wides.`)
  }

  if (puckouts.total > 0) {
    const zone = puckouts.bestZone ? ` Best zone was ${puckouts.bestZone.label} at ${puckouts.bestZone.winPct}%.` : ''
    bullets.push(`Won ${puckouts.won} of ${puckouts.total} puckouts (${puckouts.winPct}%).${zone}`)
  }

  const turnoversWon = getTeamStatTotal(match, 'Turnover Won')
  const turnoversLost = getTeamStatTotal(match, 'Turnover Lost')
  if (turnoversWon || turnoversLost) {
    bullets.push(`Turnover balance: ${turnoversWon} won, ${turnoversLost} lost.`)
  }

  if (conceded.goals || conceded.points) {
    const top = conceded.topOppositionScorer ? ` Main scorer: ${conceded.topOppositionScorer.name}.` : ''
    bullets.push(`Conceded ${conceded.goals}-${String(conceded.points).padStart(2, '0')} from tracked opposition scores.${top}`)
  }

  if (targets.length > 0) {
    const met = targets.filter(t => t.status === 'met').length
    bullets.push(`Met ${met} of ${targets.length} active team targets for this match.`)
  }

  const bestPeriod = periods.filter(p => p.home || p.away).sort((a, b) => b.margin - a.margin)[0]
  const worstPeriod = periods.filter(p => p.home || p.away).sort((a, b) => a.margin - b.margin)[0]
  if (bestPeriod && worstPeriod && bestPeriod.period !== worstPeriod.period) {
    bullets.push(`Best period by scoreboard margin: ${bestPeriod.period}. Toughest period: ${worstPeriod.period}.`)
  }

  if (scoringRun.bestHomeRun?.points) {
    bullets.push(`Best scoring run: ${scoringRun.bestHomeRun.points} unanswered point${scoringRun.bestHomeRun.points === 1 ? '' : 's'}.`)
  }

  return {
    headline: bullets[0],
    bullets: bullets.slice(1, 6)
  }
}

function buildWorkOns(match, parts) {
  const { shots, puckouts, conceded, targets, periods } = parts
  const workOns = []
  const turnoversWon = getTeamStatTotal(match, 'Turnover Won')
  const turnoversLost = getTeamStatTotal(match, 'Turnover Lost')

  if (shots.attempts >= 5 && shots.accuracy !== null && shots.accuracy < 55) {
    workOns.push(`Improve shot selection: ${shots.accuracy}% accuracy from ${shots.attempts} attempts.`)
  }
  if (shots.wides >= 6) {
    workOns.push(`Reduce wides under pressure: ${shots.wides} wides were logged.`)
  }
  if (puckouts.total >= 5 && puckouts.winPct < 50) {
    workOns.push(`Rebuild puckout plan: ${puckouts.winPct}% won from ${puckouts.total} tracked puckouts.`)
  }
  if (puckouts.weakZone && puckouts.weakZone.winPct < 50) {
    workOns.push(`Review puckout shape in ${puckouts.weakZone.label}: ${puckouts.weakZone.winPct}% won.`)
  }
  if (turnoversLost > turnoversWon) {
    workOns.push(`Protect possession after contact: ${turnoversLost} turnovers lost versus ${turnoversWon} won.`)
  }
  if (conceded.goals >= 2) {
    workOns.push(`Tighten goal protection: ${conceded.goals} goals conceded were tracked.`)
  }

  const missedTargets = targets.filter(t => t.status === 'missed').slice(0, 2)
  missedTargets.forEach(target => {
    workOns.push(`Close target gap on ${target.label.toLowerCase()}: ${target.matchValue} against target ${target.target}.`)
  })

  const worstPeriod = periods.filter(p => p.home || p.away).sort((a, b) => a.margin - b.margin)[0]
  if (worstPeriod && worstPeriod.margin <= -4) {
    workOns.push(`Plan response for ${worstPeriod.period}: lost that period by ${Math.abs(worstPeriod.margin)} points.`)
  }

  if (workOns.length === 0) {
    workOns.push('Keep the current performance profile stable and review one high-value habit before the next match.')
    if (shots.attempts > 0) workOns.push('Use the shot map to reinforce where the team created its best chances.')
    if (puckouts.total > 0) workOns.push('Carry forward the most reliable puckout zone and player pairing.')
  }

  return workOns.slice(0, 5)
}

export function analyzeMatch(match, seasonMatches = [], targetConfig = {}) {
  if (!match) return null

  const allSeasonMatches = seasonMatches?.length ? seasonMatches : [match]
  const outcome = scoreOutcome(match)
  const shots = buildShotSummary(match)
  const puckouts = buildPuckoutSummary(match)
  const conceded = buildConcededSummary(match)
  const periods = buildPeriodRows(match)
  const scoringRun = buildScoringRun(match)
  const players = buildPlayerImpact(match)
  const targets = buildTargetRows(match, allSeasonMatches, targetConfig)
  const pitch = buildShotZones(match)
  const trends = buildTrendRows(allSeasonMatches)
  const story = buildStory(match, { outcome, shots, puckouts, conceded, targets, periods, scoringRun })
  const workOns = buildWorkOns(match, { shots, puckouts, conceded, targets, periods })
  const statKeys = getAllStatKeys(match)

  return {
    outcome,
    shots,
    puckouts,
    conceded,
    periods,
    scoringRun,
    players,
    targets,
    pitch,
    trends,
    story,
    workOns,
    statKeys,
    defaultCoachSummary: [story.headline, ...story.bullets].filter(Boolean).join(' ')
  }
}

export function summarizeSeason(matches = []) {
  const ordered = [...matches].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
  const played = ordered.length
  if (!played) {
    return { played: 0, wins: 0, losses: 0, draws: 0, avgFor: 0, avgAgainst: 0, trends: [] }
  }

  let wins = 0
  let losses = 0
  let draws = 0
  let totalFor = 0
  let totalAgainst = 0

  ordered.forEach(match => {
    const outcome = scoreOutcome(match)
    totalFor += outcome.home
    totalAgainst += outcome.away
    if (outcome.result === 'W') wins++
    else if (outcome.result === 'L') losses++
    else draws++
  })

  return {
    played,
    wins,
    losses,
    draws,
    avgFor: Math.round((totalFor / played) * 10) / 10,
    avgAgainst: Math.round((totalAgainst / played) * 10) / 10,
    trends: buildTrendRows(ordered)
  }
}
