<script>
  import { onMount } from 'svelte'
  import { getDB, loadMatches } from './db.js'
  import { settingsStore } from './settings-store.js'

  let settings = { ...$settingsStore }
  let saved = false
  let exportSuccess = false

  function saveSettings() {
    settingsStore.save(settings)
    saved = true
    setTimeout(() => saved = false, 3000)
  }

  const allPossibleStats = [
    'Point', 'Goal', 'Wide', 'Tackle', 'Block',
    'Turnover Won', 'Turnover Lost', 'Free Won',
    'Yellow Card', 'Red Card', 'Penalty Won', 'Penalty Scored'
  ]

  let newStat = ''

  function toggleStat(stat) {
    if (settings.defaultStats.includes(stat)) {
      if (settings.defaultStats.length <= 1) return
      settings.defaultStats = settings.defaultStats.filter(s => s !== stat)
    } else {
      settings.defaultStats = [...settings.defaultStats, stat]
    }
  }

  function addCustomDefaultStat() {
    const trimmed = newStat.trim()
    if (!trimmed || allPossibleStats.includes(trimmed) || settings.defaultStats.includes(trimmed)) return
    settings.defaultStats = [...settings.defaultStats, trimmed]
    newStat = ''
  }

  async function exportData() {
    const matches = await loadMatches()
    const db = await getDB()
    const squad = await db.getAll('squad')
    const data = {
      exportDate: new Date().toISOString(),
      version: '1.0',
      settings,
      squad,
      matches
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `doora-stats-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
    exportSuccess = true
    setTimeout(() => exportSuccess = false, 3000)
  }
</script>

<div class="screen">

  <div class="page-header">
    <div>
      <h2>Settings</h2>
      <p>Configure the app for your team</p>
    </div>
    <button class="save-btn" class:saved on:click={saveSettings}>
      {saved ? '✓ Saved' : 'Save Settings'}
    </button>
  </div>

  <!-- TEAM NAME -->
  <div class="card">
    <div class="card-title">Team</div>
    <div class="field-group">
      <label>Team name</label>
      <input bind:value={settings.teamName} placeholder="e.g. Doora Barefield" />
    </div>
    <div class="field-group">
      <label>Age group</label>
      <select bind:value={settings.ageGroup}>
        <option value="U12">U12</option>
        <option value="U13">U13</option>
        <option value="U14">U14</option>
        <option value="U15">U15</option>
        <option value="U16">U16</option>
        <option value="Minor">Minor (U17)</option>
        <option value="U18">U18</option>
        <option value="U20">U20</option>
        <option value="Junior">Junior</option>
        <option value="Senior">Senior</option>
      </select>
    </div>
  </div>

  <!-- PERIOD LENGTH -->
  <div class="card">
    <div class="card-title">Match settings</div>
    <div class="field-group">
      <label>Period length (minutes)</label>
      <div class="period-row">
        <input
          type="range"
          min="15"
          max="40"
          step="5"
          bind:value={settings.periodLength}
        />
        <span class="period-val">{settings.periodLength} min</span>
      </div>
      <div class="field-hint">Used as a reference for match duration. Timer will highlight when this time is reached.</div>
    </div>
  </div>

  <!-- DEFAULT STATS -->
  <div class="card">
    <div class="card-title">Default stats</div>
    <p class="card-sub">These stats appear in the counter grid for every new match. Toggle them on or off.</p>

    <div class="stats-grid">
      {#each allPossibleStats as stat}
        <button
          class="stat-toggle"
          class:active={settings.defaultStats.includes(stat)}
          on:click={() => toggleStat(stat)}
        >
          <span class="toggle-check">
            {#if settings.defaultStats.includes(stat)}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            {/if}
          </span>
          {stat}
        </button>
      {/each}
    </div>

    <div class="add-stat-row">
      <input
        bind:value={newStat}
        placeholder="Add a custom default stat..."
        on:keydown={e => e.key === 'Enter' && addCustomDefaultStat()}
      />
      <button class="add-stat-btn" on:click={addCustomDefaultStat}>Add</button>
    </div>

    {#if settings.defaultStats.filter(s => !allPossibleStats.includes(s)).length > 0}
      <div class="custom-stats-list">
        <div class="section-label" style="margin-bottom:6px">Custom defaults</div>
        {#each settings.defaultStats.filter(s => !allPossibleStats.includes(s)) as stat}
          <div class="custom-stat-row">
            <span>{stat}</span>
            <button class="remove-btn" on:click={() => toggleStat(stat)}>Remove</button>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- APPEARANCE -->
  <div class="card">
    <div class="card-title">Appearance</div>
    <div class="appearance-row">
      <div>
        <div class="appearance-label">Dark mode</div>
        <div class="appearance-sub">Easier on the eyes in low light</div>
      </div>
      <button
        class="dark-toggle"
        class:on={settings.darkMode}
        on:click={() => { settings.darkMode = !settings.darkMode; saveSettings() }}
        aria-label="Toggle dark mode"
      >
        <span class="dark-toggle-thumb"></span>
      </button>
    </div>
  </div>

  <!-- DATA EXPORT -->
  <div class="card">
    <div class="card-title">Data backup</div>
    <p class="card-sub">Download a full backup of all your matches, squad and settings as a JSON file. Keep this safe — it's your only backup until Supabase sync is set up.</p>
    <button class="export-btn" class:success={exportSuccess} on:click={exportData}>
      {#if exportSuccess}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:16px;height:16px"><polyline points="20 6 9 17 4 12"/></svg>
        Backup downloaded
      {:else}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Download backup
      {/if}
    </button>
  </div>

  <!-- ABOUT -->
  <div class="card about-card">
    <div class="card-title">About</div>
    <div class="about-row">
      <span class="about-label">App</span>
      <span class="about-val">Doora Barefield Stats</span>
    </div>
    <div class="about-row">
      <span class="about-label">Version</span>
      <span class="about-val">1.0.0</span>
    </div>
    <div class="about-row">
      <span class="about-label">Built for</span>
      <span class="about-val">Doora Barefield GAA · Minor Hurling</span>
    </div>
    <div class="about-row">
      <span class="about-label">Storage</span>
      <span class="about-val">Local (IndexedDB)</span>
    </div>
    <div class="about-row">
      <span class="about-label">Sync</span>
      <span class="about-val">Coming soon (Supabase)</span>
    </div>
  </div>

  <button class="save-btn-full" class:saved on:click={saveSettings}>
    {saved ? '✓ Settings Saved!' : 'Save Settings'}
  </button>

</div>

<style>
  .screen { display: flex; flex-direction: column; gap: 12px; padding-bottom: 2rem; }
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1rem; display: flex; flex-direction: column; gap: 12px; }

  .page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
  .page-header h2 { font-size: 20px; font-weight: 700; color: var(--text); margin-bottom: 4px; }
  .page-header p { font-size: 13px; color: var(--text-muted); }

  .card-title { font-size: 13px; font-weight: 700; color: var(--text); }
  .card-sub { font-size: 13px; color: var(--text-muted); line-height: 1.5; margin-top: -4px; }

  .field-group { display: flex; flex-direction: column; gap: 6px; }
  .field-group label { font-size: 12px; font-weight: 600; color: var(--text-2); }
  .field-group input {
    padding: 13px 14px;
    border: 1.5px solid var(--input-border);
    border-radius: 10px;
    font-size: 16px;
    font-family: inherit;
    background: var(--surface-3);
    transition: all 0.15s;
    min-height: 46px;
  }
  .field-group input:focus { outline: none; border-color: #6B1B2B; background: var(--surface); box-shadow: 0 0 0 3px rgba(107,27,43,0.08); }
  .field-hint { font-size: 12px; color: var(--text-faint); line-height: 1.4; }

  .period-row { display: flex; align-items: center; gap: 12px; }
  .period-row input[type="range"] { flex: 1; accent-color: #6B1B2B; }
  .period-val { font-size: 15px; font-weight: 700; color: #6B1B2B; min-width: 56px; }

  .stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 8px; }
  .stat-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 11px 12px;
    border-radius: 8px;
    border: 1.5px solid var(--input-border);
    background: var(--surface);
    font-size: 14px;
    font-weight: 500;
    color: var(--text-muted);
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
    text-align: left;
    min-height: 44px;
  }
  .stat-toggle.active { border-color: #6B1B2B; color: var(--text); background: rgba(107,27,43,0.08); }
  .toggle-check {
    width: 18px;
    height: 18px;
    border-radius: 4px;
    border: 1.5px solid var(--input-border);
    background: var(--surface);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: #6B1B2B;
  }
  .stat-toggle.active .toggle-check { background: #6B1B2B; border-color: #6B1B2B; color: white; }
  .toggle-check svg { width: 11px; height: 11px; }

  .add-stat-row { display: flex; gap: 8px; margin-top: 4px; }
  .add-stat-row input {
    flex: 1;
    padding: 11px 12px;
    border: 1.5px solid var(--input-border);
    border-radius: 8px;
    font-size: 16px;
    font-family: inherit;
    background: var(--surface-3);
    min-height: 44px;
  }
  .add-stat-row input:focus { outline: none; border-color: #6B1B2B; background: var(--surface); }
  .add-stat-btn {
    padding: 11px 16px;
    border-radius: 8px;
    border: none;
    background: #6B1B2B;
    color: white;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    min-height: 44px;
  }

  .custom-stats-list { border-top: 1px solid var(--divider); padding-top: 10px; display: flex; flex-direction: column; gap: 6px; }
  .custom-stat-row { display: flex; align-items: center; justify-content: space-between; font-size: 13px; color: var(--text); padding: 4px 0; }
  .remove-btn { background: none; border: none; color: #e53935; font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit; }

  .section-label { font-size: 11px; font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; color: var(--text-faint); }

  .export-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 11px 18px;
    border-radius: 10px;
    border: 1.5px solid #6B1B2B;
    background: none;
    color: #6B1B2B;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
    width: fit-content;
  }
  .export-btn:hover { background: #6B1B2B; color: white; }
  .export-btn.success { background: #e6f4ea; border-color: #2d7a2d; color: #2d7a2d; }

  .about-card { gap: 0; }
  .about-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--divider-faint); font-size: 13px; }
  .about-row:last-child { border-bottom: none; }
  .about-label { color: var(--text-faint); }
  .about-val { font-weight: 500; color: var(--text); text-align: right; }

  .save-btn {
    padding: 11px 20px;
    background: #6B1B2B;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.2s;
    flex-shrink: 0;
    min-height: 44px;
  }
  .save-btn.saved { background: #2d7a2d; }
  .save-btn:hover { background: #551522; }

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
    font-family: inherit;
    transition: background 0.2s;
  }
  .save-btn-full.saved { background: #2d7a2d; }
  .save-btn-full:hover { background: #551522; }

  .appearance-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .appearance-label { font-size: 14px; font-weight: 600; color: var(--text); }
  .appearance-sub { font-size: 12px; color: var(--text-muted); margin-top: 2px; }

  .dark-toggle {
    position: relative; width: 48px; height: 28px; border-radius: 14px;
    border: none; background: #ddd; cursor: pointer; transition: background 0.2s;
    flex-shrink: 0; padding: 0;
  }
  .dark-toggle.on { background: #6B1B2B; }
  .dark-toggle-thumb {
    position: absolute; top: 3px; left: 3px;
    width: 22px; height: 22px; border-radius: 50%;
    background: white; transition: transform 0.2s;
    display: block;
  }
  .dark-toggle.on .dark-toggle-thumb { transform: translateX(20px); }

  @media (max-width: 480px) {
    .stats-grid { grid-template-columns: repeat(2, 1fr); }
    .page-header { flex-direction: column; }
    .save-btn { width: 100%; text-align: center; }
  }
</style>