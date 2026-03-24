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
    <div class="detail-header">
      <button class="back-btn" on:click={() => selectedMatch = null}>← Back</button>
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

    <button class="delete-match-btn" on:click={async (e) => {
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
  .card { background: white; border: 1px solid #e5e5e5; border-radius: 12px; padding: 1rem; }

  .season-card { background: #1a1a1a; border-radius: 14px; padding: 1.25rem; color: white; }
  .season-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.5; margin-bottom: 1rem; }
  .season-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .season-stat { text-align: center; }
  .season-val { font-size: 26px; font-weight: 700; }
  .season-val.win { color: #4caf50; }
  .season-val.loss { color: #ef5350; }
  .season-label { font-size: 11px; opacity: 0.5; margin-top: 2px; }

  .search-row { display: flex; flex-direction: column; gap: 8px; }
  .search-input { width: 100%; padding: 13px 14px; border: 1.5px solid #e0e0e0; border-radius: 10px; font-size: 16px; font-family: inherit; background: white; color: #1a1a1a; min-height: 46px; }
  .search-input:focus { outline: none; border-color: #6B1B2B; }
  .filter-pills { display: flex; gap: 6px; flex-wrap: wrap; }
  .filter-pill { padding: 8px 16px; border-radius: 20px; border: 1px solid #e0e0e0; background: none; font-size: 13px; color: #666; cursor: pointer; font-family: inherit; font-weight: 600; transition: all 0.15s; min-height: 38px; }
  .filter-pill.active { background: #6B1B2B; color: white; border-color: #6B1B2B; }

  .match-card { background: white; border: 1px solid #e5e5e5; border-radius: 12px; padding: 1rem 1.25rem; cursor: pointer; position: relative; transition: all 0.15s; }
  .match-card:hover { border-color: #6B1B2B; box-shadow: 0 2px 8px rgba(107,27,43,0.08); }
  .match-card-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .match-card-left { display: flex; align-items: center; gap: 12px; flex: 1; }
  .match-opposition { font-size: 15px; font-weight: 700; color: #1a1a1a; }
  .match-meta { font-size: 12px; color: #aaa; margin-top: 2px; }
  .match-card-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
  .match-scores { display: flex; align-items: center; gap: 8px; }
  .match-score-block { text-align: center; }
  .match-score-label { font-size: 10px; color: #aaa; font-weight: 600; }
  .match-score-val { font-size: 16px; font-weight: 700; color: #1a1a1a; }
  .match-score-divider { font-size: 16px; color: #ddd; }
  .match-card-footer { margin-top: 8px; padding-top: 8px; border-top: 1px solid #f5f5f5; font-size: 12px; }
  .top-scorer-label { color: #aaa; }
  .top-scorer-val { color: #6B1B2B; font-weight: 600; margin-left: 4px; }

  .delete-btn {
    background: none;
    border: 1px solid #ddd;
    color: #ccc;
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
  .delete-btn:hover { border-color: #e53935; color: #e53935; background: #fff0f0; }

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
  .result-badge.draw { background: #f5f5f5; color: #888; }

  .detail-header { margin-bottom: 4px; }
  .back-btn { background: none; border: none; color: #6B1B2B; font-size: 14px; font-weight: 600; cursor: pointer; padding: 0; font-family: inherit; margin-bottom: 8px; }
  .detail-title { font-size: 20px; font-weight: 700; color: #1a1a1a; }
  .detail-meta { font-size: 13px; color: #888; margin-top: 2px; }

  .result-card { background: #1a1a1a; border-radius: 14px; padding: 1.25rem; color: white; }
  .result-teams { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 12px; }
  .result-team.right { text-align: right; }
  .result-team-name { font-size: 13px; opacity: 0.7; margin-bottom: 4px; }
  .result-score { font-size: 28px; font-weight: 700; }
  .result-middle { text-align: center; }
  .result-period { font-size: 11px; opacity: 0.4; margin-top: 4px; }

  .table-wrap { width: 100%; overflow-x: auto; }
  .stats-table { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 380px; }
  .stats-table thead { background: #f8f8f8; }
  .stats-table th { padding: 8px 10px; font-size: 11px; font-weight: 600; color: #aaa; text-transform: uppercase; letter-spacing: 0.05em; text-align: center; border-bottom: 1px solid #f0f0f0; }
  .th-left { text-align: left; padding-left: 1rem; }
  .stats-table td { padding: 8px 10px; text-align: center; border-bottom: 1px solid #f5f5f5; }
  .stats-table tr:last-child td { border-bottom: none; }
  .td-left { text-align: left; padding-left: 1rem; font-weight: 600; white-space: nowrap; }
  .num-badge { display: inline-block; font-size: 11px; background: #6B1B2B; color: white; border-radius: 4px; padding: 1px 5px; font-weight: 600; margin-right: 4px; }

  .sub-row { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px solid #f0f0f0; font-size: 13px; }
  .sub-row:last-child { border-bottom: none; }
  .sub-time { font-weight: 700; color: #6B1B2B; min-width: 44px; }
  .sub-detail { flex: 1; color: #333; }
  .sub-period { font-size: 11px; color: #aaa; }

  .notes-text { font-size: 14px; color: #555; line-height: 1.6; }

  .empty-state { text-align: center; padding: 3rem 1rem; }
  .empty-icon { font-size: 36px; margin-bottom: 0.75rem; }
  .empty-title { font-size: 16px; font-weight: 600; color: #888; margin-bottom: 4px; }
  .empty-sub { font-size: 13px; color: #aaa; }

  .section-label { font-size: 11px; font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; color: #aaa; }

  @media (min-width: 600px) {
    .season-grid { grid-template-columns: repeat(6, 1fr); }
    .search-row { flex-direction: row; align-items: center; }
    .search-input { flex: 1; }
  }
  @media (max-width: 480px) {
    .result-score { font-size: 22px; }
  }
</style>