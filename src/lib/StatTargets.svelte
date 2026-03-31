<script>
  import { onMount } from 'svelte'
  import { loadMatches } from './db.js'

  let matches = []
  let targets = {}
  let saved = false
  let newCustomStat = ''
  let showAddStat = false

  const TARGETS_KEY = 'doora-team-targets'

  const trackableStats = [
    { key: 'Point', label: 'Points scored' },
    { key: 'Goal', label: 'Goals scored' },
    { key: 'Wide', label: 'Wides', lowerIsBetter: true },
    { key: 'Tackle', label: 'Tackles won' },
    { key: 'Block', label: 'Blocks' },
    { key: 'Turnover Won', label: 'Turnovers won' },
    { key: 'Turnover Lost', label: 'Turnovers lost', lowerIsBetter: true },
    { key: 'Free Won', label: 'Frees won' },
  ]

  let customTargetStats = []

  onMount(async () => {
    matches = await loadMatches()
    matches.sort((a, b) => new Date(b.date) - new Date(a.date))
    const stored = localStorage.getItem(TARGETS_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        targets = parsed.targets || {}
        customTargetStats = parsed.customStats || []
      } catch (e) {}
    }
  })

  $: allStats = [
    ...trackableStats,
    ...customTargetStats.map(s => ({ key: s, label: s, custom: true }))
  ]

  function getTeamTotal(stat, match) {
    return Object.values(match.stats || {}).reduce((sum, s) => sum + (s[stat] || 0), 0)
  }

  function getTeamAvg(stat) {
    if (matches.length === 0) return null
    const total = matches.reduce((sum, m) => sum + getTeamTotal(stat, m), 0)
    return (total / matches.length).toFixed(1)
  }

  function getLastMatchVal(stat) {
    if (matches.length === 0) return null
    return getTeamTotal(stat, matches[0])
  }

  function getRecentTrend(stat) {
    if (matches.length < 3) return null
    const recent = matches.slice(0, 3).map(m => getTeamTotal(stat, m))
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length
    const older = matches.slice(3, 6)
    if (older.length === 0) return null
    const olderAvg = older.map(m => getTeamTotal(stat, m)).reduce((a, b) => a + b, 0) / older.length
    if (avg > olderAvg * 1.1) return 'up'
    if (avg < olderAvg * 0.9) return 'down'
    return 'stable'
  }

  function getStatus(stat, lowerIsBetter) {
    const target = targets[stat]
    if (!target) return null
    const last = getLastMatchVal(stat)
    if (last === null) return null
    if (lowerIsBetter) {
      if (last <= target) return 'met'
      if (last <= target * 1.25) return 'close'
      return 'below'
    } else {
      if (last >= target) return 'met'
      if (last >= target * 0.75) return 'close'
      return 'below'
    }
  }

  function getProgressPct(stat, lowerIsBetter) {
    const last = getLastMatchVal(stat) ?? 0
    const target = targets[stat]
    if (!target) return 0
    if (lowerIsBetter) return Math.min(100, (target / Math.max(1, last)) * 100)
    return Math.min(100, (last / target) * 100)
  }

  function addCustomStat() {
    const trimmed = newCustomStat.trim()
    if (!trimmed || allStats.some(s => s.key === trimmed)) return
    customTargetStats = [...customTargetStats, trimmed]
    newCustomStat = ''
    showAddStat = false
  }

  function removeCustomStat(key) {
    customTargetStats = customTargetStats.filter(s => s !== key)
    delete targets[key]
    targets = targets
  }

  function saveTargets() {
    localStorage.setItem(TARGETS_KEY, JSON.stringify({
      targets,
      customStats: customTargetStats
    }))
    saved = true
    setTimeout(() => saved = false, 3000)
  }

  $: targetsSet = Object.values(targets).filter(v => v !== null && v !== '' && v > 0).length
  $: targetsMet = allStats.filter(s => getStatus(s.key, s.lowerIsBetter) === 'met').length
  $: statsWithTargets = allStats.filter(s => targets[s.key])
</script>

<div class="screen">

  <div class="page-header">
    <div>
      <h2>Team Targets</h2>
      <p>Set performance goals for the team and track how each match measures up</p>
    </div>
    <button class="save-btn" class:saved on:click={saveTargets}>
      {#if saved}<svg style="width:14px;height:14px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Saved{:else}Save Targets{/if}
    </button>
  </div>

  <!-- SUMMARY -->
  {#if targetsSet > 0 && matches.length > 0}
    <div class="summary-card">
      <div class="summary-item">
        <div class="summary-val">{targetsSet}</div>
        <div class="summary-label">Targets set</div>
      </div>
      <div class="summary-divider"></div>
      <div class="summary-item">
        <div class="summary-val met">{targetsMet}</div>
        <div class="summary-label">Met last match</div>
      </div>
      <div class="summary-divider"></div>
      <div class="summary-item">
        <div class="summary-val">{matches.length > 0 ? `vs ${matches[0].opposition}` : '—'}</div>
        <div class="summary-label">Last match</div>
      </div>
    </div>
  {/if}

  <!-- TARGETS TABLE -->
  <div class="card" style="padding:0; overflow:hidden;">
    <div style="padding:1rem 1rem 0.5rem; display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
      <div class="section-label">Team targets per match</div>
      {#if showAddStat}
        <div class="add-stat-wrap">
          <input
            bind:value={newCustomStat}
            placeholder="Stat name..."
            on:keydown={e => e.key === 'Enter' && addCustomStat()}
            autofocus
          />
          <button class="confirm-btn" on:click={addCustomStat}>Add</button>
          <button class="cancel-small" on:click={() => showAddStat = false}><svg style="width:14px;height:14px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
      {:else}
        <button class="add-stat-btn" on:click={() => showAddStat = true}>+ Custom stat</button>
      {/if}
    </div>

    <div class="targets-scroll">
    <div class="targets-header">
      <span>Stat</span>
      <span>Target</span>
      <span>Avg / game</span>
      <span>Last match</span>
      <span>Status</span>
    </div>

    {#each allStats as stat}
      <div class="target-row">
        <div class="target-stat-wrap">
          <span class="target-stat">{stat.label}</span>
          {#if stat.lowerIsBetter}
            <span class="lower-badge">lower = better</span>
          {/if}
          {#if stat.custom}
            <button class="remove-custom" on:click={() => removeCustomStat(stat.key)}><svg style="width:12px;height:12px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          {/if}
        </div>
        <span>
          <input
            class="target-input"
            type="number"
            min="0"
            max="999"
            placeholder="—"
            value={targets[stat.key] ?? ''}
            on:input={e => {
              targets[stat.key] = e.target.value === '' ? null : parseInt(e.target.value)
              targets = targets
            }}
          />
        </span>
        <span class="target-data">{getTeamAvg(stat.key) ?? '—'}</span>
        <span class="target-data">{getLastMatchVal(stat.key) ?? '—'}</span>
        <span>
          {#if getStatus(stat.key, stat.lowerIsBetter) === 'met'}
            <span class="status-badge met">Met</span>
          {:else if getStatus(stat.key, stat.lowerIsBetter) === 'close'}
            <span class="status-badge close">Close</span>
          {:else if getStatus(stat.key, stat.lowerIsBetter) === 'below'}
            <span class="status-badge below">Below</span>
          {:else}
            <span class="target-data">—</span>
          {/if}
        </span>
      </div>
    {/each}
    </div><!-- end targets-scroll -->
  </div>

  <!-- PROGRESS BARS -->
  {#if statsWithTargets.length > 0 && matches.length > 0}
    <div class="card">
      <div class="section-label" style="margin-bottom:12px">Last match vs target</div>
      {#each statsWithTargets as stat}
        <div class="progress-row">
          <div class="progress-label">
            <span>{stat.label}</span>
            <span class="progress-nums">
              {getLastMatchVal(stat.key) ?? 0} / {targets[stat.key]}
            </span>
          </div>
          <div class="progress-bar-wrap">
            <div
              class="progress-bar"
              class:met={getStatus(stat.key, stat.lowerIsBetter) === 'met'}
              class:close={getStatus(stat.key, stat.lowerIsBetter) === 'close'}
              class:below={getStatus(stat.key, stat.lowerIsBetter) === 'below'}
              style="width:{getProgressPct(stat.key, stat.lowerIsBetter)}%"
            ></div>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- TREND OVER SEASON -->
  {#if matches.length >= 3 && statsWithTargets.length > 0}
    <div class="card">
      <div class="section-label" style="margin-bottom:10px">Season trend</div>
      {#each statsWithTargets as stat}
        {#if getRecentTrend(stat.key)}
          <div class="trend-row">
            <span class="trend-label">{stat.label}</span>
            <div class="trend-indicator {getRecentTrend(stat.key)}">
              {#if getRecentTrend(stat.key) === 'up'}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                Improving
              {:else if getRecentTrend(stat.key) === 'down'}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
                Declining
              {:else}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Stable
              {/if}
            </div>
          </div>
        {/if}
      {/each}
    </div>
  {/if}

  <button class="save-btn-full" class:saved on:click={saveTargets}>
    {#if saved}<svg style="width:16px;height:16px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Targets Saved!{:else}Save Targets{/if}
  </button>

</div>

<style>
  .screen { display: flex; flex-direction: column; gap: 12px; padding-bottom: 2rem; }
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1rem; }

  .page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
  .page-header h2 { font-size: 20px; font-weight: 700; color: var(--text); margin-bottom: 4px; }
  .page-header p { font-size: 13px; color: var(--text-muted); }

  .summary-card {
    background: #1a1a1a; border-radius: 14px; padding: 1.25rem;
    color: white; display: flex; align-items: center; justify-content: space-around;
  }
  .summary-item { text-align: center; }
  .summary-val { font-size: 26px; font-weight: 700; }
  .summary-val.met { color: #4caf50; }
  .summary-label { font-size: 11px; opacity: 0.5; margin-top: 2px; }
  .summary-divider { width: 1px; height: 40px; background: rgba(255,255,255,0.15); }

  .section-label { font-size: 11px; font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; color: var(--text-faint); }

  .targets-scroll { overflow-x: auto; }
  .targets-header {
    display: grid;
    grid-template-columns: 1fr 80px 80px 90px 70px;
    padding: 8px 1rem;
    background: var(--surface-2);
    font-size: 11px; font-weight: 600; color: var(--text-faint);
    text-transform: uppercase; letter-spacing: 0.05em;
    border-bottom: 1px solid var(--divider);
  }
  .target-row {
    display: grid;
    grid-template-columns: 1fr 80px 80px 90px 70px;
    align-items: center;
    padding: 9px 1rem;
    border-bottom: 1px solid var(--divider-faint);
    gap: 4px;
  }
  .target-row:last-child { border-bottom: none; }
  .target-stat-wrap { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .target-stat { font-size: 13px; font-weight: 500; color: var(--text); }
  .lower-badge { font-size: 10px; color: var(--text-faint); background: var(--surface-2); padding: 1px 6px; border-radius: 4px; }
  .remove-custom { background: none; border: none; color: var(--text-faint); font-size: 12px; cursor: pointer; padding: 2px; }
  .remove-custom:hover { color: #e53935; }
  .target-data { font-size: 13px; color: var(--text-muted); }
  .target-input {
    width: 64px; padding: 8px 6px;
    border: 1.5px solid var(--input-border); border-radius: 6px;
    font-size: 16px; font-family: inherit; text-align: center; background: var(--surface); color: var(--text);
    min-height: 38px;
  }
  .target-input:focus { outline: none; border-color: var(--primary); }

  .status-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; }
  .status-badge.met { background: #e6f4ea; color: #2d7a2d; }
  .status-badge.close { background: #fff3e0; color: #e65100; }
  .status-badge.below { background: #fce8e8; color: #c62828; }

  .progress-row { margin-bottom: 12px; }
  .progress-row:last-child { margin-bottom: 0; }
  .progress-label { display: flex; justify-content: space-between; font-size: 13px; color: var(--text-2); margin-bottom: 6px; }
  .progress-nums { font-weight: 600; color: var(--text-muted); }
  .progress-bar-wrap { height: 8px; background: var(--divider); border-radius: 4px; overflow: hidden; }
  .progress-bar { height: 100%; border-radius: 4px; transition: width 0.4s ease; background: #c62828; }
  .progress-bar.met { background: #2d7a2d; }
  .progress-bar.close { background: #e65100; }
  .progress-bar.below { background: #c62828; }

  .trend-row { display: flex; align-items: center; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid var(--divider-faint); }
  .trend-row:last-child { border-bottom: none; }
  .trend-label { font-size: 13px; color: var(--text-2); }
  .trend-indicator { display: flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 6px; }
  .trend-indicator svg { width: 14px; height: 14px; }
  .trend-indicator.up { background: #e6f4ea; color: #2d7a2d; }
  .trend-indicator.down { background: #fce8e8; color: #c62828; }
  .trend-indicator.stable { background: var(--surface-2); color: var(--text-muted); }

  .add-stat-btn { padding: 8px 14px; border-radius: 6px; border: 1.5px dashed var(--primary); background: none; color: var(--primary); font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; min-height: 38px; }
  .add-stat-wrap { display: flex; align-items: center; gap: 6px; }
  .add-stat-wrap input { padding: 8px 10px; border: 1.5px solid var(--primary); border-radius: 6px; font-size: 16px; font-family: inherit; outline: none; width: 150px; min-height: 38px; background: var(--surface); color: var(--text); }
  .confirm-btn { padding: 8px 12px; background: var(--primary); color: white; border: none; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; min-height: 38px; }
  .cancel-small { background: none; border: none; color: var(--text-faint); font-size: 18px; cursor: pointer; padding: 4px 8px; min-height: 38px; }

  .save-btn { display: inline-flex; align-items: center; gap: 6px; padding: 11px 20px; background: var(--primary); color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; transition: background 0.2s; flex-shrink: 0; min-height: 44px; }
  .save-btn.saved { background: #2d7a2d; }
  .save-btn:hover { background: var(--primary-hover); }
  .save-btn-full { display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 15px; background: var(--primary); color: white; border: none; border-radius: 10px; font-size: 16px; font-weight: 700; cursor: pointer; font-family: inherit; transition: background 0.2s; }
  .save-btn-full.saved { background: #2d7a2d; }
  .save-btn-full:hover { background: var(--primary-hover); }

  @media (max-width: 480px) {
    .targets-header, .target-row { grid-template-columns: 1fr 60px 60px 70px 60px; }
    .page-header { flex-direction: column; }
    .save-btn { width: 100%; }
  }
</style>