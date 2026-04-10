<script>
  import { onMount } from 'svelte'
  import { loadMatches, loadSquad } from './db.js'
  import { Chart, registerables } from 'chart.js'

  Chart.register(...registerables)

  let matches = $state([])
  let squadNames = $state(new Set())
  let selectedPlayerName = $state(null)
  let compareMode = $state(false)
  let matchA = $state(null)
  let matchB = $state(null)
  let chartInstance = null
  let canvas = $state()

  onMount(async () => {
    const [loadedMatches, squad] = await Promise.all([loadMatches(), loadSquad()])
    matches = loadedMatches.sort((a, b) => new Date(b.date) - new Date(a.date))
    squadNames = new Set((squad || []).map(p => p.name?.trim()).filter(Boolean))
  })

  let allPlayers = $derived((() => {
    const map = {}
    matches.forEach(m => {
      ;(m.players || []).forEach(p => {
        const name = p.name?.trim()
        if (!name) return
        if (!map[name]) map[name] = { ...p }
      })
    })
    return Object.values(map)
      .filter(p => squadNames.has(p.name?.trim()))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  })())

  let selectedPlayer = $derived(allPlayers.find(p => p.name === selectedPlayerName) || null)

  let playerStatKeys = $derived((() => {
    const keys = new Set([
      'Point','Goal','Wide','Tackle','Block',
      'Turnover Won','Turnover Lost','Free Won'
    ])
    matches.forEach(m => {
      ;(m.customStats || []).forEach(s => keys.add(s))
    })
    return [...keys]
  })())

  function getPlayerIdInMatch(match, name) {
    const p = (match.players || []).find(p => p.name?.trim() === name?.trim())
    return p ? p.id : null
  }

  let playerMatches = $derived(matches.filter(m =>
    (m.players || []).some(p => p.name?.trim() === selectedPlayerName?.trim())
  ))

  let aggregateStats = $derived((() => {
    if (!selectedPlayerName) return {}
    const agg = {}
    playerStatKeys.forEach(k => (agg[k] = 0))
    playerMatches.forEach(m => {
      const id = getPlayerIdInMatch(m, selectedPlayerName)
      if (id === null) return
      const s = m.stats?.[id] || {}
      playerStatKeys.forEach(k => (agg[k] += s[k] || 0))
    })
    return agg
  })())

  let perMatchStats = $derived(playerMatches.map(m => {
    const id = getPlayerIdInMatch(m, selectedPlayerName)
    return {
      match: m,
      stats: id !== null ? (m.stats?.[id] || {}) : {}
    }
  }))

  let compareA = $derived((() => {
    if (!matchA) return {}
    const id = getPlayerIdInMatch(matchA, selectedPlayerName)
    return id !== null ? (matchA.stats?.[id] || {}) : {}
  })())

  let compareB = $derived((() => {
    if (!matchB) return {}
    const id = getPlayerIdInMatch(matchB, selectedPlayerName)
    return id !== null ? (matchB.stats?.[id] || {}) : {}
  })())

  let shootingAcc = $derived((() => {
    if (!selectedPlayerName) return null
    const scores = (aggregateStats['Point'] || 0) + (aggregateStats['Goal'] || 0)
    const wides = aggregateStats['Wide'] || 0
    const total = scores + wides
    if (total === 0) return null
    return Math.round((scores / total) * 100)
  })())

  $effect(() => {
    if (canvas && selectedPlayerName && playerMatches.length > 0 && !compareMode) {
      buildChart()
    }
  })

  function buildChart() {
    if (chartInstance) { chartInstance.destroy(); chartInstance = null }
    if (!canvas || playerMatches.length === 0) return
    const labels = [...playerMatches].reverse().map(m => `vs ${m.opposition}`)
    const points = [...playerMatches].reverse().map(m => {
      const id = getPlayerIdInMatch(m, selectedPlayerName)
      if (id === null) return 0
      const s = m.stats?.[id] || {}
      return (s['Point'] || 0) + (s['Goal'] || 0) * 3
    })
    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#5A8A00'
    const primaryRgb = getComputedStyle(document.documentElement).getPropertyValue('--primary-rgb').trim() || '90, 138, 0'
    chartInstance = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Score contribution',
          data: points,
          borderColor: primaryColor,
          backgroundColor: `rgba(${primaryRgb}, 0.08)`,
          borderWidth: 2,
          pointBackgroundColor: primaryColor,
          pointRadius: 5,
          tension: 0.3,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1 },
            grid: { color: '#f0f0f0' }
          },
          x: {
            grid: { display: false },
            ticks: { font: { size: 11 } }
          }
        }
      }
    })
  }

  function formatScore(goals, points) {
    return `${goals}-${String(points).padStart(2, '0')}`
  }
</script>

<div class="screen">

  <!-- PLAYER SELECTOR -->
  <div class="selector-row">
    <div class="field-group">
      <label>Select player</label>
      <select bind:value={selectedPlayerName}>
        <option value={null}>— Pick a player —</option>
        {#each allPlayers as p}
          <option value={p.name}>{p.name}</option>
        {/each}
      </select>
    </div>
    {#if selectedPlayerName && playerMatches.length >= 2}
      <div class="field-group">
        <label>&nbsp;</label>
        <button
          class="compare-btn"
          class:active={compareMode}
          onclick={() => compareMode = !compareMode}
        >{#if compareMode}<svg style="width:14px;height:14px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Exit compare{:else}<svg style="width:14px;height:14px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg> Compare matches{/if}</button>
      </div>
    {/if}
  </div>

  <!-- EMPTY STATES -->
  {#if !selectedPlayerName}
    <div class="empty-state">
      <div class="empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      </div>
      <div class="empty-title">No player selected</div>
      <div class="empty-sub">Pick a player above to see their stats</div>
    </div>

  {:else if playerMatches.length === 0}
    <div class="empty-state">
      <div class="empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
          <rect x="9" y="3" width="6" height="4" rx="1"/>
        </svg>
      </div>
      <div class="empty-title">No matches found</div>
      <div class="empty-sub">This player hasn't appeared in any saved matches yet</div>
    </div>

  {:else if compareMode}
    <!-- COMPARE MODE -->
    <div class="card">
      <div class="section-label">Choose two matches to compare</div>
      <div class="compare-selects">
        <div class="field-group">
          <label>Match A</label>
          <select bind:value={matchA}>
            <option value={null}>— Select —</option>
            {#each playerMatches as m}
              <option value={m}>vs {m.opposition} · {m.date}</option>
            {/each}
          </select>
        </div>
        <div class="compare-vs">vs</div>
        <div class="field-group">
          <label>Match B</label>
          <select bind:value={matchB}>
            <option value={null}>— Select —</option>
            {#each playerMatches as m}
              <option value={m}>vs {m.opposition} · {m.date}</option>
            {/each}
          </select>
        </div>
      </div>
    </div>

    {#if matchA && matchB}
      <div class="card">
        <div class="compare-header">
          <span class="compare-match-label">vs {matchA.opposition}</span>
          <span class="compare-stat-label">Stat</span>
          <span class="compare-match-label">vs {matchB.opposition}</span>
        </div>
        {#each playerStatKeys as stat}
          {@const a = compareA[stat] || 0}
          {@const b = compareB[stat] || 0}
          {@const diff = a - b}
          <div class="compare-row">
            <span class="compare-val" class:better={diff > 0} class:worse={diff < 0}>{a}</span>
            <span class="compare-key">{stat}</span>
            <span class="compare-val" class:better={diff < 0} class:worse={diff > 0}>{b}</span>
          </div>
        {/each}
      </div>
    {/if}

  {:else}
    <!-- NORMAL MODE -->

    <!-- PROFILE -->
    <div class="card profile-card">
      <div class="profile-avatar">
        {(selectedPlayer?.name || 'P').charAt(0).toUpperCase()}
      </div>
      <div class="profile-info">
        <div class="profile-name">{selectedPlayer?.name || 'Unnamed'}</div>
        <div class="profile-meta">
          {selectedPlayer?.position}
          · {playerMatches.length} match{playerMatches.length !== 1 ? 'es' : ''}
        </div>
      </div>
      <div class="profile-badge" class:good={shootingAcc !== null}>
        {shootingAcc !== null ? shootingAcc + '% acc.' : '—'}
      </div>
    </div>

    <!-- METRICS -->
    <div class="metrics-grid">
      <div class="metric">
        <div class="metric-label">Total score</div>
        <div class="metric-val">
          {formatScore(aggregateStats['Goal'] || 0, aggregateStats['Point'] || 0)}
        </div>
        <div class="metric-sub">goals · points</div>
      </div>
      <div class="metric">
        <div class="metric-label">Shooting acc.</div>
        <div class="metric-val">{shootingAcc !== null ? shootingAcc + '%' : '—'}</div>
        <div class="metric-sub">scores / attempts</div>
      </div>
      <div class="metric">
        <div class="metric-label">Tackles</div>
        <div class="metric-val">{aggregateStats['Tackle'] || 0}</div>
        <div class="metric-sub">
          avg {playerMatches.length > 0
            ? ((aggregateStats['Tackle'] || 0) / playerMatches.length).toFixed(1)
            : 0} / game
        </div>
      </div>
      <div class="metric">
        <div class="metric-label">Turnovers won</div>
        <div class="metric-val">{aggregateStats['Turnover Won'] || 0}</div>
        <div class="metric-sub">
          avg {playerMatches.length > 0
            ? ((aggregateStats['Turnover Won'] || 0) / playerMatches.length).toFixed(1)
            : 0} / game
        </div>
      </div>
    </div>

    <!-- CHART -->
    {#if playerMatches.length >= 2}
      <div class="card">
        <div class="section-label" style="margin-bottom:0.75rem">
          Score contribution per match
        </div>
        <div class="chart-wrap">
          <canvas bind:this={canvas}></canvas>
        </div>
      </div>
    {/if}

    <!-- PER MATCH TABLE -->
    <div class="card" style="padding:0; overflow:hidden;">
      <div style="padding:1rem 1rem 0.5rem;">
        <div class="section-label">Per match breakdown</div>
      </div>
      <div class="table-wrap">
        <table class="stats-table">
          <thead>
            <tr>
              <th class="th-left">Match</th>
              <th>Date</th>
              {#each playerStatKeys.slice(0, 5) as stat}
                <th>{stat.split(' ')[0]}</th>
              {/each}
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {#each perMatchStats as { match, stats: ms }}
              <tr>
                <td class="td-left">vs {match.opposition}</td>
                <td class="td-muted">{match.date}</td>
                {#each playerStatKeys.slice(0, 5) as stat}
                  <td>{ms[stat] || 0}</td>
                {/each}
                <td>
                  {#if match.score}
                    {@const ht = match.score.home.goals * 3 + match.score.home.points}
                    {@const at = match.score.away.goals * 3 + match.score.away.points}
                    <span
                      class="result-badge"
                      class:win={ht > at}
                      class:loss={ht < at}
                      class:draw={ht === at}
                    >
                      {ht > at ? 'W' : ht < at ? 'L' : 'D'}
                    </span>
                  {:else}
                    <span class="td-muted">—</span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <!-- ALL STAT TOTALS -->
    <div class="card">
      <div class="section-label" style="margin-bottom:10px">Season totals</div>
      {#each playerStatKeys as stat}
        {@const val = aggregateStats[stat] || 0}
        {@const max = Math.max(1, Math.max(...playerStatKeys.map(k => aggregateStats[k] || 0)))}
        <div class="stat-row">
          <span class="stat-label">{stat}</span>
          <div class="stat-bar-wrap">
            <div class="stat-bar" style="width:{Math.min(100, (val / max) * 100)}%"></div>
          </div>
          <span class="stat-val">{val}</span>
        </div>
      {/each}
    </div>

  {/if}
</div>

<style>
  .screen { display: flex; flex-direction: column; gap: 12px; padding-bottom: 2rem; }
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1rem; }

  .selector-row { display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; }
  .field-group { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 180px; }
  .field-group label { font-size: 12px; font-weight: 600; color: var(--text-2); }
  .field-group select {
    padding: 12px 12px;
    border: 1.5px solid var(--input-border);
    border-radius: 10px;
    font-size: 16px;
    font-family: inherit;
    background: var(--surface);
    color: var(--text);
    width: 100%;
    min-height: 46px;
  }
  .field-group select:focus { outline: none; border-color: var(--primary); }

  .compare-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 12px 16px;
    border-radius: 10px;
    border: 1.5px solid var(--primary);
    background: none;
    color: var(--primary);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    width: 100%;
    font-family: inherit;
    transition: all 0.15s;
    min-height: 46px;
  }
  .compare-btn.active { background: var(--primary); color: white; }

  .empty-state { text-align: center; padding: 3rem 1rem; }
  .empty-icon { width: 48px; height: 48px; margin: 0 auto 1rem; color: var(--text-faint); }
  .empty-icon svg { width: 100%; height: 100%; }
  .empty-title { font-size: 16px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; }
  .empty-sub { font-size: 13px; color: var(--text-faint); }

  .profile-card { display: flex; align-items: center; gap: 1rem; }
  .profile-avatar {
    width: 52px; height: 52px; border-radius: 50%;
    background: var(--primary); color: white;
    display: flex; align-items: center; justify-content: center;
    font-size: 22px; font-weight: 700; flex-shrink: 0;
  }
  .profile-info { flex: 1; }
  .profile-name { font-size: 17px; font-weight: 700; color: var(--text); }
  .profile-meta { font-size: 13px; color: var(--text-muted); margin-top: 2px; }
  .profile-badge {
    padding: 4px 12px; border-radius: 20px;
    font-size: 13px; font-weight: 600;
    background: var(--surface-2); color: var(--text-muted); white-space: nowrap;
  }
  .profile-badge.good { background: #e6f4ea; color: #2d7a2d; }

  .metrics-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .metric { background: var(--surface-2); border-radius: 10px; padding: 0.875rem 1rem; }
  .metric-label { font-size: 11px; font-weight: 600; color: var(--text-faint); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
  .metric-val { font-size: 24px; font-weight: 700; color: var(--text); }
  .metric-sub { font-size: 11px; color: var(--text-faint); margin-top: 2px; }

  .chart-wrap { height: 200px; position: relative; }

  .table-wrap { width: 100%; overflow-x: auto; }
  .stats-table { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 400px; }
  .stats-table thead { background: var(--surface-2); }
  .stats-table th { padding: 8px 10px; font-size: 11px; font-weight: 600; color: var(--text-faint); text-transform: uppercase; letter-spacing: 0.05em; text-align: center; border-bottom: 1px solid var(--divider); }
  .th-left { text-align: left; padding-left: 1rem; }
  .stats-table td { padding: 8px 10px; text-align: center; border-bottom: 1px solid var(--divider-faint); font-size: 13px; color: var(--text); }
  .stats-table tr:last-child td { border-bottom: none; }
  .td-left { text-align: left; padding-left: 1rem; font-weight: 600; white-space: nowrap; }
  .td-muted { color: var(--text-faint); font-size: 12px; }
  .result-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; }
  .result-badge.win { background: #e6f4ea; color: #2d7a2d; }
  .result-badge.loss { background: #fce8e8; color: #c62828; }
  .result-badge.draw { background: var(--surface-2); color: var(--text-muted); }

  .section-label { font-size: 11px; font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; color: var(--text-faint); }
  .stat-row { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px solid var(--divider-faint); }
  .stat-row:last-child { border-bottom: none; }
  .stat-label { font-size: 13px; color: var(--text-2); min-width: 130px; }
  .stat-bar-wrap { flex: 1; height: 6px; background: var(--divider); border-radius: 3px; overflow: hidden; }
  .stat-bar { height: 100%; background: var(--primary); border-radius: 3px; transition: width 0.4s ease; }
  .stat-val { font-size: 13px; font-weight: 700; color: var(--text); min-width: 24px; text-align: right; }

  .compare-selects { display: grid; grid-template-columns: 1fr auto 1fr; gap: 10px; align-items: center; margin-top: 8px; }
  .compare-vs { font-size: 13px; color: var(--text-faint); text-align: center; font-weight: 600; }
  .compare-header { display: grid; grid-template-columns: 1fr 1fr 1fr; text-align: center; padding: 8px 0; border-bottom: 1px solid var(--divider); margin-bottom: 4px; }
  .compare-match-label { font-size: 12px; font-weight: 700; color: var(--primary); }
  .compare-stat-label { font-size: 11px; color: var(--text-faint); text-transform: uppercase; letter-spacing: 0.05em; }
  .compare-row { display: grid; grid-template-columns: 1fr 1fr 1fr; text-align: center; padding: 7px 0; border-bottom: 1px solid var(--divider-faint); align-items: center; }
  .compare-row:last-child { border-bottom: none; }
  .compare-key { font-size: 12px; color: var(--text-muted); }
  .compare-val { font-size: 16px; font-weight: 700; color: var(--text); }
  .compare-val.better { color: #2d7a2d; }
  .compare-val.worse { color: #c62828; }

  @media (min-width: 600px) {
    .metrics-grid { grid-template-columns: repeat(4, 1fr); }
  }
  @media (max-width: 480px) {
    .compare-selects { grid-template-columns: 1fr; }
    .compare-vs { display: none; }
  }
</style>