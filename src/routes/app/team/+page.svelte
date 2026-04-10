<script>
  export const ssr = false

  import TeamStats from '$lib/TeamStats.svelte'
  import Upgrade from '$lib/Upgrade.svelte'
  import { isPro } from '$lib/subscription-store.js'
</script>

{#if $isPro}
  <TeamStats />
{:else}
  <Upgrade feature="Team Stats" />
{/if}
