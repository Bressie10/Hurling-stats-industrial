<script>
  import { subscriptionStore, createTeam, loadClubTeams, deleteTeam, loadSubscription } from './subscription-store.js'
  import { user } from './auth-store.js'

  export let onDone = () => {}

  const MAX_TEAMS = 4

  let teams = []
  let newTeamName = ''
  let adding = false
  let addError = null
  let loading = true

  async function load() {
    if (!$subscriptionStore.clubId) { loading = false; return }
    teams = await loadClubTeams($subscriptionStore.clubId)
    loading = false
  }

  $: if ($subscriptionStore.clubId && loading) load()

  async function addTeam() {
    if (!newTeamName.trim()) { addError = 'Enter a team name'; return }
    if (teams.length >= MAX_TEAMS) { addError = 'Maximum 4 teams reached'; return }
    adding = true; addError = null
    try {
      const team = await createTeam($subscriptionStore.clubId, newTeamName)
      teams = [...teams, team]
      newTeamName = ''
    } catch (e) {
      addError = e.message
    }
    adding = false
  }

  async function removeTeam(teamId) {
    if (!confirm('Delete this team? Coaches using it will lose access.')) return
    await deleteTeam(teamId)
    teams = teams.filter(t => t.id !== teamId)
  }

  function copyCode(code) {
    navigator.clipboard.writeText(code)
  }

  function shareWhatsApp(team) {
    const text = `Join ${$subscriptionStore.clubName} — ${team.name} on GAA Stats!\n\nYour team code: ${team.code}\n\nDownload the app, tap "Join my team" and enter this code.`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  async function handleDone() {
    // Reload subscription to pick up any team context before entering app
    await loadSubscription($user.id)
    onDone()
  }
</script>

<div class="setup-wrap">
  <div class="setup-card">

    <div class="setup-header">
      <div class="setup-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      </div>
      <h2>Set up your teams</h2>
      <p>Create a team for each age group or grade. Each team gets its own 6-digit code — share it with coaches and they can join instantly.</p>
    </div>

    {#if loading}
      <div class="loading-msg">Loading…</div>
    {:else}

      <!-- Team list -->
      {#if teams.length > 0}
        <div class="teams-list">
          {#each teams as team}
            <div class="team-row">
              <div class="team-info">
                <div class="team-name">{team.name}</div>
                <div class="team-code">{team.code}</div>
              </div>
              <div class="team-actions">
                <button class="copy-btn" on:click={() => copyCode(team.code)} title="Copy code">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  Copy code
                </button>
                <button class="wa-btn" on:click={() => shareWhatsApp(team)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.136.563 4.14 1.535 5.875L0 24l6.283-1.501A11.943 11.943 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 0 1-5.002-1.37l-.36-.214-3.727.89.931-3.618-.235-.372A9.818 9.818 0 1 1 12 21.818z"/></svg>
                  WhatsApp
                </button>
                <button class="delete-team-btn" on:click={() => removeTeam(team.id)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                </button>
              </div>
            </div>
          {/each}
        </div>
      {/if}

      <!-- Add team form -->
      {#if teams.length < MAX_TEAMS}
        <div class="add-team-row">
          <input
            type="text" bind:value={newTeamName}
            placeholder="e.g. Senior, Minor, U21…"
            on:keydown={e => e.key === 'Enter' && addTeam()}
          />
          <button class="add-btn" on:click={addTeam} disabled={adding}>
            {adding ? '…' : '+ Add'}
          </button>
        </div>
        {#if addError}<div class="add-error">{addError}</div>{/if}
      {:else}
        <div class="max-note">Maximum of 4 teams reached</div>
      {/if}

      <!-- Done -->
      <button
        class="done-btn"
        class:disabled={teams.length === 0}
        disabled={teams.length === 0}
        on:click={handleDone}
      >
        {teams.length === 0 ? 'Add at least one team to continue' : 'Enter the app →'}
      </button>

      {#if teams.length === 0}
        <p class="skip-hint">You can also set up teams later in Settings</p>
        <button class="skip-btn" on:click={handleDone}>Skip for now</button>
      {/if}

    {/if}
  </div>
</div>

<style>
  .setup-wrap {
    min-height: 100vh;
    display: flex; align-items: center; justify-content: center;
    background: var(--bg);
    background-image: radial-gradient(ellipse 70% 50% at 50% 0%, rgba(var(--primary-rgb), 0.08) 0%, transparent 70%);
    padding: 1rem;
  }
  .setup-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 2rem;
    width: 100%; max-width: 460px;
    display: flex; flex-direction: column; gap: 18px;
    box-shadow: 0 8px 40px rgba(26,32,21,0.10);
  }

  .setup-header { text-align: center; }
  .setup-icon {
    width: 64px; height: 64px; border-radius: 18px;
    background: rgba(var(--primary-rgb), 0.1); color: var(--primary);
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto 16px;
  }
  .setup-header h2 { font-size: 20px; font-weight: 700; color: var(--text); margin-bottom: 8px; letter-spacing: -0.02em; }
  .setup-header p { font-size: 13px; color: var(--text-muted); line-height: 1.6; }

  .loading-msg { text-align: center; color: var(--text-faint); font-size: 13px; }

  /* Teams list */
  .teams-list { display: flex; flex-direction: column; gap: 10px; }
  .team-row {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 14px;
    background: var(--surface-2); border: 1px solid var(--border);
    border-radius: 12px;
  }
  .team-info { flex: 1; }
  .team-name { font-size: 14px; font-weight: 600; color: var(--text); }
  .team-code {
    font-size: 20px; font-weight: 800; color: var(--primary);
    letter-spacing: 0.2em; font-family: monospace; margin-top: 2px;
  }
  .team-actions { display: flex; align-items: center; gap: 6px; }
  .copy-btn, .wa-btn {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 6px 10px; border-radius: 7px;
    font-size: 11px; font-weight: 600;
    cursor: pointer; font-family: inherit; border: none;
    transition: all 0.15s; white-space: nowrap;
  }
  .copy-btn { background: var(--surface); border: 1px solid var(--border); color: var(--text-muted); }
  .copy-btn:hover { border-color: var(--primary); color: var(--primary); }
  .wa-btn { background: #25d366; color: white; }
  .wa-btn:hover { background: #1ebe5d; }
  .delete-team-btn {
    width: 30px; height: 30px; border-radius: 7px;
    border: 1px solid var(--border); background: var(--surface);
    color: var(--text-faint); cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: all 0.15s;
  }
  .delete-team-btn:hover { border-color: #e53935; color: #e53935; }

  /* Add team */
  .add-team-row { display: flex; gap: 8px; }
  .add-team-row input {
    flex: 1; padding: 12px 14px;
    border: 1.5px solid var(--input-border); border-radius: 10px;
    font-size: 14px; font-family: inherit;
    background: var(--surface-3); color: var(--text);
    transition: all 0.15s;
  }
  .add-team-row input:focus {
    outline: none; border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(var(--primary-rgb),0.08);
  }
  .add-btn {
    padding: 12px 18px; border-radius: 10px;
    background: var(--primary); color: var(--primary-text);
    border: none; font-size: 14px; font-weight: 700;
    cursor: pointer; font-family: inherit; white-space: nowrap;
    transition: background 0.15s;
  }
  .add-btn:hover { background: var(--primary-hover); }
  .add-btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .add-error { font-size: 12px; color: #c62828; }
  .max-note { font-size: 12px; color: var(--text-faint); text-align: center; }

  /* Done */
  .done-btn {
    width: 100%; padding: 15px;
    background: var(--primary); color: var(--primary-text);
    border: none; border-radius: 10px;
    font-size: 16px; font-weight: 700;
    cursor: pointer; font-family: inherit; transition: background 0.15s;
  }
  .done-btn:hover:not(:disabled) { background: var(--primary-hover); }
  .done-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .skip-hint { font-size: 12px; color: var(--text-faint); text-align: center; margin: -8px 0; }
  .skip-btn {
    background: none; border: none; color: var(--text-muted);
    font-size: 13px; cursor: pointer; font-family: inherit;
    text-align: center; text-decoration: underline;
  }
</style>
