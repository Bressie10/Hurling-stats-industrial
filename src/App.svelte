<script>
import { clearAllData } from './lib/db.js'
  import Match from './lib/Match.svelte'
  import PlayerStats from './lib/PlayerStats.svelte'
  import TeamStats from './lib/TeamStats.svelte'
  import History from './lib/History.svelte'
  import Squad from './lib/Squad.svelte'
  import Timeline from './lib/Timeline.svelte'
  import Settings from './lib/Settings.svelte'
  import StatTargets from './lib/StatTargets.svelte'
  import Auth from './lib/Auth.svelte'
  import { user, authLoading, signOut } from './lib/auth-store.js'
  import { syncToSupabase, syncFromSupabase } from './lib/sync.js'
  import { onMount } from 'svelte'

  let activePage = 'match'
  let syncing = false
  let syncMsg = ''
  let dataReady = false
  let lastUserId = null

  onMount(async () => {
    // Wait for auth to resolve
    const unsubscribe = user.subscribe(async (u) => {
      if (u && u.id !== lastUserId) {
        dataReady = false
        lastUserId = u.id
        await clearAllData()
        await syncFromSupabase(u.id)
        dataReady = true
      }
      if (!u) {
        lastUserId = null
        dataReady = false
      }
    })
    return unsubscribe
  })

  async function handleSync() {
    if (!$user) return
    syncing = true
    syncMsg = ''
    const ok = await syncToSupabase($user.id)
    syncMsg = ok ? 'Synced!' : 'Sync failed'
    syncing = false
    setTimeout(() => syncMsg = '', 3000)
  }

  async function handleSignOut() {
    const confirmed = confirm(
      '⚠️ Before signing out:\n\n' +
      '1. Make sure you have a stable internet connection\n' +
      '2. Click "↑ Sync" in the top bar to back up your data to the cloud\n\n' +
      'If you sign out without syncing, any unsynced match data will be lost.\n\n' +
      'Are you sure you want to sign out?'
    )
    if (!confirmed) return
    await signOut()
    activePage = 'match'
    dataReady = false
    lastUserId = null
  }
</script>

{#if $authLoading}
  <div class="loading-screen">
    <img src="/src/assets/doora-barefield.png" alt="Loading" class="loading-logo" />
  </div>

{:else if !$user}
  <Auth />

{:else if !dataReady}
  <div class="loading-screen">
    <img src="/src/assets/doora-barefield.png" alt="Loading" class="loading-logo" />
    <p style="color:#888; font-size:13px; margin-top:1rem;">Loading your data...</p>
  </div>

{:else}
  <div class="app">
    <nav>
      <div class="brand">
        <img src="/src/assets/doora-barefield.png" alt="Doora Barefield GAA" class="brand-logo" />
        Doora Barefield GAA
      </div>
      <div class="tabs">
        <button class:active={activePage === 'match'} on:click={() => activePage = 'match'}>Match</button>
        <button class:active={activePage === 'timeline'} on:click={() => activePage = 'timeline'}>Timeline</button>
        <button class:active={activePage === 'player'} on:click={() => activePage = 'player'}>Player Stats</button>
        <button class:active={activePage === 'team'} on:click={() => activePage = 'team'}>Team Stats</button>
        <button class:active={activePage === 'history'} on:click={() => activePage = 'history'}>Previous Matches</button>
        <button class:active={activePage === 'squad'} on:click={() => activePage = 'squad'}>Squad</button>
        <button class:active={activePage === 'targets'} on:click={() => activePage = 'targets'}>Targets</button>
        <button class:active={activePage === 'settings'} on:click={() => activePage = 'settings'}>Settings</button>
      </div>
      <div class="nav-actions">
        <button class="sync-btn" class:syncing on:click={handleSync} disabled={syncing}>
          {#if syncing}
            Syncing...
          {:else if syncMsg}
            {syncMsg}
          {:else}
            ↑ Sync
          {/if}
        </button>
        <button class="signout-btn" on:click={handleSignOut}>Sign out</button>
      </div>
    </nav>

    <main>
      {#if activePage === 'match'}
        <Match />
      {:else if activePage === 'timeline'}
        <Timeline />
      {:else if activePage === 'player'}
        <PlayerStats />
      {:else if activePage === 'team'}
        <TeamStats />
      {:else if activePage === 'history'}
        <History />
      {:else if activePage === 'squad'}
        <Squad />
      {:else if activePage === 'targets'}
        <StatTargets />
      {:else if activePage === 'settings'}
        <Settings />
      {/if}
    </main>
  </div>
{/if}

<style>
  .loading-screen {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f8f8f6;
  }
  .loading-logo {
    width: 80px;
    height: 80px;
    object-fit: contain;
    opacity: 0.5;
  }

  .app { min-height: 100vh; display: flex; flex-direction: column; }

  nav {
    display: flex;
    align-items: center;
    border-bottom: 1px solid #e5e5e5;
    background: #fff;
    position: sticky;
    top: 0;
    z-index: 100;
    overflow-x: auto;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 16px;
    font-weight: 600;
    font-size: 14px;
    border-right: 1px solid #e5e5e5;
    height: 52px;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .brand-logo { width: 32px; height: 32px; object-fit: contain; }

  .tabs { display: flex; flex: 1; }
  .tabs button {
    padding: 0 16px;
    height: 52px;
    border: none;
    background: none;
    font-size: 13px;
    color: #888;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: all 0.15s;
    white-space: nowrap;
    font-family: inherit;
  }
  .tabs button:hover { color: #333; background: #f9f9f9; }
  .tabs button.active { color: #6B1B2B; font-weight: 600; border-bottom: 2px solid #6B1B2B; }

  .nav-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px;
    flex-shrink: 0;
    border-left: 1px solid #e5e5e5;
  }
  .sync-btn {
    padding: 6px 12px;
    border-radius: 7px;
    border: 1.5px solid #6B1B2B;
    background: none;
    color: #6B1B2B;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
    transition: all 0.15s;
  }
  .sync-btn:hover { background: #6B1B2B; color: white; }
  .sync-btn.syncing { opacity: 0.6; cursor: not-allowed; }
  .signout-btn {
    padding: 6px 12px;
    border-radius: 7px;
    border: 1px solid #e0e0e0;
    background: none;
    color: #888;
    font-size: 12px;
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
  }
  .signout-btn:hover { border-color: #e53935; color: #e53935; }

  main {
    flex: 1;
    padding: 20px 16px;
    max-width: 900px;
    width: 100%;
    margin: 0 auto;
  }

  @media (max-width: 480px) {
    .tabs button { padding: 0 12px; font-size: 12px; }
    .nav-actions { padding: 0 8px; gap: 6px; }
    .sync-btn, .signout-btn { font-size: 11px; padding: 5px 8px; }
  }
</style>