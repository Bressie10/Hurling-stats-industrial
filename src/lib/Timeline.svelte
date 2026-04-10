<script>
  import { onMount } from 'svelte'
  import { loadMatches } from './db.js'

  let matches = $state([])
  let selectedMatch = $state(null)
  let filter = $state('all')  // 'all' | 'puckouts'

  onMount(async () => {
    matches = await loadMatches()
    matches.sort((a, b) => new Date(b.date) - new Date(a.date))
    if (matches.length > 0) selectedMatch = matches[0]
  })

  function getPlayerName(match, playerId) {
    const p = (match.players || []).find(p => p.id === playerId)
    return p ? (p.name || `#${p.number}`) : 'Unknown'
  }

  function formatTime(s) {
    if (s === null || s === undefined) return '—'
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  }

  function getEventColor(stat) {
    if (stat === 'Goal' || stat === 'Point' || stat === 'Turnover Won') return 'green'
    if (stat === 'Wide' || stat === 'Turnover Lost') return 'red'
    if (stat === 'Tackle' || stat === 'Block') return 'blue'
    if (stat === 'Free Won') return 'amber'
    return 'gray'
  }

  let timeline = $derived((() => {
    if (!selectedMatch) return []
    const items = []
    ;(selectedMatch.events || []).forEach(e => {
      items.push({
        type: 'stat',
        time: e.time ?? 0,
        period: e.period,
        stat: e.stat,
        playerId: e.playerId,
        playerName: getPlayerName(selectedMatch, e.playerId)
      })
    })
    ;(selectedMatch.subs_log || []).forEach(s => {
      items.push({
        type: 'sub',
        time: typeof s.time === 'number' ? s.time : 0,
        period: s.period,
        off: s.off,
        on: s.on
      })
    })
    ;(selectedMatch.puckouts || []).forEach(p => {
      items.push({
        type: 'puckout',
        time: p.time ?? 0,
        period: p.period,
        outcome: p.outcome,
        ourPlayer: p.ourPlayer,
        oppPlayer: p.oppPlayer,
        section: p.section
      })
    })
    items.sort((a, b) => a.time - b.time)
    return items
  })())

  let filteredItems = $derived(filter === 'puckouts'
    ? timeline.filter(i => i.type === 'puckout')
    : timeline)

  let grouped = $derived((() => {
    const order = ['Warm-up', '1st Half', '2nd Half', 'Extra Time']
    const groups = {}
    filteredItems.forEach(item => {
      const p = item.period || 'Unknown'
      if (!groups[p]) groups[p] = []
      groups[p].push(item)
    })
    return Object.entries(groups).sort((a, b) => {
      const ai = order.indexOf(a[0])
      const bi = order.indexOf(b[0])
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    })
  })())
</script>

<div class="screen">

  <div class="field-group">
    <label>Select match</label>
    <select bind:value={selectedMatch}>
      {#each matches as m}
        <option value={m}>vs {m.opposition} · {m.date}</option>
      {/each}
    </select>
  </div>

  {#if !selectedMatch}
    <div class="empty-state">
      <div class="empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      </div>
      <div class="empty-title">No matches yet</div>
      <div class="empty-sub">Save a match to see its timeline</div>
    </div>

  {:else if timeline.length === 0}
    <div class="empty-state">
      <div class="empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>
      </div>
      <div class="empty-title">No events logged</div>
      <div class="empty-sub">This match has no timeline events recorded</div>
    </div>

  {:else}

    <div class="summary-card">
      <div class="summary-left">
        <div class="summary-title">vs {selectedMatch.opposition}</div>
        <div class="summary-meta">{selectedMatch.date}{selectedMatch.venue ? ` · ${selectedMatch.venue}` : ''}</div>
      </div>
      <div class="summary-right">
        <div class="summary-score">
          {selectedMatch.score?.home?.goals ?? 0}-{String(selectedMatch.score?.home?.points ?? 0).padStart(2,'0')}
        </div>
        <div class="summary-score-label">Final score</div>
      </div>
    </div>

    <div class="stats-row">
      <div class="stat-pill">
        <div class="stat-pill-icon blue">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
        </div>
        <span class="stat-pill-val">{(selectedMatch.events || []).filter(e => e.stat === 'Point').length}</span>
        <span class="stat-pill-label">Points</span>
      </div>
      <div class="stat-pill">
        <div class="stat-pill-icon green">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
        </div>
        <span class="stat-pill-val">{(selectedMatch.events || []).filter(e => e.stat === 'Goal').length}</span>
        <span class="stat-pill-label">Goals</span>
      </div>
      <div class="stat-pill">
        <div class="stat-pill-icon red">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </div>
        <span class="stat-pill-val">{(selectedMatch.events || []).filter(e => e.stat === 'Wide').length}</span>
        <span class="stat-pill-label">Wides</span>
      </div>
      <div class="stat-pill">
        <div class="stat-pill-icon maroon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <span class="stat-pill-val">{(selectedMatch.events || []).filter(e => e.stat === 'Tackle').length}</span>
        <span class="stat-pill-label">Tackles</span>
      </div>
      {#if (selectedMatch.puckouts || []).length > 0}
        {@const pw = (selectedMatch.puckouts || []).filter(p => p.outcome === 'won').length}
        {@const pt = (selectedMatch.puckouts || []).length}
        <div class="stat-pill clickable" class:pill-active={filter === 'puckouts'} onclick={() => filter = filter === 'puckouts' ? 'all' : 'puckouts'}>
          <div class="stat-pill-icon green">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
          </div>
          <span class="stat-pill-val">{pw}/{pt}</span>
          <span class="stat-pill-label">Puckouts</span>
        </div>
      {/if}
      <div class="stat-pill">
        <div class="stat-pill-icon gray">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
        </div>
        <span class="stat-pill-val">{(selectedMatch.subs_log || []).length}</span>
        <span class="stat-pill-label">Subs</span>
      </div>
    </div>

    <div class="filter-row">
      <button class="filter-pill" class:active={filter === 'all'} onclick={() => filter = 'all'}>All events</button>
      {#if (selectedMatch.puckouts || []).length > 0}
        <button class="filter-pill" class:active={filter === 'puckouts'} onclick={() => filter = 'puckouts'}>Puckouts only</button>
      {/if}
    </div>

    {#each grouped as [period, items]}
      <div class="period-group">
        <div class="period-label">{period}</div>
        <div class="timeline">
          {#each items as item, i}
            <div class="timeline-item">
              <div class="timeline-time">{formatTime(item.time)}</div>
              <div class="timeline-track">
                <div class="timeline-dot {item.type === 'sub' ? 'maroon' : item.type === 'puckout' ? (item.outcome === 'won' ? 'green' : 'red') : getEventColor(item.stat)}"></div>
                {#if i < items.length - 1}
                  <div class="timeline-line"></div>
                {/if}
              </div>
              <div class="timeline-content">
                {#if item.type === 'stat'}
                  <div class="event-card {getEventColor(item.stat)}">
                    <div class="event-icon-wrap {getEventColor(item.stat)}">
                      {#if item.stat === 'Goal'}
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                      {:else if item.stat === 'Point'}
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                      {:else if item.stat === 'Wide'}
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      {:else if item.stat === 'Tackle'}
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                      {:else if item.stat === 'Block'}
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                      {:else if item.stat === 'Turnover Won'}
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                      {:else if item.stat === 'Turnover Lost'}
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
                      {:else if item.stat === 'Free Won'}
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      {:else}
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/></svg>
                      {/if}
                    </div>
                    <div class="event-info">
                      <div class="event-stat">{item.stat}</div>
                      <div class="event-player">{item.playerName}</div>
                    </div>
                    {#if item.stat === 'Goal'}
                      <div class="event-badge goal">Goal</div>
                    {:else if item.stat === 'Point'}
                      <div class="event-badge point">Point</div>
                    {/if}
                  </div>
                {:else if item.type === 'puckout'}
                  <div class="event-card {item.outcome === 'won' ? 'green' : 'red'}">
                    <div class="event-icon-wrap {item.outcome === 'won' ? 'green' : 'red'}">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M8 12h8"/></svg>
                    </div>
                    <div class="event-info">
                      <div class="event-stat">Puckout {item.outcome === 'won' ? 'Won' : 'Lost'}</div>
                      <div class="event-player">
                        {item.ourPlayer || '—'}{item.section ? ' · ' + item.section.replace('-', ' ') : ''}{item.oppPlayer ? ' vs #' + item.oppPlayer : ''}
                      </div>
                    </div>
                    <div class="event-badge {item.outcome === 'won' ? 'point' : 'wide'}">{item.outcome === 'won' ? 'Won' : 'Lost'}</div>
                  </div>
                {:else}
                  <div class="event-card sub">
                    <div class="event-icon-wrap maroon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>
                    </div>
                    <div class="event-info">
                      <div class="event-stat">Substitution</div>
                      <div class="event-player">{item.off} off · {item.on} on</div>
                    </div>
                    <div class="event-badge sub">Sub</div>
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/each}

  {/if}
</div>

<style>
  .screen { display: flex; flex-direction: column; gap: 12px; padding-bottom: 2rem; }

  .field-group { display: flex; flex-direction: column; gap: 4px; }
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

  .empty-state { text-align: center; padding: 3rem 1rem; }
  .empty-icon { width: 48px; height: 48px; margin: 0 auto 1rem; color: var(--text-faint); }
  .empty-icon svg { width: 100%; height: 100%; }
  .empty-title { font-size: 16px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; }
  .empty-sub { font-size: 13px; color: var(--text-faint); }

  .summary-card {
    background: #1a1a1a;
    border-radius: 14px;
    padding: 1.25rem;
    color: white;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }
  .summary-title { font-size: 17px; font-weight: 700; }
  .summary-meta { font-size: 12px; opacity: 0.5; margin-top: 4px; }
  .summary-score { font-size: 32px; font-weight: 700; text-align: right; }
  .summary-score-label { font-size: 11px; opacity: 0.5; text-align: right; margin-top: 2px; }

  .stats-row { display: flex; gap: 8px; flex-wrap: wrap; }
  .stat-pill {
    flex: 1;
    min-width: 56px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 0.75rem 0.5rem;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  .stat-pill-icon {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
  }
  .stat-pill-icon svg { width: 100%; height: 100%; }
  .stat-pill-icon.green { background: #e6f4ea; color: #2d7a2d; }
  .stat-pill-icon.red { background: #fce8e8; color: #c62828; }
  .stat-pill-icon.blue { background: #e3f0fb; color: #1565c0; }
  .stat-pill-icon.maroon { background: #fdf0f2; color: var(--primary); }
  .stat-pill-icon.gray { background: var(--surface-2); color: var(--text-muted); }
  .stat-pill-val { font-size: 20px; font-weight: 700; color: var(--text); line-height: 1; }
  .stat-pill-label { font-size: 11px; color: var(--text-faint); }

  .period-group { }
  .period-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--primary);
    margin-bottom: 8px;
    padding-left: 4px;
  }

  .timeline { display: flex; flex-direction: column; }
  .timeline-item {
    display: grid;
    grid-template-columns: 48px 24px 1fr;
    gap: 8px;
    align-items: flex-start;
  }

  .timeline-time {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-faint);
    text-align: right;
    padding-top: 12px;
    font-variant-numeric: tabular-nums;
  }

  .timeline-track {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .timeline-dot {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    margin-top: 10px;
    flex-shrink: 0;
    border: 2px solid var(--bg);
  }
  .timeline-dot.green { background: #2d7a2d; box-shadow: 0 0 0 1px #2d7a2d; }
  .timeline-dot.red { background: #e53935; box-shadow: 0 0 0 1px #e53935; }
  .timeline-dot.blue { background: #1565c0; box-shadow: 0 0 0 1px #1565c0; }
  .timeline-dot.amber { background: #f57c00; box-shadow: 0 0 0 1px #f57c00; }
  .timeline-dot.gray { background: #888; box-shadow: 0 0 0 1px #888; }
  .timeline-dot.maroon { background: var(--primary); box-shadow: 0 0 0 1px var(--primary); }
  .timeline-line {
    width: 2px;
    flex: 1;
    min-height: 12px;
    background: var(--divider);
    margin: 2px 0;
  }

  .timeline-content { padding-bottom: 10px; }
  .event-card {
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px 12px;
    border-left: 3px solid var(--border);
  }
  .event-card.green { border-left-color: #2d7a2d; }
  .event-card.red { border-left-color: #e53935; }
  .event-card.blue { border-left-color: #1565c0; }
  .event-card.amber { border-left-color: #f57c00; }
  .event-card.gray { border-left-color: #888; }
  .event-card.sub { border-left-color: var(--primary); }

  .event-icon-wrap {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px;
    flex-shrink: 0;
  }
  .event-icon-wrap svg { width: 100%; height: 100%; }
  .event-icon-wrap.green { background: #e6f4ea; color: #2d7a2d; }
  .event-icon-wrap.red { background: #fce8e8; color: #c62828; }
  .event-icon-wrap.blue { background: #e3f0fb; color: #1565c0; }
  .event-icon-wrap.amber { background: #fff3e0; color: #f57c00; }
  .event-icon-wrap.gray { background: var(--surface-2); color: var(--text-muted); }
  .event-icon-wrap.maroon { background: #fdf0f2; color: var(--primary); }

  .event-info { flex: 1; min-width: 0; }
  .event-stat { font-size: 13px; font-weight: 700; color: var(--text); }
  .event-player { font-size: 12px; color: var(--text-muted); margin-top: 1px; }

  .event-badge {
    font-size: 11px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 6px;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .event-badge.goal { background: #e6f4ea; color: #2d7a2d; }
  .event-badge.point { background: #e3f0fb; color: #1565c0; }
  .event-badge.sub { background: #fdf0f2; color: var(--primary); }

  .stat-pill.clickable { cursor: pointer; transition: all 0.15s; }
  .stat-pill.clickable:hover { border-color: #2d7a2d; }
  .stat-pill.pill-active { border-color: #2d7a2d; background: rgba(45,122,45,0.07); }

  .filter-row { display: flex; gap: 8px; flex-wrap: wrap; }
  .filter-pill {
    padding: 7px 16px;
    border-radius: 20px;
    border: 1px solid var(--input-border);
    background: none;
    font-size: 13px;
    color: var(--text-muted);
    cursor: pointer;
    font-family: inherit;
    font-weight: 600;
    transition: all 0.15s;
    min-height: 36px;
  }
  .filter-pill.active { background: var(--primary); color: white; border-color: var(--primary); }

  @media (max-width: 480px) {
    .timeline-item { grid-template-columns: 40px 20px 1fr; gap: 6px; }
    .stats-row { gap: 6px; }
    .stat-pill { min-width: 48px; }
  }
</style>