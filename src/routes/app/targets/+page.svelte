<script>
  import StatTargets from '$lib/StatTargets.svelte'
  import Upgrade from '$lib/Upgrade.svelte'
  import { isPro } from '$lib/subscription-store.js'
</script>

{#if $isPro}
  <StatTargets />
{:else}
  <Upgrade feature="Stat Targets" />
{/if}
