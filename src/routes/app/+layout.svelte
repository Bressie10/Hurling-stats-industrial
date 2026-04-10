<script>
  import { user, authLoading } from '$lib/auth-store.js'
  import { goto } from '$app/navigation'

  $: if (!$authLoading && !$user) {
    goto('/')
  }
</script>

{#if $authLoading}
  <div class="loading-screen">
    <img src="/gaastat-icon.svg" alt="GAAstat" class="loading-logo">
  </div>
{:else if $user}
  <slot />
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
