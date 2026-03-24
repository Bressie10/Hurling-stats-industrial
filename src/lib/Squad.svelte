<script>
  import { onMount } from 'svelte'
  import { saveSquad, loadSquad, clearAllData } from './db.js'

  let players = []
  let nextId = 21
  let saved = false
  let loading = true

  const positions = ['GK', 'FB', 'HB', 'MF', 'HF', 'FF', 'Sub']

  const defaultSquad = Array.from({ length: 20 }, (_, i) => ({
    id: i + 1,
    name: '',
    number: i + 1,
    position: i < 15
      ? ['GK','FB','FB','FB','HB','HB','HB','MF','MF','HF','HF','HF','FF','FF','FF'][i]
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

  function addPlayer() {
    players = [...players, {
      id: nextId++,
      name: '',
      number: players.length + 1,
      position: 'Sub'
    }]
    saved = false
  }

  function removePlayer(id) {
    if (players.length <= 1) return
    players = players.filter(p => p.id !== id)
    saved = false
  }

  function markChanged() {
    saved = false
  }

  async function handleSave() {
    await saveSquad(players)
    saved = true
    setTimeout(() => saved = false, 3000)
  }

  $: starters = players.filter(p => p.position !== 'Sub')
  $: subs = players.filter(p => p.position === 'Sub')
</script>

<div class="screen">

  <!-- HEADER -->
  <div class="page-header">
    <div>
      <h2>Squad Management</h2>
      <p>Your saved squad loads automatically every time you set up a new match. Update it here anytime.</p>
    </div>
    <button class="save-btn" class:saved on:click={handleSave}>
      {saved ? '✓ Saved' : 'Save Squad'}
    </button>
  </div>

  {#if loading}
    <div class="loading">Loading squad...</div>
  {:else}

    <!-- HOW IT WORKS -->
    <div class="info-card">
      <div class="info-icon">💡</div>
      <div class="info-text">
        <strong>How it works:</strong> Add your full panel here once. Every time you start a new match,
        this squad loads automatically. You can still make changes on match day — swap jersey numbers,
        move players from sub to starting, or add late additions.
      </div>
    </div>

    <!-- STARTERS -->
    <div class="section-header">
      <div class="section-label">Starting 15 ({starters.length})</div>
      <div class="section-hint">Players with a field position</div>
    </div>

    <div class="card squad-card">
      <div class="squad-col-labels">
        <span>#</span>
        <span>Name</span>
        <span>Position</span>
        <span></span>
      </div>
      {#each starters as player (player.id)}
        <div class="squad-row">
          <input
            class="input-num"
            type="number"
            bind:value={player.number}
            min="1" max="99"
            on:input={markChanged}
          />
          <input
            class="input-name"
            bind:value={player.name}
            placeholder="Player name"
            on:input={markChanged}
          />
          <select
            class="input-pos"
            bind:value={player.position}
            on:change={markChanged}
          >
            {#each positions as pos}
              <option value={pos}>{pos}</option>
            {/each}
          </select>
          <button class="delete-btn" on:click={() => removePlayer(player.id)} title="Remove player">✕</button>
        </div>
      {/each}
    </div>

    <!-- SUBS -->
    <div class="section-header">
      <div class="section-label">Substitutes ({subs.length})</div>
      <div class="section-hint">Players listed as Sub</div>
    </div>

    <div class="card squad-card">
      {#if subs.length === 0}
        <div class="empty-section">No substitutes added yet</div>
      {:else}
        <div class="squad-col-labels">
          <span>#</span>
          <span>Name</span>
          <span>Position</span>
          <span></span>
        </div>
        {#each subs as player (player.id)}
          <div class="squad-row is-sub">
            <input
              class="input-num"
              type="number"
              bind:value={player.number}
              min="1" max="99"
              on:input={markChanged}
            />
            <input
              class="input-name"
              bind:value={player.name}
              placeholder="Player name"
              on:input={markChanged}
            />
            <select
              class="input-pos"
              bind:value={player.position}
              on:change={markChanged}
            >
              {#each positions as pos}
                <option value={pos}>{pos}</option>
              {/each}
            </select>
            <button class="delete-btn" on:click={() => removePlayer(player.id)} title="Remove player">✕</button>
          </div>
        {/each}
      {/if}
    </div>

    <!-- ADD PLAYER BUTTON -->
    <button class="add-player-btn" on:click={addPlayer}>
      <span class="add-icon">+</span>
      Add Player
    </button>

    <!-- SQUAD SUMMARY -->
    <div class="card summary-card">
      <div class="section-label">Squad summary</div>
      <div class="summary-grid">
        <div class="summary-item">
          <div class="summary-val">{players.length}</div>
          <div class="summary-label">Total players</div>
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

    <!-- SAVE BUTTON BOTTOM -->
    <button class="save-btn-full" class:saved on:click={handleSave}>
      {saved ? '✓ Squad Saved!' : 'Save Squad'}
    </button>

  {/if}

  <div class="danger-zone">
  <div class="section-label">Danger zone</div>
  <div class="danger-card">
    <div class="danger-info">
      <div class="danger-title">Clear all data</div>
      <div class="danger-sub">Deletes all matches, stats and squad data permanently. Cannot be undone.</div>
    </div>
    <button class="danger-btn" on:click={async () => {
      if (confirm('Are you sure? This will delete everything permanently.')) {
        await clearAllData()
        players = []
        alert('All data cleared.')
      }
    }}>Clear data</button>
  </div>
</div>
</div>

<style>
.danger-zone { margin-top: 1rem; }
  .danger-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    background: var(--surface);
    border: 1px solid #fca5a5; /* danger zone — keep red */
    border-radius: 12px;
    padding: 1rem 1.25rem;
    margin-top: 8px;
    flex-wrap: wrap;
  }
  .danger-title { font-size: 14px; font-weight: 600; color: var(--text); margin-bottom: 2px; }
  .danger-sub { font-size: 12px; color: var(--text-muted); }
  .danger-btn {
    padding: 8px 18px;
    border-radius: 8px;
    border: 1.5px solid #e53935;
    background: none;
    color: #e53935;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    font-family: inherit;
    transition: all 0.15s;
  }
  .danger-btn:hover { background: #e53935; color: white; }
  .screen { display: flex; flex-direction: column; gap: 12px; padding-bottom: 2rem; }
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1rem; }

  /* HEADER */
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    flex-wrap: wrap;
  }
  .page-header h2 { font-size: 20px; font-weight: 700; color: var(--text); margin-bottom: 4px; }
  .page-header p { font-size: 13px; color: var(--text-muted); max-width: 500px; }

  .save-btn {
    padding: 9px 20px;
    background: #6B1B2B;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.2s;
    flex-shrink: 0;
  }
  .save-btn.saved { background: #2d7a2d; }
  .save-btn:hover { background: #551522; }

  /* INFO CARD */
  .info-card {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    background: rgba(107,27,43,0.06);
    border: 1px solid rgba(107,27,43,0.18);
    border-radius: 10px;
    padding: 0.875rem 1rem;
    font-size: 13px;
    color: var(--text-2);
    line-height: 1.5;
  }
  .info-icon { font-size: 18px; flex-shrink: 0; margin-top: 1px; }
  .info-text strong { color: #6B1B2B; }

  /* SECTION HEADER */
  .section-header {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  .section-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--text-faint);
  }
  .section-hint { font-size: 12px; color: var(--text-faint); }

  /* SQUAD TABLE */
  .squad-card { padding: 0; overflow: hidden; }
  .squad-col-labels {
    display: grid;
    grid-template-columns: 52px 1fr 100px 40px;
    gap: 8px;
    padding: 8px 14px;
    background: var(--surface-2);
    font-size: 11px;
    font-weight: 600;
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .squad-row {
    display: grid;
    grid-template-columns: 52px 1fr 100px 40px;
    gap: 8px;
    align-items: center;
    padding: 7px 14px;
    border-top: 1px solid var(--divider);
    transition: background 0.1s;
  }
  .squad-row:hover { background: var(--surface-2); }
  .squad-row.is-sub { background: var(--surface-3); }

  .input-num {
    width: 100%;
    padding: 9px 4px;
    border: 1px solid var(--input-border);
    border-radius: 6px;
    font-size: 16px;
    font-family: inherit;
    text-align: center;
    background: var(--surface);
    min-height: 40px;
  }
  .input-name {
    width: 100%;
    padding: 9px 10px;
    border: 1px solid var(--input-border);
    border-radius: 6px;
    font-size: 16px;
    font-family: inherit;
    background: var(--surface);
    min-height: 40px;
  }
  .input-pos {
    width: 100%;
    padding: 9px 6px;
    border: 1px solid var(--input-border);
    border-radius: 6px;
    font-size: 15px;
    font-family: inherit;
    background: var(--surface);
    color: var(--text);
    min-height: 40px;
  }
  .input-num:focus, .input-name:focus, .input-pos:focus {
    outline: none;
    border-color: #6B1B2B;
  }

  .delete-btn {
    background: none;
    border: none;
    color: var(--text-faint);
    font-size: 18px;
    cursor: pointer;
    padding: 6px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 36px;
    min-height: 36px;
  }
  .delete-btn:hover { color: #e53935; background: rgba(229,57,53,0.08); }

  .empty-section {
    padding: 1.5rem;
    text-align: center;
    color: var(--text-faint);
    font-size: 13px;
  }

  /* ADD PLAYER */
  .add-player-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 12px;
    border: 2px dashed var(--input-border);
    border-radius: 10px;
    background: none;
    color: var(--text-faint);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    font-family: inherit;
  }
  .add-player-btn:hover { border-color: #6B1B2B; color: #6B1B2B; }
  .add-icon { font-size: 18px; line-height: 1; }

  /* SUMMARY */
  .summary-card { }
  .summary-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-top: 10px;
  }
  .summary-item {
    text-align: center;
    background: var(--surface-2);
    border-radius: 8px;
    padding: 0.75rem 0.5rem;
  }
  .summary-val { font-size: 22px; font-weight: 700; color: #6B1B2B; }
  .summary-label { font-size: 11px; color: var(--text-faint); margin-top: 2px; }

  /* SAVE BOTTOM */
  .save-btn-full {
    width: 100%;
    padding: 15px;
    background: #6B1B2B;
    color: white;
    border: none;
    border-radius: 10px;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.2s;
    font-family: inherit;
  }
  .save-btn-full.saved { background: #2d7a2d; }
  .save-btn-full:hover { background: #551522; }

  .loading {
    text-align: center;
    padding: 3rem;
    color: var(--text-faint);
    font-size: 14px;
  }

  /* RESPONSIVE */
  @media (max-width: 480px) {
    .squad-col-labels,
    .squad-row { grid-template-columns: 44px 1fr 76px 40px; gap: 6px; padding: 8px 10px; }
    .summary-grid { grid-template-columns: repeat(2, 1fr); }
    .page-header { flex-direction: column; }
    .save-btn { width: 100%; text-align: center; }
  }
</style>