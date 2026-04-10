<script>
  export const ssr = false

  import PlayerStats from '$lib/PlayerStats.svelte'
  import Upgrade from '$lib/Upgrade.svelte'
  import { isPro } from '$lib/subscription-store.js'
</script>

{#if $isPro}
  <PlayerStats />
{:else}
  <Upgrade feature="Player Stats" />
{/if}
