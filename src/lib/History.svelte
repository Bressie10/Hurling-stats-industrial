<script>
  import { onMount } from 'svelte'
  import { loadMatches, getDB } from './db.js'
  import { settingsStore } from './settings-store.js'
  import { user } from './auth-store.js'
  import { deleteMatchFromCloud } from './sync.js'

  let matches = []
  let search = ''
  let filterResult = 'all'
  let selectedMatch = null

  onMount(async () => {
    matches = await loadMatches()
    matches.sort((a, b) => new Date(b.date) - new Date(a.date))
  })

  async function deleteMatch(id, e) {
    e.stopPropagation()
    if (!confirm('Delete this match permanently?')) return
    // Delete locally first — UI updates immediately even if cloud delete is slow
    const db = await getDB()
    await db.delete('matches', id)
    matches = matches.filter(m => m.id !== id)
    // FIX: Also delete from Supabase. Previously, deleted matches would reappear
    // after the next login because syncFromSupabase re-downloaded them.
    deleteMatchFromCloud($user?.id, id)
  }

  $: filtered = matches.filter(m => {
    const matchesSearch = !search ||
      m.opposition?.toLowerCase().includes(search.toLowerCase()) ||
      m.venue?.toLowerCase().includes(search.toLowerCase()) ||
      m.date?.includes(search)
    if (!matchesSearch) return false
    if (filterResult === 'all') return true
    const ht = (m.score?.home?.goals * 3 + m.score?.home?.points) || 0
    const at = (m.score?.away?.goals * 3 + m.score?.away?.points) || 0
    if (filterResult === 'W') return ht > at
    if (filterResult === 'L') return ht < at
    if (filterResult === 'D') return ht === at
    return true
  })

  $: seasonStats = (() => {
    if (matches.length === 0) return null
    let wins = 0, losses = 0, draws = 0
    let totalFor = 0, totalAgainst = 0
    matches.forEach(m => {
      const ht = (m.score?.home?.goals * 3 + m.score?.home?.points) || 0
      const at = (m.score?.away?.goals * 3 + m.score?.away?.points) || 0
      totalFor += ht
      totalAgainst += at
      if (ht > at) wins++
      else if (ht < at) losses++
      else draws++
    })
    return {
      played: matches.length,
      wins, losses, draws,
      avgFor: (totalFor / matches.length).toFixed(1),
      avgAgainst: (totalAgainst / matches.length).toFixed(1)
    }
  })()

  function getResult(m) {
    const ht = (m.score?.home?.goals * 3 + m.score?.home?.points) || 0
    const at = (m.score?.away?.goals * 3 + m.score?.away?.points) || 0
    return ht > at ? 'W' : ht < at ? 'L' : 'D'
  }

  function formatScore(s) {
    if (!s) return '—'
    return `${s.goals}-${String(s.points).padStart(2, '0')}`
  }

  function printReport() {
    window.print()
  }

  function getTopScorer(m) {
    if (!m.stats || !m.players) return null
    let top = null, max = 0
    Object.entries(m.stats).forEach(([id, s]) => {
      const score = (s['Point'] || 0) + (s['Goal'] || 0) * 3
      if (score > max) { max = score; top = parseInt(id) }
    })
    if (!top || max === 0) return null
    const player = m.players.find(p => p.id === top)
    return player ? `${player.name || `#${player.number}`} (${max}pts)` : null
  }

  function formatTime(secs) {
    if (secs == null) return '—'
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${String(s).padStart(2,'0')}`
  }

  // All stat column names present in this match (ordered: known stats first, custom after)
  $: allStatCols = (() => {
    if (!selectedMatch?.stats) return []
    const KNOWN = ['Point','Goal','Wide','Tackle','Block','Turnover Won','Turnover Lost','Free Won','Yellow Card','Red Card','Penalty Won','Penalty Scored']
    const found = new Set()
    Object.values(selectedMatch.stats).forEach(s => Object.keys(s).forEach(k => { if (s[k] > 0) found.add(k) }))
    const result = KNOWN.filter(k => found.has(k))
    found.forEach(k => { if (!KNOWN.includes(k)) result.push(k) })
    return result
  })()

  // Per-player totals scoring contribution: Goal*3 + Point
  function scoringContrib(s) { return (s?.['Goal'] || 0) * 3 + (s?.['Point'] || 0) }

  // Team totals across all players
  $: teamTotals = (() => {
    if (!selectedMatch?.stats) return {}
    const t = {}
    Object.values(selectedMatch.stats).forEach(s => {
      Object.entries(s).forEach(([k, v]) => { t[k] = (t[k] || 0) + v })
    })
    return t
  })()

  // Period breakdown from events
  $: statsByPeriod = (() => {
    if (!selectedMatch?.events?.length) return []
    const periodMap = {}
    const periodOrder = []
    selectedMatch.events.forEach(e => {
      const p = e.period || '?'
      if (!periodMap[p]) { periodMap[p] = {}; periodOrder.push(p) }
      periodMap[p][e.stat] = (periodMap[p][e.stat] || 0) + 1
    })
    const seen = new Set()
    return periodOrder.filter(p => { if (seen.has(p)) return false; seen.add(p); return true })
      .map(p => ({ period: p, stats: periodMap[p] }))
  })()

  // Scoring timeline — our goals/points + opp scores, sorted by time
  $: scoringTimeline = (() => {
    if (!selectedMatch) return []
    let homeG = 0, homeP = 0, awayG = 0, awayP = 0
    const events = []
    ;(selectedMatch.events || [])
      .filter(e => e.stat === 'Point' || e.stat === 'Goal')
      .forEach(e => {
        const player = selectedMatch.players?.find(p => p.id === e.playerId)
        events.push({ team: 'home', type: e.stat, name: player?.name || `#${player?.number || '?'}`, time: e.time ?? null, period: e.period })
      })
    ;(selectedMatch.oppScores || []).forEach(s => {
      events.push({ team: 'away', type: s.type === 'goal' ? 'Goal' : 'Point', name: s.oppPlayerNum ? `#${s.oppPlayerNum}` : '?', marker: s.marker, time: s.time ?? null, period: s.period })
    })
    events.sort((a, b) => (a.time ?? 9999) - (b.time ?? 9999))
    return events.map(e => {
      if (e.team === 'home') { if (e.type === 'Goal') homeG++; else homeP++ }
      else { if (e.type === 'Goal') awayG++; else awayP++ }
      return { ...e, score: `${homeG}-${String(homeP).padStart(2,'0')} : ${awayG}-${String(awayP).padStart(2,'0')}` }
    })
  })()

  // Puckout zone breakdown
  $: puckoutByZone = (() => {
    if (!selectedMatch?.puckouts?.length) return []
    const map = {}
    selectedMatch.puckouts.forEach(p => {
      if (!p.section) return
      if (!map[p.section]) map[p.section] = { zone: p.section, won: 0, lost: 0 }
      if (p.outcome === 'won') map[p.section].won++; else map[p.section].lost++
    })
    return Object.values(map).sort((a,b) => (b.won+b.lost)-(a.won+a.lost))
  })()

  function formatZoneLabel(key) {
    if (!key) return '—'
    return key.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  }

  // Lineup helpers (match.lineup is { [posNum]: playerId })
  function getLineupName(match, posNum) {
    if (!match?.lineup || !match?.players) return null
    const id = match.lineup[posNum]
    if (!id && id !== 0) return null
    return match.players.find(p => p.id === id)?.name?.trim() || null
  }
  const GAA_ROWS = [[13,14,15],[10,11,12],[8,9],[5,6,7],[2,3,4],[1]]
  const POS_LABEL = {1:'GK',2:'RFB',3:'CFB',4:'LFB',5:'RHB',6:'CHB',7:'LHB',8:'RMF',9:'LMF',10:'RHF',11:'CHF',12:'LHF',13:'RFF',14:'CFF',15:'LFF'}

  // ── PRINT-ONLY COMPUTED DATA ──────────────────────────

  $: printShotEvents = (() => {
    if (!selectedMatch?.events?.length) return []
    return selectedMatch.events.filter(e => e.x != null && e.y != null && ['Point','Goal','Wide'].includes(e.stat))
  })()

  $: printAllLocatedEvents = (() => {
    if (!selectedMatch?.events?.length) return []
    return selectedMatch.events.filter(e => e.x != null && e.y != null)
  })()

  $: puckoutZoneData = (() => {
    if (!selectedMatch?.puckouts?.length) return {}
    const map = {}
    selectedMatch.puckouts.forEach(p => {
      if (!p.section) return
      if (!map[p.section]) map[p.section] = { won: 0, lost: 0 }
      if (p.outcome === 'won') map[p.section].won++; else map[p.section].lost++
    })
    return map
  })()

  function printZoneColor(key) {
    const d = puckoutZoneData[key]
    if (!d || d.won + d.lost === 0) return 'rgba(255,255,255,0.08)'
    const pct = d.won / (d.won + d.lost)
    if (pct >= 0.67) return 'rgba(45,122,45,0.75)'
    if (pct >= 0.40) return 'rgba(245,124,0,0.75)'
    return 'rgba(229,57,53,0.75)'
  }

  $: topPerformers = (() => {
    if (!selectedMatch?.stats || !allStatCols.length) return []
    return allStatCols.map(stat => {
      let topId = null, max = 0
      Object.entries(selectedMatch.stats).forEach(([id, s]) => {
        if ((s[stat] || 0) > max) { max = s[stat] || 0; topId = parseInt(id) }
      })
      if (!topId || max === 0) return null
      const player = selectedMatch.players?.find(p => p.id === topId)
      return { stat, name: player?.name || `#${player?.number || '?'}`, count: max }
    }).filter(Boolean)
  })()

  $: fullEventLog = (() => {
    if (!selectedMatch?.events?.length) return []
    return [...selectedMatch.events]
      .sort((a, b) => (a.time ?? 9999) - (b.time ?? 9999))
      .map(e => {
        const player = selectedMatch.players?.find(p => p.id === e.playerId)
        return { ...e, playerName: player?.name || `#${player?.number || '?'}` }
      })
  })()

  function evtColor(stat) {
    if (stat === 'Point' || stat === 'Goal') return '#2d7a2d'
    if (stat === 'Wide') return '#e53935'
    if (stat === 'Tackle' || stat === 'Block') return '#1565c0'
    if (stat === 'Turnover Won') return '#2d7a2d'
    if (stat === 'Turnover Lost') return '#e53935'
    if (stat === 'Free Won') return '#f57c00'
    return '#7B1FA2'
  }
  function evtLabel(stat) {
    if (stat === 'Point') return 'P'
    if (stat === 'Goal') return 'G'
    if (stat === 'Wide') return 'W'
    if (stat === 'Tackle') return 'T'
    if (stat === 'Block') return 'B'
    if (stat === 'Turnover Won') return 'TW'
    if (stat === 'Turnover Lost') return 'TL'
    if (stat === 'Free Won') return 'F'
    return stat.charAt(0).toUpperCase()
  }
</script>

<div class="screen">

  {#if selectedMatch}
    <!-- MATCH DETAIL VIEW -->
    <!-- Print-only report header (hidden on screen) -->
    <div class="print-header">
      <div class="print-club">{$settingsStore.teamName || 'GAA Stats'} — Match Report</div>
      <div class="print-fixture">vs {selectedMatch.opposition} · {selectedMatch.date}{selectedMatch.venue ? ` · ${selectedMatch.venue}` : ''}</div>
    </div>

    <div class="detail-header">
      <div class="detail-top-row">
        <button class="back-btn" data-print-hide on:click={() => selectedMatch = null}>← Back</button>
        <button class="print-btn" data-print-hide on:click={printReport}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Print / Save PDF
        </button>
      </div>
      <div class="detail-title">vs {selectedMatch.opposition}</div>
      <div class="detail-meta">{selectedMatch.date}{selectedMatch.venue ? ` · ${selectedMatch.venue}` : ''}</div>
    </div>

    <div class="result-card">
      <div class="result-teams">
        <div class="result-team">
          <div class="result-team-name">{$settingsStore.teamName || 'Home'}</div>
          <div class="result-score">{formatScore(selectedMatch.score?.home)}</div>
        </div>
        <div class="result-middle">
          <div class="result-badge"
            class:win={getResult(selectedMatch)==='W'}
            class:loss={getResult(selectedMatch)==='L'}
            class:draw={getResult(selectedMatch)==='D'}
          >{getResult(selectedMatch)}</div>
          <div class="result-period">{selectedMatch.period || ''}</div>
        </div>
        <div class="result-team right">
          <div class="result-team-name">{selectedMatch.opposition}</div>
          <div class="result-score">{formatScore(selectedMatch.score?.away)}</div>
        </div>
      </div>
    </div>

    <div class="card" style="padding:0; overflow:hidden;">
      <div style="padding:1rem 1rem 0.5rem;">
        <div class="section-label">Player stats</div>
      </div>
      <div class="table-wrap">
        <table class="stats-table">
          <thead>
            <tr>
              <th class="th-left">Player</th>
              <th>Score</th>
              {#each allStatCols as col}<th>{col}</th>{/each}
            </tr>
          </thead>
          <tbody>
            {#each (selectedMatch.players || []) as player}
              {@const s = selectedMatch.stats?.[player.id] || {}}
              {@const hasStats = Object.values(s).some(v => v > 0)}
              {#if hasStats}
                <tr>
                  <td class="td-left">
                    <span class="num-badge">#{player.number}</span>
                    {player.name || 'Player'}
                  </td>
                  <td class="td-score">{scoringContrib(s) > 0 ? scoringContrib(s) + 'pts' : '—'}</td>
                  {#each allStatCols as col}<td>{s[col] || 0}</td>{/each}
                </tr>
              {/if}
            {/each}
            <tr class="totals-row">
              <td class="td-left td-totals">Team total</td>
              <td class="td-score">{scoringContrib(teamTotals) > 0 ? scoringContrib(teamTotals) + 'pts' : '—'}</td>
              {#each allStatCols as col}<td class="td-total">{teamTotals[col] || 0}</td>{/each}
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    {#if selectedMatch.subs_log?.length > 0}
      <div class="card">
        <div class="section-label" style="margin-bottom:8px">Substitutions</div>
        {#each selectedMatch.subs_log as sub}
          <div class="sub-row">
            <span class="sub-time">{sub.time}</span>
            <span class="sub-detail"><svg style="width:12px;height:12px;color:#e53935" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg> {sub.off} → <svg style="width:12px;height:12px;color:#2d7a2d" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg> {sub.on}</span>
            <span class="sub-period">{sub.period}</span>
          </div>
        {/each}
      </div>
    {/if}

    {#if selectedMatch.puckouts?.length > 0}
      {@const wins = selectedMatch.puckouts.filter(p => p.outcome === 'won').length}
      {@const total = selectedMatch.puckouts.length}
      {@const byPlayer = (() => {
        const map = {}
        selectedMatch.puckouts.forEach(p => {
          const k = p.ourPlayer || 'Unknown'
          if (!map[k]) map[k] = { name: k, won: 0, lost: 0, lostTo: [], wonAgainst: [] }
          if (p.outcome === 'won') {
            map[k].won++
            if (p.oppPlayer) { const o = '#'+p.oppPlayer; if (!map[k].wonAgainst.includes(o)) map[k].wonAgainst.push(o) }
          } else {
            map[k].lost++
            if (p.oppPlayer) { const o = '#'+p.oppPlayer; if (!map[k].lostTo.includes(o)) map[k].lostTo.push(o) }
          }
        })
        return Object.values(map).sort((a,b) => b.won - a.won)
      })()}
      {@const byOppPlayer = (() => {
        const map = {}
        selectedMatch.puckouts.filter(p => p.outcome === 'lost' && p.oppPlayer).forEach(p => {
          const k = '#' + p.oppPlayer
          if (!map[k]) map[k] = { num: k, count: 0, beatPlayers: [] }
          map[k].count++
          if (p.ourPlayer && !map[k].beatPlayers.includes(p.ourPlayer)) map[k].beatPlayers.push(p.ourPlayer)
        })
        return Object.values(map).sort((a,b) => b.count - a.count)
      })()}
      {@const topPuckoutPlayer = byPlayer.find(r => r.won > 0) ?? null}
      <div class="card">
        <div class="section-label" style="margin-bottom:10px">Puckout stats</div>
        <div class="po-summary-row">
          <div class="po-stat"><div class="po-val green">{wins}</div><div class="po-label">Won</div></div>
          <div class="po-divider"></div>
          <div class="po-stat"><div class="po-val red">{total - wins}</div><div class="po-label">Lost</div></div>
          <div class="po-divider"></div>
          <div class="po-stat"><div class="po-val">{total}</div><div class="po-label">Total</div></div>
          <div class="po-divider"></div>
          <div class="po-stat"><div class="po-val">{Math.round((wins/total)*100)}%</div><div class="po-label">Win rate</div></div>
        </div>
        {#if byPlayer.length > 0}
          {#if topPuckoutPlayer}
            <div class="h-standout-row">
              <span class="h-standout-label">Best</span>
              <span class="h-standout-name">{topPuckoutPlayer.name}</span>
              <span class="h-standout-val">{topPuckoutPlayer.won}W / {topPuckoutPlayer.lost}L</span>
            </div>
          {/if}
          <div class="po-sub-label">By our player</div>
          <div class="po-breakdown">
            {#each byPlayer as row}
              <div class="po-row">
                <span class="po-name">{row.name}</span>
                <span class="po-badges">
                  <span class="won-badge">{row.won}W</span>
                  <span class="lost-badge">{row.lost}L</span>
                  <span class="po-pct">{Math.round(row.won/(row.won+row.lost)*100)}%</span>
                </span>
              </div>
              {#if row.wonAgainst.length > 0 || row.lostTo.length > 0}
                <div class="po-matchup-line">
                  {#if row.wonAgainst.length > 0}<span class="po-matchup-won">Won vs {row.wonAgainst.join(', ')}</span>{/if}
                  {#if row.lostTo.length > 0}<span class="po-matchup-lost">Lost to {row.lostTo.join(', ')}</span>{/if}
                </div>
              {/if}
            {/each}
          </div>
        {/if}
        {#if byOppPlayer.length > 0}
          <div class="po-sub-label" style="margin-top:10px">Opposition winners (lost puckouts)</div>
          {#if byOppPlayer[0]}
            <div class="h-standout-row danger">
              <span class="h-standout-label">Most wins</span>
              <span class="h-standout-name">{byOppPlayer[0].num}</span>
              <span class="h-standout-val">{byOppPlayer[0].count} puckout{byOppPlayer[0].count > 1 ? 's' : ''} won</span>
            </div>
          {/if}
          <div class="po-breakdown">
            {#each byOppPlayer as row}
              <div class="po-row">
                <span class="po-name">{row.num}</span>
                <span class="po-badges"><span class="lost-badge">{row.count} won vs us</span></span>
              </div>
              {#if row.beatPlayers.length > 0}
                <div class="po-matchup-line">
                  <span class="po-matchup-lost">Marking: {row.beatPlayers.join(', ')}</span>
                </div>
              {/if}
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    {#if selectedMatch.oppScores?.length > 0}
      {@const byMarker = (() => {
        const map = {}
        selectedMatch.oppScores.forEach(s => {
          const k = s.marker || 'Unknown'
          if (!map[k]) map[k] = { marker: k, goals: 0, points: 0, scores: [] }
          if (s.type === 'goal') map[k].goals++; else map[k].points++
          map[k].scores.push(s)
        })
        return Object.values(map).sort((a,b) => (b.goals*3+b.points)-(a.goals*3+a.points))
      })()}
      {@const byOppScorer = (() => {
        const map = {}
        selectedMatch.oppScores.filter(s => s.oppPlayerNum).forEach(s => {
          const k = '#' + s.oppPlayerNum
          if (!map[k]) map[k] = { num: k, goals: 0, points: 0, markers: [] }
          if (s.type === 'goal') map[k].goals++; else map[k].points++
          if (s.marker && !map[k].markers.includes(s.marker)) map[k].markers.push(s.marker)
        })
        return Object.values(map).sort((a,b) => (b.goals*3+b.points)-(a.goals*3+a.points))
      })()}
      <div class="card">
        <div class="section-label" style="margin-bottom:10px">Scores conceded</div>
        {#if byMarker[0]}
          <div class="h-standout-row danger">
            <span class="h-standout-label">Most exposed</span>
            <span class="h-standout-name">{byMarker[0].marker}</span>
            <span class="h-standout-val">
              {byMarker[0].goals > 0 ? byMarker[0].goals + 'G ' : ''}{byMarker[0].points > 0 ? byMarker[0].points + 'P' : ''}
            </span>
          </div>
        {/if}
        <div class="po-sub-label">By our marker</div>
        {#each byMarker as row}
          <div class="marker-row">
            <span class="marker-name">{row.marker}</span>
            <span class="marker-tally">
              {#if row.goals > 0}<span class="conceded-goal">{row.goals}G</span>{/if}
              {#if row.points > 0}<span class="conceded-point">{row.points}P</span>{/if}
            </span>
            <span class="marker-opp">
              {row.scores.filter(s => s.oppPlayerNum).map(s => '#' + s.oppPlayerNum).join(', ')}
            </span>
          </div>
        {/each}
        {#if byOppScorer.length > 0}
          <div class="po-sub-label" style="margin-top:10px">By opposition player</div>
          {#if byOppScorer[0]}
            <div class="h-standout-row danger">
              <span class="h-standout-label">Most dangerous</span>
              <span class="h-standout-name">{byOppScorer[0].num}</span>
              <span class="h-standout-val">
                {byOppScorer[0].goals > 0 ? byOppScorer[0].goals + 'G ' : ''}{byOppScorer[0].points > 0 ? byOppScorer[0].points + 'P' : ''}
                {byOppScorer[0].markers.length > 0 ? '(on ' + byOppScorer[0].markers.join(', ') + ')' : ''}
              </span>
            </div>
          {/if}
          {#each byOppScorer as row}
            <div class="marker-row">
              <span class="marker-name">{row.num}</span>
              <span class="marker-tally">
                {#if row.goals > 0}<span class="conceded-goal">{row.goals}G</span>{/if}
                {#if row.points > 0}<span class="conceded-point">{row.points}P</span>{/if}
              </span>
              <span class="marker-opp">{row.markers.length > 0 ? 'on ' + row.markers.join(', ') : ''}</span>
            </div>
          {/each}
        {/if}
      </div>
    {/if}

    {#if selectedMatch.notes}
      <div class="card">
        <div class="section-label" style="margin-bottom:8px">Match notes</div>
        <p class="notes-text">{selectedMatch.notes}</p>
      </div>
    {/if}

    <!-- ═══════════════════════════════════════════ -->
    <!-- PRINT-ONLY SECTIONS — hidden on screen     -->
    <!-- ═══════════════════════════════════════════ -->

    <!-- Extended match info -->
    <div class="print-only print-info-grid">
      <div class="print-info-block">
        <div class="print-section-title">Match Details</div>
        <table class="print-info-table">
          <tbody>
            <tr><td class="pi-label">Date</td><td>{selectedMatch.date || '—'}</td></tr>
            {#if selectedMatch.venue}<tr><td class="pi-label">Venue</td><td>{selectedMatch.venue}</td></tr>{/if}
            {#if selectedMatch.competition}<tr><td class="pi-label">Competition</td><td>{selectedMatch.competition}</td></tr>{/if}
            <tr><td class="pi-label">Period</td><td>{selectedMatch.period || '—'}</td></tr>
            <tr><td class="pi-label">Team</td><td>{$settingsStore.teamName || 'Home'}</td></tr>
            <tr><td class="pi-label">Age Group</td><td>{$settingsStore.ageGroup || '—'}</td></tr>
          </tbody>
        </table>
      </div>

      {#if selectedMatch.lineup && Object.keys(selectedMatch.lineup).length > 0}
        <div class="print-info-block">
          <div class="print-section-title">Starting Lineup</div>
          <div class="print-lineup-grid">
            {#each GAA_ROWS as row}
              <div class="print-lineup-row">
                {#each row as pos}
                  <div class="print-lineup-slot">
                    <span class="print-lineup-pos">{pos} <span class="print-lineup-poslabel">{POS_LABEL[pos]}</span></span>
                    <span class="print-lineup-name">{getLineupName(selectedMatch, pos) || '—'}</span>
                  </div>
                {/each}
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>

    <!-- Period-by-period breakdown -->
    {#if statsByPeriod.length > 1}
      <div class="print-only">
        <div class="print-section-title">Stats by Period</div>
        <div class="table-wrap">
          <table class="stats-table print-table">
            <thead>
              <tr>
                <th class="th-left">Period</th>
                {#each allStatCols as col}<th>{col}</th>{/each}
              </tr>
            </thead>
            <tbody>
              {#each statsByPeriod as row}
                <tr>
                  <td class="td-left">{row.period}</td>
                  {#each allStatCols as col}<td>{row.stats[col] || 0}</td>{/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}

    <!-- Scoring timeline -->
    {#if scoringTimeline.length > 0}
      <div class="print-only">
        <div class="print-section-title">Scoring Timeline</div>
        <table class="stats-table print-table">
          <thead>
            <tr>
              <th class="th-left">Time</th>
              <th class="th-left">Period</th>
              <th class="th-left">Team</th>
              <th class="th-left">Player</th>
              <th class="th-left">Score</th>
              <th class="th-left">Running Score</th>
            </tr>
          </thead>
          <tbody>
            {#each scoringTimeline as e}
              <tr class:timeline-home={e.team==='home'} class:timeline-away={e.team==='away'}>
                <td>{e.time != null ? formatTime(e.time) : '—'}</td>
                <td>{e.period || '—'}</td>
                <td class="td-left">
                  {#if e.team === 'home'}
                    <span class="tl-home">{$settingsStore.teamName || 'Home'}</span>
                  {:else}
                    <span class="tl-away">{selectedMatch.opposition}</span>
                  {/if}
                </td>
                <td class="td-left">
                  {e.name}
                  {#if e.team === 'away' && e.marker}<span class="tl-marker">(on {e.marker})</span>{/if}
                </td>
                <td><span class="{e.type === 'Goal' ? 'tl-goal' : 'tl-point'}">{e.type}</span></td>
                <td class="tl-score">{e.score}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}

    <!-- Puckout zone breakdown (print-only addition to puckout section) -->
    {#if puckoutByZone.length > 0}
      <div class="print-only">
        <div class="print-section-title">Puckout Zone Breakdown</div>
        <table class="stats-table print-table">
          <thead>
            <tr>
              <th class="th-left">Zone</th>
              <th>Won</th>
              <th>Lost</th>
              <th>Total</th>
              <th>Win %</th>
            </tr>
          </thead>
          <tbody>
            {#each puckoutByZone as z}
              {@const total = z.won + z.lost}
              <tr>
                <td class="td-left">{formatZoneLabel(z.zone)}</td>
                <td>{z.won}</td>
                <td>{z.lost}</td>
                <td>{total}</td>
                <td>{Math.round((z.won / total) * 100)}%</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}

    <!-- PUCKOUT ZONE HEATMAP SVG (print-only) -->
    {#if selectedMatch?.puckouts?.length > 0 && Object.keys(puckoutZoneData).length > 0}
      <div class="print-only print-map-section">
        <div class="print-section-title">Puckout Zone Heatmap</div>
        <svg viewBox="0 0 300 110" xmlns="http://www.w3.org/2000/svg" class="print-zone-svg">
          <rect width="300" height="100" fill="#1e6b1e" rx="4"/>
          {#each [
            {key:'short',    x:4,   w:56, label:'Short'},
            {key:'own-half', x:62,  w:56, label:'Own Half'},
            {key:'midfield', x:120, w:58, label:'Midfield'},
            {key:'opp-half', x:180, w:56, label:'Opp Half'},
            {key:'long',     x:238, w:56, label:'Long'}
          ] as col}
            {#each [{key:'top',y:4,h:44},{key:'bottom',y:50,h:44}] as row}
              {@const zkey = `${col.key}-${row.key}`}
              {@const zd = puckoutZoneData[zkey]}
              <rect x={col.x} y={row.y} width={col.w} height={row.h} fill={printZoneColor(zkey)} rx="2"/>
              <rect x={col.x} y={row.y} width={col.w} height={row.h} fill="none" stroke="white" stroke-width="0.5" opacity="0.4" rx="2"/>
              {#if zd && zd.won + zd.lost > 0}
                <text x={col.x + col.w/2} y={row.y + row.h/2 - 4} text-anchor="middle" fill="white" font-size="8" font-weight="bold">{zd.won}W / {zd.lost}L</text>
                <text x={col.x + col.w/2} y={row.y + row.h/2 + 8} text-anchor="middle" fill="white" font-size="9" font-weight="bold">{Math.round(zd.won/(zd.won+zd.lost)*100)}%</text>
              {:else}
                <text x={col.x + col.w/2} y={row.y + row.h/2 + 4} text-anchor="middle" fill="white" font-size="8" opacity="0.35">—</text>
              {/if}
            {/each}
            <text x={col.x + col.w/2} y="108" text-anchor="middle" fill="#333" font-size="7" font-weight="600">{col.label}</text>
          {/each}
          <text x="2" y="28" fill="white" font-size="6" opacity="0.5">Top</text>
          <text x="2" y="74" fill="white" font-size="6" opacity="0.5">Btm</text>
        </svg>
        <div class="print-zone-legend">
          <span class="zone-legend-item"><span class="zlc green"></span>≥67% win rate</span>
          <span class="zone-legend-item"><span class="zlc amber"></span>40–66%</span>
          <span class="zone-legend-item"><span class="zlc red"></span>&lt;40%</span>
          <span class="zone-legend-item"><span class="zlc none"></span>No data</span>
        </div>
      </div>
    {/if}

    <!-- SHOTS PITCH MAP (print-only) -->
    {#if printShotEvents.length > 0}
      <div class="print-only print-map-section">
        <div class="print-section-title">Shots Map — Points, Goals &amp; Wides</div>
        <div class="print-map-legend-row">
          <span class="pm-legend"><span class="pm-dot" style="background:#2d7a2d"></span> Point / Goal</span>
          <span class="pm-legend"><span class="pm-dot" style="background:#e53935"></span> Wide</span>
        </div>
        <svg viewBox="0 0 500 320" xmlns="http://www.w3.org/2000/svg" class="print-pitch-svg">
          <rect width="500" height="320" fill="#2d7a2d" rx="6"/>
          {#each [0,1,2,3,4,5,6] as i}<rect x={i*72} y="0" width="36" height="320" fill="rgba(0,0,0,0.04)"/>{/each}
          <rect x="0" y="0" width="250" height="320" fill="rgba(0,0,0,0.07)" rx="6"/>
          <rect x="6" y="6" width="488" height="308" fill="none" stroke="white" stroke-width="2" opacity="0.8"/>
          <line x1="250" y1="6" x2="250" y2="314" stroke="white" stroke-width="2" opacity="0.8"/>
          <circle cx="250" cy="160" r="40" fill="none" stroke="white" stroke-width="1.5" opacity="0.6"/>
          <circle cx="250" cy="160" r="3" fill="white" opacity="0.6"/>
          <rect x="6" y="90" width="65" height="140" fill="none" stroke="white" stroke-width="1.5" opacity="0.7"/>
          <rect x="6" y="118" width="28" height="84" fill="none" stroke="white" stroke-width="1.5" opacity="0.7"/>
          <rect x="6" y="138" width="8" height="44" fill="rgba(255,255,255,0.15)" stroke="white" stroke-width="1.5" opacity="0.8"/>
          <rect x="429" y="90" width="65" height="140" fill="none" stroke="white" stroke-width="1.5" opacity="0.7"/>
          <rect x="466" y="118" width="28" height="84" fill="none" stroke="white" stroke-width="1.5" opacity="0.7"/>
          <rect x="486" y="138" width="8" height="44" fill="rgba(255,255,255,0.15)" stroke="white" stroke-width="1.5" opacity="0.8"/>
          <line x1="120" y1="6" x2="120" y2="314" stroke="white" stroke-width="1" stroke-dasharray="4,4" opacity="0.4"/>
          <line x1="380" y1="6" x2="380" y2="314" stroke="white" stroke-width="1" stroke-dasharray="4,4" opacity="0.4"/>
          <circle cx="90" cy="160" r="3" fill="white" opacity="0.6"/>
          <circle cx="410" cy="160" r="3" fill="white" opacity="0.6"/>
          <text x="125" y="22" text-anchor="middle" fill="white" font-size="11" font-weight="bold" opacity="0.9">DB END</text>
          <text x="375" y="22" text-anchor="middle" fill="white" font-size="11" font-weight="bold" opacity="0.9">{selectedMatch.opposition.slice(0,10).toUpperCase()} END</text>
          {#each printShotEvents as e}
            <circle cx={e.x/100*500} cy={e.y/100*320} r="9" fill={evtColor(e.stat)} opacity="0.88" stroke="white" stroke-width="0.8"/>
            <text x={e.x/100*500} y={e.y/100*320+4} text-anchor="middle" fill="white" font-size="8" font-weight="bold">{evtLabel(e.stat)}</text>
          {/each}
        </svg>
      </div>
    {/if}

    <!-- ALL ACTIONS PITCH MAP (print-only) -->
    {#if printAllLocatedEvents.length > 0}
      <div class="print-only print-map-section">
        <div class="print-section-title">All Actions Map ({printAllLocatedEvents.length} events with locations)</div>
        <div class="print-map-legend-row">
          <span class="pm-legend"><span class="pm-dot" style="background:#2d7a2d"></span> Score / Turnover Won</span>
          <span class="pm-legend"><span class="pm-dot" style="background:#e53935"></span> Wide / Turnover Lost</span>
          <span class="pm-legend"><span class="pm-dot" style="background:#1565c0"></span> Tackle / Block</span>
          <span class="pm-legend"><span class="pm-dot" style="background:#f57c00"></span> Free Won</span>
          <span class="pm-legend"><span class="pm-dot" style="background:#7B1FA2"></span> Other</span>
        </div>
        <svg viewBox="0 0 500 320" xmlns="http://www.w3.org/2000/svg" class="print-pitch-svg">
          <rect width="500" height="320" fill="#2d7a2d" rx="6"/>
          {#each [0,1,2,3,4,5,6] as i}<rect x={i*72} y="0" width="36" height="320" fill="rgba(0,0,0,0.04)"/>{/each}
          <rect x="0" y="0" width="250" height="320" fill="rgba(0,0,0,0.07)" rx="6"/>
          <rect x="6" y="6" width="488" height="308" fill="none" stroke="white" stroke-width="2" opacity="0.8"/>
          <line x1="250" y1="6" x2="250" y2="314" stroke="white" stroke-width="2" opacity="0.8"/>
          <circle cx="250" cy="160" r="40" fill="none" stroke="white" stroke-width="1.5" opacity="0.6"/>
          <circle cx="250" cy="160" r="3" fill="white" opacity="0.6"/>
          <rect x="6" y="90" width="65" height="140" fill="none" stroke="white" stroke-width="1.5" opacity="0.7"/>
          <rect x="6" y="118" width="28" height="84" fill="none" stroke="white" stroke-width="1.5" opacity="0.7"/>
          <rect x="6" y="138" width="8" height="44" fill="rgba(255,255,255,0.15)" stroke="white" stroke-width="1.5" opacity="0.8"/>
          <rect x="429" y="90" width="65" height="140" fill="none" stroke="white" stroke-width="1.5" opacity="0.7"/>
          <rect x="466" y="118" width="28" height="84" fill="none" stroke="white" stroke-width="1.5" opacity="0.7"/>
          <rect x="486" y="138" width="8" height="44" fill="rgba(255,255,255,0.15)" stroke="white" stroke-width="1.5" opacity="0.8"/>
          <line x1="120" y1="6" x2="120" y2="314" stroke="white" stroke-width="1" stroke-dasharray="4,4" opacity="0.4"/>
          <line x1="380" y1="6" x2="380" y2="314" stroke="white" stroke-width="1" stroke-dasharray="4,4" opacity="0.4"/>
          <circle cx="90" cy="160" r="3" fill="white" opacity="0.6"/>
          <circle cx="410" cy="160" r="3" fill="white" opacity="0.6"/>
          <text x="125" y="22" text-anchor="middle" fill="white" font-size="11" font-weight="bold" opacity="0.9">DB END</text>
          <text x="375" y="22" text-anchor="middle" fill="white" font-size="11" font-weight="bold" opacity="0.9">{selectedMatch.opposition.slice(0,10).toUpperCase()} END</text>
          {#each printAllLocatedEvents as e}
            <circle cx={e.x/100*500} cy={e.y/100*320} r="7" fill={evtColor(e.stat)} opacity="0.82" stroke="white" stroke-width="0.5"/>
            <text x={e.x/100*500} y={e.y/100*320+4} text-anchor="middle" fill="white" font-size="7" font-weight="bold">{evtLabel(e.stat)}</text>
          {/each}
        </svg>
      </div>
    {/if}

    <!-- TOP PERFORMERS PER STAT (print-only) -->
    {#if topPerformers.length > 0}
      <div class="print-only">
        <div class="print-section-title">Top Performers per Stat</div>
        <table class="stats-table print-table">
          <thead>
            <tr>
              <th class="th-left">Stat</th>
              <th class="th-left">Top Player</th>
              <th>Count</th>
              <th class="th-left">Team Total</th>
            </tr>
          </thead>
          <tbody>
            {#each topPerformers as row}
              <tr>
                <td class="td-left">{row.stat}</td>
                <td class="td-left">{row.name}</td>
                <td>{row.count}</td>
                <td class="td-left">{teamTotals[row.stat] || 0}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}

    <!-- COMPLETE EVENT LOG (print-only) -->
    {#if fullEventLog.length > 0}
      <div class="print-only">
        <div class="print-section-title">Complete Event Log — {fullEventLog.length} events</div>
        <table class="stats-table print-table print-event-table">
          <thead>
            <tr>
              <th>Time</th>
              <th class="th-left">Period</th>
              <th class="th-left">Player</th>
              <th class="th-left">Stat</th>
              <th class="th-left">End</th>
            </tr>
          </thead>
          <tbody>
            {#each fullEventLog as e}
              <tr>
                <td>{e.time != null ? formatTime(e.time) : '—'}</td>
                <td class="td-left">{e.period || '—'}</td>
                <td class="td-left">{e.playerName}</td>
                <td class="td-left">
                  <span class="evt-badge" style="background:{evtColor(e.stat)}">{e.stat}</span>
                </td>
                <td class="td-left">
                  {#if e.end === 'db'}DB End{:else if e.end === 'opposition'}Opp End{:else}—{/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}

    <button class="delete-match-btn" data-print-hide on:click={async (e) => {
      await deleteMatch(selectedMatch.id, e)
      selectedMatch = null
    }}>
      Delete this match
    </button>

  {:else}
    <!-- MATCH LIST VIEW -->

    {#if seasonStats}
      <div class="season-card">
        <div class="season-title">Season summary</div>
        <div class="season-grid">
          <div class="season-stat">
            <div class="season-val">{seasonStats.played}</div>
            <div class="season-label">Played</div>
          </div>
          <div class="season-stat">
            <div class="season-val win">{seasonStats.wins}</div>
            <div class="season-label">Won</div>
          </div>
          <div class="season-stat">
            <div class="season-val loss">{seasonStats.losses}</div>
            <div class="season-label">Lost</div>
          </div>
          <div class="season-stat">
            <div class="season-val">{seasonStats.draws}</div>
            <div class="season-label">Drawn</div>
          </div>
          <div class="season-stat">
            <div class="season-val">{seasonStats.avgFor}</div>
            <div class="season-label">Avg for</div>
          </div>
          <div class="season-stat">
            <div class="season-val">{seasonStats.avgAgainst}</div>
            <div class="season-label">Avg against</div>
          </div>
        </div>
      </div>
    {/if}

    <div class="search-row">
      <input
        class="search-input"
        bind:value={search}
        placeholder="Search by team, venue or date..."
      />
      <div class="filter-pills">
        {#each ['all','W','L','D'] as f}
          <button
            class="filter-pill"
            class:active={filterResult === f}
            on:click={() => filterResult = f}
          >{f === 'all' ? 'All' : f}</button>
        {/each}
      </div>
    </div>

    {#if filtered.length === 0}
      <div class="empty-state">
        <div class="empty-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:48px;height:48px"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/></svg></div>
        <div class="empty-title">No matches found</div>
        <div class="empty-sub">
          {matches.length === 0
            ? 'Save your first match to see it here'
            : 'Try a different search or filter'}
        </div>
      </div>
    {:else}
      {#each filtered as match}
        {@const result = getResult(match)}
        {@const topScorer = getTopScorer(match)}
        <div class="match-card" on:click={() => selectedMatch = match}>
          <div class="match-card-top">
            <div class="match-card-left">
              <span class="result-badge sm" class:win={result==='W'} class:loss={result==='L'} class:draw={result==='D'}>
                {result}
              </span>
              <div>
                <div class="match-opposition">vs {match.opposition}</div>
                <div class="match-meta">
                  {match.date}{match.venue ? ` · ${match.venue}` : ''}
                </div>
              </div>
            </div>
            <div class="match-card-right">
              <div class="match-scores">
                <div class="match-score-block">
                  <div class="match-score-label">{($settingsStore.teamName || 'Home').slice(0,4).toUpperCase()}</div>
                  <div class="match-score-val">{formatScore(match.score?.home)}</div>
                </div>
                <div class="match-score-divider">–</div>
                <div class="match-score-block">
                  <div class="match-score-label">{match.opposition?.slice(0,4).toUpperCase()}</div>
                  <div class="match-score-val">{formatScore(match.score?.away)}</div>
                </div>
              </div>
              <button
                class="delete-btn"
                on:click={e => deleteMatch(match.id, e)}
                title="Delete match"
              ><svg style="width:14px;height:14px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>
          </div>
          {#if topScorer}
            <div class="match-card-footer">
              <span class="top-scorer-label">Top scorer:</span>
              <span class="top-scorer-val">{topScorer}</span>
            </div>
          {/if}
        </div>
      {/each}
    {/if}

  {/if}
</div>

<style>
  .screen { display: flex; flex-direction: column; gap: 12px; padding-bottom: 2rem; }
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1rem; }

  .season-card { background: #1a1a1a; border-radius: 14px; padding: 1.25rem; color: white; }
  .season-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.5; margin-bottom: 1rem; }
  .season-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .season-stat { text-align: center; }
  .season-val { font-size: 26px; font-weight: 700; }
  .season-val.win { color: #4caf50; }
  .season-val.loss { color: #ef5350; }
  .season-label { font-size: 11px; opacity: 0.5; margin-top: 2px; }

  .search-row { display: flex; flex-direction: column; gap: 8px; }
  .search-input { width: 100%; padding: 13px 14px; border: 1.5px solid var(--input-border); border-radius: 10px; font-size: 16px; font-family: inherit; background: var(--surface); color: var(--text); min-height: 46px; }
  .search-input:focus { outline: none; border-color: var(--primary); }
  .filter-pills { display: flex; gap: 6px; flex-wrap: wrap; }
  .filter-pill { padding: 8px 16px; border-radius: 20px; border: 1px solid var(--input-border); background: none; font-size: 13px; color: var(--text-muted); cursor: pointer; font-family: inherit; font-weight: 600; transition: all 0.15s; min-height: 38px; }
  .filter-pill.active { background: var(--primary); color: white; border-color: var(--primary); }

  .match-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1rem 1.25rem; cursor: pointer; position: relative; transition: all 0.15s; }
  .match-card:hover { border-color: var(--primary); box-shadow: 0 2px 8px rgba(var(--primary-rgb),0.08); }
  .match-card-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .match-card-left { display: flex; align-items: center; gap: 12px; flex: 1; }
  .match-opposition { font-size: 15px; font-weight: 700; color: var(--text); }
  .match-meta { font-size: 12px; color: var(--text-faint); margin-top: 2px; }
  .match-card-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
  .match-scores { display: flex; align-items: center; gap: 8px; }
  .match-score-block { text-align: center; }
  .match-score-label { font-size: 10px; color: var(--text-faint); font-weight: 600; }
  .match-score-val { font-size: 16px; font-weight: 700; color: var(--text); }
  .match-score-divider { font-size: 16px; color: var(--text-faint); }
  .match-card-footer { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--divider-faint); font-size: 12px; }
  .top-scorer-label { color: var(--text-faint); }
  .top-scorer-val { color: var(--primary); font-weight: 600; margin-left: 4px; }

  .delete-btn {
    background: none;
    border: 1px solid var(--border);
    color: var(--text-faint);
    width: 28px;
    height: 28px;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all 0.15s;
  }
  .delete-btn:hover { border-color: #e53935; color: #e53935; background: rgba(229,57,53,0.08); }

  .delete-match-btn {
    width: 100%;
    padding: 12px;
    border: 1.5px solid #e53935;
    background: none;
    color: #e53935;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
    margin-top: 4px;
  }
  .delete-match-btn:hover { background: #e53935; color: white; }

  .result-badge {
    display: inline-flex; align-items: center; justify-content: center;
    width: 40px; height: 40px; border-radius: 50%;
    font-size: 14px; font-weight: 700; flex-shrink: 0;
  }
  .result-badge.sm { width: 32px; height: 32px; font-size: 12px; }
  .result-badge.win { background: #e6f4ea; color: #2d7a2d; }
  .result-badge.loss { background: #fce8e8; color: #c62828; }
  .result-badge.draw { background: var(--surface-2); color: var(--text-muted); }

  .detail-header { margin-bottom: 4px; }
  .detail-top-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; gap: 8px; }
  .back-btn { background: none; border: none; color: var(--primary); font-size: 14px; font-weight: 600; cursor: pointer; padding: 0; font-family: inherit; }
  .print-btn {
    display: flex; align-items: center; gap: 6px;
    padding: 8px 14px; border-radius: 8px;
    border: 1.5px solid var(--primary); background: none; color: var(--primary);
    font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit;
    transition: all 0.15s; white-space: nowrap;
  }
  .print-btn:hover { background: var(--primary); color: white; }
  .detail-title { font-size: 20px; font-weight: 700; color: var(--text); }
  .detail-meta { font-size: 13px; color: var(--text-muted); margin-top: 2px; }

  .print-header { display: none; }
  .print-club { font-size: 20px; font-weight: 700; color: #1a1a1a; }
  .print-fixture { font-size: 14px; color: #555; margin-top: 4px; }

  .td-score { font-size: 12px; font-weight: 600; color: var(--primary); text-align: center; }
  .totals-row td { font-weight: 700; background: var(--surface-2); border-top: 2px solid var(--border); }
  .td-totals { color: var(--text); }
  .td-total { color: var(--text); text-align: center; }

  /* Print-only: hidden on screen, shown in print */
  .print-only { display: none; }

  /* Scoring timeline */
  .tl-home { font-weight: 700; color: var(--primary); }
  .tl-away { font-weight: 700; color: #e53935; }
  .tl-goal { background: rgba(229,57,53,0.12); color: #c62828; font-weight: 700; font-size: 11px; padding: 2px 6px; border-radius: 4px; }
  .tl-point { background: rgba(var(--primary-rgb),0.1); color: var(--primary); font-weight: 700; font-size: 11px; padding: 2px 6px; border-radius: 4px; }
  .tl-score { font-size: 12px; font-weight: 700; color: var(--text); font-variant-numeric: tabular-nums; white-space: nowrap; }
  .tl-marker { font-size: 11px; color: var(--text-faint); }

  @media print {
    :global(nav) { display: none !important; }
    :global([data-print-hide]) { display: none !important; }
    :global(main) { padding: 0 !important; max-width: 100% !important; }
    .print-header { display: block; padding-bottom: 1rem; margin-bottom: 1rem; border-bottom: 3px solid #1a1a1a; }
    .print-club { font-size: 22px; font-weight: 800; }
    .print-fixture { font-size: 14px; }
    .screen { gap: 12px; padding-bottom: 0; }
    .print-only { display: block; }

    /* Result card print fix */
    .result-card { background: #f5f5f5 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

    /* Season card print fix */
    .season-card { background: #1a1a1a !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

    /* Tables */
    .stats-table { font-size: 11px; }
    .stats-table th { font-size: 10px; }
    .table-wrap { overflow: visible; }
    .print-table { width: 100%; }

    /* Avoid breaks inside cards */
    .card { page-break-inside: avoid; break-inside: avoid; border: 1px solid #ccc !important; }
    .print-only { page-break-inside: avoid; break-inside: avoid; }
    .print-section-title { page-break-after: avoid; break-after: avoid; }

    /* Print info grid */
    .print-info-grid { display: grid !important; grid-template-columns: 1fr 1fr; gap: 16px; }
    .print-info-block { border: 1px solid #ddd; border-radius: 8px; padding: 12px; }
    .print-section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #666; margin-bottom: 8px; }
    .print-info-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .print-info-table tr { border-bottom: 1px solid #f0f0f0; }
    .print-info-table td { padding: 4px 0; }
    .pi-label { color: #888; width: 100px; font-weight: 600; }

    /* Lineup grid */
    .print-lineup-grid { display: flex; flex-direction: column; gap: 4px; }
    .print-lineup-row { display: flex; gap: 6px; justify-content: center; }
    .print-lineup-slot { display: flex; flex-direction: column; align-items: center; border: 1px solid #ddd; border-radius: 4px; padding: 3px 6px; min-width: 60px; background: #f9f9f9; }
    .print-lineup-pos { font-size: 9px; color: #888; font-weight: 700; }
    .print-lineup-poslabel { color: #bbb; }
    .print-lineup-name { font-size: 10px; font-weight: 600; color: #333; text-align: center; margin-top: 1px; }

    /* Period breakdown */
    .print-section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #555; margin-bottom: 6px; display: block; }

    /* Timeline */
    .timeline-home td { background: #f9fff5; }
    .timeline-away td { background: #fff5f5; }
    .tl-home { color: #2d7a2d; }
    .tl-away { color: #c62828; }
  }

  .result-card { background: #1a1a1a; border-radius: 14px; padding: 1.25rem; color: white; }
  .result-teams { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 12px; }
  .result-team.right { text-align: right; }
  .result-team-name { font-size: 13px; opacity: 0.7; margin-bottom: 4px; }
  .result-score { font-size: 28px; font-weight: 700; }
  .result-middle { text-align: center; }
  .result-period { font-size: 11px; opacity: 0.4; margin-top: 4px; }

  .table-wrap { width: 100%; overflow-x: auto; }
  .stats-table { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 380px; }
  .stats-table thead { background: var(--surface-2); }
  .stats-table th { padding: 8px 10px; font-size: 11px; font-weight: 600; color: var(--text-faint); text-transform: uppercase; letter-spacing: 0.05em; text-align: center; border-bottom: 1px solid var(--divider); }
  .th-left { text-align: left; padding-left: 1rem; }
  .stats-table td { padding: 8px 10px; text-align: center; border-bottom: 1px solid var(--divider-faint); color: var(--text); }
  .stats-table tr:last-child td { border-bottom: none; }
  .td-left { text-align: left; padding-left: 1rem; font-weight: 600; white-space: nowrap; }
  .num-badge { display: inline-block; font-size: 11px; background: var(--primary); color: white; border-radius: 4px; padding: 1px 5px; font-weight: 600; margin-right: 4px; }

  .sub-row { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px solid var(--divider); font-size: 13px; }
  .sub-row:last-child { border-bottom: none; }
  .sub-time { font-weight: 700; color: var(--primary); min-width: 44px; }
  .sub-detail { flex: 1; color: var(--text-2); }
  .sub-period { font-size: 11px; color: var(--text-faint); }

  .notes-text { font-size: 14px; color: var(--text-2); line-height: 1.6; }

  .empty-state { text-align: center; padding: 3rem 1rem; }
  .empty-icon { font-size: 36px; margin-bottom: 0.75rem; }
  .empty-title { font-size: 16px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; }
  .empty-sub { font-size: 13px; color: var(--text-faint); }

  .section-label { font-size: 11px; font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; color: var(--text-faint); }

  /* ── PUCKOUT STATS ── */
  .po-summary-row { display: flex; align-items: center; gap: 12px; background: var(--surface-2); border-radius: 10px; padding: 1rem; margin-bottom: 4px; }
  .po-stat { text-align: center; flex: 1; }
  .po-val { font-size: 22px; font-weight: 700; color: var(--text); }
  .po-val.green { color: #2d7a2d; }
  .po-val.red { color: #e53935; }
  .po-label { font-size: 10px; color: var(--text-faint); margin-top: 2px; text-transform: uppercase; letter-spacing: 0.04em; }
  .po-divider { width: 1px; height: 36px; background: var(--divider); flex-shrink: 0; }
  .po-breakdown { border-top: 1px solid var(--divider-faint); padding-top: 10px; margin-top: 10px; display: flex; flex-direction: column; gap: 4px; }
  .po-row { display: flex; align-items: center; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid var(--divider-faint); font-size: 13px; }
  .po-row:last-child { border-bottom: none; }
  .po-name { font-weight: 600; color: var(--text); }
  .po-badges { display: flex; gap: 4px; }
  .won-badge { background: rgba(45,122,45,0.12); color: #2d7a2d; font-weight: 700; font-size: 12px; padding: 2px 6px; border-radius: 4px; }
  .lost-badge { background: rgba(229,57,53,0.12); color: #e53935; font-weight: 700; font-size: 12px; padding: 2px 6px; border-radius: 4px; }
  .po-pct { font-size: 12px; color: var(--text-faint); padding: 2px 4px; }
  .po-sub-label { font-size: 11px; font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; color: var(--text-faint); margin: 10px 0 6px; }
  .po-matchup-line { display: flex; gap: 10px; flex-wrap: wrap; padding: 2px 0 6px; margin-top: -2px; }
  .po-matchup-won { font-size: 11px; color: #2d7a2d; font-weight: 600; }
  .po-matchup-lost { font-size: 11px; color: #e53935; font-weight: 600; }

  /* ── STANDOUT / BIGGEST WINNER ── */
  .h-standout-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 12px;
    background: rgba(var(--primary-rgb),0.06);
    border: 1px solid rgba(var(--primary-rgb),0.15);
    border-left: 3px solid var(--primary);
    border-radius: 8px;
    margin-bottom: 8px;
    flex-wrap: wrap;
  }
  .h-standout-row.danger {
    background: rgba(229,57,53,0.05);
    border-color: rgba(229,57,53,0.18);
    border-left-color: #e53935;
  }
  .h-standout-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-faint); flex-shrink: 0; }
  .h-standout-name { font-size: 14px; font-weight: 700; color: var(--text); flex: 1; }
  .h-standout-val { font-size: 13px; font-weight: 600; color: var(--text-muted); flex-shrink: 0; }

  /* ── CONCEDED BY MARKER ── */
  .marker-row { display: flex; align-items: center; gap: 8px; padding: 7px 0; border-bottom: 1px solid var(--divider-faint); font-size: 13px; }
  .marker-row:last-child { border-bottom: none; }
  .marker-name { flex: 1; font-weight: 600; color: var(--text); }
  .marker-tally { display: flex; gap: 4px; flex-shrink: 0; }
  .marker-opp { font-size: 11px; color: var(--text-faint); flex-shrink: 0; }
  .conceded-goal { background: rgba(229,57,53,0.12); color: #e53935; font-weight: 700; font-size: 12px; padding: 2px 6px; border-radius: 4px; }
  .conceded-point { background: rgba(224,160,32,0.12); color: #9a6000; font-weight: 700; font-size: 12px; padding: 2px 6px; border-radius: 4px; }

  /* ── PRINT MAP / ZONE STYLES ── */
  .print-map-legend-row { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 6px; font-size: 11px; color: #444; }
  .pm-legend { display: flex; align-items: center; gap: 5px; }
  .pm-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
  .print-zone-legend { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 6px; font-size: 10px; color: #555; }
  .zone-legend-item { display: flex; align-items: center; gap: 5px; }
  .zlc { width: 14px; height: 10px; border-radius: 2px; display: inline-block; flex-shrink: 0; }
  .zlc.green { background: rgba(45,122,45,0.75); }
  .zlc.amber { background: rgba(245,124,0,0.75); }
  .zlc.red { background: rgba(229,57,53,0.75); }
  .zlc.none { background: rgba(255,255,255,0.2); border: 1px solid #ccc; }
  .evt-badge { display: inline-block; color: white; font-size: 9px; font-weight: 700; padding: 1px 6px; border-radius: 3px; white-space: nowrap; }

  @media print {
    /* Pitch + zone SVGs */
    .print-pitch-svg { width: 100%; height: auto; display: block; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .print-zone-svg { width: 100%; max-width: 420px; height: auto; display: block; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .print-map-section { page-break-inside: avoid; break-inside: avoid; margin-bottom: 12px; }
    .print-map-legend-row { display: flex !important; }
    .print-zone-legend { display: flex !important; }
    .print-event-table { font-size: 10px; }
    .print-event-table th, .print-event-table td { padding: 4px 6px; }
    .evt-badge { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }

  @media (min-width: 600px) {
    .season-grid { grid-template-columns: repeat(6, 1fr); }
    .search-row { flex-direction: row; align-items: center; }
    .search-input { flex: 1; }
  }
  @media (max-width: 480px) {
    .result-score { font-size: 22px; }
    .season-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
    .season-val { font-size: 20px; }
    .match-card { padding: 0.875rem 1rem; }
    .match-card-left { gap: 8px; }
    .match-card-right { gap: 6px; }
    .filter-pill { padding: 7px 12px; font-size: 12px; }
  }
</style>