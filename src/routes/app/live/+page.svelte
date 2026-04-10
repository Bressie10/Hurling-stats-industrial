<script>
  export const ssr = false

  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import LiveViewer from '$lib/LiveViewer.svelte'
  import { supabase } from '$lib/supabase.js'
  import { subscriptionStore } from '$lib/subscription-store.js'
  import { user } from '$lib/auth-store.js'

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

{#if session}
  <LiveViewer {session} {onClose} />
{:else if loading}
  <div class="loading">
    <img src="/doora-barefield.png" alt="" class="loading-logo">
  </div>
{/if}

<style>
  .loading {
    min-height: 60vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .loading-logo {
    width: 56px;
    height: 56px;
    object-fit: contain;
    animation: pulse 2s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 0.5; transform: scale(1); }
    50% { opacity: 0.85; transform: scale(1.04); }
  }
</style>
