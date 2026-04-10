<script>
  import { onMount, onDestroy } from 'svelte'
  import { supabase } from './supabase.js'

  const { session, onClose = () => {} } = $props()

  let matchData = $state(session.match_data || null)
  let channel = $state(null)
  let connected = $state(false)
  let lastUpdate = $state(null)

  let openSections = $state({ puckouts: true, conceded: true, players: false, subs: true })
  function toggleSection(k) { openSections[k] = !openSections[k] }

  onMount(() => {
    channel = supabase.channel(`live:${session.id}`)
      .on('broadcast', { event: 'match_update' }, ({ payload }) => {
        matchData = payload
        lastUpdate = new Date()
      })
      .subscribe((status) => {
        connected = status === 'SUBSCRIBED'
      })
  })

  onDestroy(() => {
    if (channel) supabase.removeChannel(channel)
  })

  function formatScore(s) {
    if (!s) return '0-00'
    return `${s.goals ?? 0}-${String(s.points ?? 0).padStart(2, '0')}`
  }
  function totalPts(s) {
    return (s?.goals ?? 0) * 3 + (s?.points ?? 0)
  }
  function formatTime(s) {
    if (s == null) return ''
    const m = Math.floor(s / 60), sec = s % 60
    return `${m}:${String(sec).padStart(2,'0')}`
  }

  let home = $derived(matchData?.score?.home)
  let away = $derived(matchData?.score?.away)
  let homePts = $derived(totalPts(home))
  let awayPts = $derived(totalPts(away))

  let topPlayers = $derived((() => {
    if (!matchData?.stats) return []
    const stats = matchData.stats
    const players = matchData.players || []
    return players
      .map(p => {
        const s = stats[p.id] || {}
        const total = Object.values(s).reduce((a, b) => a + b, 0)
        const pts = (s['Goal'] || 0) * 3 + (s['Point'] || 0)
        return { name: p.name, total, pts }
      })
      .filter(p => p.total > 0)
      .sort((a, b) => b.pts - a.pts || b.total - a.total)
      .slice(0, 5)
  })())

  let recentEvents = $derived((matchData?.events || []).slice(-5).reverse())

  // ── Puckout derived ──
  let puckouts = $derived(matchData?.puckouts || [])
  let puckoutWins = $derived(puckouts.filter(p => p.outcome === 'won').length)
  let puckoutLosses = $derived(puckouts.filter(p => p.outcome === 'lost').length)
  let puckoutWinPct = $derived(puckouts.length ? Math.round((puckoutWins / puckouts.length) * 100) : 0)

  let puckoutsByPlayer = $derived((() => {
    const map = {}
    puckouts.forEach(p => {
      const key = p.ourPlayer || 'Unknown'
      if (!map[key]) map[key] = { name: key, won: 0, lost: 0, lostTo: [], wonAgainst: [] }
      if (p.outcome === 'won') {
        map[key].won++
        if (p.oppPlayer) map[key].wonAgainst.push('#' + p.oppPlayer)
      } else {
        map[key].lost++
        if (p.oppPlayer) map[key].lostTo.push('#' + p.oppPlayer)
      }
    })
    return Object.values(map).sort((a, b) => (b.won + b.lost) - (a.won + a.lost))
  })())

  let puckoutByOppPlayer = $derived((() => {
    const map = {}
    puckouts.filter(p => p.outcome === 'lost' && p.oppPlayer).forEach(p => {
      const k = '#' + p.oppPlayer
      if (!map[k]) map[k] = { num: k, count: 0, beatPlayers: [] }
      map[k].count++
      if (p.ourPlayer) map[k].beatPlayers.push(p.ourPlayer)
    })
    return Object.values(map).sort((a, b) => b.count - a.count)
  })())

  let bestPuckoutPlayer = $derived(puckoutsByPlayer.length
    ? puckoutsByPlayer.reduce((best, p) => (p.won > (best?.won ?? -1) ? p : best), null)
    : null)

  // ── Conceded derived ──
  let oppScores = $derived(matchData?.oppScores || [])
  let concededGoals = $derived(oppScores.filter(s => s.type === 'goal').length)
  let concededPoints = $derived(oppScores.filter(s => s.type === 'point').length)

  let concededByMarker = $derived((() => {
    const map = {}
    oppScores.forEach(s => {
      const key = s.marker || 'Unknown'
      if (!map[key]) map[key] = { marker: key, goals: 0, points: 0 }
      if (s.type === 'goal') map[key].goals++
      else map[key].points++
    })
    return Object.values(map).sort((a, b) => (b.goals * 3 + b.points) - (a.goals * 3 + a.points))
  })())

  let concededByOppPlayer = $derived((() => {
    const map = {}
    oppScores.forEach(s => {
      const k = s.oppPlayerNum ? '#' + s.oppPlayerNum : 'Unknown'
      if (!map[k]) map[k] = { num: k, goals: 0, points: 0 }
      if (s.type === 'goal') map[k].goals++
      else map[k].points++
    })
    return Object.values(map).sort((a, b) => (b.goals * 3 + b.points) - (a.goals * 3 + a.points))
  })())

  // ── Player stats derived ──
  let playerStatsRows = $derived((() => {
    if (!matchData?.stats || !matchData?.players) return []
    const stats = matchData.stats
    const players = matchData.players
    const allStats = new Set()
    Object.values(stats).forEach(s => Object.keys(s).forEach(k => allStats.add(k)))
    const statKeys = [...allStats]
    return players
      .map(p => ({ name: p.name, s: stats[p.id] || {} }))
      .filter(p => Object.values(p.s).some(v => v > 0))
      .sort((a, b) => {
        const ta = Object.values(a.s).reduce((x,y) => x+y, 0)
        const tb = Object.values(b.s).reduce((x,y) => x+y, 0)
        return tb - ta
      })
      .map(p => ({ name: p.name, stats: statKeys.map(k => ({ k, v: p.s[k] || 0 })) }))
  })())

  let allStatKeys = $derived((() => {
    if (!matchData?.stats) return []
    const all = new Set()
    Object.values(matchData.stats).forEach(s => Object.keys(s).forEach(k => all.add(k)))
    return [...all]
  })())

  // ── Subs ──
  let subsLog = $derived(matchData?.subs_log || [])
</script>

<div class="viewer-wrap">
  <div class="viewer-header">
    <div class="live-badge">
      <span class="live-dot"></span>
      LIVE
    </div>
    <div class="viewer-meta">
      {matchData?.opposition ? `vs ${matchData.opposition}` : 'Match in progress'}
      {#if matchData?.period} · {matchData.period}{/if}
    </div>
    <button class="close-btn" onclick={onClose}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  </div>

  {#if !connected}
    <div class="connecting">Connecting to live feed…</div>
  {:else if !matchData}
    <div class="connecting">Waiting for match data…</div>
  {:else}
    <!-- Score -->
    <div class="scoreboard">
      <div class="score-side" class:winning={homePts > awayPts}>
        <div class="score-label">{matchData.teamName || 'Home'}</div>
        <div class="score-val">{formatScore(home)}</div>
      </div>
      <div class="score-divider">–</div>
      <div class="score-side" class:winning={awayPts > homePts}>
        <div class="score-label">{matchData.opposition || 'Away'}</div>
        <div class="score-val">{formatScore(away)}</div>
      </div>
    </div>

    <!-- Top performers -->
    {#if topPlayers.length > 0}
      <div class="section">
        <div class="section-title">Top performers</div>
        <div class="player-list">
          {#each topPlayers as p}
            <div class="player-row">
              <span class="player-name">{p.name}</span>
              <span class="player-pts">{p.pts > 0 ? `${Math.floor(p.pts/3)}-${String(p.pts % 3).padStart(2,'0')}` : ''}</span>
              <span class="player-total">{p.total} actions</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Recent events -->
    {#if recentEvents.length > 0}
      <div class="section">
        <div class="section-title">Recent events</div>
        <div class="event-list">
          {#each recentEvents as ev}
            <div class="event-row">
              <span class="event-time">{ev.time ?? '–'}'</span>
              <span class="event-stat">{ev.stat}</span>
              <span class="event-player">{(matchData.players || []).find(p => p.id === ev.playerId)?.name ?? ''}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- ── Puckouts accordion ── -->
    {#if puckouts.length > 0}
      <div class="accordion-card">
        <button class="accordion-header" onclick={() => toggleSection('puckouts')}>
          <div class="accordion-title">
            <span class="accordion-name">Puckouts</span>
            <span class="accordion-summary">
              <span class="badge-won">{puckoutWins}W</span>
              <span class="badge-lost">{puckoutLosses}L</span>
              <span class="badge-pct" class:pct-good={puckoutWinPct >= 60} class:pct-warn={puckoutWinPct >= 40 && puckoutWinPct < 60} class:pct-bad={puckoutWinPct < 40}>{puckoutWinPct}%</span>
            </span>
          </div>
          <span class="accordion-chevron">
            {#if openSections.puckouts}
              <svg style="width:16px;height:16px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>
            {:else}
              <svg style="width:16px;height:16px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            {/if}
          </span>
        </button>
        {#if openSections.puckouts}
          <div class="accordion-body">
            {#if bestPuckoutPlayer}
              <div class="standout-row">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                <span class="standout-text">{bestPuckoutPlayer.name} — {bestPuckoutPlayer.won} wins</span>
              </div>
            {/if}
            <div class="ht-sub-label">By player</div>
            {#each puckoutsByPlayer as row}
              <div class="ht-player-row">
                <span class="ht-player-name">{row.name}</span>
                <span class="ht-wl">
                  <span class="badge-won">{row.won}W</span>
                  <span class="badge-lost">{row.lost}L</span>
                </span>
                <div class="ht-matchup-lines">
                  {#each row.wonAgainst.slice(0,2) as opp}
                    <span class="matchup-won">Won vs {opp}</span>
                  {/each}
                  {#each row.lostTo.slice(0,2) as opp}
                    <span class="matchup-lost">Lost to {opp}</span>
                  {/each}
                </div>
              </div>
            {/each}
            {#if puckoutByOppPlayer.length > 0}
              <div class="ht-sub-label" style="margin-top:10px">Opposition winners</div>
              {#each puckoutByOppPlayer as opp}
                <div class="ht-player-row">
                  <span class="ht-player-name">{opp.num}</span>
                  <span class="badge-lost">{opp.count} won</span>
                  {#if opp.beatPlayers.length > 0}
                    <span class="matchup-info">Marking: {[...new Set(opp.beatPlayers)].join(', ')}</span>
                  {/if}
                </div>
              {/each}
            {/if}
          </div>
        {/if}
      </div>
    {/if}

    <!-- ── Scores Conceded accordion ── -->
    {#if oppScores.length > 0}
      <div class="accordion-card">
        <button class="accordion-header" onclick={() => toggleSection('conceded')}>
          <div class="accordion-title">
            <span class="accordion-name">Scores Conceded</span>
            <span class="accordion-summary">
              {#if concededGoals > 0}<span class="badge-goals">{concededGoals}G</span>{/if}
              <span class="badge-pts">{concededPoints}P</span>
            </span>
          </div>
          <span class="accordion-chevron">
            {#if openSections.conceded}
              <svg style="width:16px;height:16px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>
            {:else}
              <svg style="width:16px;height:16px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            {/if}
          </span>
        </button>
        {#if openSections.conceded}
          <div class="accordion-body">
            {#if concededByMarker.length > 0}
              <div class="ht-sub-label">By our marker</div>
              {#each concededByMarker as row}
                <div class="ht-player-row">
                  <span class="ht-player-name">{row.marker}</span>
                  <span class="ht-conceded-score">
                    {#if row.goals > 0}<span class="badge-goals">{row.goals}G</span>{/if}
                    <span class="badge-pts">{row.points}P</span>
                  </span>
                </div>
              {/each}
            {/if}
            {#if concededByOppPlayer.length > 0}
              <div class="ht-sub-label" style="margin-top:10px">By opposition player</div>
              {#each concededByOppPlayer as row}
                <div class="ht-player-row">
                  <span class="ht-player-name">{row.num}</span>
                  <span class="ht-conceded-score">
                    {#if row.goals > 0}<span class="badge-goals">{row.goals}G</span>{/if}
                    <span class="badge-pts">{row.points}P</span>
                  </span>
                </div>
              {/each}
            {/if}
          </div>
        {/if}
      </div>
    {/if}

    <!-- ── Player Stats accordion ── -->
    {#if playerStatsRows.length > 0}
      <div class="accordion-card">
        <button class="accordion-header" onclick={() => toggleSection('players')}>
          <div class="accordion-title">
            <span class="accordion-name">Player Stats</span>
            <span class="accordion-summary"><span class="badge-pts">{playerStatsRows.length} players</span></span>
          </div>
          <span class="accordion-chevron">
            {#if openSections.players}
              <svg style="width:16px;height:16px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>
            {:else}
              <svg style="width:16px;height:16px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            {/if}
          </span>
        </button>
        {#if openSections.players}
          <div class="accordion-body">
            <div class="stats-table">
              <div class="stats-table-head">
                <span class="st-name">Player</span>
                {#each allStatKeys as k}<span class="st-key">{k}</span>{/each}
              </div>
              {#each playerStatsRows as row}
                <div class="stats-table-row">
                  <span class="st-name">{row.name}</span>
                  {#each row.stats as cell}<span class="st-val" class:st-zero={cell.v === 0}>{cell.v || '–'}</span>{/each}
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}

    <!-- ── Substitutions accordion ── -->
    {#if subsLog.length > 0}
      <div class="accordion-card">
        <button class="accordion-header" onclick={() => toggleSection('subs')}>
          <div class="accordion-title">
            <span class="accordion-name">Substitutions</span>
            <span class="accordion-summary"><span class="badge-pts">{subsLog.length} made</span></span>
          </div>
          <span class="accordion-chevron">
            {#if openSections.subs}
              <svg style="width:16px;height:16px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>
            {:else}
              <svg style="width:16px;height:16px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            {/if}
          </span>
        </button>
        {#if openSections.subs}
          <div class="accordion-body">
            {#each subsLog as sub}
              <div class="sub-log-row">
                {#if sub.time != null}<span class="sub-time">{formatTime(sub.time)}</span>{/if}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
                <span class="sub-off">{sub.off}</span>
                <span class="sub-arrow">→</span>
                <span class="sub-on">{sub.on}</span>
                {#if sub.period}<span class="sub-period">{sub.period}</span>{/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    {#if lastUpdate}
      <div class="last-update">Updated {lastUpdate.toLocaleTimeString()}</div>
    {/if}
  {/if}
</div>

<style>
  .viewer-wrap {
    display: flex; flex-direction: column; gap: 12px;
  }

  .viewer-header {
    display: flex; align-items: center; gap: 10px;
  }
  .live-badge {
    display: inline-flex; align-items: center; gap: 6px;
    background: #e53935; color: white;
    font-size: 11px; font-weight: 800; letter-spacing: 0.08em;
    padding: 4px 10px; border-radius: 20px;
    flex-shrink: 0;
  }
  .live-dot {
    width: 7px; height: 7px; border-radius: 50%;
    background: white; animation: pulse 1.2s ease-in-out infinite;
  }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
  .viewer-meta { flex: 1; font-size: 13px; color: var(--text-muted); }
  .close-btn {
    width: 32px; height: 32px; border-radius: 8px;
    border: 1px solid var(--border); background: var(--surface-2);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; color: var(--text-muted);
  }
  .close-btn:hover { border-color: var(--border); color: var(--text); }

  .connecting { text-align: center; color: var(--text-faint); font-size: 13px; padding: 20px 0; }

  /* Scoreboard */
  .scoreboard {
    display: flex; align-items: center; justify-content: center; gap: 12px;
    background: #1a1a1a; border-radius: 14px; padding: 20px;
    color: white;
  }
  .score-side { text-align: center; flex: 1; }
  .score-label { font-size: 11px; font-weight: 600; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
  .score-val { font-size: 32px; font-weight: 800; letter-spacing: -0.02em; }
  .score-side.winning .score-val { color: #7bc47f; }
  .score-divider { font-size: 24px; font-weight: 300; opacity: 0.4; }

  /* Sections */
  .section { display: flex; flex-direction: column; gap: 8px; }
  .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-faint); }

  .player-list { display: flex; flex-direction: column; gap: 6px; }
  .player-row {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 12px; background: var(--surface-2);
    border-radius: 8px; border: 1px solid var(--border);
  }
  .player-name { flex: 1; font-size: 13px; font-weight: 600; color: var(--text); }
  .player-pts { font-size: 13px; font-weight: 700; color: var(--primary); min-width: 36px; }
  .player-total { font-size: 11px; color: var(--text-faint); }

  .event-list { display: flex; flex-direction: column; gap: 4px; }
  .event-row {
    display: flex; align-items: center; gap: 8px;
    padding: 6px 12px; background: var(--surface-2);
    border-radius: 7px;
  }
  .event-time { font-size: 11px; color: var(--text-faint); min-width: 24px; }
  .event-stat { font-size: 12px; font-weight: 600; color: var(--text); flex: 1; }
  .event-player { font-size: 11px; color: var(--text-muted); }

  /* Accordions */
  .accordion-card {
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface);
    overflow: hidden;
  }
  .accordion-header {
    width: 100%; display: flex; align-items: center; gap: 10px;
    padding: 12px 14px;
    background: none; border: none; cursor: pointer;
    text-align: left;
  }
  .accordion-header:hover { background: var(--surface-2); }
  .accordion-title { flex: 1; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .accordion-name { font-size: 13px; font-weight: 700; color: var(--text); }
  .accordion-summary { display: flex; align-items: center; gap: 4px; }
  .accordion-chevron { color: var(--text-faint); flex-shrink: 0; }
  .accordion-body { padding: 0 14px 14px; display: flex; flex-direction: column; gap: 6px; }

  /* Badges */
  .badge-won { font-size: 11px; font-weight: 700; color: #2d7a2d; background: rgba(45,122,45,0.1); padding: 2px 7px; border-radius: 20px; }
  .badge-lost { font-size: 11px; font-weight: 700; color: #e53935; background: rgba(229,57,53,0.1); padding: 2px 7px; border-radius: 20px; }
  .badge-pct { font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 20px; }
  .badge-pct.pct-good { color: #2d7a2d; background: rgba(45,122,45,0.1); }
  .badge-pct.pct-warn { color: #b45309; background: rgba(180,83,9,0.1); }
  .badge-pct.pct-bad  { color: #e53935; background: rgba(229,57,53,0.1); }
  .badge-goals { font-size: 11px; font-weight: 700; color: #e53935; background: rgba(229,57,53,0.1); padding: 2px 7px; border-radius: 20px; }
  .badge-pts { font-size: 11px; font-weight: 700; color: var(--text-muted); background: var(--surface-2); padding: 2px 7px; border-radius: 20px; border: 1px solid var(--border); }

  /* Standout row */
  .standout-row {
    display: flex; align-items: center; gap: 8px;
    background: rgba(var(--primary-rgb), 0.06);
    border-left: 3px solid var(--primary);
    border-radius: 0 8px 8px 0;
    padding: 8px 10px; margin-bottom: 4px;
    font-size: 12px; font-weight: 600; color: var(--text);
  }
  .standout-row svg { color: var(--primary); flex-shrink: 0; }
  .standout-text { font-size: 12px; color: var(--text); }

  /* Player rows in accordions */
  .ht-sub-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-faint); }
  .ht-player-row {
    display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
    padding: 7px 10px; background: var(--surface-2);
    border-radius: 8px; border: 1px solid var(--border);
  }
  .ht-player-name { flex: 1; font-size: 13px; font-weight: 600; color: var(--text); min-width: 80px; }
  .ht-wl { display: flex; gap: 4px; }
  .ht-conceded-score { display: flex; gap: 4px; }
  .ht-matchup-lines { display: flex; flex-wrap: wrap; gap: 4px; width: 100%; }
  .matchup-won { font-size: 11px; color: #2d7a2d; background: rgba(45,122,45,0.08); padding: 2px 6px; border-radius: 4px; }
  .matchup-lost { font-size: 11px; color: #e53935; background: rgba(229,57,53,0.08); padding: 2px 6px; border-radius: 4px; }
  .matchup-info { font-size: 11px; color: var(--text-muted); }

  /* Player Stats table */
  .stats-table { display: flex; flex-direction: column; gap: 4px; overflow-x: auto; }
  .stats-table-head, .stats-table-row {
    display: flex; align-items: center; gap: 4px; min-width: max-content;
  }
  .stats-table-head { padding: 0 4px; }
  .stats-table-row {
    padding: 7px 8px; background: var(--surface-2);
    border-radius: 7px; border: 1px solid var(--border);
  }
  .st-name { font-size: 12px; font-weight: 600; color: var(--text); min-width: 100px; width: 100px; }
  .stats-table-head .st-name { font-size: 11px; color: var(--text-faint); }
  .st-key { font-size: 11px; color: var(--text-faint); min-width: 40px; text-align: center; }
  .st-val { font-size: 12px; font-weight: 700; color: var(--text); min-width: 40px; text-align: center; }
  .st-val.st-zero { color: var(--text-faint); font-weight: 400; }

  /* Substitutions */
  .sub-log-row {
    display: flex; align-items: center; gap: 8px;
    padding: 7px 10px; background: var(--surface-2);
    border-radius: 8px; border: 1px solid var(--border);
    font-size: 13px;
  }
  .sub-time { font-size: 11px; color: var(--text-faint); min-width: 36px; }
  .sub-off { color: #e53935; font-weight: 600; }
  .sub-on  { color: #2d7a2d; font-weight: 600; }
  .sub-arrow { color: var(--text-faint); }
  .sub-period { font-size: 11px; color: var(--text-faint); margin-left: auto; }

  .last-update { font-size: 11px; color: var(--text-faint); text-align: center; }
</style>
