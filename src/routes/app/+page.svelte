<script>
  export const ssr = false

  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'

  onMount(() => {
    goto('/app/match', { replaceState: true })
  })
</script>
