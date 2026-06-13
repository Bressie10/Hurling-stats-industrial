#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const DEFAULT_EMAIL = 'reviewer@pitchnote.ie'
const DEFAULT_PLAN = 'personal'
const DEFAULT_STATS = [
  'Point', 'Goal', 'Wide', 'Tackle', 'Block',
  'Turnover Won', 'Turnover Lost', 'Free Won',
  'Yellow Card', 'Red Card', 'Penalty Won', 'Penalty Scored',
  'Hook', 'Pressure'
]

function loadDotEnv(file) {
  if (!existsSync(file)) return
  const text = readFileSync(file, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
    const index = trimmed.indexOf('=')
    const key = trimmed.slice(0, index).trim()
    let value = trimmed.slice(index + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (key && process.env[key] == null) process.env[key] = value
  }
}

function parseArgs(argv) {
  const options = {
    dryRun: false,
    preserveExisting: false,
    resetPassword: true,
    email: process.env.REVIEWER_EMAIL || DEFAULT_EMAIL,
    password: process.env.REVIEWER_PASSWORD || '',
    plan: process.env.REVIEWER_PLAN || DEFAULT_PLAN
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--dry-run') options.dryRun = true
    else if (arg === '--preserve-existing') options.preserveExisting = true
    else if (arg === '--no-reset-password') options.resetPassword = false
    else if (arg === '--email') options.email = argv[++i]
    else if (arg.startsWith('--email=')) options.email = arg.slice('--email='.length)
    else if (arg === '--password') options.password = argv[++i]
    else if (arg.startsWith('--password=')) options.password = arg.slice('--password='.length)
    else if (arg === '--plan') options.plan = argv[++i]
    else if (arg.startsWith('--plan=')) options.plan = arg.slice('--plan='.length)
    else {
      throw new Error(`Unknown option: ${arg}`)
    }
  }

  return options
}

function timestamp(daysAgo = 0) {
  return Date.now() - daysAgo * 24 * 60 * 60 * 1000
}

const squad = [
  { id: 1, number: 1, name: 'Eoin McGrath', position: 'GK' },
  { id: 2, number: 2, name: 'Darragh Keane', position: 'FB' },
  { id: 3, number: 3, name: 'Brian Hayes', position: 'FB' },
  { id: 4, number: 4, name: 'Conor Ryan', position: 'FB' },
  { id: 5, number: 5, name: 'Jack O Connell', position: 'HB' },
  { id: 6, number: 6, name: 'Shane Walsh', position: 'HB' },
  { id: 7, number: 7, name: 'Liam Burke', position: 'HB' },
  { id: 8, number: 8, name: 'Cian Murphy', position: 'MF' },
  { id: 9, number: 9, name: 'Niall Kelly', position: 'MF' },
  { id: 10, number: 10, name: 'Ronan Daly', position: 'HF' },
  { id: 11, number: 11, name: 'Padraig Nolan', position: 'HF' },
  { id: 12, number: 12, name: 'Mark Byrne', position: 'HF' },
  { id: 13, number: 13, name: 'Sean Collins', position: 'FF' },
  { id: 14, number: 14, name: 'Tom O Shea', position: 'FF' },
  { id: 15, number: 15, name: 'Adam Quinn', position: 'FF' },
  { id: 16, number: 16, name: 'Fergal Moore', position: 'Sub' },
  { id: 17, number: 17, name: 'Jamie Roche', position: 'Sub' },
  { id: 18, number: 18, name: 'Cathal Flynn', position: 'Sub' },
  { id: 19, number: 19, name: 'David Lynch', position: 'Sub' },
  { id: 20, number: 20, name: 'Luke Brennan', position: 'Sub' },
  { id: 21, number: 21, name: 'Owen Farrell', position: 'Sub' },
  { id: 22, number: 22, name: 'Michael Casey', position: 'Sub' },
  { id: 23, number: 23, name: 'Aaron Foley', position: 'Sub' },
  { id: 24, number: 24, name: 'Kevin Barry', position: 'Sub' },
  { id: 25, number: 25, name: 'Noel Griffin', position: 'Sub' }
].map(player => ({ ...player, updated_at: timestamp() }))

function playerName(playerId) {
  return squad.find(player => player.id === playerId)?.name || `#${playerId}`
}

function baseStats() {
  return Object.fromEntries(squad.map(player => [
    player.id,
    Object.fromEntries(DEFAULT_STATS.map(stat => [stat, 0]))
  ]))
}

function makeLineup() {
  const lineup = {}
  for (const player of squad.filter(player => player.position !== 'Sub')) {
    lineup[player.number] = player.id
  }
  return lineup
}

function addStat(match, event) {
  const { playerId, stat } = event
  if (!match.stats[playerId]) match.stats[playerId] = {}
  match.stats[playerId][stat] = (match.stats[playerId][stat] || 0) + 1
  match.events.push({
    playerId,
    stat,
    period: event.period,
    time: event.time,
    x: event.x ?? null,
    y: event.y ?? null,
    end: event.end ?? null
  })
  if (stat === 'Point') match.score.home.points++
  if (stat === 'Goal') match.score.home.goals++
}

function addOppScore(match, score) {
  match.oppScores.push({
    type: score.type,
    oppPlayerNum: score.oppPlayerNum == null ? null : String(score.oppPlayerNum),
    marker: score.marker ?? null,
    time: score.time,
    period: score.period
  })
  if (score.type === 'point') match.score.away.points++
  if (score.type === 'goal') match.score.away.goals++
}

function addPuckout(match, puckout) {
  match.puckouts.push({
    outcome: puckout.outcome,
    ourPlayer: puckout.ourPlayer,
    oppPlayer: puckout.oppPlayer == null ? null : String(puckout.oppPlayer),
    section: puckout.section,
    time: puckout.time,
    period: puckout.period
  })
}

function makeMatch({ id, date, opposition, venue, competition, notes, workOns, events, oppScores, puckouts, subsLog, daysAgo }) {
  const match = {
    id,
    date,
    opposition,
    venue,
    competition,
    period: '2nd Half',
    score: { home: { goals: 0, points: 0 }, away: { goals: 0, points: 0 } },
    stats: baseStats(),
    events: [],
    notes,
    customStats: ['Hook', 'Pressure'],
    players: squad.map(player => ({ ...player })),
    subs_log: subsLog,
    puckouts: [],
    oppScores: [],
    lineup: makeLineup(),
    coachSummary: notes,
    workOns,
    updated_at: timestamp(daysAgo)
  }

  for (const event of events) addStat(match, event)
  for (const score of oppScores) addOppScore(match, score)
  for (const puckout of puckouts) addPuckout(match, puckout)
  return match
}

function repeatedStats({ playerId, stat, count, period, start, x, y }) {
  return Array.from({ length: count }, (_, index) => ({
    playerId,
    stat,
    period,
    time: start + index * 180,
    x: x == null ? null : x + index * 4,
    y: y == null ? null : y + (index % 2) * 5
  }))
}

function buildSeedMatches() {
  return [
    makeMatch({
      id: 'reviewer-2026-06-01-cork',
      date: '2026-06-01',
      opposition: 'Cork City',
      venue: 'Pairc Ui Rinn',
      competition: 'Senior League',
      daysAgo: 3,
      notes: 'Strong first half work rate. Puckout retention improved after switching to the midfield channel.',
      workOns: ['Clean first touch under pressure', 'Reduce wides from the right wing', 'Protect the D after turnovers'],
      subsLog: [
        { off: 'Ronan Daly', on: 'Jamie Roche', time: 3180, period: '2nd Half' },
        { off: 'Adam Quinn', on: 'Cathal Flynn', time: 3540, period: '2nd Half' }
      ],
      events: [
        ...repeatedStats({ playerId: 14, stat: 'Point', count: 5, period: '1st Half', start: 420, x: 218, y: 42 }),
        ...repeatedStats({ playerId: 13, stat: 'Point', count: 3, period: '2nd Half', start: 2380, x: 230, y: 62 }),
        ...repeatedStats({ playerId: 11, stat: 'Point', count: 3, period: '1st Half', start: 650, x: 194, y: 50 }),
        { playerId: 15, stat: 'Goal', period: '2nd Half', time: 2860, x: 246, y: 49 },
        { playerId: 14, stat: 'Goal', period: '2nd Half', time: 3440, x: 252, y: 53 },
        ...repeatedStats({ playerId: 12, stat: 'Wide', count: 5, period: '2nd Half', start: 2120, x: 238, y: 74 }),
        ...repeatedStats({ playerId: 6, stat: 'Tackle', count: 7, period: '1st Half', start: 300, x: 96, y: 52 }),
        ...repeatedStats({ playerId: 8, stat: 'Turnover Won', count: 5, period: '2nd Half', start: 2300, x: 132, y: 40 }),
        ...repeatedStats({ playerId: 5, stat: 'Block', count: 3, period: '2nd Half', start: 2460, x: 82, y: 58 }),
        ...repeatedStats({ playerId: 10, stat: 'Free Won', count: 4, period: '1st Half', start: 540, x: 178, y: 51 }),
        ...repeatedStats({ playerId: 7, stat: 'Hook', count: 2, period: '2nd Half', start: 2960, x: 108, y: 44 }),
        ...repeatedStats({ playerId: 9, stat: 'Pressure', count: 4, period: '2nd Half', start: 2660, x: 146, y: 67 })
      ],
      oppScores: [
        { type: 'point', oppPlayerNum: 10, marker: 'Shane Walsh', period: '1st Half', time: 380 },
        { type: 'point', oppPlayerNum: 11, marker: 'Liam Burke', period: '1st Half', time: 760 },
        { type: 'goal', oppPlayerNum: 14, marker: 'Brian Hayes', period: '1st Half', time: 1340 },
        { type: 'point', oppPlayerNum: 12, marker: 'Jack O Connell', period: '2nd Half', time: 2240 },
        { type: 'point', oppPlayerNum: 13, marker: 'Conor Ryan', period: '2nd Half', time: 2780 },
        { type: 'point', oppPlayerNum: 10, marker: 'Shane Walsh', period: '2nd Half', time: 3300 },
        { type: 'point', oppPlayerNum: 15, marker: 'Darragh Keane', period: '2nd Half', time: 3720 }
      ],
      puckouts: [
        { outcome: 'won', ourPlayer: playerName(8), oppPlayer: 9, section: 'midfield-top', period: '1st Half', time: 180 },
        { outcome: 'won', ourPlayer: playerName(9), oppPlayer: 8, section: 'midfield-bottom', period: '1st Half', time: 540 },
        { outcome: 'lost', ourPlayer: playerName(14), oppPlayer: 6, section: 'long-top', period: '1st Half', time: 900 },
        { outcome: 'won', ourPlayer: playerName(8), oppPlayer: 11, section: 'opp-half-bottom', period: '2nd Half', time: 2200 },
        { outcome: 'won', ourPlayer: playerName(11), oppPlayer: 5, section: 'own-half-top', period: '2nd Half', time: 2600 },
        { outcome: 'lost', ourPlayer: playerName(13), oppPlayer: 7, section: 'long-bottom', period: '2nd Half', time: 3150 }
      ]
    }),
    makeMatch({
      id: 'reviewer-2026-05-24-clare',
      date: '2026-05-24',
      opposition: 'Clare Rovers',
      venue: 'Home Ground',
      competition: 'Challenge Match',
      daysAgo: 10,
      notes: 'Balanced scoring spread. Defensive turnovers were the difference late on.',
      workOns: ['Restart shape after substitutions', 'Sharper puckout calls from half-back line'],
      subsLog: [
        { off: 'Mark Byrne', on: 'David Lynch', time: 2900, period: '2nd Half' }
      ],
      events: [
        ...repeatedStats({ playerId: 13, stat: 'Point', count: 4, period: '1st Half', start: 480, x: 226, y: 44 }),
        ...repeatedStats({ playerId: 11, stat: 'Point', count: 4, period: '2nd Half', start: 2140, x: 210, y: 60 }),
        ...repeatedStats({ playerId: 10, stat: 'Point', count: 2, period: '1st Half', start: 720, x: 188, y: 41 }),
        { playerId: 14, stat: 'Goal', period: '1st Half', time: 1260, x: 248, y: 50 },
        ...repeatedStats({ playerId: 15, stat: 'Wide', count: 4, period: '2nd Half', start: 2380, x: 236, y: 33 }),
        ...repeatedStats({ playerId: 7, stat: 'Tackle', count: 6, period: '2nd Half', start: 2060, x: 94, y: 62 }),
        ...repeatedStats({ playerId: 6, stat: 'Block', count: 4, period: '2nd Half', start: 2500, x: 76, y: 49 }),
        ...repeatedStats({ playerId: 9, stat: 'Turnover Won', count: 6, period: '2nd Half', start: 2320, x: 142, y: 55 }),
        ...repeatedStats({ playerId: 8, stat: 'Turnover Lost', count: 3, period: '1st Half', start: 820, x: 150, y: 67 }),
        ...repeatedStats({ playerId: 12, stat: 'Free Won', count: 3, period: '2nd Half', start: 2720, x: 198, y: 43 })
      ],
      oppScores: [
        { type: 'point', oppPlayerNum: 9, marker: 'Cian Murphy', period: '1st Half', time: 420 },
        { type: 'point', oppPlayerNum: 12, marker: 'Jack O Connell', period: '1st Half', time: 960 },
        { type: 'point', oppPlayerNum: 11, marker: 'Liam Burke', period: '1st Half', time: 1540 },
        { type: 'goal', oppPlayerNum: 14, marker: 'Brian Hayes', period: '2nd Half', time: 2320 },
        { type: 'point', oppPlayerNum: 10, marker: 'Shane Walsh', period: '2nd Half', time: 2760 },
        { type: 'point', oppPlayerNum: 13, marker: 'Conor Ryan', period: '2nd Half', time: 3260 }
      ],
      puckouts: [
        { outcome: 'won', ourPlayer: playerName(9), oppPlayer: 8, section: 'midfield-top', period: '1st Half', time: 240 },
        { outcome: 'lost', ourPlayer: playerName(8), oppPlayer: 9, section: 'midfield-bottom', period: '1st Half', time: 620 },
        { outcome: 'won', ourPlayer: playerName(11), oppPlayer: 7, section: 'own-half-top', period: '1st Half', time: 1120 },
        { outcome: 'won', ourPlayer: playerName(14), oppPlayer: 3, section: 'long-top', period: '2nd Half', time: 2260 },
        { outcome: 'lost', ourPlayer: playerName(13), oppPlayer: 5, section: 'opp-half-bottom', period: '2nd Half', time: 3100 }
      ]
    }),
    makeMatch({
      id: 'reviewer-2026-05-17-limerick',
      date: '2026-05-17',
      opposition: 'Limerick East',
      venue: 'Neutral Venue',
      competition: 'League Semi-Final',
      daysAgo: 17,
      notes: 'High pressure game. Good tackle count but too many turnovers lost in the middle third.',
      workOns: ['Short support lines', 'Outlet after winning dirty ball', 'Discipline under pressure'],
      subsLog: [
        { off: 'Padraig Nolan', on: 'Fergal Moore', time: 2700, period: '2nd Half' },
        { off: 'Tom O Shea', on: 'Luke Brennan', time: 3400, period: '2nd Half' }
      ],
      events: [
        ...repeatedStats({ playerId: 14, stat: 'Point', count: 4, period: '1st Half', start: 520, x: 232, y: 55 }),
        ...repeatedStats({ playerId: 11, stat: 'Point', count: 3, period: '2nd Half', start: 2140, x: 204, y: 46 }),
        ...repeatedStats({ playerId: 10, stat: 'Point', count: 2, period: '1st Half', start: 700, x: 194, y: 70 }),
        { playerId: 13, stat: 'Goal', period: '2nd Half', time: 2480, x: 250, y: 50 },
        ...repeatedStats({ playerId: 12, stat: 'Wide', count: 6, period: '2nd Half', start: 2280, x: 244, y: 70 }),
        ...repeatedStats({ playerId: 6, stat: 'Tackle', count: 8, period: '2nd Half', start: 1980, x: 86, y: 52 }),
        ...repeatedStats({ playerId: 5, stat: 'Block', count: 3, period: '1st Half', start: 980, x: 72, y: 48 }),
        ...repeatedStats({ playerId: 8, stat: 'Turnover Won', count: 5, period: '2nd Half', start: 2440, x: 136, y: 58 }),
        ...repeatedStats({ playerId: 9, stat: 'Turnover Lost', count: 5, period: '1st Half', start: 760, x: 148, y: 60 }),
        ...repeatedStats({ playerId: 7, stat: 'Yellow Card', count: 1, period: '2nd Half', start: 3020, x: null, y: null }),
        ...repeatedStats({ playerId: 15, stat: 'Free Won', count: 4, period: '1st Half', start: 880, x: 206, y: 38 })
      ],
      oppScores: [
        { type: 'point', oppPlayerNum: 10, marker: 'Shane Walsh', period: '1st Half', time: 360 },
        { type: 'goal', oppPlayerNum: 13, marker: 'Conor Ryan', period: '1st Half', time: 1040 },
        { type: 'point', oppPlayerNum: 11, marker: 'Liam Burke', period: '1st Half', time: 1380 },
        { type: 'point', oppPlayerNum: 12, marker: 'Jack O Connell', period: '2nd Half', time: 2200 },
        { type: 'point', oppPlayerNum: 14, marker: 'Brian Hayes', period: '2nd Half', time: 2600 },
        { type: 'point', oppPlayerNum: 9, marker: 'Cian Murphy', period: '2nd Half', time: 3120 },
        { type: 'point', oppPlayerNum: 10, marker: 'Shane Walsh', period: '2nd Half', time: 3560 }
      ],
      puckouts: [
        { outcome: 'lost', ourPlayer: playerName(8), oppPlayer: 8, section: 'midfield-top', period: '1st Half', time: 210 },
        { outcome: 'won', ourPlayer: playerName(9), oppPlayer: 9, section: 'own-half-bottom', period: '1st Half', time: 580 },
        { outcome: 'lost', ourPlayer: playerName(14), oppPlayer: 6, section: 'long-top', period: '1st Half', time: 1220 },
        { outcome: 'won', ourPlayer: playerName(11), oppPlayer: 7, section: 'opp-half-top', period: '2nd Half', time: 2320 },
        { outcome: 'lost', ourPlayer: playerName(13), oppPlayer: 5, section: 'long-bottom', period: '2nd Half', time: 2980 },
        { outcome: 'won', ourPlayer: playerName(8), oppPlayer: 11, section: 'midfield-bottom', period: '2nd Half', time: 3440 }
      ]
    })
  ]
}

function squadCloudId(userId, localId) {
  return `${userId}:${localId}`
}

async function findUserByEmail(supabase, email) {
  let page = 1
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const user = data.users.find(candidate => candidate.email?.toLowerCase() === email.toLowerCase())
    if (user) return user
    if (data.users.length < 1000) return null
    page += 1
  }
}

async function ensureReviewerUser(supabase, { email, password, resetPassword }) {
  const existing = await findUserByEmail(supabase, email)
  if (existing) {
    if (resetPassword && password) {
      const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
        user_metadata: { purpose: 'store_review' }
      })
      if (error) throw error
      return data.user
    }
    return existing
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { purpose: 'store_review' }
  })
  if (error) throw error
  return data.user
}

async function upsertReviewerData(supabase, { userId, plan, preserveExisting }) {
  const matches = buildSeedMatches()
  const matchRows = matches.map(match => ({
    id: match.id,
    user_id: userId,
    data: match
  }))
  const squadRows = squad.map(player => ({
    id: squadCloudId(userId, player.id),
    user_id: userId,
    data: {
      local_id: player.id,
      name: player.name,
      number: player.number,
      position: player.position,
      updated_at: player.updated_at
    }
  }))

  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({ id: userId }, { onConflict: 'id' })
  if (profileError) throw profileError

  const { error: subError } = await supabase
    .from('subscriptions')
    .upsert({
      user_id: userId,
      plan,
      status: 'active',
      seat_limit: 1,
      cancel_at_period_end: false,
      custom_features: { isPro: true }
    }, { onConflict: 'user_id' })
  if (subError) throw subError

  if (!preserveExisting) {
    const { error: deleteSquadError } = await supabase
      .from('squad')
      .delete()
      .eq('user_id', userId)
    if (deleteSquadError) throw deleteSquadError
  }

  const { error: squadError } = await supabase
    .from('squad')
    .upsert(squadRows, { onConflict: 'id,user_id' })
  if (squadError) throw squadError

  const { error: matchError } = await supabase
    .from('matches')
    .upsert(matchRows, { onConflict: 'id' })
  if (matchError) throw matchError

  return { matches, squadRows }
}

function printPlan({ email, plan, dryRun, preserveExisting }) {
  const matches = buildSeedMatches()
  console.log(`${dryRun ? 'Dry run' : 'Seed'} reviewer account`)
  console.log(`email: ${email}`)
  console.log(`plan: ${plan}`)
  console.log(`squad players: ${squad.length}`)
  console.log(`matches: ${matches.length}`)
  console.log(`preserve existing squad rows: ${preserveExisting ? 'yes' : 'no'}`)
  for (const match of matches) {
    console.log(`- ${match.date} vs ${match.opposition}: ${match.score.home.goals}-${String(match.score.home.points).padStart(2, '0')} to ${match.score.away.goals}-${String(match.score.away.points).padStart(2, '0')}`)
  }
}

loadDotEnv('.env.local')
loadDotEnv('.env')

const options = parseArgs(process.argv.slice(2))
printPlan(options)

if (options.dryRun) {
  process.exit(0)
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) throw new Error('Missing SUPABASE_URL or PUBLIC_SUPABASE_URL')
if (!serviceRoleKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
if (!options.password || options.password.length < 8) {
  throw new Error('Missing REVIEWER_PASSWORD, or password is shorter than 8 characters')
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const user = await ensureReviewerUser(supabase, options)
const seeded = await upsertReviewerData(supabase, {
  userId: user.id,
  plan: options.plan,
  preserveExisting: options.preserveExisting
})

console.log('\nReviewer seed complete')
console.log(`user id: ${user.id}`)
console.log(`seeded squad rows: ${seeded.squadRows.length}`)
console.log(`seeded match rows: ${seeded.matches.length}`)
console.log('\nNext: sign in at https://www.pitchnote.ie/?store_build=ios and confirm History, Player Stats, Team Stats, Timeline, Insights, Squad, and Settings load.')
