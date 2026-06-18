<script>
  import EntitlementGate from '$lib/EntitlementGate.svelte'
  import { goto } from '$app/navigation'
  import { base } from '$app/paths'
  import LiveViewer from '$lib/LiveViewer.svelte'
  import { supabase } from '$lib/supabase.js'
  import { subscriptionStore } from '$lib/subscription-store.js'
  import { user } from '$lib/auth-store.js'
  import { canUseFeature, FEATURES } from '$lib/entitlements.js'
  import { showToast } from '$lib/toast.js'

  let session = $state(null)
  let loading = $state(true)
  let lookupKey = $state(null)
  let loadError = $state('')

  async function loadLiveSession(teamId, currentUser, requestKey) {
    if (!teamId) {
      loading = false
      goto('/app/match', { replaceState: true })
      return
    }

    const { data: sessions, error } = await supabase
      .from('live_sessions')
      .select('*')
      .eq('team_id', teamId)
      .is('ended_at', null)
      .neq('host_user_id', currentUser.id)
      .order('started_at', { ascending: false })
      .limit(1)

    if (lookupKey !== requestKey) return

    if (error) {
      session = null
      loading = false
      loadError = 'Could not load the live session. Please try again.'
      showToast(loadError, 'error')
      return
    }

    session = sessions?.[0] ?? null
    loading = false

    if (!session) {
      goto('/app/match', { replaceState: true })
    }
  }

  $effect(() => {
    const subscription = $subscriptionStore
    const currentUser = $user
    const teamId = subscription.activeTeamId

    if (subscription.loading || !currentUser) return
    if (!canUseFeature(subscription, FEATURES.liveSharing)) {
      loading = false
      session = null
      lookupKey = null
      loadError = ''
      return
    }

    const nextLookupKey = `${currentUser.id}:${teamId ?? 'none'}`
    if (lookupKey === nextLookupKey) return
    lookupKey = nextLookupKey
    loading = true
    session = null
    loadError = ''
    void loadLiveSession(teamId, currentUser, nextLookupKey)
  })

  function onClose() {
    goto('/app/match')
  }

  function retryLiveLookup() {
    lookupKey = null
  }
</script>

<EntitlementGate feature={FEATURES.liveSharing} label="Live match sharing">
  {#if session}
    <LiveViewer {session} {onClose} />
  {:else if loading}
    <div class="loading-screen">
      <img src="{base}/pitchnote-icon.svg" alt="PitchNote" class="loading-logo" />
      <div class="loading-tagline">
        <p class="loading-tagline-top">Coach Smarter.</p>
        <p class="loading-tagline-bottom">Win More.</p>
      </div>
      <div class="loading-bar-wrap">
        <div class="loading-bar"></div>
      </div>
    </div>
  {:else if loadError}
    <div class="live-error-state" role="alert">
      <h1>Live session unavailable</h1>
      <p>{loadError}</p>
      <div class="live-error-actions">
        <button type="button" class="retry-btn" onclick={retryLiveLookup}>Try again</button>
        <button type="button" class="secondary-btn" onclick={onClose}>Return to match</button>
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
  .live-error-state {
    min-height: 55vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 24px;
    text-align: center;
    background: var(--bg);
  }
  .live-error-state h1 {
    margin: 0;
    color: var(--text);
    font-size: 22px;
    line-height: 1.2;
  }
  .live-error-state p {
    max-width: 340px;
    margin: 0;
    color: var(--text-muted);
    font-size: 14px;
    line-height: 1.45;
  }
  .live-error-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px;
    margin-top: 4px;
  }
  .retry-btn,
  .secondary-btn {
    min-height: 40px;
    border: 0;
    border-radius: 8px;
    padding: 0 16px;
    font: inherit;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
  }
  .retry-btn {
    color: var(--primary-text);
    background: var(--primary);
  }
  .secondary-btn {
    color: var(--text);
    background: var(--surface-2);
  }
  @keyframes pulse {
    0%,
    100% {
      opacity: 0.5;
      transform: scale(1);
    }
    50% {
      opacity: 0.85;
      transform: scale(1.04);
    }
  }
  @keyframes loading-slide {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(260%);
    }
  }
</style>
