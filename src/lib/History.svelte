<script>
  import { onMount } from 'svelte'
  import { loadMatches } from './db.js'
  import { getDB } from './db.js'

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
    const db = await getDB()
    await db.delete('matches', id)
    matches = matches.filter(m => m.id !== id)
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
</script>

<div class="screen">

  {#if selectedMatch}
    <!-- MATCH DETAIL VIEW -->
    <!-- Print-only report header (hidden on screen) -->
    <div class="print-header">
      <div class="print-club">Doora Barefield GAA — Match Report</div>
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
          <div class="result-team-name">Doora Barefield</div>
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
              <th>Pts</th>
              <th>Goals</th>
              <th>Wides</th>
              <th>Tackles</th>
              <th>TO Won</th>
              <th>Frees</th>
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
                  <td>{s['Free Won'] || 0}</td>
                </tr>
              {/if}
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    {#if selectedMatch.customStats?.length > 0}
      <div class="card" style="padding:0; overflow:hidden;">
        <div style="padding:1rem 1rem 0.5rem;">
          <div class="section-label">Custom stats</div>
        </div>
        <div class="table-wrap">
          <table class="stats-table">
            <thead>
              <tr>
                <th class="th-left">Player</th>
                {#each selectedMatch.customStats as stat}
                  <th>{stat}</th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#each (selectedMatch.players || []) as player}
                {@const s = selectedMatch.stats?.[player.id] || {}}
                {@const hasCustom = selectedMatch.customStats.some(stat => (s[stat] || 0) > 0)}
                {#if hasCustom}
                  <tr>
                    <td class="td-left">
                      <span class="num-badge">#{player.number}</span>
                      {player.name || 'Player'}
                    </td>
                    {#each selectedMatch.customStats as stat}
                      <td>{s[stat] || 0}</td>
                    {/each}
                  </tr>
                {/if}
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}

    {#if selectedMatch.subs_log?.length > 0}
      <div class="card">
        <div class="section-label" style="margin-bottom:8px">Substitutions</div>
        {#each selectedMatch.subs_log as sub}
          <div class="sub-row">
            <span class="sub-time">{sub.time}</span>
            <span class="sub-detail">⬇ {sub.off} → ⬆ {sub.on}</span>
            <span class="sub-period">{sub.period}</span>
          </div>
        {/each}
      </div>
    {/if}

    {#if selectedMatch.notes}
      <div class="card">
        <div class="section-label" style="margin-bottom:8px">Match notes</div>
        <p class="notes-text">{selectedMatch.notes}</p>
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
        <div class="empty-icon">📭</div>
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
                  <div class="match-score-label">DB</div>
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
              >✕</button>
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
  .search-input:focus { outline: none; border-color: #6B1B2B; }
  .filter-pills { display: flex; gap: 6px; flex-wrap: wrap; }
  .filter-pill { padding: 8px 16px; border-radius: 20px; border: 1px solid var(--input-border); background: none; font-size: 13px; color: var(--text-muted); cursor: pointer; font-family: inherit; font-weight: 600; transition: all 0.15s; min-height: 38px; }
  .filter-pill.active { background: #6B1B2B; color: white; border-color: #6B1B2B; }

  .match-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1rem 1.25rem; cursor: pointer; position: relative; transition: all 0.15s; }
  .match-card:hover { border-color: #6B1B2B; box-shadow: 0 2px 8px rgba(107,27,43,0.08); }
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
  .top-scorer-val { color: #6B1B2B; font-weight: 600; margin-left: 4px; }

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
  .back-btn { background: none; border: none; color: #6B1B2B; font-size: 14px; font-weight: 600; cursor: pointer; padding: 0; font-family: inherit; }
  .print-btn {
    display: flex; align-items: center; gap: 6px;
    padding: 8px 14px; border-radius: 8px;
    border: 1.5px solid #6B1B2B; background: none; color: #6B1B2B;
    font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit;
    transition: all 0.15s; white-space: nowrap;
  }
  .print-btn:hover { background: #6B1B2B; color: white; }
  .detail-title { font-size: 20px; font-weight: 700; color: var(--text); }
  .detail-meta { font-size: 13px; color: var(--text-muted); margin-top: 2px; }

  .print-header { display: none; }
  .print-club { font-size: 20px; font-weight: 700; color: #1a1a1a; }
  .print-fixture { font-size: 14px; color: #555; margin-top: 4px; }

  @media print {
    :global(nav) { display: none !important; }
    :global([data-print-hide]) { display: none !important; }
    :global(main) { padding: 0 !important; max-width: 100% !important; }
    .print-header { display: block; padding-bottom: 1rem; margin-bottom: 1.5rem; border-bottom: 2px solid #1a1a1a; }
    .screen { gap: 16px; padding-bottom: 0; }
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
  .num-badge { display: inline-block; font-size: 11px; background: #6B1B2B; color: white; border-radius: 4px; padding: 1px 5px; font-weight: 600; margin-right: 4px; }

  .sub-row { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px solid var(--divider); font-size: 13px; }
  .sub-row:last-child { border-bottom: none; }
  .sub-time { font-weight: 700; color: #6B1B2B; min-width: 44px; }
  .sub-detail { flex: 1; color: var(--text-2); }
  .sub-period { font-size: 11px; color: var(--text-faint); }

  .notes-text { font-size: 14px; color: var(--text-2); line-height: 1.6; }

  .empty-state { text-align: center; padding: 3rem 1rem; }
  .empty-icon { font-size: 36px; margin-bottom: 0.75rem; }
  .empty-title { font-size: 16px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; }
  .empty-sub { font-size: 13px; color: var(--text-faint); }

  .section-label { font-size: 11px; font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; color: var(--text-faint); }

  @media (min-width: 600px) {
    .season-grid { grid-template-columns: repeat(6, 1fr); }
    .search-row { flex-direction: row; align-items: center; }
    .search-input { flex: 1; }
  }
  @media (max-width: 480px) {
    .result-score { font-size: 22px; }
  }
</style>