<script>
  export const ssr = false

  import Timeline from '$lib/Timeline.svelte'
  import Upgrade from '$lib/Upgrade.svelte'
  import { isPro } from '$lib/subscription-store.js'
</script>

{#if $isPro}
  <Timeline />
{:else}
  <Upgrade feature="Timeline" />
{/if}
