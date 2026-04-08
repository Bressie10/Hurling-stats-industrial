<script>
  import { subscriptionStore, setActiveTeam } from './subscription-store.js'

  export let onPicked = () => {}

  function pick(team) {
    setActiveTeam(team)
    onPicked()
  }
</script>

<div class="picker-wrap">
  <div class="picker-card">

    <div class="picker-header">
      <div class="picker-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      </div>
      <h2>Which team today?</h2>
      <p>
        {#if $subscriptionStore.isOwner}
          Select a team to view. You can switch at any time in Settings.
        {:else}
          You're on multiple teams. Pick one to continue.
        {/if}
      </p>
    </div>

    <div class="teams-list">
      {#each $subscriptionStore.teams as team}
        <button class="team-row" on:click={() => pick(team)}>
          <div class="team-info">
            <div class="team-name">{team.name}</div>
            <div class="team-code">{team.code}</div>
          </div>
          <svg class="chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      {/each}
    </div>

  </div>
</div>

<style>
  .picker-wrap {
    min-height: 100vh;
    display: flex; align-items: center; justify-content: center;
    background: var(--bg);
    background-image: radial-gradient(ellipse 70% 50% at 50% 0%, rgba(var(--primary-rgb), 0.08) 0%, transparent 70%);
    padding: 1rem;
  }
  .picker-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 2rem;
    width: 100%; max-width: 420px;
    display: flex; flex-direction: column; gap: 20px;
    box-shadow: 0 8px 40px rgba(26,32,21,0.10);
  }

  .picker-header { text-align: center; }
  .picker-icon {
    width: 64px; height: 64px; border-radius: 18px;
    background: rgba(var(--primary-rgb), 0.1); color: var(--primary);
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto 16px;
  }
  .picker-header h2 { font-size: 20px; font-weight: 700; color: var(--text); margin-bottom: 8px; letter-spacing: -0.02em; }
  .picker-header p { font-size: 13px; color: var(--text-muted); line-height: 1.6; }

  .teams-list { display: flex; flex-direction: column; gap: 10px; }

  .team-row {
    display: flex; align-items: center;
    padding: 14px 16px;
    background: var(--surface-2); border: 1.5px solid var(--border);
    border-radius: 12px;
    cursor: pointer; font-family: inherit;
    transition: all 0.15s; text-align: left;
    width: 100%;
  }
  .team-row:hover {
    border-color: var(--primary);
    background: rgba(var(--primary-rgb), 0.04);
  }
  .team-info { flex: 1; }
  .team-name { font-size: 15px; font-weight: 600; color: var(--text); }
  .team-code {
    font-size: 18px; font-weight: 800; color: var(--primary);
    letter-spacing: 0.2em; font-family: monospace; margin-top: 2px;
  }
  .chevron { color: var(--text-faint); flex-shrink: 0; }
  .team-row:hover .chevron { color: var(--primary); }
</style>
