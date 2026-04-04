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
  import Upgrade from './lib/Upgrade.svelte'
  import TeamSetup from './lib/TeamSetup.svelte'
  import LiveViewer from './lib/LiveViewer.svelte'
  import { user, authLoading, signOut } from './lib/auth-store.js'
  import { syncToSupabase, syncFromSupabase } from './lib/sync.js'
  import { settingsStore } from './lib/settings-store.js'
  import { subscriptionStore, isPro, isClub, isClubPro, ensureProfile, loadSubscription, loadClubTeams } from './lib/subscription-store.js'
  import { supabase } from './lib/supabase.js'
  import { onMount } from 'svelte'

  let needsTeamSetup = false
  let liveSession = null

  function hexToRgbString(hex) {
    const r = parseInt(hex.slice(1,3), 16)
    const g = parseInt(hex.slice(3,5), 16)
    const b = parseInt(hex.slice(5,7), 16)
    return `${r}, ${g}, ${b}`
  }

  function darkenHex(hex, amount) {
    const r = Math.max(0, parseInt(hex.slice(1,3), 16) - amount)
    const g = Math.max(0, parseInt(hex.slice(3,5), 16) - amount)
    const b = Math.max(0, parseInt(hex.slice(5,7), 16) - amount)
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`
  }

  function contrastText(hex) {
    const r = parseInt(hex.slice(1,3), 16)
    const g = parseInt(hex.slice(3,5), 16)
    const b = parseInt(hex.slice(5,7), 16)
    return (0.299*r + 0.587*g + 0.114*b) / 255 > 0.5 ? '#1A2015' : '#ffffff'
  }

  $: {
    if (typeof document !== 'undefined') {
      const name = $settingsStore.teamName || 'GAA Stats'
      document.title = name
      document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', name)

      const color = $settingsStore.clubPrimaryColor
      if (color && /^#[0-9a-fA-F]{6}$/.test(color)) {
        document.documentElement.style.setProperty('--primary', color)
        document.documentElement.style.setProperty('--primary-hover', darkenHex(color, 20))
        document.documentElement.style.setProperty('--primary-rgb', hexToRgbString(color))
        document.documentElement.style.setProperty('--primary-text', contrastText(color))
      } else {
        document.documentElement.style.removeProperty('--primary')
        document.documentElement.style.removeProperty('--primary-hover')
        document.documentElement.style.removeProperty('--primary-rgb')
        document.documentElement.style.removeProperty('--primary-text')
      }
    }
  }

  const LAST_USER_KEY = 'doora_last_user_id'

  let activePage = 'match'
  let syncing = false
  let syncMsg = ''
  let dataReady = false
  let lastUserId = null
  let showMoreSheet = false

  $: morePages = ['timeline', 'squad', 'targets', 'settings']
  $: moreActive = morePages.includes(activePage)

  function navigateTo(page) {
    activePage = page
    showMoreSheet = false
  }

  onMount(async () => {
    const unsubscribe = user.subscribe(async (u) => {
      if (u && u.id !== lastUserId) {
        dataReady = false
        lastUserId = u.id

        // Create profile/club/subscription records on first login
        await ensureProfile(u.id)
        // Load subscription plan + team context
        await loadSubscription(u.id)

        const previousUserId = localStorage.getItem(LAST_USER_KEY)

        if (previousUserId === u.id) {
          dataReady = true
        } else {
          localStorage.setItem(LAST_USER_KEY, u.id)
          await clearAllData()
          await syncFromSupabase(u.id)
          dataReady = true
        }

        // Club owners with no teams yet → show team setup
        const sub = subscriptionStore
        let subVal; sub.subscribe(s => subVal = s)()
        if (subVal.isOwner && subVal.clubId) {
          const teams = await loadClubTeams(subVal.clubId)
          needsTeamSetup = teams.length === 0
        }

        // Check for active live session on this team
        if (subVal.teamId) {
          const { data: sessions } = await supabase
            .from('live_sessions')
            .select('*')
            .eq('team_id', subVal.teamId)
            .is('ended_at', null)
            .neq('host_user_id', u.id)
            .order('started_at', { ascending: false })
            .limit(1)
          liveSession = sessions?.[0] ?? null
        }
      }
      if (!u) {
        lastUserId = null
        dataReady = false
        subscriptionStore.set({ plan: 'free', status: 'active', clubId: null, clubCode: null, clubName: null, seatLimit: 1, currentPeriodEnd: null, loading: false })
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
      'Before signing out:\n\n' +
      '1. Make sure you have a stable internet connection\n' +
      '2. Click "↑ Sync" in the top bar to back up your data to the cloud\n\n' +
      'If you sign out without syncing, any unsynced match data will be lost.\n\n' +
      'Are you sure you want to sign out?'
    )
    if (!confirmed) return
    localStorage.removeItem(LAST_USER_KEY)
    await signOut()
    activePage = 'match'
    dataReady = false
    lastUserId = null
  }
</script>

{#if $authLoading}
  <div class="loading-screen">
    <img src="doora-barefield.png" alt="Doora Barefield GAA" class="loading-logo">
  </div>

{:else if !$user}
  <Auth />

{:else if !dataReady && !needsTeamSetup}
  <div class="loading-screen">
    <img src="doora-barefield.png" alt="Doora Barefield GAA" class="loading-logo">
    <p class="loading-text">Loading your data…</p>
  </div>

{:else if needsTeamSetup}
  <TeamSetup onDone={() => { needsTeamSetup = false }} />

{:else}
  <!-- Live session banner -->
  {#if liveSession}
    <div class="live-banner" on:click={() => activePage = 'live'}>
      <span class="live-dot-sm"></span>
      <strong>Live match in progress</strong>
      <span>Tap to watch</span>
      <button class="live-banner-close" on:click|stopPropagation={() => liveSession = null}>✕</button>
    </div>
  {/if}

  <div class="app">
    <!-- Top bar: brand + desktop tabs + actions -->
    <nav class="top-nav">
      <div class="brand">
        <img class="brand-logo" src="doora-barefield.png" alt="Doora Barefield GAA">
        <span class="brand-name">{$settingsStore.teamName || 'GAA Stats'}</span>
      </div>

      <!-- Desktop-only tab row -->
      <div class="desk-tabs">
        <button class:active={activePage === 'match'} on:click={() => navigateTo('match')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          Match
        </button>
        <button class:active={activePage === 'timeline'} on:click={() => navigateTo('timeline')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          Timeline
        </button>
        <button class:active={activePage === 'player'} on:click={() => navigateTo('player')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          Players
        </button>
        <button class:active={activePage === 'team'} on:click={() => navigateTo('team')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          Team Stats
        </button>
        <button class:active={activePage === 'history'} on:click={() => navigateTo('history')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          History
        </button>
        <button class:active={activePage === 'squad'} on:click={() => navigateTo('squad')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          Squad
        </button>
        <button class:active={activePage === 'targets'} on:click={() => navigateTo('targets')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
          Targets
        </button>
        <button class:active={activePage === 'settings'} on:click={() => navigateTo('settings')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          Settings
        </button>
      </div>

      <div class="nav-actions">
        <button class="sync-btn" class:syncing on:click={handleSync} disabled={syncing}>
          {#if syncing}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="spin"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            Syncing…
          {:else if syncMsg}
            {syncMsg}
          {:else}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
            Sync
          {/if}
        </button>
        <button class="signout-btn" on:click={handleSignOut}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Sign out
        </button>
      </div>
    </nav>

    <main>
      {#if activePage === 'live' && liveSession}
        <LiveViewer session={liveSession} onClose={() => { activePage = 'match'; liveSession = null }} />
      {:else if activePage === 'match'}
        <Match />
      {:else if activePage === 'timeline'}
        {#if $isPro}
          <Timeline />
        {:else}
          <Upgrade feature="Timeline" />
        {/if}
      {:else if activePage === 'player'}
        {#if $isPro}
          <PlayerStats />
        {:else}
          <Upgrade feature="Player Stats" />
        {/if}
      {:else if activePage === 'team'}
        {#if $isPro}
          <TeamStats />
        {:else}
          <Upgrade feature="Team Stats" />
        {/if}
      {:else if activePage === 'history'}
        <History proAccess={$isPro} />
      {:else if activePage === 'squad'}
        <Squad />
      {:else if activePage === 'targets'}
        {#if $isPro}
          <StatTargets />
        {:else}
          <Upgrade feature="Stat Targets" />
        {/if}
      {:else if activePage === 'settings'}
        <Settings />
      {/if}
    </main>
  </div>

  <!-- Mobile bottom nav (hidden on desktop via CSS) -->
  <nav class="mob-nav">
    <button class="mob-tab" class:active={activePage === 'match'} on:click={() => navigateTo('match')}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
      <span>Match</span>
    </button>
    <button class="mob-tab" class:active={activePage === 'history'} on:click={() => navigateTo('history')}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
      <span>History</span>
    </button>
    <button class="mob-tab" class:active={activePage === 'player'} on:click={() => navigateTo('player')}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      <span>Players</span>
    </button>
    <button class="mob-tab" class:active={activePage === 'team'} on:click={() => navigateTo('team')}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
      <span>Team</span>
    </button>
    <button class="mob-tab" class:active={showMoreSheet || moreActive} on:click={() => showMoreSheet = !showMoreSheet}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="19" r="1.5" fill="currentColor"/></svg>
      <span>More</span>
    </button>
  </nav>

  <!-- More bottom sheet -->
  {#if showMoreSheet}
    <div class="more-backdrop" on:click={() => showMoreSheet = false}>
      <div class="more-sheet" on:click|stopPropagation>
        <div class="more-handle"></div>
        <div class="more-sheet-title">More</div>
        <div class="more-grid">
          <button class="more-item" class:active={activePage === 'timeline'} on:click={() => navigateTo('timeline')}>
            <div class="more-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            </div>
            <span>Timeline</span>
          </button>
          <button class="more-item" class:active={activePage === 'squad'} on:click={() => navigateTo('squad')}>
            <div class="more-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <span>Squad</span>
          </button>
          <button class="more-item" class:active={activePage === 'targets'} on:click={() => navigateTo('targets')}>
            <div class="more-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
            </div>
            <span>Targets</span>
          </button>
          <button class="more-item" class:active={activePage === 'settings'} on:click={() => navigateTo('settings')}>
            <div class="more-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </div>
            <span>Settings</span>
          </button>
        </div>
        <!-- Sync + sign out in more sheet on mobile -->
        <div class="more-actions">
          <button class="more-sync-btn" class:syncing on:click={handleSync} disabled={syncing}>
            {#if syncing}Syncing…{:else if syncMsg}{syncMsg}{:else}↑ Sync to cloud{/if}
          </button>
          <button class="more-signout-btn" on:click={handleSignOut}>Sign out</button>
        </div>
      </div>
    </div>
  {/if}
{/if}

<style>
  /* ── LOADING ── */
  .loading-screen {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: var(--bg);
    gap: 16px;
  }
  .loading-logo {
    width: 72px;
    height: 72px;
    object-fit: contain;
    animation: pulse 2s ease-in-out infinite;
  }
  .loading-text {
    color: var(--text-faint);
    font-size: 13px;
  }
  @keyframes pulse {
    0%, 100% { opacity: 0.5; transform: scale(1); }
    50% { opacity: 0.85; transform: scale(1.04); }
  }

  /* ── APP SHELL ── */
  .app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  /* ── TOP NAV ── */
  .top-nav {
    display: flex;
    align-items: center;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
    position: sticky;
    top: 0;
    z-index: 100;
    overflow-x: auto;
    box-shadow: var(--shadow-sm);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 0 16px;
    font-weight: 700;
    font-size: 14px;
    color: var(--text);
    border-right: 1px solid var(--border);
    height: 52px;
    white-space: nowrap;
    flex-shrink: 0;
    letter-spacing: -0.01em;
  }
  .brand-logo {
    width: 30px;
    height: 30px;
    object-fit: contain;
    border-radius: 6px;
  }

  /* Desktop tab row */
  .desk-tabs {
    display: flex;
    flex: 1;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .desk-tabs::-webkit-scrollbar { display: none; }
  .desk-tabs button {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 0 14px;
    height: 52px;
    border: none;
    background: none;
    font-size: 13px;
    color: var(--text-muted);
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: color 0.15s, border-color 0.15s, background 0.15s;
    white-space: nowrap;
    font-family: inherit;
    font-weight: 500;
    flex-shrink: 0;
  }
  .desk-tabs button svg { opacity: 0.7; flex-shrink: 0; }
  .desk-tabs button:hover { color: var(--text); background: var(--surface-2); }
  .desk-tabs button:hover svg { opacity: 1; }
  .desk-tabs button.active {
    color: var(--primary);
    font-weight: 600;
    border-bottom: 2px solid var(--primary);
  }
  .desk-tabs button.active svg { opacity: 1; }

  /* Nav actions */
  .nav-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 12px;
    flex-shrink: 0;
    border-left: 1px solid var(--border);
  }
  .sync-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 11px;
    border-radius: 7px;
    border: 1.5px solid var(--primary);
    background: none;
    color: var(--primary);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
    transition: all 0.15s;
  }
  .sync-btn:hover { background: var(--primary); color: white; }
  .sync-btn.syncing { opacity: 0.6; cursor: not-allowed; }
  .signout-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 11px;
    border-radius: 7px;
    border: 1px solid var(--input-border);
    background: none;
    color: var(--text-muted);
    font-size: 12px;
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
    transition: all 0.15s;
  }
  .signout-btn:hover { border-color: #e53935; color: #e53935; }

  @keyframes spin { to { transform: rotate(360deg); } }
  .spin { animation: spin 1s linear infinite; }

  /* ── LIVE BANNER ── */
  .live-banner {
    display: flex; align-items: center; gap: 8px;
    background: #e53935; color: white;
    padding: 10px 16px;
    font-size: 13px; font-weight: 600;
    cursor: pointer;
    position: sticky; top: 0; z-index: 200;
  }
  .live-banner span:not(.live-dot-sm) { font-size: 12px; font-weight: 400; opacity: 0.85; margin-left: 4px; flex: 1; }
  .live-dot-sm {
    width: 8px; height: 8px; border-radius: 50%;
    background: white; flex-shrink: 0;
    animation: pulse 1.2s ease-in-out infinite;
  }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
  .live-banner-close {
    background: none; border: none; color: white;
    font-size: 14px; cursor: pointer; opacity: 0.7; padding: 0 4px;
  }

  /* ── MAIN CONTENT ── */
  main {
    flex: 1;
    padding: 20px 16px;
    max-width: 900px;
    width: 100%;
    margin: 0 auto;
    padding-bottom: calc(20px + env(safe-area-inset-bottom));
  }

  /* ── MOBILE BOTTOM NAV ── */
  .mob-nav {
    display: none; /* hidden on desktop */
  }

  /* ── MORE SHEET ── */
  .more-backdrop {
    display: none; /* hidden on desktop */
  }

  /* ── MOBILE BREAKPOINT ── */
  @media (max-width: 640px) {
    /* Collapse desktop tabs */
    .desk-tabs { display: none; }

    /* Slim top bar */
    .top-nav {
      overflow-x: visible;
      box-shadow: none;
      border-bottom: 1px solid var(--border);
    }
    .brand {
      flex: 1;
      border-right: none;
      height: 52px;
    }
    .nav-actions { display: none; } /* moved into More sheet */

    /* Main gets bottom padding for the bottom nav */
    main {
      padding: 14px 12px;
      padding-bottom: calc(72px + env(safe-area-inset-bottom) + 8px);
    }

    /* Bottom nav */
    .mob-nav {
      display: flex;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: var(--surface);
      border-top: 1px solid var(--border);
      padding: 6px 0 calc(6px + env(safe-area-inset-bottom));
      z-index: 100;
      box-shadow: 0 -4px 16px rgba(26,32,21,0.08);
    }
    .mob-tab {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      padding: 6px 4px;
      border: none;
      background: none;
      color: var(--text-faint);
      font-size: 10px;
      font-weight: 500;
      cursor: pointer;
      font-family: inherit;
      transition: color 0.15s;
      -webkit-tap-highlight-color: transparent;
    }
    .mob-tab svg { flex-shrink: 0; }
    .mob-tab.active { color: var(--primary); }
    .mob-tab.active svg { stroke-width: 2.5; }

    /* More sheet */
    .more-backdrop {
      display: flex;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.4);
      z-index: 150;
      align-items: flex-end;
      justify-content: center;
      -webkit-backdrop-filter: blur(2px);
      backdrop-filter: blur(2px);
    }
    .more-sheet {
      background: var(--surface);
      border-radius: 20px 20px 0 0;
      width: 100%;
      max-width: 640px;
      padding: 12px 20px calc(20px + env(safe-area-inset-bottom));
      animation: slideUp 0.22s cubic-bezier(0.32, 0.72, 0, 1);
      box-shadow: 0 -8px 32px rgba(26,32,21,0.15);
    }
    @keyframes slideUp {
      from { transform: translateY(100%); }
      to { transform: translateY(0); }
    }
    .more-handle {
      width: 36px;
      height: 4px;
      background: var(--border);
      border-radius: 2px;
      margin: 0 auto 16px;
    }
    .more-sheet-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-faint);
      margin-bottom: 14px;
    }
    .more-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 20px;
    }
    .more-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 14px 8px;
      border: 1.5px solid var(--border);
      border-radius: 14px;
      background: var(--surface-2);
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      cursor: pointer;
      font-family: inherit;
      transition: all 0.15s;
      -webkit-tap-highlight-color: transparent;
    }
    .more-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: var(--surface);
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--border);
    }
    .more-item.active {
      color: var(--primary);
      border-color: var(--primary);
      background: rgba(var(--primary-rgb), 0.06);
    }
    .more-item.active .more-icon {
      background: rgba(var(--primary-rgb), 0.1);
      border-color: rgba(var(--primary-rgb), 0.25);
    }
    .more-item:active { transform: scale(0.96); }
    .more-actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-top: 4px;
      border-top: 1px solid var(--divider);
      padding-top: 16px;
    }
    .more-sync-btn {
      width: 100%;
      padding: 13px;
      border-radius: 10px;
      border: 1.5px solid var(--primary);
      background: none;
      color: var(--primary);
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.15s;
    }
    .more-sync-btn:hover { background: var(--primary); color: white; }
    .more-sync-btn.syncing { opacity: 0.6; cursor: not-allowed; }
    .more-signout-btn {
      width: 100%;
      padding: 13px;
      border-radius: 10px;
      border: 1px solid var(--input-border);
      background: none;
      color: var(--text-muted);
      font-size: 14px;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.15s;
    }
    .more-signout-btn:hover { border-color: #e53935; color: #e53935; }
  }
</style>
