<script>
  import { user, authLoading } from '$lib/auth-store.js'
  import { goto } from '$app/navigation'
  import { browser } from '$app/environment'
  import { base } from '$app/paths'

  let { children } = $props()

  $effect(() => {
    if (browser && !$authLoading && !$user) {
      goto('/')
    }
  })
</script>

{#if $authLoading}
  <div class="loading-screen">
    <img src="{base}/pitchnote-icon.svg" alt="PitchNote" class="loading-logo">
    <div class="loading-tagline">
      <p class="loading-tagline-top">Coach Smarter.</p>
      <p class="loading-tagline-bottom">Win More.</p>
    </div>
    <div class="loading-bar-wrap">
      <div class="loading-bar"></div>
    </div>
  </div>
{:else if $user}
  {@render children()}
{/if}

<style>
  .loading-screen {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg);
  }
  .loading-logo {
    width: 72px;
    height: 72px;
    object-fit: contain;
    animation: pulse 2s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 0.5; transform: scale(1); }
    50% { opacity: 0.85; transform: scale(1.04); }
  }
</style>
