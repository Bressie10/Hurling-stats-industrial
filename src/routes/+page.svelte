<script>
  import { goto } from '$app/navigation'
  import Landing from '$lib/Landing.svelte'

  function onNavigate(page) {
    goto(page === 'home' ? '/' : '/' + page)
  }
</script>

<Landing {onNavigate} />
