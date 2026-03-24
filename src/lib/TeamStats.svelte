<script>
  import { onMount } from 'svelte'
  import { loadMatches } from './db.js'

  let matches = []
  let selectedMatch = null
  let activeFilter = 'Shots'
  let activePeriod = 'Full match'

  const periods = ['Full match', 'Warm-up', '1st Half', '2nd Half', 'Extra Time']

  onMount(async () => {
    matches = await loadMatches()
    matches.sort((a, b) => new Date(b.date) - new Date(a.date))
    if (matches.length > 0) selectedMatch = matches[0]
  })

  $: if (selectedMatch) activeFilter = 'Shots'

  const baseFilters = ['Shots', 'Tackles', 'Turnovers', 'Frees']

  $: customFilters = (() => {
    if (!selectedMatch) return []
    return (selectedMatch.customStats || []).filter(s =>
      (selectedMatch.events || []).some(e => e.stat === s && e.x !== null)
    )
  })()

  $: filters = [...baseFilters, ...customFilters, 'All']

  $: events = selectedMatch?.events || []

  $: periodFilteredEvents = activePeriod === 'Full match'
    ? events
    : events.filter(e => e.period === activePeriod)

  $: filteredEvents = periodFilteredEvents.filter(e => {
    if (e.x === null || e.y === null) return false
    if (activeFilter === 'All') return true
    if (activeFilter === 'Shots') return ['Point', 'Goal', 'Wide'].includes(e.stat)
    if (activeFilter === 'Tackles') return e.stat === 'Tackle'
    if (activeFilter === 'Turnovers') return e.stat === 'Turnover Won' || e.stat === 'Turnover Lost'
    if (activeFilter === 'Frees') return e.stat === 'Free Won'
    return e.stat === activeFilter
  })

  function getDotColor(stat) {
    if (stat === 'Point' || stat === 'Goal') return '#2d7a2d'
    if (stat === 'Wide') return '#e53935'
    if (stat === 'Tackle') return '#1565c0'
    if (stat === 'Turnover Won') return '#2d7a2d'
    if (stat === 'Turnover Lost') return '#e53935'
    if (stat === 'Free Won') return '#f57c00'
    return '#7B1FA2'
  }

  function getDotLabel(stat) {
    if (stat === 'Point') return 'P'
    if (stat === 'Goal') return 'G'
    if (stat === 'Wide') return 'W'
    if (stat === 'Tackle') return 'T'
    if (stat === 'Turnover Won') return 'TW'
    if (stat === 'Turnover Lost') return 'TL'
    if (stat === 'Free Won') return 'F'
    return stat.charAt(0).toUpperCase()
  }

  function getPlayerName(playerId) {
    if (!selectedMatch) return 'Unknown'
    const p = (selectedMatch.players || []).find(p => p.id === playerId)
    return p ? (p.name || `#${p.number}`) : 'Unknown'
  }

  function formatScore(s) {
    if (!s) return '—'
    return `${s.goals}-${String(s.points).padStart(2, '0')}`
  }

  $: homeTotal = selectedMatch
    ? (selectedMatch.score?.home?.goals * 3 + selectedMatch.score?.home?.points) : 0
  $: awayTotal = selectedMatch
    ? (selectedMatch.score?.away?.goals * 3 + selectedMatch.score?.away?.points) : 0
  $: result = homeTotal > awayTotal ? 'W' : homeTotal < awayTotal ? 'L' : 'D'

  $: teamStats = (() => {
    if (!selectedMatch) return {}
    const agg = {}
    Object.values(selectedMatch.stats || {}).forEach(playerStats => {
      Object.entries(playerStats).forEach(([stat, val]) => {
        agg[stat] = (agg[stat] || 0) + val
      })
    })
    return agg
  })()

  $: totalShots = (teamStats['Point'] || 0) + (teamStats['Goal'] || 0) + (teamStats['Wide'] || 0)
  $: shootingAcc = totalShots > 0
    ? Math.round(((teamStats['Point'] || 0) + (teamStats['Goal'] || 0)) / totalShots * 100)
    : null

  $: topScorer = (() => {
    if (!selectedMatch) return null
    let top = null, max = 0
    Object.entries(selectedMatch.stats || {}).forEach(([id, s]) => {
      const score = (s['Point'] || 0) + (s['Goal'] || 0) * 3
      if (score > max) { max = score; top = { id: parseInt(id), score } }
    })
    if (!top) return null
    return { name: getPlayerName(top.id), score: top.score }
  })()

  $: topTackler = (() => {
    if (!selectedMatch) return null
    let top = null, max = 0
    Object.entries(selectedMatch.stats || {}).forEach(([id, s]) => {
      const t = s['Tackle'] || 0
      if (t > max) { max = t; top = { id: parseInt(id), count: t } }
    })
    if (!top || max === 0) return null
    return { name: getPlayerName(top.id), count: top.count }
  })()

  let tooltip = null
  function showTooltip(e, event) {
    tooltip = { x: e.clientX, y: e.clientY, text: `${getPlayerName(event.playerId)} — ${event.stat} (${event.period})` }
  }
  function hideTooltip() { tooltip = null }
</script>

<div class="screen">

  <div class="selector-row">
    <div class="field-group">
      <label>Select match</label>
      <select bind:value={selectedMatch}>
        {#each matches as m}
          <option value={m}>vs {m.opposition} · {m.date}</option>
        {/each}
      </select>
    </div>
  </div>

  {#if !selectedMatch}
    <div class="empty-state">
      <div class="empty-icon">📊</div>
      <div class="empty-title">No matches yet</div>
      <div class="empty-sub">Save a match first to see team stats</div>
    </div>

  {:else}

    <div class="result-card">
      <div class="result-teams">
        <div class="result-team">
          <div class="result-team-name">Doora Barefield</div>
          <div class="result-score">{formatScore(selectedMatch.score?.home)}</div>
        </div>
        <div class="result-middle">
          <div class="result-badge"
            class:win={result === 'W'}
            class:loss={result === 'L'}
            class:draw={result === 'D'}
          >{result}</div>
          <div class="result-date">{selectedMatch.date}</div>
          <div class="result-venue">{selectedMatch.venue || ''}</div>
        </div>
        <div class="result-team right">
          <div class="result-team-name">{selectedMatch.opposition}</div>
          <div class="result-score">{formatScore(selectedMatch.score?.away)}</div>
        </div>
      </div>
    </div>

    <div class="metrics-grid">
      <div class="metric">
        <div class="metric-label">Total score</div>
        <div class="metric-val">{formatScore(selectedMatch.score?.home)}</div>
        <div class="metric-sub">goals · points</div>
      </div>
      <div class="metric">
        <div class="metric-label">Shooting acc.</div>
        <div class="metric-val">{shootingAcc !== null ? shootingAcc + '%' : '—'}</div>
        <div class="metric-sub">{totalShots} attempts</div>
      </div>
      <div class="metric">
        <div class="metric-label">Tackles</div>
        <div class="metric-val">{teamStats['Tackle'] || 0}</div>
        <div class="metric-sub">total</div>
      </div>
      <div class="metric">
        <div class="metric-label">Turnovers won</div>
        <div class="metric-val">{teamStats['Turnover Won'] || 0}</div>
        <div class="metric-sub">total</div>
      </div>
    </div>

    {#if topScorer || topTackler}
      <div class="performers-row">
        {#if topScorer}
          <div class="performer-card">
            <div class="performer-label">Top scorer</div>
            <div class="performer-name">{topScorer.name}</div>
            <div class="performer-val">{topScorer.score} pts</div>
          </div>
        {/if}
        {#if topTackler}
          <div class="performer-card">
            <div class="performer-label">Most tackles</div>
            <div class="performer-name">{topTackler.name}</div>
            <div class="performer-val">{topTackler.count} tackles</div>
          </div>
        {/if}
      </div>
    {/if}

    <!-- PITCH MAP -->
    <div class="pitch-section">
      <div class="pitch-section-header">
        <div class="section-label">Pitch map</div>
        <div class="filter-pills">
          {#each filters as f}
            <button
              class="filter-pill"
              class:active={activeFilter === f}
              on:click={() => activeFilter = f}
            >{f}</button>
          {/each}
        </div>
      </div>

      <!-- PERIOD FILTER -->
      <div class="period-filter">
        {#each periods as p}
          <button
            class="period-pill"
            class:active={activePeriod === p}
            on:click={() => activePeriod = p}
          >{p}</button>
        {/each}
      </div>

      <div class="pitch-legend">
        {#if activeFilter === 'Shots' || activeFilter === 'All'}
          <span class="legend-item"><span class="dot" style="background:#2d7a2d"></span>Score</span>
          <span class="legend-item"><span class="dot" style="background:#e53935"></span>Wide</span>
        {/if}
        {#if activeFilter === 'Tackles' || activeFilter === 'All'}
          <span class="legend-item"><span class="dot" style="background:#1565c0"></span>Tackle</span>
        {/if}
        {#if activeFilter === 'Turnovers' || activeFilter === 'All'}
          <span class="legend-item"><span class="dot" style="background:#2d7a2d"></span>TO Won</span>
          <span class="legend-item"><span class="dot" style="background:#e53935"></span>TO Lost</span>
        {/if}
        {#if activeFilter === 'Frees' || activeFilter === 'All'}
          <span class="legend-item"><span class="dot" style="background:#f57c00"></span>Free Won</span>
        {/if}
        {#if customFilters.includes(activeFilter)}
          <span class="legend-item"><span class="dot" style="background:#7B1FA2"></span>{activeFilter}</span>
        {/if}
      </div>

      <svg class="pitch-svg" viewBox="0 0 500 320" xmlns="http://www.w3.org/2000/svg">
        <!-- Pitch background -->
        <rect width="500" height="320" fill="#2d7a2d" rx="6"/>
        <!-- Stripes -->
        {#each [0,1,2,3,4,5,6] as i}
          <rect x={i*72} y="0" width="36" height="320" fill="rgba(0,0,0,0.04)"/>
        {/each}
        <!-- DB end tint -->
        <rect x="0" y="0" width="250" height="320" fill="rgba(107,27,43,0.12)" rx="6"/>
        <!-- Pitch outline -->
        <rect x="6" y="6" width="488" height="308" fill="none" stroke="white" stroke-width="2" opacity="0.8"/>
        <!-- Halfway line -->
        <line x1="250" y1="6" x2="250" y2="314" stroke="white" stroke-width="2" opacity="0.8"/>
        <!-- Centre circle -->
        <circle cx="250" cy="160" r="40" fill="none" stroke="white" stroke-width="1.5" opacity="0.6"/>
        <circle cx="250" cy="160" r="3" fill="white" opacity="0.6"/>
        <!-- Left 21m -->
        <rect x="6" y="90" width="65" height="140" fill="none" stroke="white" stroke-width="1.5" opacity="0.7"/>
        <rect x="6" y="118" width="28" height="84" fill="none" stroke="white" stroke-width="1.5" opacity="0.7"/>
        <rect x="6" y="138" width="8" height="44" fill="rgba(255,255,255,0.15)" stroke="white" stroke-width="1.5" opacity="0.8"/>
        <!-- Right 21m -->
        <rect x="429" y="90" width="65" height="140" fill="none" stroke="white" stroke-width="1.5" opacity="0.7"/>
        <rect x="466" y="118" width="28" height="84" fill="none" stroke="white" stroke-width="1.5" opacity="0.7"/>
        <rect x="486" y="138" width="8" height="44" fill="rgba(255,255,255,0.15)" stroke="white" stroke-width="1.5" opacity="0.8"/>
        <!-- 45m lines -->
        <line x1="120" y1="6" x2="120" y2="314" stroke="white" stroke-width="1" stroke-dasharray="4,4" opacity="0.4"/>
        <line x1="380" y1="6" x2="380" y2="314" stroke="white" stroke-width="1" stroke-dasharray="4,4" opacity="0.4"/>
        <!-- Penalty spots -->
        <circle cx="90" cy="160" r="3" fill="white" opacity="0.6"/>
        <circle cx="410" cy="160" r="3" fill="white" opacity="0.6"/>
        <!-- End labels -->
        <text x="125" y="22" text-anchor="middle" fill="white" font-size="11" font-weight="bold" opacity="0.9">DB END</text>
        <text x="375" y="22" text-anchor="middle" fill="white" font-size="11" font-weight="bold" opacity="0.9">{selectedMatch.opposition.slice(0,10).toUpperCase()} END</text>

        {#if filteredEvents.length === 0}
          <text x="250" y="168" text-anchor="middle" fill="white" font-size="13" opacity="0.5">
            No events with locations for this filter
          </text>
        {/if}

        {#each filteredEvents as event}
          <circle
            cx={event.x / 100 * 500}
            cy={event.y / 100 * 320}
            r="8"
            fill={getDotColor(event.stat)}
            stroke="white"
            stroke-width="1.5"
            opacity="0.9"
            style="cursor:pointer"
            on:mouseenter={e => showTooltip(e, event)}
            on:mouseleave={hideTooltip}
            on:touchstart={e => showTooltip(e, event)}
          />
          <text
            x={event.x / 100 * 500}
            y={event.y / 100 * 320 + 4}
            text-anchor="middle"
            fill="white"
            font-size="7"
            font-weight="bold"
            pointer-events="none"
          >{getDotLabel(event.stat)}</text>
        {/each}
      </svg>

      <div class="pitch-count">
        {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''} shown
        {#if activePeriod !== 'Full match'}· {activePeriod}{/if}
      </div>
    </div>

    <div class="card">
      <div class="section-label" style="margin-bottom:10px">Full stat breakdown</div>
      {#each Object.entries(teamStats) as [stat, val]}
        <div class="stat-row">
          <span class="stat-label">{stat}</span>
          <div class="stat-bar-wrap">
            <div class="stat-bar" style="width:{Math.min(100, (val / Math.max(1, Math.max(...Object.values(teamStats)))) * 100)}%"></div>
          </div>
          <span class="stat-val">{val}</span>
        </div>
      {/each}
    </div>

    <div class="card" style="padding:0; overflow:hidden;">
      <div style="padding:1rem 1rem 0.5rem;">
        <div class="section-label">Player breakdown</div>
      </div>
      <div class="table-wrap">
        <table class="stats-table">
          <thead>
            <tr>
              <th class="th-left">Player</th>
              <th>Pts</th>
              <th>Goals</th>
              <th>Wides</th>
              <th>Tackles</th>
              <th>TO Won</th>
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
                  <td>{s['Point'] || 0}</td>
                  <td>{s['Goal'] || 0}</td>
                  <td>{s['Wide'] || 0}</td>
                  <td>{s['Tackle'] || 0}</td>
                  <td>{s['Turnover Won'] || 0}</td>
                </tr>
              {/if}
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    {#if selectedMatch.notes}
      <div class="card">
        <div class="section-label" style="margin-bottom:8px">Match notes</div>
        <p class="notes-text">{selectedMatch.notes}</p>
      </div>
    {/if}

  {/if}
</div>

{#if tooltip}
  <div class="tooltip" style="left:{tooltip.x + 12}px; top:{tooltip.y - 10}px;">
    {tooltip.text}
  </div>
{/if}

<style>
  .screen { display: flex; flex-direction: column; gap: 12px; padding-bottom: 2rem; }
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1rem; }
  .selector-row { display: flex; gap: 12px; flex-wrap: wrap; }
  .field-group { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 200px; }
  .field-group label { font-size: 12px; font-weight: 600; color: var(--text-2); }
  .field-group select { padding: 12px 12px; border: 1.5px solid var(--input-border); border-radius: 10px; font-size: 16px; font-family: inherit; background: var(--surface); color: var(--text); width: 100%; min-height: 46px; }
  .field-group select:focus { outline: none; border-color: #6B1B2B; }
  .empty-state { text-align: center; padding: 3rem 1rem; color: var(--text-faint); }
  .empty-icon { font-size: 36px; margin-bottom: 0.75rem; }
  .empty-title { font-size: 16px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; }
  .empty-sub { font-size: 13px; }
  .result-card { background: #1a1a1a; border-radius: 14px; padding: 1.25rem; color: white; }
  .result-teams { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 12px; }
  .result-team.right { text-align: right; }
  .result-team-name { font-size: 13px; opacity: 0.7; margin-bottom: 4px; }
  .result-score { font-size: 28px; font-weight: 700; }
  .result-middle { text-align: center; }
  .result-badge { width: 36px; height: 36px; border-radius: 50%; font-size: 14px; font-weight: 700; display: flex; align-items: center; justify-content: center; margin: 0 auto 6px; }
  .result-badge.win { background: #2d7a2d; }
  .result-badge.loss { background: #c62828; }
  .result-badge.draw { background: #555; }
  .result-date { font-size: 12px; opacity: 0.6; }
  .result-venue { font-size: 11px; opacity: 0.4; margin-top: 2px; }
  .metrics-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .metric { background: var(--surface-2); border-radius: 10px; padding: 0.875rem 1rem; }
  .metric-label { font-size: 11px; font-weight: 600; color: var(--text-faint); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
  .metric-val { font-size: 24px; font-weight: 700; color: var(--text); }
  .metric-sub { font-size: 11px; color: var(--text-faint); margin-top: 2px; }
  .performers-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .performer-card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 0.875rem 1rem; border-left: 3px solid #6B1B2B; }
  .performer-label { font-size: 11px; color: var(--text-faint); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
  .performer-name { font-size: 15px; font-weight: 700; color: var(--text); }
  .performer-val { font-size: 13px; color: #6B1B2B; font-weight: 600; margin-top: 2px; }
  .pitch-section { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1rem; }
  .pitch-section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 8px; }
  .section-label { font-size: 11px; font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; color: var(--text-faint); }
  .filter-pills { display: flex; gap: 6px; flex-wrap: wrap; }
  .filter-pill { padding: 8px 14px; border-radius: 20px; border: 1px solid var(--input-border); background: none; font-size: 13px; color: var(--text-muted); cursor: pointer; font-family: inherit; transition: all 0.15s; min-height: 36px; }
  .filter-pill.active { background: #6B1B2B; color: white; border-color: #6B1B2B; font-weight: 600; }
  .period-filter { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 0.75rem; }
  .period-pill { padding: 7px 12px; border-radius: 20px; border: 1px solid var(--input-border); background: none; font-size: 12px; color: var(--text-muted); cursor: pointer; font-family: inherit; transition: all 0.15s; min-height: 34px; }
  .period-pill.active { background: var(--text); color: var(--bg); border-color: var(--text); font-weight: 600; }
  .pitch-legend { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
  .legend-item { display: flex; align-items: center; gap: 5px; font-size: 12px; color: var(--text-muted); }
  .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
  .pitch-svg { width: 100%; height: auto; display: block; border-radius: 6px; }
  .pitch-count { font-size: 11px; color: var(--text-faint); text-align: right; margin-top: 6px; }
  .stat-row { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px solid var(--divider-faint); }
  .stat-row:last-child { border-bottom: none; }
  .stat-label { font-size: 13px; color: var(--text-2); min-width: 130px; }
  .stat-bar-wrap { flex: 1; height: 6px; background: var(--divider); border-radius: 3px; overflow: hidden; }
  .stat-bar { height: 100%; background: #6B1B2B; border-radius: 3px; }
  .stat-val { font-size: 13px; font-weight: 700; color: var(--text); min-width: 24px; text-align: right; }
  .table-wrap { width: 100%; overflow-x: auto; }
  .stats-table { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 360px; }
  .stats-table thead { background: var(--surface-2); }
  .stats-table th { padding: 8px 10px; font-size: 11px; font-weight: 600; color: var(--text-faint); text-transform: uppercase; letter-spacing: 0.05em; text-align: center; border-bottom: 1px solid var(--divider); }
  .th-left { text-align: left; padding-left: 1rem; }
  .stats-table td { padding: 8px 10px; text-align: center; border-bottom: 1px solid var(--divider-faint); color: var(--text); }
  .stats-table tr:last-child td { border-bottom: none; }
  .td-left { text-align: left; padding-left: 1rem; font-weight: 600; white-space: nowrap; }
  .num-badge { display: inline-block; font-size: 11px; background: #6B1B2B; color: white; border-radius: 4px; padding: 1px 5px; font-weight: 600; margin-right: 4px; }
  .notes-text { font-size: 14px; color: var(--text-2); line-height: 1.6; }
  .tooltip { position: fixed; background: #1a1a1a; color: white; padding: 6px 10px; border-radius: 6px; font-size: 12px; pointer-events: none; z-index: 300; white-space: nowrap; }
  @media (min-width: 600px) { .metrics-grid { grid-template-columns: repeat(4, 1fr); } }
  @media (max-width: 480px) { .result-score { font-size: 22px; } .performers-row { grid-template-columns: 1fr; } }
</style>