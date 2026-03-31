<script>
  import { onMount } from 'svelte'
  import { saveSquad, loadSquad, saveMatch, saveDraftMatch, loadDraftMatch, clearDraftMatch, markDraftSaved } from './db.js'
  import { user } from './auth-store.js'
  import { scheduleAutoSync } from './sync.js'
  import { settingsStore } from './settings-store.js'

  let screen = 'setup'
  let finishing = false
  let players = []
  let opposition = ''
  let venue = ''
  let competition = ''
  let matchDate = new Date().toISOString().split('T')[0]
  let nextId = 21
  let events = []

  // ── LINEUP ───────────────────────────────────
  // Auto-populated from squad jersey numbers; saved with match for PDF export
  let lineup = {} // { [positionNumber: 1-15]: playerId }

  function initLineup() {
    lineup = {}
    players.forEach(p => {
      if (p.name.trim() && p.number >= 1 && p.number <= 15) {
        lineup[p.number] = p.id
      }
    })
  }

  // ── PUCKOUT TRACKING ─────────────────────────
  let puckouts = []
  let showPuckoutModal = false
  let puckoutOutcome = null   // 'won' | 'lost'
  let puckoutOurPlayer = null // player name string
  let puckoutOppPlayer = ''   // text input

  // ── OPPOSITION SCORE TRACKING ─────────────────
  let oppScores = []
  let showOppScoreModal = false
  let oppScoreType = null     // 'goal' | 'point'
  let oppScorePlayerNum = ''
  let oppScoreMarker = null   // player name string

  // ── PUCKOUT SECTION ───────────────────────────
  let puckoutSection = null  // e.g. 'short-top', 'midfield-bottom'
  const puckoutCols = [
    { key: 'short',    label: 'Short',    x: 4,   w: 58 },
    { key: 'own-half', label: 'Own Half', x: 62,  w: 58 },
    { key: 'midfield', label: 'Midfield', x: 120, w: 60 },
    { key: 'opp-half', label: 'Opp Half', x: 180, w: 58 },
    { key: 'long',     label: 'Long',     x: 238, w: 58 }
  ]
  const puckoutRows = [
    { key: 'top',    y: 4,  h: 46 },
    { key: 'bottom', y: 50, h: 46 }
  ]
  function formatZoneLabel(key) {
    if (!key) return ''
    return key.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  }

  const defaultSquad = Array.from({ length: 20 }, (_, i) => ({
    id: i + 1,
    name: '',
    number: i + 1,
    position: i < 15 ? ['GK','FB','FB','FB','HB','HB','HB','MF','MF','HF','HF','HF','FF','FF','FF'][i] : 'Sub'
  }))

  onMount(async () => {
    const saved = await loadSquad()
    if (saved && saved.length > 0) {
      saved.sort((a, b) => a.number - b.number)
      players = saved
      nextId = Math.max(...saved.map(p => p.id)) + 1
    } else {
      players = defaultSquad.map(p => ({ ...p }))
    }

    initLineup()

    // Check for in-progress draft — auto-resume without asking
    const draft = await loadDraftMatch()
    if (draft && draft.opposition && !draft._saved) {
      opposition = draft.opposition
      venue = draft.venue || ''
      competition = draft.competition || ''
      matchDate = draft.date
      period = draft.period || '1st Half'
      matchScore = draft.score || { home: { goals: 0, points: 0 }, away: { goals: 0, points: 0 } }
      stats = draft.stats || {}
      notes = draft.notes || ''
      customStats = draft.customStats || []
      events = draft.events || []
      subs_log = draft.subs_log || []
      puckouts = draft.puckouts || []
      oppScores = draft.oppScores || []
      lineup = draft.lineup || {}
      if (draft.players?.length > 0) players = draft.players

      // Restore timer — if it was running when app closed, calculate real elapsed time
      if (draft.timerStartedAt) {
        const elapsed = Math.floor((Date.now() - draft.timerStartedAt) / 1000)
        timerSeconds = (draft.timerSeconds || 0) + elapsed
        timerStartedAt = Date.now()
        timerInterval = setInterval(() => { timerSeconds++; saveDraft() }, 1000)
        timerRunning = true
      } else {
        timerSeconds = draft.timerSeconds || 0
      }

      screen = draft.screen === 'stats' ? 'stats' : 'match'
    }
  })

  async function discardDraft() {
    await clearDraftMatch()
    clearInterval(timerInterval)
    timerRunning = false
    timerStartedAt = null
    opposition = ''
    venue = ''
    competition = ''
    matchDate = new Date().toISOString().split('T')[0]
    stats = {}
    events = []
    subs_log = []
    puckouts = []
    oppScores = []
    matchScore = { home: { goals: 0, points: 0 }, away: { goals: 0, points: 0 } }
    notes = ''
    customStats = []
    timerSeconds = 0
    period = $settingsStore.defaultPeriod || '1st Half'
    screen = 'setup'
  }

  async function cancelMatch() {
    if (!confirm('Cancel this match? All stats will be lost.')) return
    await discardDraft()
  }

  async function startMatch() {
    if (!opposition.trim()) { alert('Please enter the opposition team name.'); return }
    await saveSquad(players)
    players.forEach(p => {
      if (!stats[p.id]) {
        stats[p.id] = {}
        allStats.forEach(s => stats[p.id][s] = 0)
      }
    })
    stats = stats
    initLineup()
    screen = 'match'
    saveDraft()
  }

  // ── STATS ────────────────────────────────────
  $: defaultStats = $settingsStore.defaultStats?.length
    ? $settingsStore.defaultStats
    : ['Point', 'Goal', 'Wide', 'Tackle', 'Block', 'Turnover Won', 'Turnover Lost', 'Free Won']
  let customStats = []
  let newCustomStat = ''
  let showAddStat = false

  $: allStats = [...defaultStats, ...customStats]

  $: lastEventLabel = (() => {
    if (events.length === 0) return null
    const last = events[events.length - 1]
    const player = players.find(p => p.id === last.playerId)
    return `${last.stat} — ${player?.name || '#' + player?.number}`
  })()

  function undoLastStat() {
    if (events.length === 0) return
    const last = events[events.length - 1]
    events = events.slice(0, -1)
    if (stats[last.playerId]?.[last.stat] > 0) stats[last.playerId][last.stat]--
    if (last.stat === 'Point' && matchScore.home.points > 0) matchScore.home.points--
    if (last.stat === 'Goal' && matchScore.home.goals > 0) matchScore.home.goals--
    stats = stats
    matchScore = matchScore
    saveDraft()
    scheduleAutoSync($user?.id)
  }

  function addCustomStat() {
    const trimmed = newCustomStat.trim()
    if (!trimmed || allStats.includes(trimmed)) return
    customStats = [...customStats, trimmed]
    players.forEach(p => {
      if (!stats[p.id]) stats[p.id] = {}
      stats[p.id][trimmed] = 0
    })
    stats = stats
    newCustomStat = ''
    showAddStat = false
    saveDraft()
  }

  let stats = {}
  let period = $settingsStore.defaultPeriod || '1st Half'
  $: matchPeriods = $settingsStore.periods?.length ? $settingsStore.periods : ['Warm-up', '1st Half', '2nd Half', 'Extra Time']
  let mode = 'quick'
  let notes = ''
  let matchScore = { home: { goals: 0, points: 0 }, away: { goals: 0, points: 0 } }
  let selectedStat = null
  let showPlayerPicker = false
  let pendingLog = null
  let showPitchPicker = false

  function openPlayerPicker(stat) { selectedStat = stat; showPlayerPicker = true }

  function logStat(playerId, stat) {
    pendingLog = { playerId, stat }
    showPlayerPicker = false
    selectedStat = null
    if ($settingsStore.trackPitchCoords) {
      showPitchPicker = true
    } else {
      confirmLogWithCoords(null, null, null)
    }
  }

  function confirmLogWithCoords(x, y, end) {
    if (!pendingLog) return
    const { playerId, stat } = pendingLog
    if (!stats[playerId]) stats[playerId] = {}
    stats[playerId][stat] = (stats[playerId][stat] || 0) + 1
    events = [...events, {
      playerId, stat, period,
      time: timerSeconds,
      x: x ?? null,
      y: y ?? null,
      end: end ?? null
    }]
    if (stat === 'Point') matchScore.home.points++
    if (stat === 'Goal') matchScore.home.goals++
    stats = stats
    matchScore = matchScore
    pendingLog = null
    showPitchPicker = false
    saveDraft()
    scheduleAutoSync($user?.id)
  }

  function decrement(playerId, stat) {
    if (!stats[playerId] || (stats[playerId][stat] || 0) === 0) return
    stats[playerId][stat]--
    if (stat === 'Point' && matchScore.home.points > 0) matchScore.home.points--
    if (stat === 'Goal' && matchScore.home.goals > 0) matchScore.home.goals--
    stats = stats
    matchScore = matchScore
    saveDraft()
    scheduleAutoSync($user?.id)
  }

  function formatScore(s) { return `${s.goals}-${String(s.points).padStart(2, '0')}` }

  async function saveDraft() {
    try {
      await saveDraftMatch({
        date: matchDate,
        opposition,
        venue,
        competition,
        period,
        score: matchScore,
        stats,
        notes,
        customStats,
        events,
        players: players.map(p => ({ ...p })),
        subs_log,
        puckouts,
        oppScores,
        lineup,
        timerSeconds,
        timerStartedAt: timerRunning ? timerStartedAt : null,
        screen: screen === 'stats' ? 'stats' : 'match'
      })
    } catch (e) {
      console.warn('Draft save failed:', e)
    }
  }

  async function finishMatch() {
    if (!confirm('End match and save stats?')) return
    if (finishing) return
    finishing = true
    clearInterval(timerInterval)
    timerRunning = false
    try {
      await saveMatch({
        id: Date.now(), date: matchDate, opposition, venue, competition,
        period, score: matchScore, stats, notes, customStats, events,
        subs_log, puckouts, oppScores, lineup,
        players: players.map(p => ({ ...p }))
      })
      // FIX: Poison the draft immediately after saveMatch succeeds.
      // If clearDraftMatch throws or the app crashes before it runs, the _saved
      // flag prevents the already-saved match from being auto-resumed and duplicated.
      await markDraftSaved()
      await clearDraftMatch()
      // Reset all state
      clearInterval(timerInterval)
      timerRunning = false
      timerStartedAt = null
      opposition = ''
      venue = ''
      competition = ''
      matchDate = new Date().toISOString().split('T')[0]
      stats = {}
      events = []
      subs_log = []
      puckouts = []
      oppScores = []
      matchScore = { home: { goals: 0, points: 0 }, away: { goals: 0, points: 0 } }
      notes = ''
      customStats = []
      timerSeconds = 0
      period = $settingsStore.defaultPeriod || '1st Half'
      screen = 'setup'
      // FIX: Trigger auto-sync so the finished match is backed up without
      // requiring the coach to manually tap Sync.
      scheduleAutoSync($user?.id)
      alert('Match saved!')
    } catch (e) {
      alert('Save failed — please try again. Your match data is still safe.')
      // FIX: Restore timerStartedAt so wall-clock recovery works correctly
      // if the app closes after this failure. Without this, reopening the app
      // would calculate elapsed from the wrong reference point.
      timerStartedAt = Date.now() - timerSeconds * 1000
      timerInterval = setInterval(() => { timerSeconds++; saveDraft() }, 1000)
      timerRunning = true
    } finally {
      finishing = false
    }
  }

  $: starters = players.filter(p => p.position !== 'Sub')
  $: subs = players.filter(p => p.position === 'Sub')

  // ── SUBSTITUTIONS ────────────────────────────
  let subs_log = []
  let showSubModal = false
  let subOff = null

  function openSubModal() { showSubModal = true; subOff = null }

  function makeSub(playerOnId) {
    if (!subOff) return
    const playerOffData = players.find(p => p.id === subOff)
    const playerOnData = players.find(p => p.id === playerOnId)
    if (!playerOffData || !playerOnData) return
    const tempPos = playerOffData.position
    playerOffData.position = 'Sub'
    playerOnData.position = tempPos
    players = players
    subs_log = [...subs_log, {
      off: playerOffData.name || `#${playerOffData.number}`,
      on: playerOnData.name || `#${playerOnData.number}`,
      time: timerSeconds,
      period
    }]
    showSubModal = false
    subOff = null
    saveDraft()
    scheduleAutoSync($user?.id)
  }

  // ── TIMER ────────────────────────────────────
  let timerSeconds = 0
  let timerRunning = false
  let timerInterval = null
  let timerStartedAt = null  // Date.now() when timer last started — survives app close

  $: timerOverTime = timerSeconds >= ($settingsStore.periodLength || 30) * 60

  function toggleTimer() {
    if (timerRunning) {
      clearInterval(timerInterval)
      timerRunning = false
      timerStartedAt = null
    } else {
      timerStartedAt = Date.now()
      timerInterval = setInterval(() => { timerSeconds++; saveDraft() }, 1000)
      timerRunning = true
    }
  }

  function resetTimer() {
    clearInterval(timerInterval)
    timerRunning = false
    timerStartedAt = null
    timerSeconds = 0
    saveDraft()
  }
  function formatTime(s) { return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}` }

  // FIX: findLastIndex helper — Array.prototype.findLastIndex not available in all targets
  function findLastIndex(arr, pred) {
    for (let i = arr.length - 1; i >= 0; i--) { if (pred(arr[i])) return i }
    return -1
  }

  // FIX: When trackOppScores is on, decrementing the opposition score must also
  // remove the last matching entry from oppScores. Previously the scoreboard and
  // the detailed breakdown would diverge (e.g. scoreboard showed 1 goal but
  // oppScores still had 2 goal entries with marker/player data).
  function undoOppPoint() {
    if (matchScore.away.points <= 0) return
    matchScore.away.points--
    matchScore = matchScore
    if ($settingsStore.trackOppScores) {
      const idx = findLastIndex(oppScores, s => s.type === 'point')
      if (idx !== -1) oppScores = oppScores.filter((_, i) => i !== idx)
    }
    saveDraft()
    scheduleAutoSync($user?.id)
  }

  function undoOppGoal() {
    if (matchScore.away.goals <= 0) return
    matchScore.away.goals--
    matchScore = matchScore
    if ($settingsStore.trackOppScores) {
      const idx = findLastIndex(oppScores, s => s.type === 'goal')
      if (idx !== -1) oppScores = oppScores.filter((_, i) => i !== idx)
    }
    saveDraft()
    scheduleAutoSync($user?.id)
  }

  // ── PUCKOUT FUNCTIONS ────────────────────────
  function openPuckoutModal() {
    puckoutOutcome = null
    puckoutOurPlayer = null
    puckoutOppPlayer = ''
    puckoutSection = null
    showPuckoutModal = true
  }

  function logPuckout() {
    if (!puckoutOutcome) return
    puckouts = [...puckouts, {
      outcome: puckoutOutcome,
      ourPlayer: puckoutOurPlayer,
      oppPlayer: puckoutOppPlayer.trim() || null,
      section: puckoutSection,
      time: timerSeconds,
      period
    }]
    showPuckoutModal = false
    saveDraft()
    scheduleAutoSync($user?.id)
  }

  $: puckoutWins = puckouts.filter(p => p.outcome === 'won').length
  $: puckoutLosses = puckouts.filter(p => p.outcome === 'lost').length
  $: puckoutTotal = puckouts.length

  // ── OPPOSITION SCORE FUNCTIONS ────────────────
  function handleOppScore(type) {
    if ($settingsStore.trackOppScores) {
      openOppScoreModal(type)
    } else {
      if (type === 'point') matchScore.away.points++
      if (type === 'goal') matchScore.away.goals++
      matchScore = matchScore
      saveDraft()
      scheduleAutoSync($user?.id)
    }
  }

  function openOppScoreModal(type) {
    oppScoreType = type
    oppScorePlayerNum = ''
    oppScoreMarker = null
    showOppScoreModal = true
  }

  function confirmOppScore(withDetails) {
    if (oppScoreType === 'point') matchScore.away.points++
    if (oppScoreType === 'goal') matchScore.away.goals++
    if (withDetails) {
      oppScores = [...oppScores, {
        type: oppScoreType,
        oppPlayerNum: oppScorePlayerNum.trim() || null,
        marker: oppScoreMarker,
        time: timerSeconds,
        period
      }]
    }
    matchScore = matchScore
    showOppScoreModal = false
    saveDraft()
    scheduleAutoSync($user?.id)
  }

  // ── QUICK VIEW STATS ──────────────────────────
  function openStatsView() {
    // Reset section open state to current settings defaults each time the panel opens
    const qv = $settingsStore.quickViewSections
    openSections = {
      puckouts: qv?.puckouts ?? true,
      conceded: qv?.conceded ?? true,
      players: qv?.players ?? false,
      subs: qv?.subs ?? false,
    }
    screen = 'stats'
    saveDraft()
  }

  function closeStatsView() {
    screen = 'match'
    saveDraft()
  }

  // ── QUICK VIEW STATS — all use live data ──────
  let openSections = {
    puckouts: $settingsStore.quickViewSections?.puckouts ?? true,
    conceded: $settingsStore.quickViewSections?.conceded ?? true,
    players: $settingsStore.quickViewSections?.players ?? false,
    subs: $settingsStore.quickViewSections?.subs ?? false,
  }
  function toggleSection(k) { openSections[k] = !openSections[k]; openSections = openSections }

  let htPuckoutZoneFilter = null

  $: htPuckoutsByPlayer = (() => {
    const map = {}
    puckouts.forEach(p => {
      const key = p.ourPlayer || 'Unknown'
      if (!map[key]) map[key] = { name: key, won: 0, lost: 0, lostTo: [], wonAgainst: [] }
      if (p.outcome === 'won') {
        map[key].won++
        if (p.oppPlayer) { const o = '#'+p.oppPlayer; if (!map[key].wonAgainst.includes(o)) map[key].wonAgainst.push(o) }
      } else {
        map[key].lost++
        if (p.oppPlayer) { const o = '#'+p.oppPlayer; if (!map[key].lostTo.includes(o)) map[key].lostTo.push(o) }
      }
    })
    return Object.values(map).sort((a, b) => (b.won + b.lost) - (a.won + a.lost))
  })()

  $: htPuckoutByZone = (() => {
    const map = {}
    puckouts.forEach(p => {
      const z = p.section || 'no-zone'
      if (!map[z]) map[z] = { won: 0, lost: 0 }
      if (p.outcome === 'won') map[z].won++; else map[z].lost++
    })
    return map
  })()

  $: htPuckoutZoneRows = Object.entries(htPuckoutByZone)
    .filter(([k]) => k !== 'no-zone')
    .map(([key, d]) => ({
      key, label: formatZoneLabel(key),
      won: d.won, lost: d.lost, total: d.won + d.lost,
      winPct: Math.round((d.won / (d.won + d.lost)) * 100)
    }))
    .sort((a, b) => b.total - a.total)

  function htZoneColor(zkey) {
    const d = htPuckoutByZone[zkey]
    if (!d) return 'rgba(255,255,255,0.05)'
    const rate = d.won / (d.won + d.lost)
    if (rate >= 0.67) return 'rgba(45,122,45,0.65)'
    if (rate >= 0.4) return 'rgba(224,160,32,0.55)'
    return 'rgba(200,50,50,0.6)'
  }

  $: htPuckoutByOppPlayer = (() => {
    const map = {}
    puckouts.filter(p => p.outcome === 'lost' && p.oppPlayer).forEach(p => {
      const k = '#' + p.oppPlayer
      if (!map[k]) map[k] = { num: k, count: 0, beatPlayers: [] }
      map[k].count++
      if (p.ourPlayer && !map[k].beatPlayers.includes(p.ourPlayer)) map[k].beatPlayers.push(p.ourPlayer)
    })
    return Object.values(map).sort((a, b) => b.count - a.count)
  })()

  $: allConcededByMarker = (() => {
    const map = {}
    oppScores.forEach(s => {
      const key = s.marker || 'Unknown'
      if (!map[key]) map[key] = { marker: key, goals: 0, points: 0, scores: [] }
      if (s.type === 'goal') map[key].goals++; else map[key].points++
      map[key].scores.push(s)
    })
    return Object.values(map).sort((a, b) => (b.goals * 3 + b.points) - (a.goals * 3 + a.points))
  })()

  $: htConcededByOppPlayer = (() => {
    const map = {}
    oppScores.forEach(s => {
      const k = s.oppPlayerNum ? '#' + s.oppPlayerNum : 'Unknown'
      if (!map[k]) map[k] = { num: k, goals: 0, points: 0, markers: [] }
      if (s.type === 'goal') map[k].goals++; else map[k].points++
      if (s.marker && !map[k].markers.includes(s.marker)) map[k].markers.push(s.marker)
    })
    return Object.values(map).sort((a, b) => (b.goals * 3 + b.points) - (a.goals * 3 + a.points))
  })()

  $: htBestPuckoutPlayer = htPuckoutsByPlayer.reduce((best, p) => p.won > (best?.won ?? -1) ? p : best, null)
  $: htBestOppPuckoutWinner = htPuckoutByOppPlayer[0] ?? null
  $: htBiggestConcededOppPlayer = htConcededByOppPlayer[0] ?? null

  $: htTopScorer = (() => {
    let best = null, max = 0
    players.filter(p => p.name?.trim()).forEach(p => {
      const s = stats[p.id] || {}
      const pts = (s['Goal'] || 0) * 3 + (s['Point'] || 0)
      if (pts > max) { max = pts; best = { name: p.name, goals: s['Goal'] || 0, points: s['Point'] || 0, pts } }
    })
    return best
  })()
</script>

{#if screen === 'setup'}
<div class="screen">

  <div class="setup-hero">
    <img src="doora-barefield.png" alt="Doora Barefield GAA" class="hero-logo">
    <div>
      <h2>New Match</h2>
      <p>{$settingsStore.teamName || 'GAA Stats'} · {$settingsStore.ageGroup || ''} Hurling</p>
    </div>
  </div>

  <div class="setup-card">
    <div class="setup-card-title">Match Details</div>
    <div class="field-group">
      <label>Opposition *</label>
      <input bind:value={opposition} placeholder="e.g. Éire Óg" />
    </div>
    <div class="field-row">
      {#if $settingsStore.showVenueField}
      <div class="field-group">
        <label>Venue</label>
        <input bind:value={venue} placeholder="e.g. Cusack Park" />
      </div>
      {/if}
      {#if $settingsStore.showCompetitionField}
      <div class="field-group">
        <label>Competition</label>
        <input bind:value={competition} placeholder="e.g. County Championship" />
      </div>
      {/if}
      <div class="field-group">
        <label>Date</label>
        <input type="date" bind:value={matchDate} />
      </div>
    </div>
  </div>

  <div class="squad-preview-card">
    <div class="squad-preview-title">
      <span class="squad-dot"></span>
      Squad ready
    </div>
    <div class="squad-preview-stats">
      <div class="squad-stat">
        <div class="squad-stat-val">{players.filter(p => p.name.trim()).length}</div>
        <div class="squad-stat-label">Players</div>
      </div>
      <div class="squad-divider"></div>
      <div class="squad-stat">
        <div class="squad-stat-val">{players.filter(p => p.position !== 'Sub' && p.name.trim()).length}</div>
        <div class="squad-stat-label">Starters</div>
      </div>
      <div class="squad-divider"></div>
      <div class="squad-stat">
        <div class="squad-stat-val">{players.filter(p => p.position === 'Sub' && p.name.trim()).length}</div>
        <div class="squad-stat-label">Subs</div>
      </div>
    </div>
    <div class="squad-preview-hint">Edit your panel anytime in the Squad tab</div>
  </div>

  <button class="start-btn" on:click={startMatch}>
    <span>Throw In</span>
    <span class="start-arrow">→</span>
  </button>

</div>
{/if}

{#if screen === 'match'}
<div class="screen">

  <div class="match-header">
    <div class="match-info">
      <div class="match-title">DB <span class="vs">vs</span> {opposition}</div>
      <div class="match-meta">{[competition, venue, matchDate].filter(Boolean).join(' · ')}</div>
    </div>
    <div class="scoreboard">
      <div class="score-block">
        <div class="score-label">{($settingsStore.teamName || 'Home').slice(0,4).toUpperCase()}</div>
        <div class="score-val">{formatScore(matchScore.home)}</div>
      </div>
      <div class="score-divider">–</div>
      <div class="score-block">
        <div class="score-label">{opposition.slice(0,4).toUpperCase()}</div>
        <div class="score-val">{formatScore(matchScore.away)}</div>
        <div class="opp-btns">
          <button class="opp-btn" on:click={undoOppPoint}>−P</button>
          <button class="opp-btn opp-btn-score" on:click={() => handleOppScore('point')}>+P</button>
          <button class="opp-btn" on:click={undoOppGoal}>−G</button>
          <button class="opp-btn opp-btn-score" on:click={() => handleOppScore('goal')}>+G</button>
        </div>
      </div>
    </div>
  </div>

  <div class="card timer-card">
    <div class="timer-left">
      <div class="timer-display" class:running={timerRunning} class:overtime={timerOverTime}>{formatTime(timerSeconds)}</div>
      <div class="timer-btns">
        <button class="timer-btn primary" on:click={toggleTimer}>
          {#if timerRunning}
            <svg style="width:14px;height:14px;flex-shrink:0" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pause
          {:else}
            <svg style="width:14px;height:14px;flex-shrink:0" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Start
          {/if}
        </button>
        <button class="timer-btn" on:click={resetTimer}>Reset</button>
      </div>
    </div>
    <div class="period-pills">
      {#each matchPeriods as p}
        <button
          class="period-btn"
          class:active={period === p}
          on:click={() => { period = p; resetTimer() }}
        >{p}</button>
      {/each}
    </div>
  </div>

  <div class="mode-row">
    <div class="mode-toggle">
      <button class:active={mode === 'quick'} on:click={() => mode = 'quick'}>Quick log</button>
      <button class:active={mode === 'player'} on:click={() => mode = 'player'}>Player rows</button>
    </div>
    <div class="action-btns">
      {#if $settingsStore.trackPuckouts}<button class="puckout-btn" on:click={openPuckoutModal}>+ Puckout</button>{/if}
      <button class="sub-btn" on:click={openSubModal}>
        <svg style="width:15px;height:15px;flex-shrink:0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg> Sub
      </button>
      <button class="stats-view-btn" on:click={openStatsView}>
        <svg style="width:15px;height:15px;flex-shrink:0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg> Stats
      </button>
    </div>
  </div>

  {#if $settingsStore.trackPuckouts && puckoutTotal > 0}
    <div class="puckout-summary-bar">
      <span class="puckout-summary-label">Puckouts</span>
      <span class="puckout-won">{puckoutWins} Won</span>
      <span class="puckout-divider">/</span>
      <span class="puckout-lost">{puckoutLosses} Lost</span>
      {#if puckoutTotal > 0}<span class="puckout-pct">({Math.round((puckoutWins/puckoutTotal)*100)}%)</span>{/if}
    </div>
  {/if}

  {#if lastEventLabel}
    <div class="undo-row">
      <button class="undo-btn" on:click={undoLastStat}>Undo: {lastEventLabel}</button>
    </div>
  {/if}

  {#if mode === 'quick'}
    <div class="section-label">Tap a stat — then pick the player</div>
    <div class="stat-grid">
      {#each allStats as stat}
        <button class="stat-btn" on:click={() => openPlayerPicker(stat)}>
          {stat}
          {#if customStats.includes(stat)}
            <span class="custom-tag">custom</span>
          {/if}
        </button>
      {/each}
      {#if showAddStat}
        <div class="stat-btn add-stat-input">
          <input bind:value={newCustomStat} placeholder="Stat name"
            on:keydown={e => e.key === 'Enter' && addCustomStat()} autofocus />
          <button class="confirm-btn" on:click={addCustomStat}>Add</button>
          <button class="cancel-small" on:click={() => showAddStat = false}><svg style="width:14px;height:14px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
      {:else}
        <button class="stat-btn dashed" on:click={() => showAddStat = true}>+ Custom stat</button>
      {/if}
    </div>
  {/if}

  {#if mode === 'player'}
    <div class="custom-stat-row">
      {#if showAddStat}
        <div class="custom-stat-input-wrap">
          <input class="custom-stat-input" bind:value={newCustomStat} placeholder="Enter stat name..."
            on:keydown={e => e.key === 'Enter' && addCustomStat()} autofocus />
          <button class="confirm-btn" on:click={addCustomStat}>Add</button>
          <button class="cancel-small" on:click={() => showAddStat = false}><svg style="width:14px;height:14px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
      {:else}
        <button class="custom-stat-btn" on:click={() => showAddStat = true}>+ Add custom stat</button>
      {/if}
    </div>

    <div class="section-label">Starters</div>
    <div class="table-wrap">
      <table class="player-table">
        <thead>
          <tr>
            <th class="th-player">Player</th>
            {#each allStats as stat}<th>{stat.split(' ')[0]}</th>{/each}
          </tr>
        </thead>
        <tbody>
          {#each starters as player}
            <tr>
              <td class="td-player"><span class="num-badge">#{player.number}</span>{player.name || 'Player'}</td>
              {#each allStats as stat}
                <td>
                  <div class="counter">
                    <button class="mini-dec" on:click={() => decrement(player.id, stat)}>−</button>
                    <span class="mini-val">{stats[player.id]?.[stat] ?? 0}</span>
                    <button class="mini-inc" on:click={() => logStat(player.id, stat)}>+</button>
                  </div>
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <div class="section-label" style="margin-top:1rem">Subs</div>
    <div class="table-wrap">
      <table class="player-table">
        <tbody>
          {#each subs as player}
            <tr>
              <td class="td-player"><span class="num-badge sub">#{player.number}</span>{player.name || 'Player'}</td>
              {#each allStats as stat}
                <td>
                  <div class="counter">
                    <button class="mini-dec" on:click={() => decrement(player.id, stat)}>−</button>
                    <span class="mini-val">{stats[player.id]?.[stat] ?? 0}</span>
                    <button class="mini-inc" on:click={() => logStat(player.id, stat)}>+</button>
                  </div>
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  {#if subs_log.length > 0}
    <div class="card">
      <div class="section-label" style="margin-bottom:8px">Substitutions</div>
      {#each subs_log as sub}
        <div class="sub-log-row">
          <span class="sub-time">{formatTime(sub.time)}</span>
          <span class="sub-detail"><svg style="width:12px;height:12px;color:#e53935" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg> {sub.off} → <svg style="width:12px;height:12px;color:#2d7a2d" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg> {sub.on}</span>
          <span class="sub-period">{sub.period}</span>
        </div>
      {/each}
    </div>
  {/if}

  {#if showPlayerPicker}
    <div class="modal-backdrop" on:click={() => showPlayerPicker = false}>
      <div class="modal" on:click|stopPropagation>
        <div class="modal-title">Who got the <strong>{selectedStat}</strong>?</div>
        <div class="modal-section-label">Starters</div>
        <div class="player-grid">
          {#each starters as player}
            <button class="player-btn" on:click={() => logStat(player.id, selectedStat)}>
              <span class="player-num">#{player.number}</span>
              <span class="player-name">{player.name || 'Player'}</span>
            </button>
          {/each}
        </div>
        {#if subs.length > 0}
          <div class="modal-section-label">Subs</div>
          <div class="player-grid">
            {#each subs as player}
              <button class="player-btn sub" on:click={() => logStat(player.id, selectedStat)}>
                <span class="player-num">#{player.number}</span>
                <span class="player-name">{player.name || 'Player'}</span>
              </button>
            {/each}
          </div>
        {/if}
        <button class="cancel-btn" on:click={() => showPlayerPicker = false}>Cancel</button>
      </div>
    </div>
  {/if}

  {#if showPitchPicker}
    <div class="modal-backdrop" on:click={() => confirmLogWithCoords(null, null, null)}>
      <div class="modal" on:click|stopPropagation>
        <div class="modal-title">
          Where did it happen?
          <span class="optional-tag">optional</span>
        </div>
        <div class="pitch-wrap">
          <svg
            class="pitch-svg"
            viewBox="0 0 300 200"
            on:click={e => {
              const rect = e.currentTarget.getBoundingClientRect()
              const x = Math.round(((e.clientX - rect.left) / rect.width) * 100)
              const y = Math.round(((e.clientY - rect.top) / rect.height) * 100)
              const end = x < 50 ? 'db' : 'opposition'
              confirmLogWithCoords(x, y, end)
            }}
          >
            <!-- Pitch background -->
            <rect width="300" height="200" fill="#2d7a2d" rx="4"/>
            <!-- Left half — DB end -->
            <rect x="0" y="0" width="150" height="200" class="pitch-end-zone" rx="4"/>
            <!-- Right half — Opposition end -->
            <rect x="150" y="0" width="150" height="200" fill="rgba(0,0,0,0.08)" rx="4"/>
            <!-- Pitch outline -->
            <rect x="4" y="4" width="292" height="192" fill="none" stroke="white" stroke-width="1.5" opacity="0.7"/>
            <!-- Halfway line -->
            <line x1="150" y1="4" x2="150" y2="196" stroke="white" stroke-width="1.5" opacity="0.8"/>
            <!-- Centre circle -->
            <circle cx="150" cy="100" r="30" fill="none" stroke="white" stroke-width="1" opacity="0.5"/>
            <!-- Left 21 -->
            <rect x="4" y="60" width="40" height="80" fill="none" stroke="white" stroke-width="1" opacity="0.6"/>
            <rect x="4" y="78" width="18" height="44" fill="none" stroke="white" stroke-width="1" opacity="0.6"/>
            <!-- Right 21 -->
            <rect x="256" y="60" width="40" height="80" fill="none" stroke="white" stroke-width="1" opacity="0.6"/>
            <rect x="278" y="78" width="18" height="44" fill="none" stroke="white" stroke-width="1" opacity="0.6"/>
            <!-- End labels -->
            <text x="75" y="18" text-anchor="middle" fill="white" font-size="9" font-weight="bold" opacity="0.9">DB END</text>
            <text x="225" y="18" text-anchor="middle" fill="white" font-size="9" font-weight="bold" opacity="0.9">{opposition.slice(0,8).toUpperCase()} END</text>
            <!-- Tap hint -->
            <text x="150" y="108" text-anchor="middle" fill="white" font-size="10" opacity="0.5">Tap where it happened</text>
          </svg>
        </div>
        <button class="cancel-btn" on:click={() => confirmLogWithCoords(null, null, null)}>
          Skip — log without location
        </button>
      </div>
    </div>
  {/if}

  {#if showSubModal}
    <div class="modal-backdrop" on:click={() => showSubModal = false}>
      <div class="modal" on:click|stopPropagation>
        <div class="modal-title">Make a Substitution</div>
        {#if !subOff}
          <div class="modal-section-label">Who is coming OFF?</div>
          <div class="player-grid">
            {#each starters as player}
              <button class="player-btn" on:click={() => subOff = player.id}>
                <span class="player-num">#{player.number}</span>
                <span class="player-name">{player.name || 'Player'}</span>
              </button>
            {/each}
          </div>
        {:else}
          <div class="modal-section-label">
            Who is coming ON? (replacing {players.find(p => p.id === subOff)?.name || 'player'})
          </div>
          <div class="player-grid">
            {#each subs as player}
              <button class="player-btn" on:click={() => makeSub(player.id)}>
                <span class="player-num">#{player.number}</span>
                <span class="player-name">{player.name || 'Player'}</span>
              </button>
            {/each}
          </div>
          <button class="ghost-btn" style="margin-top:8px" on:click={() => subOff = null}>← Back</button>
        {/if}
        <button class="cancel-btn" on:click={() => showSubModal = false}>Cancel</button>
      </div>
    </div>
  {/if}

  {#if oppScores.length > 0}
    <div class="card conceded-summary">
      <div class="section-label" style="margin-bottom:10px">Scores conceded</div>
      {#each allConcededByMarker as row}
        <div class="conceded-row">
          <span class="conceded-marker">{row.marker}</span>
          <span class="conceded-tally">
            {#if row.goals > 0}<span class="conceded-goal">{row.goals}G</span>{/if}
            {#if row.points > 0}<span class="conceded-point">{row.points}P</span>{/if}
          </span>
          <span class="conceded-opp">
            {row.scores.filter(s => s.oppPlayerNum).map(s => '#' + s.oppPlayerNum).join(', ')}
          </span>
        </div>
      {/each}
    </div>
  {/if}

  <div class="notes-section">
    <div class="section-label">Match notes</div>
    <textarea bind:value={notes} placeholder="Add notes about the match..." on:input={saveDraft}></textarea>
  </div>

  <div class="finish-row">
    <button class="finish-btn" disabled={finishing} on:click={finishMatch}>{finishing ? 'Saving…' : 'End Match & Save'}</button>
    <button class="cancel-match-btn" on:click={cancelMatch}>Cancel Match</button>
  </div>

  <!-- PUCKOUT MODAL -->
  {#if showPuckoutModal}
    <div class="modal-backdrop" on:click={() => showPuckoutModal = false}>
      <div class="modal" on:click|stopPropagation>
        <div class="modal-title">Log Puckout</div>

        <div class="puckout-outcome-row">
          <button
            class="outcome-btn won"
            class:selected={puckoutOutcome === 'won'}
            on:click={() => puckoutOutcome = 'won'}
          >We Won</button>
          <button
            class="outcome-btn lost"
            class:selected={puckoutOutcome === 'lost'}
            on:click={() => puckoutOutcome = 'lost'}
          >They Won</button>
        </div>

        <div class="modal-section-label">Our player involved (optional)</div>
        <div class="player-grid">
          {#each players.filter(p => p.name?.trim()) as player}
            <button
              class="player-btn"
              class:selected-player={puckoutOurPlayer === player.name}
              on:click={() => puckoutOurPlayer = puckoutOurPlayer === player.name ? null : player.name}
            >
              <span class="player-num">#{player.number}</span>
              <span class="player-name">{player.name}</span>
            </button>
          {/each}
        </div>

        <div class="modal-section-label">Where did it land? (optional) {#if puckoutSection}<span class="zone-hint">— {formatZoneLabel(puckoutSection)} selected</span>{/if}</div>
        <div class="puckout-pitch-wrap">
          <svg class="puckout-pitch-svg" viewBox="0 0 300 100">
            <!-- Pitch background -->
            <rect width="300" height="100" fill="#2d7a2d" rx="4"/>
            <!-- 10 clickable zones (5 cols × 2 rows) -->
            {#each puckoutRows as row}
              {#each puckoutCols as col}
                {@const zkey = col.key + '-' + row.key}
                <rect
                  x={col.x} y={row.y} width={col.w} height={row.h}
                  fill={puckoutSection === zkey ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.07)'}
                  stroke={puckoutSection === zkey ? 'white' : 'rgba(255,255,255,0.18)'}
                  stroke-width={puckoutSection === zkey ? '2' : '0.5'}
                  style="cursor:pointer"
                  on:click={() => puckoutSection = puckoutSection === zkey ? null : zkey}
                />
                <text
                  x={col.x + col.w / 2} y={row.y + row.h / 2 + 2.5}
                  text-anchor="middle"
                  fill="white"
                  font-size="6.5"
                  font-weight={puckoutSection === zkey ? 'bold' : 'normal'}
                  opacity={puckoutSection === zkey ? '1' : '0.65'}
                  style="pointer-events:none"
                >{col.label}</text>
              {/each}
            {/each}
            <!-- Vertical zone dividers -->
            {#each [62, 120, 180, 238] as dx}
              <line x1={dx} y1="4" x2={dx} y2="96" stroke="white" stroke-width="0.5" opacity="0.25"/>
            {/each}
            <!-- Horizontal mid-pitch divider (widthways split) -->
            <line x1="4" y1="50" x2="296" y2="50" stroke="white" stroke-width="1" opacity="0.5"/>
            <!-- Halfway length line (dashed) -->
            <line x1="150" y1="4" x2="150" y2="96" stroke="white" stroke-width="1" opacity="0.4" stroke-dasharray="3,3"/>
            <!-- Goal areas -->
            <rect x="4" y="30" width="16" height="40" fill="none" stroke="white" stroke-width="0.8" opacity="0.45"/>
            <rect x="280" y="30" width="16" height="40" fill="none" stroke="white" stroke-width="0.8" opacity="0.45"/>
            <!-- End labels -->
            <text x="33" y="13" text-anchor="middle" fill="white" font-size="5.5" opacity="0.55" style="pointer-events:none">DB END</text>
            <text x="267" y="13" text-anchor="middle" fill="white" font-size="5.5" opacity="0.55" style="pointer-events:none">OPP END</text>
          </svg>
        </div>

        <div class="modal-section-label">
          {puckoutOutcome === 'lost' ? 'Which opposition player won it?' : 'Opposition player number'} (optional)
        </div>
        <input
          class="modal-input"
          bind:value={puckoutOppPlayer}
          placeholder="e.g. 6"
          type="text"
          inputmode="numeric"
        />

        <button
          class="confirm-log-btn"
          class:disabled={!puckoutOutcome}
          on:click={logPuckout}
          disabled={!puckoutOutcome}
        >Log Puckout</button>
        <button class="cancel-btn" on:click={() => showPuckoutModal = false}>Cancel</button>
      </div>
    </div>
  {/if}

  <!-- OPPOSITION SCORE MODAL -->
  {#if showOppScoreModal}
    <div class="modal-backdrop" on:click={() => showOppScoreModal = false}>
      <div class="modal" on:click|stopPropagation>
        <div class="modal-title">
          Opposition {oppScoreType === 'goal' ? 'Goal' : 'Point'}
          <span class="optional-tag">vs {opposition}</span>
        </div>

        <div class="modal-section-label">Opposition player number (optional)</div>
        <input
          class="modal-input"
          bind:value={oppScorePlayerNum}
          placeholder="e.g. 14"
          type="text"
          inputmode="numeric"
          autofocus
        />

        <div class="modal-section-label">Which of our players was marking? (optional)</div>
        <div class="player-grid">
          {#each players.filter(p => p.name?.trim()) as player}
            <button
              class="player-btn"
              class:selected-player={oppScoreMarker === player.name}
              on:click={() => oppScoreMarker = oppScoreMarker === player.name ? null : player.name}
            >
              <span class="player-num">#{player.number}</span>
              <span class="player-name">{player.name}</span>
            </button>
          {/each}
        </div>

        <button class="confirm-log-btn" on:click={() => confirmOppScore(true)}>Log Score + Details</button>
        <button class="ghost-btn" style="margin-top:8px" on:click={() => confirmOppScore(false)}>Just add score (no details)</button>
        <button class="cancel-btn" on:click={() => showOppScoreModal = false}>Cancel</button>
      </div>
    </div>
  {/if}

</div>
{/if}

<!-- QUICK VIEW STATS — available at any time, persists across navigation and app close -->
{#if screen === 'stats'}
<div class="screen">

  <!-- Live score bar -->
  <div class="ht-score-bar">
    <div class="ht-badge">{period} · {formatTime(timerSeconds)}</div>
    <div class="ht-score-bar-fixture">
      <div class="ht-score-bar-team">
        <div class="ht-score-bar-name">{$settingsStore.teamName || 'Home'}</div>
        <div class="ht-score-bar-val">{formatScore(matchScore.home)}</div>
      </div>
      <div class="ht-score-bar-sep">–</div>
      <div class="ht-score-bar-team">
        <div class="ht-score-bar-name">{opposition}</div>
        <div class="ht-score-bar-val">{formatScore(matchScore.away)}</div>
      </div>
    </div>
    <div class="ht-score-bar-meta">{[competition, venue, matchDate].filter(Boolean).join(' · ')}</div>
  </div>

  <!-- ── PUCKOUTS accordion ── -->
  {#if $settingsStore.trackPuckouts && puckouts.length > 0}
    {@const htWins = puckouts.filter(p => p.outcome === 'won').length}
    {@const htTotal = puckouts.length}
    {@const htLosses = htTotal - htWins}
    {@const htWinPct = Math.round((htWins / htTotal) * 100)}
    <div class="accordion-card">
      <button class="accordion-header" on:click={() => toggleSection('puckouts')}>
        <div class="accordion-title">
          <span class="accordion-name">Puckouts</span>
          <span class="accordion-summary">
            <span class="badge-won">{htWins}W</span>
            <span class="badge-lost">{htLosses}L</span>
            <span class="badge-pct" class:pct-green={htWinPct>=60} class:pct-amber={htWinPct>=40&&htWinPct<60} class:pct-red={htWinPct<40}>{htWinPct}%</span>
          </span>
        </div>
        <span class="accordion-chevron">{#if openSections.puckouts}<svg style="width:16px;height:16px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>{:else}<svg style="width:16px;height:16px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>{/if}</span>
      </button>
      {#if openSections.puckouts}
        <div class="accordion-body">
          {#if htBestPuckoutPlayer}
            <div class="standout-row">
              <span class="standout-label">Best</span>
              <span class="standout-name">{htBestPuckoutPlayer.name}</span>
              <span class="standout-val">{htBestPuckoutPlayer.won}W / {htBestPuckoutPlayer.lost}L</span>
            </div>
          {/if}
          <!-- Overall stats row -->
          <div class="ht-stats-row">
            <div class="ht-stat-block"><div class="ht-stat-val green">{htWins}</div><div class="ht-stat-label">Won</div></div>
            <div class="ht-stat-divider"></div>
            <div class="ht-stat-block"><div class="ht-stat-val red">{htLosses}</div><div class="ht-stat-label">Lost</div></div>
            <div class="ht-stat-divider"></div>
            <div class="ht-stat-block"><div class="ht-stat-val">{htTotal}</div><div class="ht-stat-label">Total</div></div>
            <div class="ht-stat-divider"></div>
            <div class="ht-stat-block">
              <div class="ht-stat-val" class:green={htWinPct>=60} class:amber={htWinPct>=40&&htWinPct<60} class:red={htWinPct<40}>{htWinPct}%</div>
              <div class="ht-stat-label">Win Rate</div>
            </div>
          </div>

          <!-- Zone heatmap pitch (tap to filter) -->
          {#if puckouts.some(p => p.section)}
            <div class="ht-sub-label" style="margin-top:12px">Zone heatmap — tap to filter</div>
            <div class="puckout-pitch-wrap">
              <svg class="puckout-pitch-svg" viewBox="0 0 300 100">
                <rect width="300" height="100" fill="#2d7a2d" rx="4"/>
                {#each puckoutRows as row}
                  {#each puckoutCols as col}
                    {@const zkey = col.key + '-' + row.key}
                    {@const zd = htPuckoutByZone[zkey]}
                    <rect
                      x={col.x} y={row.y} width={col.w} height={row.h}
                      fill={htPuckoutZoneFilter === zkey ? 'rgba(255,255,255,0.45)' : htZoneColor(zkey)}
                      stroke={htPuckoutZoneFilter === zkey ? 'white' : 'rgba(255,255,255,0.18)'}
                      stroke-width={htPuckoutZoneFilter === zkey ? '2.5' : '0.5'}
                      style="cursor:pointer"
                      on:click={() => htPuckoutZoneFilter = htPuckoutZoneFilter === zkey ? null : zkey}
                    />
                    {#if zd}
                      <text x={col.x+col.w/2} y={row.y+row.h/2-4} text-anchor="middle" fill="white" font-size="7.5" font-weight="bold" style="pointer-events:none">{zd.won}W {zd.lost}L</text>
                      <text x={col.x+col.w/2} y={row.y+row.h/2+7} text-anchor="middle" fill="white" font-size="7" opacity="0.9" style="pointer-events:none">{Math.round(zd.won/(zd.won+zd.lost)*100)}%</text>
                    {:else}
                      <text x={col.x+col.w/2} y={row.y+row.h/2+2.5} text-anchor="middle" fill="white" font-size="6.5" opacity="0.35" style="pointer-events:none">{col.label}</text>
                    {/if}
                  {/each}
                {/each}
                {#each [62,120,180,238] as dx}<line x1={dx} y1="4" x2={dx} y2="96" stroke="white" stroke-width="0.5" opacity="0.25"/>{/each}
                <line x1="4" y1="50" x2="296" y2="50" stroke="white" stroke-width="1" opacity="0.5"/>
                <line x1="150" y1="4" x2="150" y2="96" stroke="white" stroke-width="1" opacity="0.4" stroke-dasharray="3,3"/>
                <rect x="4" y="30" width="16" height="40" fill="none" stroke="white" stroke-width="0.8" opacity="0.45"/>
                <rect x="280" y="30" width="16" height="40" fill="none" stroke="white" stroke-width="0.8" opacity="0.45"/>
                <text x="33" y="13" text-anchor="middle" fill="white" font-size="5.5" opacity="0.55" style="pointer-events:none">DB END</text>
                <text x="267" y="13" text-anchor="middle" fill="white" font-size="5.5" opacity="0.55" style="pointer-events:none">OPP END</text>
              </svg>
            </div>
            {#if htPuckoutZoneFilter}
              {@const zf = htPuckoutByZone[htPuckoutZoneFilter] || {won:0,lost:0}}
              {@const zt = zf.won + zf.lost}
              <div class="zone-filter-result">
                <span class="zone-filter-name">{formatZoneLabel(htPuckoutZoneFilter)}</span>
                <span class="zone-filter-stats">{zf.won}W / {zf.lost}L — {zt > 0 ? Math.round(zf.won/zt*100) : 0}%</span>
                <button class="zone-filter-clear" on:click={() => htPuckoutZoneFilter = null}>All zones</button>
              </div>
            {/if}
          {/if}

          <!-- Zone breakdown table -->
          {#if htPuckoutZoneRows.length > 0}
            <div class="ht-sub-label" style="margin-top:12px">By zone</div>
            {#each (htPuckoutZoneFilter ? htPuckoutZoneRows.filter(r => r.key === htPuckoutZoneFilter) : htPuckoutZoneRows) as row}
              <div class="ht-zone-row">
                <span class="ht-zone-name">{row.label}</span>
                <span class="ht-zone-data">
                  <span class="won-badge">{row.won}W</span>
                  <span class="lost-badge">{row.lost}L</span>
                  <span class="ht-zone-pct" class:green={row.winPct>=60} class:amber={row.winPct>=40&&row.winPct<60} class:red={row.winPct<40}>{row.winPct}%</span>
                </span>
                <div class="ht-zone-bar"><div class="ht-zone-bar-fill" style="width:{row.winPct}%; background:{row.winPct>=60?'#2d7a2d':row.winPct>=40?'#e0a020':'#e53935'}"></div></div>
              </div>
            {/each}
          {/if}

          <!-- By player -->
          {#if htPuckoutsByPlayer.length > 0}
            <div class="ht-sub-label" style="margin-top:12px">By our player</div>
            {#each htPuckoutsByPlayer as row}
              {@const pct = Math.round(row.won/(row.won+row.lost)*100)}
              <div class="ht-zone-row">
                <span class="ht-zone-name">{row.name}</span>
                <span class="ht-zone-data">
                  <span class="won-badge">{row.won}W</span>
                  <span class="lost-badge">{row.lost}L</span>
                  <span class="ht-zone-pct" class:green={pct>=60} class:amber={pct>=40&&pct<60} class:red={pct<40}>{pct}%</span>
                </span>
                {#if row.lostTo.length > 0 || row.wonAgainst.length > 0}
                  <div class="ht-matchup-line">
                    {#if row.wonAgainst.length > 0}<span class="matchup-won">Won vs {row.wonAgainst.join(', ')}</span>{/if}
                    {#if row.lostTo.length > 0}<span class="matchup-lost">Lost to {row.lostTo.join(', ')}</span>{/if}
                  </div>
                {/if}
                <div class="ht-zone-bar"><div class="ht-zone-bar-fill" style="width:{pct}%; background:{pct>=60?'#2d7a2d':pct>=40?'#e0a020':'#e53935'}"></div></div>
              </div>
            {/each}
          {/if}

          <!-- Opposition players who won puckouts -->
          {#if htPuckoutByOppPlayer.length > 0}
            <div class="ht-sub-label" style="margin-top:12px">Opposition winners (lost puckouts)</div>
            {#if htBestOppPuckoutWinner}
              <div class="standout-row danger">
                <span class="standout-label">Most wins</span>
                <span class="standout-name">{htBestOppPuckoutWinner.num}</span>
                <span class="standout-val">{htBestOppPuckoutWinner.count} puckout{htBestOppPuckoutWinner.count > 1 ? 's' : ''} won</span>
              </div>
            {/if}
            {#each htPuckoutByOppPlayer as row}
              <div class="ht-zone-row">
                <span class="ht-zone-name">{row.num}</span>
                <span class="ht-zone-data">
                  <span class="lost-badge">{row.count} won vs us</span>
                </span>
                {#if row.beatPlayers.length > 0}
                  <div class="ht-matchup-line">
                    <span class="matchup-lost">Marking: {row.beatPlayers.join(', ')}</span>
                  </div>
                {/if}
              </div>
            {/each}
          {/if}
        </div>
      {/if}
    </div>
  {/if}

  <!-- ── SCORES CONCEDED accordion ── -->
  {#if $settingsStore.trackOppScores && oppScores.length > 0}
    {@const htGoals = oppScores.filter(s => s.type === 'goal').length}
    {@const htPoints = oppScores.filter(s => s.type === 'point').length}
    <div class="accordion-card">
      <button class="accordion-header" on:click={() => toggleSection('conceded')}>
        <div class="accordion-title">
          <span class="accordion-name">Scores Conceded</span>
          <span class="accordion-summary">
            {#if htGoals > 0}<span class="badge-goal">{htGoals}G</span>{/if}
            {#if htPoints > 0}<span class="badge-point">{htPoints}P</span>{/if}
            <span class="badge-pts">{htGoals*3+htPoints} pts</span>
          </span>
        </div>
        <span class="accordion-chevron">{#if openSections.conceded}<svg style="width:16px;height:16px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>{:else}<svg style="width:16px;height:16px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>{/if}</span>
      </button>
      {#if openSections.conceded}
        <div class="accordion-body">
          {#if htBiggestConcededOppPlayer}
            <div class="standout-row danger">
              <span class="standout-label">Most dangerous</span>
              <span class="standout-name">{htBiggestConcededOppPlayer.num}</span>
              <span class="standout-val">
                {htBiggestConcededOppPlayer.goals > 0 ? htBiggestConcededOppPlayer.goals + 'G ' : ''}{htBiggestConcededOppPlayer.points > 0 ? htBiggestConcededOppPlayer.points + 'P' : ''}
              </span>
            </div>
          {/if}
          <div class="ht-stats-row">
            <div class="ht-stat-block"><div class="ht-stat-val red">{htGoals}</div><div class="ht-stat-label">Goals</div></div>
            <div class="ht-stat-divider"></div>
            <div class="ht-stat-block"><div class="ht-stat-val amber">{htPoints}</div><div class="ht-stat-label">Points</div></div>
            <div class="ht-stat-divider"></div>
            <div class="ht-stat-block"><div class="ht-stat-val red">{htGoals*3+htPoints}</div><div class="ht-stat-label">Total pts</div></div>
          </div>

          {#if htConcededByMarker.length > 0}
            <div class="ht-sub-label" style="margin-top:12px">By our marker</div>
            {#each htConcededByMarker as row}
              <div class="ht-breakdown-row">
                <span class="ht-breakdown-name">{row.marker}</span>
                <span class="ht-breakdown-vals">
                  {#if row.goals > 0}<span class="goal-badge">{row.goals}G</span>{/if}
                  {#if row.points > 0}<span class="point-badge">{row.points}P</span>{/if}
                  <span class="ht-opp-nums">{row.scores.filter(s=>s.oppPlayerNum).map(s=>'#'+s.oppPlayerNum).join(', ')}</span>
                </span>
              </div>
            {/each}
          {/if}

          {#if htConcededByOppPlayer.length > 0}
            <div class="ht-sub-label" style="margin-top:12px">By opposition player</div>
            {#each htConcededByOppPlayer as row}
              <div class="ht-breakdown-row">
                <span class="ht-breakdown-name">{row.num}</span>
                <span class="ht-breakdown-vals">
                  {#if row.goals > 0}<span class="goal-badge">{row.goals}G</span>{/if}
                  {#if row.points > 0}<span class="point-badge">{row.points}P</span>{/if}
                  {#if row.markers.length > 0}<span class="ht-opp-nums">on {row.markers.join(', ')}</span>{/if}
                </span>
              </div>
            {/each}
          {/if}
        </div>
      {/if}
    </div>
  {/if}

  <!-- ── PLAYER STATS accordion ── -->
  {#if players.some(p => p.name?.trim() && Object.values(stats[p.id]||{}).some(v=>v>0))}
    {@const playersWithStats = players.filter(p => p.name?.trim() && Object.values(stats[p.id]||{}).some(v=>v>0))}
    <div class="accordion-card">
      <button class="accordion-header" on:click={() => toggleSection('players')}>
        <div class="accordion-title">
          <span class="accordion-name">Player Stats</span>
          <span class="accordion-summary"><span class="badge-pts">{playersWithStats.length} active</span></span>
        </div>
        <span class="accordion-chevron">{#if openSections.players}<svg style="width:16px;height:16px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>{:else}<svg style="width:16px;height:16px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>{/if}</span>
      </button>
      {#if openSections.players}
        <div class="accordion-body" style="overflow:hidden;">
          {#if htTopScorer}
            <div class="standout-row" style="margin-bottom:12px">
              <span class="standout-label">Top scorer</span>
              <span class="standout-name">{htTopScorer.name}</span>
              <span class="standout-val">
                {htTopScorer.goals > 0 ? htTopScorer.goals + 'G ' : ''}{htTopScorer.points > 0 ? htTopScorer.points + 'P' : ''}
                ({htTopScorer.pts} pts)
              </span>
            </div>
          {/if}
          <div class="table-wrap">
            <table class="player-table">
              <thead>
                <tr>
                  <th class="th-player">Player</th>
                  {#each allStats as stat}<th>{stat.split(' ')[0]}</th>{/each}
                </tr>
              </thead>
              <tbody>
                {#each players.filter(p=>p.name?.trim()) as player}
                  {@const s = stats[player.id] || {}}
                  {@const hasStats = Object.values(s).some(v=>v>0)}
                  {#if hasStats}
                    <tr>
                      <td class="td-player">
                        <span class="num-badge" class:sub={player.position==='Sub'}>#{player.number}</span>{player.name}
                      </td>
                      {#each allStats as stat}<td>{s[stat]||0}</td>{/each}
                    </tr>
                  {/if}
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <!-- ── SUBSTITUTIONS accordion ── -->
  {#if subs_log.length > 0}
    <div class="accordion-card">
      <button class="accordion-header" on:click={() => toggleSection('subs')}>
        <div class="accordion-title">
          <span class="accordion-name">Substitutions</span>
          <span class="accordion-summary"><span class="badge-pts">{subs_log.length} made</span></span>
        </div>
        <span class="accordion-chevron">{#if openSections.subs}<svg style="width:16px;height:16px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>{:else}<svg style="width:16px;height:16px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>{/if}</span>
      </button>
      {#if openSections.subs}
        <div class="accordion-body">
          {#each subs_log as sub}
            <div class="sub-log-row">
              <span class="sub-time">{formatTime(sub.time)}</span>
              <span class="sub-detail"><svg style="width:12px;height:12px;color:#e53935" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg> {sub.off} → <svg style="width:12px;height:12px;color:#2d7a2d" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg> {sub.on}</span>
              <span class="sub-period">{sub.period}</span>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  <button class="back-to-match-btn" on:click={closeStatsView}>← Back to Match</button>
</div>
{/if}

<style>
  .screen { display: flex; flex-direction: column; gap: 12px; padding-bottom: 2rem; }
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1rem; }

  /* ── RECOVERY SCREEN ── */
  .recover-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    padding: 1rem 0;
  }
  .recover-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 2rem 1.75rem;
    width: 100%;
    max-width: 480px;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    box-shadow: 0 4px 24px rgba(0,0,0,0.06);
  }
  .recover-header { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 10px; }
  .recover-logo { width: 56px; height: 56px; object-fit: contain; }
  .recover-badge {
    display: inline-block;
    background: rgba(224,160,32,0.12);
    color: #9a6000;
    border: 1px solid #e0a020;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.05em;
    padding: 4px 12px;
    text-transform: uppercase;
  }
  .recover-title { font-size: 20px; font-weight: 700; color: var(--text); margin: 0; }
  .recover-sub { font-size: 13px; color: var(--text-muted); margin: 0; }

  .recover-match-info {
    background: var(--surface-2);
    border-radius: 10px;
    padding: 1rem 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .recover-fixture { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .recover-team { font-size: 15px; font-weight: 700; color: var(--text); }
  .recover-vs { font-size: 12px; color: var(--text-faint); font-weight: 600; text-transform: uppercase; }
  .recover-meta { font-size: 13px; color: var(--text-muted); }

  .recover-stats-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    background: rgba(var(--primary-rgb),0.08);
    border: 1px solid rgba(var(--primary-rgb),0.2);
    border-radius: 10px;
    padding: 1rem;
  }
  .recover-stat { text-align: center; flex: 1; }
  .recover-stat-val { font-size: 18px; font-weight: 700; color: var(--primary); }
  .recover-stat-label { font-size: 10px; color: var(--text-faint); margin-top: 2px; text-transform: uppercase; letter-spacing: 0.04em; }
  .recover-stat-divider { width: 1px; height: 36px; background: var(--border); flex-shrink: 0; }

  .recover-actions { display: flex; flex-direction: column; gap: 10px; }
  .recover-resume-btn {
    width: 100%;
    padding: 15px;
    background: var(--primary);
    color: white;
    border: none;
    border-radius: 10px;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.2s;
  }
  .recover-resume-btn:hover { background: var(--primary-hover); }
  .recover-discard-btn {
    width: 100%;
    padding: 12px;
    background: none;
    color: var(--text-muted);
    border: 1px solid var(--border);
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }
  .recover-discard-btn:hover { border-color: #e53935; color: #e53935; }

  .setup-hero { display: flex; align-items: center; gap: 16px; padding: 0.5rem 0; }
  .hero-logo { width: 64px; height: 64px; object-fit: contain; }
  .setup-hero h2 { font-size: 24px; font-weight: 700; color: var(--text); margin-bottom: 2px; }
  .setup-hero p { font-size: 13px; color: var(--text-muted); }
  .setup-card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 1.25rem; display: flex; flex-direction: column; gap: 14px; }
  .setup-card-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-faint); }
  .field-group { display: flex; flex-direction: column; gap: 6px; }
  .field-group label { font-size: 13px; font-weight: 600; color: var(--text-2); }
  .field-group input { padding: 13px 14px; border: 1.5px solid var(--input-border); border-radius: 10px; font-size: 16px; font-family: inherit; width: 100%; background: var(--surface-3); transition: all 0.15s; min-height: 46px; }
  .field-group input:focus { outline: none; border-color: var(--primary); background: var(--surface); box-shadow: 0 0 0 3px rgba(var(--primary-rgb),0.08); }
  .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .squad-preview-card { background: var(--primary); border-radius: 14px; padding: 1.25rem; color: white; }
  .squad-preview-title { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; opacity: 0.85; margin-bottom: 1rem; }
  .squad-dot { width: 8px; height: 8px; border-radius: 50%; background: #4caf50; box-shadow: 0 0 0 2px rgba(76,175,80,0.3); }
  .squad-preview-stats { display: flex; align-items: center; justify-content: space-around; margin-bottom: 1rem; }
  .squad-stat { text-align: center; }
  .squad-stat-val { font-size: 32px; font-weight: 700; line-height: 1; }
  .squad-stat-label { font-size: 12px; opacity: 0.7; margin-top: 4px; }
  .squad-divider { width: 1px; height: 40px; background: rgba(255,255,255,0.2); }
  .squad-preview-hint { font-size: 12px; opacity: 0.6; text-align: center; }
  .start-btn { width: 100%; padding: 16px; background: var(--text); color: var(--bg); border: none; border-radius: 12px; font-size: 17px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; font-family: inherit; transition: background 0.15s; }
  .start-btn:hover { opacity: 0.85; }
  .start-arrow { font-size: 20px; }
  .match-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
  .match-title { font-size: 17px; font-weight: 700; color: var(--text); }
  .vs { font-weight: 400; color: var(--text-muted); margin: 0 6px; }
  .match-meta { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
  .scoreboard { display: flex; align-items: center; gap: 10px; background: var(--surface-2); border-radius: 10px; padding: 8px 16px; }
  .score-block { text-align: center; }
  .score-label { font-size: 10px; color: var(--text-muted); font-weight: 600; letter-spacing: 0.05em; }
  .score-val { font-size: 22px; font-weight: 700; color: var(--text); }
  .score-divider { font-size: 22px; color: var(--text-faint); }
  .opp-btns { display: flex; gap: 4px; margin-top: 6px; flex-wrap: wrap; justify-content: center; }
  .opp-btn { padding: 6px 10px; font-size: 12px; font-weight: 600; border: 1px solid var(--input-border); border-radius: 6px; background: var(--surface); cursor: pointer; color: var(--text-2); font-family: inherit; min-height: 36px; min-width: 36px; }
  .opp-btn:hover { border-color: var(--primary); color: var(--primary); }
  .timer-card { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
  .timer-left { display: flex; align-items: center; gap: 10px; }
  .timer-display { font-size: 28px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--text); min-width: 80px; }
  .timer-display.running { color: var(--primary); }
  .timer-display.overtime { color: #e53935; }
  .timer-display.overtime.running { color: #e53935; }
  .timer-btns { display: flex; gap: 6px; }
  .timer-btn { display: inline-flex; align-items: center; gap: 6px; padding: 10px 16px; border-radius: 8px; border: 1.5px solid var(--input-border); background: none; color: var(--text-2); font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; min-height: 44px; }
  .timer-btn.primary { background: var(--primary); border-color: var(--primary); color: white; }
  .period-pills { display: flex; gap: 6px; flex-wrap: wrap; }
  .period-btn { padding: 8px 14px; border-radius: 20px; border: 1px solid var(--input-border); background: none; font-size: 13px; color: var(--text-muted); cursor: pointer; white-space: nowrap; font-family: inherit; min-height: 40px; }
  .period-btn.active { background: var(--primary); color: white; border-color: var(--primary); font-weight: 600; }
  .undo-row { display: flex; justify-content: flex-end; }
  .undo-btn {
    padding: 8px 16px; border-radius: 8px;
    border: 1.5px solid #e0a020; background: rgba(224,160,32,0.1); color: #9a6000;
    font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit;
    min-height: 40px; transition: all 0.15s; white-space: nowrap;
  }
  .undo-btn:hover { background: #e0a020; color: white; }
  .mode-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .mode-toggle { display: flex; border: 1px solid var(--input-border); border-radius: 8px; overflow: hidden; }
  .mode-toggle button { padding: 10px 20px; border: none; background: none; font-size: 14px; color: var(--text-muted); cursor: pointer; font-family: inherit; min-height: 44px; }
  .mode-toggle button.active { background: var(--primary); color: white; font-weight: 600; }
  .sub-btn { display: inline-flex; align-items: center; gap: 6px; padding: 10px 18px; border-radius: 8px; border: 1.5px solid var(--primary); background: none; color: var(--primary); font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap; font-family: inherit; min-height: 44px; }
  .sub-btn:hover { background: var(--primary); color: white; }
  .section-label { font-size: 11px; font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; color: var(--text-faint); margin-bottom: 6px; }
  .stat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
  .stat-btn { position: relative; padding: 18px 12px; border-radius: 10px; border: 1.5px solid var(--input-border); background: var(--surface); font-size: 15px; font-weight: 600; color: var(--text); cursor: pointer; transition: all 0.15s; text-align: center; font-family: inherit; min-height: 64px; }
  .stat-btn:hover { border-color: var(--primary); color: var(--primary); background: rgba(var(--primary-rgb),0.08); }
  .stat-btn:active { transform: scale(0.97); }
  .stat-btn.dashed { border-style: dashed; color: var(--text-faint); font-weight: 400; }
  .stat-btn.dashed:hover { color: var(--primary); border-color: var(--primary); }
  .custom-tag { display: block; font-size: 10px; font-weight: 400; color: var(--text-faint); margin-top: 4px; }
  .add-stat-input { display: flex; align-items: center; gap: 6px; padding: 10px 12px; }
  .add-stat-input input { flex: 1; border: none; outline: none; font-size: 14px; font-family: inherit; min-width: 0; background: transparent; color: var(--text); }
  .confirm-btn { padding: 4px 10px; background: var(--primary); color: white; border: none; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; }
  .cancel-small { background: none; border: none; color: var(--text-faint); font-size: 14px; cursor: pointer; padding: 2px 4px; }
  .custom-stat-row { display: flex; justify-content: flex-end; margin-bottom: 8px; }
  .custom-stat-btn { padding: 7px 16px; border-radius: 8px; border: 1.5px dashed var(--primary); background: rgba(var(--primary-rgb),0.06); color: var(--primary); font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.15s; }
  .custom-stat-btn:hover { background: var(--primary); color: white; }
  .custom-stat-input-wrap { display: flex; align-items: center; gap: 8px; background: var(--surface); border: 1.5px solid var(--primary); border-radius: 8px; padding: 6px 10px; width: 100%; max-width: 320px; }
  .custom-stat-input { flex: 1; border: none; outline: none; font-size: 14px; font-family: inherit; min-width: 0; background: transparent; }
  .table-wrap { width: 100%; overflow-x: auto; border: 1px solid var(--border); border-radius: 10px; }
  .player-table { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 340px; }
  .player-table thead { background: var(--surface-2); }
  .player-table th { padding: 8px 6px; font-size: 11px; font-weight: 600; color: var(--text-faint); text-transform: uppercase; letter-spacing: 0.05em; text-align: center; border-bottom: 1px solid var(--divider); }
  .th-player { text-align: left; padding-left: 12px; }
  .player-table td { padding: 6px; border-bottom: 1px solid var(--divider-faint); text-align: center; }
  .player-table tr:last-child td { border-bottom: none; }
  .td-player { text-align: left; padding-left: 12px; white-space: nowrap; font-weight: 500; }
  .num-badge { display: inline-block; font-size: 11px; background: var(--primary); color: var(--primary-text); border-radius: 4px; padding: 1px 5px; font-weight: 600; margin-right: 4px; }
  .num-badge.sub { background: var(--text-muted); }
  .counter { display: flex; align-items: center; justify-content: center; gap: 4px; }
  .mini-dec, .mini-inc { width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--input-border); background: var(--surface); font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center; line-height: 1; font-family: inherit; flex-shrink: 0; }
  .mini-inc { border-color: var(--primary); color: var(--primary); }
  .mini-val { font-size: 14px; font-weight: 600; min-width: 20px; text-align: center; }
  .sub-log-row { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px solid var(--divider); font-size: 13px; }
  .sub-log-row:last-child { border-bottom: none; }
  .sub-time { font-weight: 700; color: var(--primary); min-width: 44px; }
  .sub-detail { flex: 1; color: var(--text); }
  .sub-period { font-size: 11px; color: var(--text-faint); }
  .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: flex-end; justify-content: center; z-index: 200; }
  .modal { background: var(--surface); border-radius: 20px 20px 0 0; padding: 1.5rem; width: 100%; max-width: 640px; max-height: 85vh; overflow-y: auto; }
  .modal-title { font-size: 17px; font-weight: 600; margin-bottom: 1rem; color: var(--text); }
  .modal-section-label { font-size: 11px; font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; color: var(--text-faint); margin: 0.75rem 0 0.5rem; }
  .player-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 8px; }
  .player-btn { display: flex; flex-direction: column; align-items: center; padding: 14px 8px; border-radius: 10px; border: 1.5px solid var(--input-border); background: var(--surface); cursor: pointer; transition: all 0.15s; gap: 4px; font-family: inherit; min-height: 64px; }
  .player-btn:active { transform: scale(0.96); border-color: var(--primary); background: rgba(var(--primary-rgb),0.08); }
  .player-btn.sub { opacity: 0.7; }
  .player-num { font-size: 11px; color: var(--text-muted); }
  .player-name { font-size: 13px; font-weight: 600; color: var(--text); text-align: center; }
  .cancel-btn { width: 100%; margin-top: 1rem; padding: 15px; border-radius: 10px; border: 1px solid var(--input-border); background: none; font-size: 16px; color: var(--text-muted); cursor: pointer; font-family: inherit; min-height: 50px; }
  .optional-tag { font-size: 12px; font-weight: 400; color: var(--text-faint); margin-left: 6px; }
  .pitch-wrap { margin: 0.75rem 0; border-radius: 8px; overflow: hidden; cursor: crosshair; }
  .pitch-svg { width: 100%; height: auto; display: block; }
  .pitch-end-zone { fill: rgba(var(--primary-rgb), 0.15); }
  .ghost-btn { width: 100%; padding: 10px; border: 1.5px dashed var(--input-border); border-radius: 8px; background: none; color: var(--text-faint); font-size: 13px; cursor: pointer; font-family: inherit; }
  .ghost-btn:hover { border-color: var(--primary); color: var(--primary); }
  .notes-section { margin-top: 4px; }
  textarea { width: 100%; min-height: 80px; border: 1px solid var(--input-border); border-radius: 8px; padding: 12px 14px; font-size: 16px; font-family: inherit; color: var(--text); resize: vertical; background: var(--surface); }
  textarea:focus { outline: none; border-color: var(--primary); }
  @media (max-width: 480px) {
    .match-header { flex-direction: column; align-items: flex-start; }
    .scoreboard { width: 100%; justify-content: center; }
    .score-val { font-size: 26px; }
    .timer-card { flex-direction: column; align-items: flex-start; gap: 10px; }
    .period-pills { width: 100%; }
    .stat-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
    .stat-btn { padding: 16px 8px; font-size: 14px; min-height: 60px; }
    .field-row { grid-template-columns: 1fr; }
    .mode-row { flex-wrap: wrap; }
    .mode-toggle { flex: 1; }
    .mode-toggle button { flex: 1; }
    .player-grid { grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap: 8px; }
    .modal { padding: 1.25rem; padding-bottom: calc(1.25rem + env(safe-area-inset-bottom)); }
    .mini-val { font-size: 15px; min-width: 22px; }
    .action-btns { flex-wrap: wrap; }
    .ht-breakdown-row { flex-wrap: wrap; }
    .ht-breakdown-vals { flex-shrink: 1; }
    .ht-score-bar-val { font-size: 22px; }
  }
  @media (min-width: 481px) and (max-width: 768px) {
    .stat-grid { grid-template-columns: repeat(3, 1fr); }
  }
  @media (min-width: 769px) {
    .stat-grid { grid-template-columns: repeat(4, 1fr); }
  }

  /* ── ACTION BUTTONS ── */
  .action-btns { display: flex; gap: 6px; }
  .puckout-btn {
    padding: 10px 14px;
    border-radius: 8px;
    border: 1.5px solid #2d7a2d;
    background: none;
    color: #2d7a2d;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    font-family: inherit;
    min-height: 44px;
    transition: all 0.15s;
  }
  .puckout-btn:hover { background: #2d7a2d; color: white; }

  .opp-btn-score { border-color: #e53935; color: #e53935; }
  .opp-btn-score:hover { border-color: #e53935; color: #e53935; background: rgba(229,57,53,0.08); }

  /* ── QUICK VIEW STATS BUTTON ── */
  .stats-view-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 10px 14px;
    border-radius: 8px;
    border: 1.5px solid var(--primary);
    background: none;
    color: var(--primary);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    font-family: inherit;
    min-height: 44px;
    transition: all 0.15s;
  }
  .stats-view-btn:hover { background: var(--primary); color: white; }

  /* ── BACK TO MATCH BUTTON ── */
  .back-to-match-btn {
    width: 100%;
    padding: 15px;
    background: var(--primary);
    color: white;
    border: none;
    border-radius: 12px;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.2s;
  }
  .back-to-match-btn:hover { background: var(--primary-hover); }

  /* ── PUCKOUT SUMMARY BAR ── */
  .puckout-summary-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    font-size: 13px;
  }
  .puckout-summary-label { font-weight: 700; color: var(--text); flex: none; }
  .puckout-won { color: #2d7a2d; font-weight: 700; }
  .puckout-lost { color: #e53935; font-weight: 700; }
  .puckout-divider { color: var(--text-faint); }
  .puckout-pct { color: var(--text-faint); font-size: 12px; margin-left: auto; }

  /* ── CONCEDED SUMMARY ── */
  .conceded-summary { display: flex; flex-direction: column; gap: 6px; }
  .conceded-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--divider-faint); font-size: 13px; }
  .conceded-row:last-child { border-bottom: none; }
  .conceded-marker { flex: 1; font-weight: 600; color: var(--text); }
  .conceded-tally { display: flex; gap: 4px; flex-shrink: 0; }
  .conceded-goal { background: rgba(229,57,53,0.12); color: #e53935; font-weight: 700; font-size: 12px; padding: 2px 6px; border-radius: 4px; }
  .conceded-point { background: rgba(224,160,32,0.12); color: #9a6000; font-weight: 700; font-size: 12px; padding: 2px 6px; border-radius: 4px; }
  .conceded-opp { font-size: 11px; color: var(--text-faint); flex-shrink: 0; }

  /* ── MODAL ADDITIONS ── */
  .puckout-outcome-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 0.75rem; }
  .outcome-btn {
    padding: 18px 12px;
    border-radius: 10px;
    border: 2px solid var(--input-border);
    background: var(--surface);
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }
  .outcome-btn.won { color: #2d7a2d; }
  .outcome-btn.won.selected { background: #2d7a2d; color: white; border-color: #2d7a2d; }
  .outcome-btn.lost { color: #e53935; }
  .outcome-btn.lost.selected { background: #e53935; color: white; border-color: #e53935; }
  .outcome-btn:not(.selected):hover { border-color: var(--primary); }

  .modal-input {
    width: 100%;
    padding: 13px 14px;
    border: 1.5px solid var(--input-border);
    border-radius: 10px;
    font-size: 18px;
    font-family: inherit;
    background: var(--surface-3);
    color: var(--text);
    margin-bottom: 0.5rem;
    min-height: 50px;
  }
  .modal-input:focus { outline: none; border-color: var(--primary); background: var(--surface); }

  .selected-player { border-color: var(--primary); background: rgba(var(--primary-rgb),0.1); }

  .confirm-log-btn {
    width: 100%;
    margin-top: 1rem;
    padding: 15px;
    border-radius: 10px;
    border: none;
    background: var(--primary);
    color: white;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    min-height: 50px;
    transition: background 0.15s;
  }
  .confirm-log-btn:hover:not(:disabled) { background: var(--primary-hover); }
  .confirm-log-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  /* ── HALFTIME SCREEN ── */
  .ht-header { text-align: center; padding: 1rem 0 0.5rem; }
  .ht-badge {
    display: inline-block;
    background: var(--primary);
    color: white;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.06em;
    padding: 5px 14px;
    text-transform: uppercase;
    margin-bottom: 10px;
  }
  .ht-title { font-size: 22px; font-weight: 700; color: var(--text); margin: 0 0 4px; }
  .ht-meta { font-size: 13px; color: var(--text-muted); }

  .ht-score-card { text-align: center; }
  .ht-score-row { display: flex; align-items: center; justify-content: center; gap: 24px; }
  .ht-score-team { text-align: center; }
  .ht-score-team.right { text-align: center; }
  .ht-team-name { font-size: 13px; color: var(--text-muted); font-weight: 600; margin-bottom: 4px; }
  .ht-score { font-size: 36px; font-weight: 700; color: var(--text); }
  .ht-score-divider { font-size: 28px; color: var(--text-faint); }

  .ht-stats-row {
    display: flex;
    align-items: center;
    gap: 12px;
    background: var(--surface-2);
    border-radius: 10px;
    padding: 1rem;
  }
  .ht-stat-block { text-align: center; flex: 1; }
  .ht-stat-val { font-size: 24px; font-weight: 700; color: var(--text); }
  .ht-stat-val.green { color: #2d7a2d; }
  .ht-stat-val.red { color: #e53935; }
  .ht-stat-label { font-size: 10px; color: var(--text-faint); margin-top: 2px; text-transform: uppercase; letter-spacing: 0.04em; }
  .ht-stat-divider { width: 1px; height: 36px; background: var(--divider); flex-shrink: 0; }

  .ht-breakdown { border-top: 1px solid var(--divider-faint); padding-top: 10px; margin-top: 10px; display: flex; flex-direction: column; gap: 4px; }
  .ht-breakdown-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-faint); margin-bottom: 6px; }
  .ht-breakdown-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid var(--divider-faint); font-size: 13px; }
  .ht-breakdown-row:last-child { border-bottom: none; }
  .ht-breakdown-name { flex: 1; font-weight: 600; color: var(--text); }
  .ht-breakdown-vals { display: flex; gap: 4px; flex-shrink: 0; }
  .ht-opp-nums { font-size: 11px; color: var(--text-faint); flex-shrink: 0; }

  .won-badge { background: rgba(45,122,45,0.12); color: #2d7a2d; font-weight: 700; font-size: 12px; padding: 2px 6px; border-radius: 4px; }
  .lost-badge { background: rgba(229,57,53,0.12); color: #e53935; font-weight: 700; font-size: 12px; padding: 2px 6px; border-radius: 4px; }
  .goal-badge { background: rgba(229,57,53,0.12); color: #e53935; font-weight: 700; font-size: 12px; padding: 2px 6px; border-radius: 4px; }
  .point-badge { background: rgba(224,160,32,0.12); color: #9a6000; font-weight: 700; font-size: 12px; padding: 2px 6px; border-radius: 4px; }

  .ht-conceded-total { font-size: 14px; font-weight: 600; color: var(--text); }

  /* ── CANCEL MATCH + FINISH ROW ── */
  .finish-row { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
  .finish-btn { width: 100%; padding: 15px; background: var(--text); color: var(--bg); border: none; border-radius: 10px; font-size: 16px; font-weight: 700; cursor: pointer; font-family: inherit; }
  .finish-btn:hover:not(:disabled) { opacity: 0.85; }
  .finish-btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .cancel-match-btn {
    width: 100%;
    padding: 11px;
    background: none;
    border: 1px solid var(--border);
    border-radius: 10px;
    color: var(--text-faint);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }
  .cancel-match-btn:hover { border-color: #e53935; color: #e53935; }

  /* ── PUCKOUT PITCH ZONE PICKER ── */
  .puckout-pitch-wrap { border-radius: 8px; overflow: hidden; margin-bottom: 0.5rem; }
  .puckout-pitch-svg { width: 100%; height: auto; display: block; }
  .zone-hint { font-weight: 600; color: #2d7a2d; text-transform: none; letter-spacing: 0; font-size: 12px; }

  /* ── HALFTIME SCORE BAR ── */
  .ht-score-bar {
    background: var(--primary);
    border-radius: 14px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    color: white;
  }
  .ht-badge {
    display: inline-block;
    background: rgba(255,255,255,0.18);
    color: white;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    padding: 4px 12px;
    text-transform: uppercase;
  }
  .ht-score-bar-fixture {
    display: flex;
    align-items: center;
    gap: 16px;
    justify-content: center;
    width: 100%;
  }
  .ht-score-bar-team { text-align: center; flex: 1; }
  .ht-score-bar-name { font-size: 12px; opacity: 0.8; margin-bottom: 2px; }
  .ht-score-bar-val { font-size: 26px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .ht-score-bar-sep { font-size: 22px; opacity: 0.6; flex-shrink: 0; }
  .ht-score-bar-meta { font-size: 11px; opacity: 0.6; }

  /* ── ACCORDION ── */
  .accordion-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
  }
  .accordion-header {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    background: none;
    border: none;
    cursor: pointer;
    font-family: inherit;
    text-align: left;
    gap: 8px;
    transition: background 0.15s;
  }
  .accordion-header:hover { background: var(--surface-2); }
  .accordion-title { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
  .accordion-name { font-size: 15px; font-weight: 700; color: var(--text); white-space: nowrap; }
  .accordion-summary { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
  .accordion-chevron { font-size: 11px; color: var(--text-faint); flex-shrink: 0; }
  .accordion-body { padding: 0 16px 16px; border-top: 1px solid var(--divider-faint); }

  /* ── ACCORDION BADGES ── */
  .badge-won { background: rgba(45,122,45,0.12); color: #2d7a2d; font-weight: 700; font-size: 12px; padding: 2px 7px; border-radius: 4px; white-space: nowrap; }
  .badge-lost { background: rgba(229,57,53,0.12); color: #e53935; font-weight: 700; font-size: 12px; padding: 2px 7px; border-radius: 4px; white-space: nowrap; }
  .badge-pct { font-weight: 700; font-size: 12px; padding: 2px 7px; border-radius: 4px; white-space: nowrap; }
  .badge-pct.pct-green { background: rgba(45,122,45,0.12); color: #2d7a2d; }
  .badge-pct.pct-amber { background: rgba(224,160,32,0.12); color: #9a6000; }
  .badge-pct.pct-red { background: rgba(229,57,53,0.12); color: #e53935; }
  .badge-goal { background: rgba(229,57,53,0.12); color: #e53935; font-weight: 700; font-size: 12px; padding: 2px 7px; border-radius: 4px; white-space: nowrap; }
  .badge-point { background: rgba(224,160,32,0.12); color: #9a6000; font-weight: 700; font-size: 12px; padding: 2px 7px; border-radius: 4px; white-space: nowrap; }
  .badge-pts { background: var(--surface-2); color: var(--text-muted); font-weight: 600; font-size: 12px; padding: 2px 7px; border-radius: 4px; white-space: nowrap; }

  /* ── HALFTIME SUB-LABEL ── */
  .ht-sub-label { font-size: 11px; font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; color: var(--text-faint); margin-bottom: 6px; }

  /* ── STANDOUT / BIGGEST WINNER CALLOUT ── */
  .standout-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: rgba(var(--primary-rgb),0.06);
    border: 1px solid rgba(var(--primary-rgb),0.15);
    border-left: 3px solid var(--primary);
    border-radius: 8px;
    margin-bottom: 10px;
    flex-wrap: wrap;
  }
  .standout-row.danger {
    background: rgba(229,57,53,0.06);
    border-color: rgba(229,57,53,0.2);
    border-left-color: #e53935;
  }
  .standout-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-faint); flex-shrink: 0; }
  .standout-name { font-size: 14px; font-weight: 700; color: var(--text); flex: 1; }
  .standout-val { font-size: 13px; font-weight: 600; color: var(--text-muted); flex-shrink: 0; }

  /* ── HALFTIME STAT VALUE COLORS ── */
  .ht-stat-val.amber { color: #9a6000; }
  .green { color: #2d7a2d; }
  .amber { color: #9a6000; }
  .red { color: #e53935; }

  /* ── ZONE BREAKDOWN ROWS ── */
  .ht-zone-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 0;
    border-bottom: 1px solid var(--divider-faint);
    flex-wrap: wrap;
  }
  .ht-zone-row:last-child { border-bottom: none; }
  .ht-zone-name { flex: 1; font-size: 13px; font-weight: 600; color: var(--text); min-width: 80px; }
  .ht-zone-data { display: flex; align-items: center; gap: 5px; flex-shrink: 0; }
  .ht-zone-pct { font-size: 12px; font-weight: 700; padding: 2px 6px; border-radius: 4px; }
  .ht-zone-pct.green { background: rgba(45,122,45,0.12); color: #2d7a2d; }
  .ht-zone-pct.amber { background: rgba(224,160,32,0.12); color: #9a6000; }
  .ht-zone-pct.red { background: rgba(229,57,53,0.12); color: #e53935; }
  .ht-zone-bar { width: 100%; height: 5px; background: var(--surface-2); border-radius: 3px; overflow: hidden; margin-top: 2px; }
  .ht-zone-bar-fill { height: 100%; border-radius: 3px; transition: width 0.3s; }

  /* ── MATCHUP LINES ── */
  .ht-matchup-line { width: 100%; display: flex; gap: 8px; flex-wrap: wrap; margin-top: 2px; }
  .matchup-won { font-size: 11px; color: #2d7a2d; font-weight: 600; }
  .matchup-lost { font-size: 11px; color: #e53935; font-weight: 600; }

  /* ── ZONE FILTER RESULT ── */
  .zone-filter-result {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: rgba(var(--primary-rgb),0.07);
    border: 1px solid rgba(var(--primary-rgb),0.18);
    border-radius: 8px;
    margin-bottom: 8px;
    flex-wrap: wrap;
  }
  .zone-filter-name { font-size: 13px; font-weight: 700; color: var(--primary); flex: 1; }
  .zone-filter-stats { font-size: 13px; color: var(--text-muted); flex-shrink: 0; }
  .zone-filter-clear {
    padding: 4px 10px;
    border-radius: 6px;
    border: 1px solid rgba(var(--primary-rgb),0.3);
    background: none;
    color: var(--primary);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    flex-shrink: 0;
  }
  .zone-filter-clear:hover { background: var(--primary); color: white; }

</style>