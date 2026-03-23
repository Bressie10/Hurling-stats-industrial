<script>
  import { onMount } from 'svelte'
  import { saveSquad, loadSquad, saveMatch, saveDraftMatch, loadDraftMatch, clearDraftMatch } from './db.js'

  let screen = 'setup'
  let players = []
  let opposition = ''
  let venue = ''
  let matchDate = new Date().toISOString().split('T')[0]
  let nextId = 21
  let events = []

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

    // Auto-resume draft without asking
    const draft = await loadDraftMatch()
    if (draft && draft.opposition && !draft._saved) {
      opposition = draft.opposition
      venue = draft.venue || ''
      matchDate = draft.date
      period = draft.period || '1st Half'
      matchScore = draft.score || { home: { goals: 0, points: 0 }, away: { goals: 0, points: 0 } }
      stats = draft.stats || {}
      notes = draft.notes || ''
      customStats = draft.customStats || []
      events = draft.events || []
      subs_log = draft.subs_log || []
      timerSeconds = draft.timerSeconds || 0
      if (draft.players?.length > 0) players = draft.players
      screen = 'match'
      // Auto-start timer
      timerInterval = setInterval(() => { timerSeconds++; saveDraft() }, 1000)
      timerRunning = true
    }
  })

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
    screen = 'match'
    saveDraft()
  }

  // ── STATS ────────────────────────────────────
  const defaultStats = ['Point', 'Goal', 'Wide', 'Tackle', 'Block', 'Turnover Won', 'Turnover Lost', 'Free Won']
  let customStats = []
  let newCustomStat = ''
  let showAddStat = false

  $: allStats = [...defaultStats, ...customStats]

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
  let period = '1st Half'
  const periods = ['Warm-up', '1st Half', '2nd Half', 'Extra Time']
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
    showPitchPicker = true
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
  }

  function decrement(playerId, stat) {
    if (!stats[playerId] || (stats[playerId][stat] || 0) === 0) return
    stats[playerId][stat]--
    if (stat === 'Point' && matchScore.home.points > 0) matchScore.home.points--
    if (stat === 'Goal' && matchScore.home.goals > 0) matchScore.home.goals--
    stats = stats
    matchScore = matchScore
    saveDraft()
  }

  function formatScore(s) { return `${s.goals}-${String(s.points).padStart(2, '0')}` }

  async function saveDraft() {
    await saveDraftMatch({
      date: matchDate,
      opposition,
      venue,
      period,
      score: matchScore,
      stats,
      notes,
      customStats,
      events,
      players: players.map(p => ({ ...p })),
      subs_log,
      timerSeconds
    })
  }

  async function finishMatch() {
    if (!confirm('End match and save stats?')) return
    clearInterval(timerInterval)
    timerRunning = false
    await saveMatch({
      id: Date.now(), date: matchDate, opposition, venue,
      period, score: matchScore, stats, notes, customStats, events,
      subs_log,
      players: players.map(p => ({ ...p }))
    })
    await clearDraftMatch()
    // Reset all state
    opposition = ''
    venue = ''
    matchDate = new Date().toISOString().split('T')[0]
    stats = {}
    events = []
    subs_log = []
    matchScore = { home: { goals: 0, points: 0 }, away: { goals: 0, points: 0 } }
    notes = ''
    customStats = []
    timerSeconds = 0
    period = '1st Half'
    screen = 'setup'
    alert('Match saved!')
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
  }

  // ── TIMER ────────────────────────────────────
  let timerSeconds = 0
  let timerRunning = false
  let timerInterval = null

  function toggleTimer() {
    if (timerRunning) { clearInterval(timerInterval); timerRunning = false }
    else { timerInterval = setInterval(() => { timerSeconds++; saveDraft() }, 1000); timerRunning = true }
  }

  function resetTimer() { clearInterval(timerInterval); timerRunning = false; timerSeconds = 0; saveDraft() }
  function formatTime(s) { return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}` }
</script>

{#if screen === 'setup'}
<div class="screen">

  <div class="setup-hero">
    <img src="doora-barefield.png" alt="Doora Barefield GAA" class="hero-logo">
    <div>
      <h2>New Match</h2>
      <p>Doora Barefield GAA · Minor Hurling</p>
    </div>
  </div>

  <div class="setup-card">
    <div class="setup-card-title">Match Details</div>
    <div class="field-group">
      <label>Opposition *</label>
      <input bind:value={opposition} placeholder="e.g. Éire Óg" />
    </div>
    <div class="field-row">
      <div class="field-group">
        <label>Venue</label>
        <input bind:value={venue} placeholder="e.g. Cusack Park" />
      </div>
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
      <div class="match-meta">{venue}{venue ? ' · ' : ''}{matchDate}</div>
    </div>
    <div class="scoreboard">
      <div class="score-block">
        <div class="score-label">DB</div>
        <div class="score-val">{formatScore(matchScore.home)}</div>
      </div>
      <div class="score-divider">–</div>
      <div class="score-block">
        <div class="score-label">{opposition.slice(0,4).toUpperCase()}</div>
        <div class="score-val">{formatScore(matchScore.away)}</div>
        <div class="opp-btns">
          <button class="opp-btn" on:click={() => { if(matchScore.away.points>0) matchScore.away.points--; matchScore=matchScore; saveDraft() }}>−P</button>
          <button class="opp-btn" on:click={() => { matchScore.away.points++; matchScore=matchScore; saveDraft() }}>+P</button>
          <button class="opp-btn" on:click={() => { if(matchScore.away.goals>0) matchScore.away.goals--; matchScore=matchScore; saveDraft() }}>−G</button>
          <button class="opp-btn" on:click={() => { matchScore.away.goals++; matchScore=matchScore; saveDraft() }}>+G</button>
        </div>
      </div>
    </div>
  </div>

  <div class="card timer-card">
    <div class="timer-left">
      <div class="timer-display" class:running={timerRunning}>{formatTime(timerSeconds)}</div>
      <div class="timer-btns">
        <button class="timer-btn primary" on:click={toggleTimer}>
          {timerRunning ? '⏸ Pause' : '▶ Start'}
        </button>
        <button class="timer-btn" on:click={resetTimer}>Reset</button>
      </div>
    </div>
    <div class="period-pills">
      {#each periods as p}
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
    <button class="sub-btn" on:click={openSubModal}>⇄ Sub</button>
  </div>

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
          <button class="cancel-small" on:click={() => showAddStat = false}>✕</button>
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
          <button class="cancel-small" on:click={() => showAddStat = false}>✕</button>
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
          <span class="sub-detail">⬇ {sub.off} → ⬆ {sub.on}</span>
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
            <rect x="0" y="0" width="150" height="200" fill="rgba(107,27,43,0.15)" rx="4"/>
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

  <div class="notes-section">
    <div class="section-label">Match notes</div>
    <textarea bind:value={notes} placeholder="Add notes about the match..." on:input={saveDraft}></textarea>
  </div>

  <button class="finish-btn" on:click={finishMatch}>End Match & Save</button>
</div>
{/if}

<style>
  .screen { display: flex; flex-direction: column; gap: 12px; padding-bottom: 2rem; }
  .card { background: white; border: 1px solid #e5e5e5; border-radius: 12px; padding: 1rem; }
  .setup-hero { display: flex; align-items: center; gap: 16px; padding: 0.5rem 0; }
  .hero-logo { width: 64px; height: 64px; object-fit: contain; }
  .setup-hero h2 { font-size: 24px; font-weight: 700; color: #1a1a1a; margin-bottom: 2px; }
  .setup-hero p { font-size: 13px; color: #888; }
  .setup-card { background: white; border: 1px solid #e5e5e5; border-radius: 14px; padding: 1.25rem; display: flex; flex-direction: column; gap: 14px; }
  .setup-card-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #aaa; }
  .field-group { display: flex; flex-direction: column; gap: 6px; }
  .field-group label { font-size: 13px; font-weight: 600; color: #444; }
  .field-group input { padding: 12px 14px; border: 1.5px solid #e0e0e0; border-radius: 10px; font-size: 15px; font-family: inherit; width: 100%; background: #fafafa; transition: all 0.15s; }
  .field-group input:focus { outline: none; border-color: #6B1B2B; background: white; box-shadow: 0 0 0 3px rgba(107,27,43,0.08); }
  .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .squad-preview-card { background: #6B1B2B; border-radius: 14px; padding: 1.25rem; color: white; }
  .squad-preview-title { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; opacity: 0.85; margin-bottom: 1rem; }
  .squad-dot { width: 8px; height: 8px; border-radius: 50%; background: #4caf50; box-shadow: 0 0 0 2px rgba(76,175,80,0.3); }
  .squad-preview-stats { display: flex; align-items: center; justify-content: space-around; margin-bottom: 1rem; }
  .squad-stat { text-align: center; }
  .squad-stat-val { font-size: 32px; font-weight: 700; line-height: 1; }
  .squad-stat-label { font-size: 12px; opacity: 0.7; margin-top: 4px; }
  .squad-divider { width: 1px; height: 40px; background: rgba(255,255,255,0.2); }
  .squad-preview-hint { font-size: 12px; opacity: 0.6; text-align: center; }
  .start-btn { width: 100%; padding: 16px; background: #1a1a1a; color: white; border: none; border-radius: 12px; font-size: 17px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; font-family: inherit; transition: background 0.15s; }
  .start-btn:hover { background: #333; }
  .start-arrow { font-size: 20px; }
  .match-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
  .match-title { font-size: 17px; font-weight: 700; color: #1a1a1a; }
  .vs { font-weight: 400; color: #888; margin: 0 6px; }
  .match-meta { font-size: 12px; color: #888; margin-top: 2px; }
  .scoreboard { display: flex; align-items: center; gap: 10px; background: #f3f3f3; border-radius: 10px; padding: 8px 16px; }
  .score-block { text-align: center; }
  .score-label { font-size: 10px; color: #888; font-weight: 600; letter-spacing: 0.05em; }
  .score-val { font-size: 22px; font-weight: 700; color: #1a1a1a; }
  .score-divider { font-size: 22px; color: #ccc; }
  .opp-btns { display: flex; gap: 3px; margin-top: 4px; flex-wrap: wrap; justify-content: center; }
  .opp-btn { padding: 2px 6px; font-size: 10px; font-weight: 600; border: 1px solid #ddd; border-radius: 4px; background: white; cursor: pointer; color: #555; font-family: inherit; }
  .opp-btn:hover { border-color: #6B1B2B; color: #6B1B2B; }
  .timer-card { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
  .timer-left { display: flex; align-items: center; gap: 10px; }
  .timer-display { font-size: 28px; font-weight: 700; font-variant-numeric: tabular-nums; color: #1a1a1a; min-width: 80px; }
  .timer-display.running { color: #6B1B2B; }
  .timer-btns { display: flex; gap: 6px; }
  .timer-btn { padding: 7px 14px; border-radius: 8px; border: 1.5px solid #ddd; background: none; color: #555; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; }
  .timer-btn.primary { background: #6B1B2B; border-color: #6B1B2B; color: white; }
  .period-pills { display: flex; gap: 6px; flex-wrap: wrap; }
  .period-btn { padding: 5px 12px; border-radius: 20px; border: 1px solid #ddd; background: none; font-size: 12px; color: #666; cursor: pointer; white-space: nowrap; font-family: inherit; }
  .period-btn.active { background: #6B1B2B; color: white; border-color: #6B1B2B; font-weight: 600; }
  .mode-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .mode-toggle { display: flex; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; }
  .mode-toggle button { padding: 8px 20px; border: none; background: none; font-size: 13px; color: #666; cursor: pointer; font-family: inherit; }
  .mode-toggle button.active { background: #6B1B2B; color: white; font-weight: 600; }
  .sub-btn { padding: 8px 16px; border-radius: 8px; border: 1.5px solid #6B1B2B; background: none; color: #6B1B2B; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; font-family: inherit; }
  .sub-btn:hover { background: #6B1B2B; color: white; }
  .section-label { font-size: 11px; font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; color: #aaa; margin-bottom: 6px; }
  .stat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
  .stat-btn { position: relative; padding: 20px 12px; border-radius: 10px; border: 1.5px solid #e0e0e0; background: white; font-size: 14px; font-weight: 600; color: #1a1a1a; cursor: pointer; transition: all 0.15s; text-align: center; font-family: inherit; }
  .stat-btn:hover { border-color: #6B1B2B; color: #6B1B2B; background: #fdf5f6; }
  .stat-btn:active { transform: scale(0.97); }
  .stat-btn.dashed { border-style: dashed; color: #aaa; font-weight: 400; }
  .stat-btn.dashed:hover { color: #6B1B2B; border-color: #6B1B2B; }
  .custom-tag { display: block; font-size: 10px; font-weight: 400; color: #aaa; margin-top: 4px; }
  .add-stat-input { display: flex; align-items: center; gap: 6px; padding: 10px 12px; }
  .add-stat-input input { flex: 1; border: none; outline: none; font-size: 14px; font-family: inherit; min-width: 0; }
  .confirm-btn { padding: 4px 10px; background: #6B1B2B; color: white; border: none; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; }
  .cancel-small { background: none; border: none; color: #aaa; font-size: 14px; cursor: pointer; padding: 2px 4px; }
  .custom-stat-row { display: flex; justify-content: flex-end; margin-bottom: 8px; }
  .custom-stat-btn { padding: 7px 16px; border-radius: 8px; border: 1.5px dashed #6B1B2B; background: #fdf5f6; color: #6B1B2B; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.15s; }
  .custom-stat-btn:hover { background: #6B1B2B; color: white; }
  .custom-stat-input-wrap { display: flex; align-items: center; gap: 8px; background: white; border: 1.5px solid #6B1B2B; border-radius: 8px; padding: 6px 10px; width: 100%; max-width: 320px; }
  .custom-stat-input { flex: 1; border: none; outline: none; font-size: 14px; font-family: inherit; min-width: 0; background: transparent; }
  .table-wrap { width: 100%; overflow-x: auto; border: 1px solid #e5e5e5; border-radius: 10px; }
  .player-table { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 340px; }
  .player-table thead { background: #f8f8f8; }
  .player-table th { padding: 8px 6px; font-size: 11px; font-weight: 600; color: #aaa; text-transform: uppercase; letter-spacing: 0.05em; text-align: center; border-bottom: 1px solid #f0f0f0; }
  .th-player { text-align: left; padding-left: 12px; }
  .player-table td { padding: 6px; border-bottom: 1px solid #f5f5f5; text-align: center; }
  .player-table tr:last-child td { border-bottom: none; }
  .td-player { text-align: left; padding-left: 12px; white-space: nowrap; font-weight: 500; }
  .num-badge { display: inline-block; font-size: 11px; background: #6B1B2B; color: white; border-radius: 4px; padding: 1px 5px; font-weight: 600; margin-right: 4px; }
  .num-badge.sub { background: #aaa; }
  .counter { display: flex; align-items: center; justify-content: center; gap: 4px; }
  .mini-dec, .mini-inc { width: 26px; height: 26px; border-radius: 50%; border: 1px solid #ddd; background: white; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; line-height: 1; font-family: inherit; }
  .mini-inc { border-color: #6B1B2B; color: #6B1B2B; }
  .mini-val { font-size: 14px; font-weight: 600; min-width: 20px; text-align: center; }
  .sub-log-row { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px solid #f0f0f0; font-size: 13px; }
  .sub-log-row:last-child { border-bottom: none; }
  .sub-time { font-weight: 700; color: #6B1B2B; min-width: 44px; }
  .sub-detail { flex: 1; color: #333; }
  .sub-period { font-size: 11px; color: #aaa; }
  .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: flex-end; justify-content: center; z-index: 200; }
  .modal { background: white; border-radius: 20px 20px 0 0; padding: 1.5rem; width: 100%; max-width: 640px; max-height: 85vh; overflow-y: auto; }
  .modal-title { font-size: 17px; font-weight: 600; margin-bottom: 1rem; color: #1a1a1a; }
  .modal-section-label { font-size: 11px; font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; color: #aaa; margin: 0.75rem 0 0.5rem; }
  .player-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 8px; }
  .player-btn { display: flex; flex-direction: column; align-items: center; padding: 12px 8px; border-radius: 10px; border: 1.5px solid #e0e0e0; background: white; cursor: pointer; transition: all 0.15s; gap: 4px; font-family: inherit; }
  .player-btn:active { transform: scale(0.96); border-color: #6B1B2B; background: #fdf5f6; }
  .player-btn.sub { opacity: 0.7; }
  .player-num { font-size: 11px; color: #888; }
  .player-name { font-size: 13px; font-weight: 600; color: #1a1a1a; text-align: center; }
  .cancel-btn { width: 100%; margin-top: 1rem; padding: 13px; border-radius: 10px; border: 1px solid #ddd; background: none; font-size: 15px; color: #888; cursor: pointer; font-family: inherit; }
  .optional-tag { font-size: 12px; font-weight: 400; color: #aaa; margin-left: 6px; }
  .pitch-wrap { margin: 0.75rem 0; border-radius: 8px; overflow: hidden; cursor: crosshair; }
  .pitch-svg { width: 100%; height: auto; display: block; }
  .ghost-btn { width: 100%; padding: 10px; border: 1.5px dashed #ddd; border-radius: 8px; background: none; color: #aaa; font-size: 13px; cursor: pointer; font-family: inherit; }
  .ghost-btn:hover { border-color: #6B1B2B; color: #6B1B2B; }
  .notes-section { margin-top: 4px; }
  textarea { width: 100%; min-height: 80px; border: 1px solid #e0e0e0; border-radius: 8px; padding: 10px 12px; font-size: 14px; font-family: inherit; color: #1a1a1a; resize: vertical; background: white; }
  textarea:focus { outline: none; border-color: #6B1B2B; }
  .finish-btn { width: 100%; padding: 15px; background: #1a1a1a; color: white; border: none; border-radius: 10px; font-size: 16px; font-weight: 700; cursor: pointer; margin-top: 8px; font-family: inherit; }
  .finish-btn:hover { background: #333; }
  @media (max-width: 480px) {
    .match-header { flex-direction: column; align-items: flex-start; }
    .scoreboard { width: 100%; justify-content: center; }
    .timer-card { flex-direction: column; align-items: flex-start; gap: 10px; }
    .period-pills { width: 100%; }
    .stat-grid { grid-template-columns: repeat(2, 1fr); }
    .field-row { grid-template-columns: 1fr; }
    .mode-row { flex-wrap: wrap; }
    .mode-toggle { flex: 1; }
    .mode-toggle button { flex: 1; }
  }
  @media (min-width: 481px) and (max-width: 768px) {
    .stat-grid { grid-template-columns: repeat(3, 1fr); }
  }
  @media (min-width: 769px) {
    .stat-grid { grid-template-columns: repeat(4, 1fr); }
  }
</style>