<script>
  import { onMount, onDestroy } from 'svelte'
  import { supabase } from './supabase.js'
  import { subscriptionStore } from './subscription-store.js'

  export let session    // { id, host_user_id, match_data }
  export let onClose = () => {}

  let matchData = session.match_data || null
  let channel = null
  let connected = false
  let lastUpdate = null

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

  $: home = matchData?.score?.home
  $: away = matchData?.score?.away
  $: homePts = totalPts(home)
  $: awayPts = totalPts(away)
  $: topPlayers = (() => {
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
  })()
  $: recentEvents = (matchData?.events || []).slice(-5).reverse()
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
    <button class="close-btn" on:click={onClose}>
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

    <!-- Top scorers -->
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

    {#if lastUpdate}
      <div class="last-update">Updated {lastUpdate.toLocaleTimeString()}</div>
    {/if}
  {/if}
</div>

<style>
  .viewer-wrap {
    display: flex; flex-direction: column; gap: 16px;
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

  .last-update { font-size: 11px; color: var(--text-faint); text-align: center; }
</style>
