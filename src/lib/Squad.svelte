<script>
  import { onMount, onDestroy } from 'svelte'
  import { saveSquad, loadSquad, clearAllData } from './db.js'

  let players = $state([])
  let nextId = $state(21)
  let saved = $state(false)
  let saving = $state(false)
  let saveError = $state(false)
  let loading = $state(true)
  let viewMode = $state('list') // 'list' | 'pitch'

  // Pitch slot state
  let pitchSlotTarget = $state(null)
  let showPitchModal = $state(false)
  let addingNewPlayer = $state(false)   // inline "new player" form inside the slot modal
  let newPlayerName = $state('')        // bound to the new player name input

  const positions = [
    'Goalkeeper',
    'Right Corner Back',
    'Full Back',
    'Left Corner Back',
    'Right Half Back',
    'Centre Back',
    'Left Half Back',
    'Midfield',
    'Right Half Forward',
    'Centre Forward',
    'Left Half Forward',
    'Right Corner Forward',
    'Full Forward',
    'Left Corner Forward',
    'Sub'
  ]

  // Maps jersey number → GAA position category
  const SLOT_POSITION = {
    1:'Goalkeeper',
    2:'Right Corner Back', 3:'Full Back', 4:'Left Corner Back',
    5:'Right Half Back', 6:'Centre Back', 7:'Left Half Back',
    8:'Midfield', 9:'Midfield',
    10:'Right Half Forward', 11:'Centre Forward', 12:'Left Half Forward',
    13:'Right Corner Forward', 14:'Full Forward', 15:'Left Corner Forward'
  }

  // Short display labels for each slot
  const SLOT_SHORT = {
    1:'GK',
    2:'R.Full Back',3:'Full Back',4:'L.Full Back',
    5:'R.Half Back',6:'Centre Back',7:'L.Half Back',
    8:'Midfield',9:'Midfield',
    10:'R.Half Fwd',11:'Centre Fwd',12:'L.Half Fwd',
    13:'R.Full Fwd',14:'Full Forward',15:'L.Full Fwd'
  }

  // Rows of position numbers, top to bottom (forwards → GK)
  const PITCH_ROWS = [[13,14,15],[10,11,12],[8,9],[5,6,7],[2,3,4],[1]]

  const defaultSquad = Array.from({ length: 20 }, (_, i) => ({
    id: i + 1,
    name: '',
    number: i + 1,
    position: i < 15
      ? ['Goalkeeper','Right Corner Back','Full Back','Left Corner Back','Right Half Back','Centre Back','Left Half Back','Midfield','Midfield','Right Half Forward','Centre Forward','Left Half Forward','Right Corner Forward','Full Forward','Left Corner Forward'][i]
      : 'Sub'
  }))

  onMount(async () => {
    const savedSquad = await loadSquad()
    if (savedSquad && savedSquad.length > 0) {
      players = savedSquad.sort((a, b) => a.number - b.number)
      nextId = Math.max(...savedSquad.map(p => p.id)) + 1
    } else {
      players = defaultSquad.map(p => ({ ...p }))
    }
    loading = false
  })

  function nextAvailableNumber() {
    const used = new Set(players.map(p => p.number))
    let n = 1
    while (used.has(n)) n++
    return n
  }

  function addPlayer() {
    players = [...players, { id: nextId++, name: '', number: nextAvailableNumber(), position: 'Sub' }]
    saved = false
  }

  function removePlayer(id) {
    if (players.length <= 1) return
    players = players.filter(p => p.id !== id)
    saved = false
  }

  function markChanged() { saved = false }

  // FIX: Auto-save when the component is destroyed (i.e. the coach navigates
  // away without pressing Save). Previously any unsaved changes were silently
  // lost. onDestroy fires synchronously but the async IndexedDB write continues
  // on the browser's task queue even after the component is gone.
  onDestroy(() => {
    if (!saved && !saving && !loading) {
      saveSquad($state.snapshot(players)).catch(e => console.warn('Squad auto-save on destroy failed:', e))
    }
  })

  async function handleSave() {
    if (saving) return
    saving = true
    saveError = false
    try {
      await saveSquad($state.snapshot(players))
      saved = true
      setTimeout(() => { saved = false }, 3000)
    } catch (e) {
      saveError = true
      setTimeout(() => { saveError = false }, 4000)
    } finally {
      saving = false
    }
  }

  // ── PITCH VIEW ──────────────────────────────────
  function getPlayerForSlot(num) {
    return players.find(p => p.number === num && p.position !== 'Sub') || null
  }

  function openPitchSlot(slotNum) {
    pitchSlotTarget = slotNum
    addingNewPlayer = false
    newPlayerName = ''
    showPitchModal = true
  }

  function assignPlayerToSlot(playerId) {
    if (playerId === null) {
      // Clear slot — move player to Sub with a free number
      const p = slotMap[pitchSlotTarget]
      if (p) {
        p.position = 'Sub'
        p.number = nextAvailableNumber()
      }
    } else {
      const incoming = players.find(p => p.id === playerId)
      if (!incoming) return
      const existing = slotMap[pitchSlotTarget]
      if (existing && existing.id !== incoming.id) {
        // Displaced player takes incoming's old number/position
        if (incoming.position === 'Sub' || incoming.number > 15) {
          // Incoming was a sub — displaced player becomes sub with a free number
          existing.position = 'Sub'
          existing.number = nextAvailableNumber()
        } else {
          // Incoming was a starter elsewhere — displaced player takes that slot
          existing.number = incoming.number
          existing.position = SLOT_POSITION[incoming.number] || 'Sub'
        }
      }
      incoming.number = pitchSlotTarget
      incoming.position = SLOT_POSITION[pitchSlotTarget]
    }
    players = [...players]
    showPitchModal = false
    addingNewPlayer = false
    newPlayerName = ''
    saved = false
  }

  function addNewPlayerToSlot() {
    const name = newPlayerName.trim()
    if (!name) return
    const newId = nextId++
    const newNum = pitchSlotTarget ? pitchSlotTarget : nextAvailableNumber()
    const newPos = pitchSlotTarget ? SLOT_POSITION[pitchSlotTarget] : 'Sub'
    // If assigning to a slot, displace existing occupant first
    if (pitchSlotTarget) {
      const existing = getPlayerForSlot(pitchSlotTarget)
      if (existing) {
        existing.position = 'Sub'
        existing.number = nextAvailableNumber()
      }
    }
    players = [...players, { id: newId, name, number: newNum, position: newPos }]
    showPitchModal = false
    addingNewPlayer = false
    newPlayerName = ''
    saved = false
  }

  function removeSubFromPitch(playerId) {
    if (players.length <= 1) return
    players = players.filter(p => p.id !== playerId)
    saved = false
  }

  let starters = $derived(players.filter(p => p.number >= 1 && p.number <= 15 && p.position !== 'Sub'))
  let subs = $derived(players.filter(p => p.position === 'Sub' || p.number > 15))

  // A player "occupies a pitch slot" only if they have number 1-15 AND position !== Sub
  function isInPitchSlot(p) { return p.number >= 1 && p.number <= 15 && p.position !== 'Sub' }

  // Reactive slot map: slotNum → player — drives the pitch display.
  let slotMap = $derived((() => {
    const map = {}
    players.forEach(p => {
      if (isInPitchSlot(p) && p.name.trim()) map[p.number] = p
    })
    return map
  })())

  let pitchModalPlayers = $derived(players
    .filter(p => p.name.trim())
    .sort((a, b) => {
      // Unplaced players come first (easiest to assign)
      const aInSlot = isInPitchSlot(a)
      const bInSlot = isInPitchSlot(b)
      if (aInSlot === bInSlot) return a.number - b.number
      return aInSlot ? 1 : -1
    }))
</script>

<div class="screen">

  <!-- HEADER -->
  <div class="page-header">
    <div>
      <h2>Squad</h2>
      <p>Your saved squad loads automatically at the start of every match.</p>
    </div>
    <div class="header-right">
      <div class="view-toggle">
        <button class:active={viewMode === 'list'} onclick={() => viewMode = 'list'}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          List
        </button>
        <button class:active={viewMode === 'pitch'} onclick={() => viewMode = 'pitch'}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="12" x2="21" y2="12"/><circle cx="12" cy="12" r="3"/></svg>
          Pitch
        </button>
      </div>
      <button class="save-btn" class:saved class:error={saveError} disabled={saving} onclick={handleSave}>
        {#if saving}Saving…
        {:else if saved}<svg style="width:14px;height:14px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Saved
        {:else if saveError}Failed — retry
        {:else}Save
        {/if}
      </button>
    </div>
  </div>

  {#if loading}
    <div class="loading">Loading squad...</div>
  {:else}

  <!-- ═══════════════════════════════ LIST VIEW ═══ -->
  {#if viewMode === 'list'}

    <div class="info-card">
      <div class="info-icon"><svg style="width:16px;height:16px" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>
      <div class="info-text">Add your full panel once. Switch to <strong>Pitch view</strong> to arrange players on the formation visually.</div>
    </div>

    <!-- STARTERS -->
    <div class="section-header">
      <div class="section-label">Starting 15 ({starters.length})</div>
    </div>
    <div class="card squad-card">
      <div class="squad-col-labels">
        <span>#</span><span>Name</span><span>Position</span><span></span>
      </div>
      {#each starters as player (player.id)}
        <div class="squad-row">
          <input class="input-num" type="number" bind:value={player.number} min="1" max="99" oninput={markChanged} />
          <input class="input-name" bind:value={player.name} placeholder="Player name" oninput={markChanged} />
          <select class="input-pos" bind:value={player.position} onchange={markChanged}>
            {#each positions as pos}<option value={pos}>{pos}</option>{/each}
          </select>
          <button class="delete-btn" onclick={() => removePlayer(player.id)} title="Remove">
            <svg style="width:14px;height:14px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      {/each}
    </div>

    <!-- SUBS -->
    <div class="section-header">
      <div class="section-label">Substitutes ({subs.length})</div>
    </div>
    <div class="card squad-card">
      {#if subs.length === 0}
        <div class="empty-section">No substitutes yet</div>
      {:else}
        <div class="squad-col-labels">
          <span>#</span><span>Name</span><span>Position</span><span></span>
        </div>
        {#each subs as player (player.id)}
          <div class="squad-row is-sub">
            <input class="input-num" type="number" bind:value={player.number} min="1" max="99" oninput={markChanged} />
            <input class="input-name" bind:value={player.name} placeholder="Player name" oninput={markChanged} />
            <select class="input-pos" bind:value={player.position} onchange={markChanged}>
              {#each positions as pos}<option value={pos}>{pos}</option>{/each}
            </select>
            <button class="delete-btn" onclick={() => removePlayer(player.id)} title="Remove">
              <svg style="width:14px;height:14px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        {/each}
      {/if}
    </div>

    <button class="add-player-btn" onclick={addPlayer}>
      <svg style="width:16px;height:16px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Add Player
    </button>

    <!-- SUMMARY -->
    <div class="card summary-card">
      <div class="section-label" style="margin-bottom:10px">Squad summary</div>
      <div class="summary-grid">
        <div class="summary-item">
          <div class="summary-val">{players.length}</div>
          <div class="summary-label">Total</div>
        </div>
        <div class="summary-item">
          <div class="summary-val">{starters.length}</div>
          <div class="summary-label">Starters</div>
        </div>
        <div class="summary-item">
          <div class="summary-val">{subs.length}</div>
          <div class="summary-label">Subs</div>
        </div>
        <div class="summary-item">
          <div class="summary-val">{players.filter(p => p.name.trim()).length}</div>
          <div class="summary-label">Named</div>
        </div>
      </div>
    </div>

    <button class="save-btn-full" class:saved class:error={saveError} disabled={saving} onclick={handleSave}>
      {#if saving}Saving…
      {:else if saved}<svg style="width:16px;height:16px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Squad Saved!
      {:else if saveError}Save failed — tap to retry
      {:else}Save Squad
      {/if}
    </button>

  <!-- ═══════════════════════════════ PITCH VIEW ══ -->
  {:else}

    <div class="pitch-hint">
      Tap any position to assign a player. Changes are saved when you tap <strong>Save</strong>.
    </div>

    <!-- PITCH -->
    <div class="pitch-wrap">

      <!-- Goal box: opposition end -->
      <div class="pitch-goal-area top-goal"></div>

      <!-- Slots -->
      <div class="pitch-field">
        {#each PITCH_ROWS as row, rowIdx}
          <div class="pitch-row" class:row-mid={row.length === 2} class:row-gk={row.length === 1}>
            {#each row as slotNum}
              <button
                class="pos-slot"
                class:slot-filled={!!slotMap[slotNum]}
                class:slot-gk={slotNum === 1}
                onclick={() => openPitchSlot(slotNum)}
              >
                <span class="slot-jersey">#{slotNum}</span>
                {#if slotMap[slotNum]}
                  <span class="slot-name">{slotMap[slotNum].name}</span>
                  <span class="slot-pos-label">{SLOT_SHORT[slotNum]}</span>
                {:else}
                  <span class="slot-empty-label">{SLOT_SHORT[slotNum]}</span>
                  <span class="slot-tap">Tap to assign</span>
                {/if}
              </button>
            {/each}
          </div>
          <!-- Centre line after row index 2 (after midfield row) -->
          {#if rowIdx === 2}
            <div class="pitch-centre-line">
              <div class="pitch-centre-circle"></div>
            </div>
          {/if}
        {/each}
      </div>

      <!-- Goal box: our end -->
      <div class="pitch-goal-area bottom-goal"></div>
    </div>

    <!-- SUBS PANEL -->
    <div class="subs-panel">
      <div class="subs-panel-header">
        <span class="subs-panel-title">Substitutes</span>
        <span class="subs-panel-count">{subs.filter(p => p.name.trim()).length} named</span>
      </div>
      {#if subs.filter(p => p.name.trim()).length === 0}
        <div class="subs-empty">No substitutes yet</div>
      {:else}
        <div class="subs-chips">
          {#each subs.filter(p => p.name.trim()) as p (p.id)}
            <div class="sub-chip">
              <span class="sub-chip-num">#{p.number}</span>
              <span class="sub-chip-name">{p.name}</span>
              <button class="sub-chip-remove" onclick={() => removeSubFromPitch(p.id)} title="Remove">
                <svg style="width:11px;height:11px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          {/each}
        </div>
      {/if}
      <button class="subs-add-btn" onclick={() => { pitchSlotTarget = null; addingNewPlayer = true; showPitchModal = true }}>
        <svg style="width:14px;height:14px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add player to squad
      </button>
    </div>

    <button class="save-btn-full" class:saved class:error={saveError} disabled={saving} onclick={handleSave}>
      {#if saving}Saving…
      {:else if saved}<svg style="width:16px;height:16px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Squad Saved!
      {:else if saveError}Save failed — tap to retry
      {:else}Save Squad
      {/if}
    </button>

  {/if}

  {/if}

  <!-- DANGER ZONE (always visible) -->
  <div class="danger-zone">
    <div class="section-label">Danger zone</div>
    <div class="danger-card">
      <div class="danger-info">
        <div class="danger-title">Clear all data</div>
        <div class="danger-sub">Deletes all matches, stats and squad data permanently.</div>
      </div>
      <button class="danger-btn" onclick={async () => {
        if (confirm('Are you sure? This will delete everything permanently.')) {
          await clearAllData()
          players = []
          nextId = 1
          saved = false
          alert('All data cleared.')
        }
      }}>Clear data</button>
    </div>
  </div>
</div>

<!-- PITCH SLOT PICKER MODAL -->
{#if showPitchModal}
  <div class="modal-backdrop" onclick={() => { showPitchModal = false; addingNewPlayer = false; newPlayerName = '' }}>
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <div>
          <div class="modal-title">
            {#if pitchSlotTarget}#{pitchSlotTarget} — {SLOT_SHORT[pitchSlotTarget]}{:else}Add Player{/if}
          </div>
          <div class="modal-sub">
            {#if addingNewPlayer}Enter a name for the new player{:else}Choose a player or add a new one{/if}
          </div>
        </div>
        <button class="modal-close" onclick={() => { showPitchModal = false; addingNewPlayer = false; newPlayerName = '' }}>
          <svg style="width:18px;height:18px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {#if addingNewPlayer}
        <!-- Inline new player form -->
        <div class="new-player-form">
          <input
            class="new-player-input"
            type="text"
            placeholder="Player name"
            bind:value={newPlayerName}
            onkeydown={(e) => e.key === 'Enter' && addNewPlayerToSlot()}
            autofocus
          />
          <div class="new-player-actions">
            <button class="new-player-cancel" onclick={() => { addingNewPlayer = false; newPlayerName = '' }}>Cancel</button>
            <button class="new-player-submit" disabled={!newPlayerName.trim()} onclick={addNewPlayerToSlot}>
              <svg style="width:15px;height:15px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              {pitchSlotTarget ? 'Add & assign' : 'Add to squad'}
            </button>
          </div>
        </div>
      {:else}
        {#if pitchModalPlayers.length === 0}
          <div class="modal-empty">No named players yet — add one below.</div>
        {:else}
          <div class="modal-player-list">
            {#each pitchModalPlayers as p}
              {@const isCurrentlyInSlot = pitchSlotTarget ? slotMap[pitchSlotTarget]?.id === p.id : false}
              {@const isInOtherSlot = isInPitchSlot(p) && !isCurrentlyInSlot}
              <button
                class="modal-player-row"
                class:modal-player-active={isCurrentlyInSlot}
                class:modal-player-placed={isInOtherSlot}
                onclick={() => pitchSlotTarget ? assignPlayerToSlot(p.id) : null}
              >
                <span class="modal-num" class:num-sub={!isInPitchSlot(p)}>#{p.number}</span>
                <span class="modal-name">{p.name}</span>
                {#if isCurrentlyInSlot}
                  <span class="modal-tag current-tag">Current</span>
                {:else if isInOtherSlot}
                  <span class="modal-tag placed-tag">#{p.number} — {SLOT_SHORT[p.number] || p.position}</span>
                {:else}
                  <span class="modal-tag sub-tag">Sub</span>
                {/if}
              </button>
            {/each}
          </div>
        {/if}

        <!-- Add new player row -->
        <button class="add-new-player-row" onclick={() => addingNewPlayer = true}>
          <span class="add-new-icon">
            <svg style="width:16px;height:16px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </span>
          <span class="add-new-label">New player{#if pitchSlotTarget} — assign to #{pitchSlotTarget}{/if}</span>
        </button>

        {#if pitchSlotTarget && slotMap[pitchSlotTarget]}
          <button class="clear-slot-btn" onclick={() => assignPlayerToSlot(null)}>
            <svg style="width:14px;height:14px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            Clear this position
          </button>
        {/if}
      {/if}
    </div>
  </div>
{/if}

<style>
  .screen { display: flex; flex-direction: column; gap: 12px; padding-bottom: 2rem; }
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1rem; }

  /* ── HEADER ── */
  .page-header {
    display: flex; justify-content: space-between; align-items: flex-start;
    gap: 12px; flex-wrap: wrap;
  }
  .page-header h2 { font-size: 20px; font-weight: 700; color: var(--text); margin-bottom: 4px; }
  .page-header p { font-size: 13px; color: var(--text-muted); }
  .header-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

  /* ── VIEW TOGGLE ── */
  .view-toggle {
    display: flex; background: var(--surface-2); border: 1px solid var(--border);
    border-radius: 10px; padding: 3px; gap: 2px;
  }
  .view-toggle button {
    display: flex; align-items: center; gap: 5px;
    padding: 7px 12px; border: none; border-radius: 7px; background: none;
    font-size: 13px; font-weight: 600; color: var(--text-muted);
    cursor: pointer; font-family: inherit; transition: all 0.15s; white-space: nowrap;
  }
  .view-toggle button.active {
    background: var(--surface); color: var(--primary);
    box-shadow: 0 1px 4px rgba(0,0,0,0.1);
  }

  /* ── SAVE BUTTON ── */
  .save-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 9px 16px; background: var(--primary); color: var(--primary-text);
    border: none; border-radius: 8px; font-size: 14px; font-weight: 600;
    cursor: pointer; white-space: nowrap; transition: background 0.2s;
    flex-shrink: 0; font-family: inherit;
  }
  .save-btn.saved { background: #2d7a2d; color: white; }
  .save-btn.error { background: #c0392b; color: white; }
  .save-btn:hover:not(:disabled) { background: var(--primary-hover); }
  .save-btn:disabled { opacity: 0.7; cursor: not-allowed; }

  /* ── INFO CARD ── */
  .info-card {
    display: flex; gap: 10px; align-items: flex-start;
    background: rgba(var(--primary-rgb),0.06); border: 1px solid rgba(var(--primary-rgb),0.18);
    border-radius: 10px; padding: 0.875rem 1rem;
    font-size: 13px; color: var(--text-2); line-height: 1.5;
  }
  .info-icon { flex-shrink: 0; margin-top: 1px; }
  .info-text strong { color: var(--primary); }

  /* ── SECTION HEADER ── */
  .section-header { display: flex; align-items: baseline; gap: 8px; }
  .section-label { font-size: 11px; font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; color: var(--text-faint); }

  /* ── SQUAD TABLE ── */
  .squad-card { padding: 0; overflow: hidden; }
  .squad-col-labels {
    display: grid; grid-template-columns: 52px 1fr 100px 40px; gap: 8px;
    padding: 8px 14px; background: var(--surface-2);
    font-size: 11px; font-weight: 600; color: var(--text-faint);
    text-transform: uppercase; letter-spacing: 0.05em;
  }
  .squad-row {
    display: grid; grid-template-columns: 52px 1fr 100px 40px; gap: 8px;
    align-items: center; padding: 7px 14px;
    border-top: 1px solid var(--divider); transition: background 0.1s;
  }
  .squad-row:hover { background: var(--surface-2); }
  .squad-row.is-sub { background: var(--surface-3); }
  .input-num {
    width: 100%; padding: 9px 4px; border: 1px solid var(--input-border);
    border-radius: 6px; font-size: 16px; font-family: inherit;
    text-align: center; background: var(--surface); min-height: 40px; color: var(--text);
  }
  .input-name {
    width: 100%; padding: 9px 10px; border: 1px solid var(--input-border);
    border-radius: 6px; font-size: 16px; font-family: inherit;
    background: var(--surface); min-height: 40px; color: var(--text);
  }
  .input-pos {
    width: 100%; padding: 9px 6px; border: 1px solid var(--input-border);
    border-radius: 6px; font-size: 15px; font-family: inherit;
    background: var(--surface); color: var(--text); min-height: 40px;
  }
  .input-num:focus, .input-name:focus, .input-pos:focus { outline: none; border-color: var(--primary); }
  .delete-btn {
    background: none; border: none; color: var(--text-faint); cursor: pointer;
    padding: 6px; border-radius: 4px; display: flex; align-items: center;
    justify-content: center; min-width: 36px; min-height: 36px;
  }
  .delete-btn:hover { color: #e53935; background: rgba(229,57,53,0.08); }
  .empty-section { padding: 1.5rem; text-align: center; color: var(--text-faint); font-size: 13px; }

  /* ── ADD PLAYER ── */
  .add-player-btn {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    width: 100%; padding: 12px; border: 2px dashed var(--input-border);
    border-radius: 10px; background: none; color: var(--text-faint);
    font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.15s; font-family: inherit;
  }
  .add-player-btn:hover { border-color: var(--primary); color: var(--primary); }

  /* ── SUMMARY ── */
  .summary-card { }
  .summary-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; margin-top: 10px; }
  .summary-item { text-align: center; background: var(--surface-2); border-radius: 8px; padding: 0.75rem 0.5rem; }
  .summary-val { font-size: 22px; font-weight: 700; color: var(--primary); }
  .summary-label { font-size: 11px; color: var(--text-faint); margin-top: 2px; }

  /* ── SAVE FULL ── */
  .save-btn-full {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    width: 100%; padding: 15px; background: var(--primary); color: var(--primary-text);
    border: none; border-radius: 10px; font-size: 16px; font-weight: 700;
    cursor: pointer; transition: background 0.2s; font-family: inherit;
  }
  .save-btn-full.saved { background: #2d7a2d; color: white; }
  .save-btn-full.error { background: #c0392b; color: white; }
  .save-btn-full:hover:not(:disabled) { background: var(--primary-hover); }
  .save-btn-full:disabled { opacity: 0.7; cursor: not-allowed; }

  /* ── PITCH VIEW ── */
  .pitch-hint {
    font-size: 13px; color: var(--text-muted); line-height: 1.5;
    background: var(--surface-2); border-radius: 10px;
    padding: 10px 14px; border: 1px solid var(--border);
  }
  .pitch-hint strong { color: var(--text); }

  .pitch-wrap {
    background: #1e6b1e;
    border-radius: 14px;
    overflow: hidden;
    box-shadow: 0 4px 20px rgba(0,0,0,0.18);
    position: relative;
  }

  /* Goal areas */
  .pitch-goal-area {
    height: 14px;
    background: rgba(255,255,255,0.06);
    border-bottom: 1px solid rgba(255,255,255,0.15);
    position: relative;
  }
  .pitch-goal-area::before {
    content: '';
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    width: 40%;
    height: 100%;
    border: 1px solid rgba(255,255,255,0.18);
    border-bottom: none;
    top: 0;
  }
  .top-goal::before { border-bottom: 1px solid rgba(255,255,255,0.18); border-top: none; }
  .bottom-goal::before { border-top: none; border-bottom: none; top: auto; bottom: 0; }
  .bottom-goal { border-bottom: none; border-top: 1px solid rgba(255,255,255,0.15); }

  .pitch-field {
    padding: 10px 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    position: relative;
  }

  /* Centre line */
  .pitch-centre-line {
    height: 0;
    position: relative;
    z-index: 1;
    pointer-events: none;
    margin: 2px 0;
  }
  .pitch-centre-line::before {
    content: '';
    position: absolute;
    left: 0; right: 0;
    top: 0;
    height: 1px;
    background: rgba(255,255,255,0.25);
  }
  .pitch-centre-circle {
    position: absolute;
    left: 50%; top: 50%;
    transform: translate(-50%, -50%);
    width: 48px; height: 48px;
    border-radius: 50%;
    border: 1px solid rgba(255,255,255,0.2);
    background: rgba(255,255,255,0.03);
    margin-top: -24px;
  }

  /* Pitch rows */
  .pitch-row {
    display: flex;
    justify-content: center;
    gap: 6px;
  }
  .row-mid { gap: 24px; }
  .row-gk { }

  /* Position slots */
  .pos-slot {
    flex: 1;
    max-width: 110px;
    min-height: 62px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    border-radius: 10px;
    border: 1.5px dashed rgba(255,255,255,0.3);
    background: rgba(0,0,0,0.2);
    cursor: pointer;
    padding: 6px 4px;
    transition: all 0.15s;
    font-family: inherit;
    position: relative;
  }
  .pos-slot:active { transform: scale(0.95); }
  .pos-slot.slot-filled {
    border-style: solid;
    border-color: rgba(255,255,255,0.55);
    background: rgba(0,0,0,0.35);
  }
  .pos-slot.slot-gk {
    max-width: 130px;
    min-height: 56px;
  }
  .slot-jersey {
    position: absolute;
    top: 5px; left: 7px;
    font-size: 10px; font-weight: 800;
    color: rgba(255,255,255,0.45);
    line-height: 1;
  }
  .slot-name {
    font-size: 12px; font-weight: 700;
    color: #ffffff;
    text-align: center;
    line-height: 1.25;
    word-break: break-word;
    max-width: 100%;
    padding: 0 4px;
  }
  .slot-pos-label {
    font-size: 10px;
    color: rgba(255,255,255,0.5);
    font-weight: 500;
    text-align: center;
    margin-top: 1px;
  }
  .slot-empty-label {
    font-size: 11px; font-weight: 600;
    color: rgba(255,255,255,0.5);
    text-align: center;
  }
  .slot-tap {
    font-size: 9px;
    color: rgba(255,255,255,0.3);
    margin-top: 1px;
  }

  /* Subs panel */
  .subs-panel {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 1rem;
  }
  .subs-panel-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
  .subs-panel-title { font-size: 13px; font-weight: 700; color: var(--text); }
  .subs-panel-count { font-size: 12px; color: var(--text-faint); }
  .subs-chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .sub-chip {
    display: flex; align-items: center; gap: 5px;
    background: var(--surface-2); border: 1px solid var(--border);
    border-radius: 20px; padding: 5px 10px;
  }
  .sub-chip-num { font-size: 11px; font-weight: 700; color: var(--primary); }
  .sub-chip-name { font-size: 13px; font-weight: 500; color: var(--text); }
  .subs-empty { font-size: 13px; color: var(--text-faint); padding: 4px 0; }

  /* ── PITCH MODAL ── */
  .modal-backdrop {
    position: fixed; inset: 0; background: rgba(0,0,0,0.5);
    display: flex; align-items: flex-end; justify-content: center; z-index: 200;
  }
  .modal {
    background: var(--surface); border-radius: 20px 20px 0 0;
    padding: 0; width: 100%; max-width: 480px; max-height: 80vh;
    display: flex; flex-direction: column;
    overflow: hidden;
  }
  .modal-header {
    display: flex; align-items: flex-start; justify-content: space-between;
    padding: 1.25rem 1.25rem 0.75rem; gap: 12px;
    border-bottom: 1px solid var(--divider);
    flex-shrink: 0;
  }
  .modal-title { font-size: 17px; font-weight: 700; color: var(--text); }
  .modal-sub { font-size: 13px; color: var(--text-muted); margin-top: 2px; }
  .modal-close {
    background: var(--surface-2); border: none; border-radius: 50%;
    width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
    cursor: pointer; color: var(--text-muted); flex-shrink: 0;
  }
  .modal-close:hover { background: var(--surface-3); color: var(--text); }
  .modal-empty { padding: 2rem 1.25rem; text-align: center; color: var(--text-faint); font-size: 13px; }

  .modal-player-list {
    overflow-y: auto;
    padding: 0.5rem 0;
    flex: 1;
  }
  .modal-player-row {
    display: flex; align-items: center; gap: 10px;
    width: 100%; padding: 12px 1.25rem;
    border: none; background: none; cursor: pointer;
    font-family: inherit; text-align: left;
    transition: background 0.1s; border-bottom: 1px solid var(--divider-faint);
  }
  .modal-player-row:last-child { border-bottom: none; }
  .modal-player-row:hover { background: var(--surface-2); }
  .modal-player-row.modal-player-active {
    background: rgba(var(--primary-rgb), 0.08);
  }
  .modal-player-row.modal-player-placed { opacity: 0.75; }

  .modal-num {
    font-size: 13px; font-weight: 700; color: var(--primary);
    background: rgba(var(--primary-rgb), 0.1);
    border-radius: 6px; padding: 3px 7px; flex-shrink: 0;
    min-width: 36px; text-align: center;
  }
  .modal-num.num-sub { color: var(--text-muted); background: var(--surface-2); }
  .modal-name { flex: 1; font-size: 15px; font-weight: 600; color: var(--text); }

  .modal-tag {
    font-size: 11px; font-weight: 600; padding: 3px 8px;
    border-radius: 20px; white-space: nowrap; flex-shrink: 0;
  }
  .current-tag { background: rgba(var(--primary-rgb), 0.12); color: var(--primary); }
  .placed-tag { background: var(--surface-2); color: var(--text-faint); }
  .sub-tag { background: var(--surface-2); color: var(--text-faint); }

  /* ── NEW PLAYER FORM ── */
  .new-player-form {
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 12px;
    flex: 1;
  }
  .new-player-input {
    width: 100%;
    padding: 14px;
    border: 1.5px solid var(--input-border);
    border-radius: 10px;
    font-size: 16px;
    font-family: inherit;
    background: var(--surface);
    color: var(--text);
    outline: none;
  }
  .new-player-input:focus { border-color: var(--primary); }
  .new-player-actions {
    display: flex;
    gap: 8px;
  }
  .new-player-cancel {
    flex: 1; padding: 12px; border-radius: 9px;
    border: 1px solid var(--border); background: var(--surface-2);
    color: var(--text-muted); font-size: 15px; font-weight: 600;
    cursor: pointer; font-family: inherit; transition: all 0.15s;
  }
  .new-player-cancel:hover { border-color: var(--input-border); color: var(--text); }
  .new-player-submit {
    flex: 2; padding: 12px; border-radius: 9px;
    border: none; background: var(--primary); color: var(--primary-text);
    font-size: 15px; font-weight: 700; cursor: pointer; font-family: inherit;
    display: flex; align-items: center; justify-content: center; gap: 6px;
    transition: background 0.15s;
  }
  .new-player-submit:hover:not(:disabled) { background: var(--primary-hover); }
  .new-player-submit:disabled { opacity: 0.45; cursor: not-allowed; }

  /* ── ADD NEW PLAYER ROW (in modal list) ── */
  .add-new-player-row {
    display: flex; align-items: center; gap: 10px;
    width: 100%; padding: 14px 1.25rem;
    border: none; border-top: 1px solid var(--divider);
    background: none; cursor: pointer; font-family: inherit;
    transition: background 0.1s; flex-shrink: 0;
  }
  .add-new-player-row:hover { background: rgba(var(--primary-rgb), 0.05); }
  .add-new-icon {
    width: 30px; height: 30px; border-radius: 50%;
    background: rgba(var(--primary-rgb), 0.1);
    display: flex; align-items: center; justify-content: center;
    color: var(--primary); flex-shrink: 0;
  }
  .add-new-label { font-size: 14px; font-weight: 600; color: var(--primary); }

  /* ── SUBS ADD BUTTON ── */
  .subs-add-btn {
    display: flex; align-items: center; justify-content: center; gap: 6px;
    width: 100%; margin-top: 10px; padding: 10px;
    border: 1.5px dashed var(--input-border); border-radius: 8px;
    background: none; color: var(--text-faint); font-size: 13px; font-weight: 600;
    cursor: pointer; font-family: inherit; transition: all 0.15s;
  }
  .subs-add-btn:hover { border-color: var(--primary); color: var(--primary); }

  /* ── SUB CHIP REMOVE ── */
  .sub-chip { position: relative; }
  .sub-chip-remove {
    background: none; border: none; padding: 3px;
    color: var(--text-faint); cursor: pointer; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    line-height: 1; transition: color 0.15s;
  }
  .sub-chip-remove:hover { color: #e53935; }

  .clear-slot-btn {
    display: flex; align-items: center; justify-content: center; gap: 7px;
    width: 100%; padding: 14px; border-top: 1px solid var(--divider);
    border: none; border-top: 1px solid var(--divider);
    background: none; color: #e53935; font-size: 14px; font-weight: 600;
    cursor: pointer; font-family: inherit; transition: background 0.15s;
    flex-shrink: 0;
  }
  .clear-slot-btn:hover { background: rgba(229,57,53,0.06); }

  /* ── DANGER ZONE ── */
  .danger-zone { margin-top: 1rem; }
  .danger-card {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    background: var(--surface); border: 1px solid #fca5a5;
    border-radius: 12px; padding: 1rem 1.25rem; margin-top: 8px; flex-wrap: wrap;
  }
  .danger-title { font-size: 14px; font-weight: 600; color: var(--text); margin-bottom: 2px; }
  .danger-sub { font-size: 12px; color: var(--text-muted); }
  .danger-btn {
    padding: 8px 18px; border-radius: 8px; border: 1.5px solid #e53935;
    background: none; color: #e53935; font-size: 13px; font-weight: 600;
    cursor: pointer; white-space: nowrap; font-family: inherit; transition: all 0.15s;
  }
  .danger-btn:hover { background: #e53935; color: white; }

  /* ── MISC ── */
  .loading { text-align: center; padding: 3rem; color: var(--text-faint); font-size: 14px; }

  /* ── RESPONSIVE ── */
  @media (max-width: 480px) {
    .squad-col-labels, .squad-row { grid-template-columns: 44px 1fr 76px 40px; gap: 6px; padding: 8px 10px; }
    .summary-grid { grid-template-columns: repeat(2,1fr); }
    .page-header { flex-direction: column; }
    .header-right { width: 100%; justify-content: space-between; }
    .pos-slot { min-height: 56px; }
    .slot-name { font-size: 11px; }
  }
</style>
