<script>
  export const ssr = false

  import History from '$lib/History.svelte'
  import { isPro } from '$lib/subscription-store.js'
</script>

<History proAccess={$isPro} />
