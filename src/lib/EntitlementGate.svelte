<script>
  import Upgrade from './Upgrade.svelte'
  import { subscriptionStore } from './subscription-store.js'
  import { canUseFeature, FEATURE_LABELS } from './entitlements.js'

  const { feature, label = FEATURE_LABELS[feature] ?? 'this feature', children } = $props()

  let allowed = $derived(canUseFeature($subscriptionStore, feature))
</script>

{#if $subscriptionStore.loading}
  <div class="gate-loading" aria-live="polite">Loading access...</div>
{:else if allowed}
  {@render children()}
{:else}
  <Upgrade feature={label} />
{/if}

<style>
  .gate-loading {
    min-height: 45vh;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    font-size: 14px;
  }
</style>
