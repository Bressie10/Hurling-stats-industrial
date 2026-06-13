<script>
  import EntitlementGate from '$lib/EntitlementGate.svelte'
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { base } from '$app/paths'
  import LiveViewer from '$lib/LiveViewer.svelte'
  import { supabase } from '$lib/supabase.js'
  import { subscriptionStore } from '$lib/subscription-store.js'
  import { user } from '$lib/auth-store.js'
  import { FEATURES } from '$lib/entitlements.js'

  let session = null
  let loading = true

  onMount(async () => {
    const teamId = $subscriptionStore.activeTeamId
    const currentUser = $user
    if (!teamId || !currentUser) {
      goto('/app/match', { replaceState: true })
      return
    }

    const { data: sessions } = await supabase
      .from('live_sessions')
      .select('*')
      .eq('team_id', teamId)
      .is('ended_at', null)
      .neq('host_user_id', currentUser.id)
      .order('started_at', { ascending: false })
      .limit(1)

    session = sessions?.[0] ?? null
    loading = false

    if (!session) {
      goto('/app/match', { replaceState: true })
    }
  })

  function onClose() {
    goto('/app/match')
  }
</script>

<EntitlementGate feature={FEATURES.liveSharing} label="Live match sharing">
  {#if session}
    <LiveViewer {session} {onClose} />
  {:else if loading}
    <div class="loading-screen">
      <img src="{base}/gaastat-icon.svg" alt="GAAstat" class="loading-logo">
      <div class="loading-tagline">
        <p class="loading-tagline-top">Coach Smarter.</p>
        <p class="loading-tagline-bottom">Win More.</p>
      </div>
      <div class="loading-bar-wrap">
        <div class="loading-bar"></div>
      </div>
    </div>
  {/if}
</EntitlementGate>

<style>
  .loading-screen {
    min-height: 60vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    background: var(--bg);
  }
  .loading-logo {
    width: 56px;
    height: 56px;
    object-fit: contain;
    animation: pulse 2s ease-in-out infinite;
  }
  .loading-tagline {
    display: flex;
    flex-direction: column;
    gap: 2px;
    text-align: center;
  }
  .loading-tagline p {
    margin: 0;
    color: var(--text-muted);
    font-size: 13px;
    font-weight: 600;
  }
  .loading-bar-wrap {
    width: 120px;
    height: 3px;
    overflow: hidden;
    border-radius: 999px;
    background: var(--surface-2);
  }
  .loading-bar {
    width: 45%;
    height: 100%;
    border-radius: inherit;
    background: var(--primary);
    animation: loading-slide 1.2s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 0.5; transform: scale(1); }
    50% { opacity: 0.85; transform: scale(1.04); }
  }
  @keyframes loading-slide {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(260%); }
  }
</style>
