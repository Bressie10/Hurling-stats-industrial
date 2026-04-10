<script>
  import { goto } from '$app/navigation'
  import InstallPage from '$lib/InstallPage.svelte'

  function onNavigate(page) {
    goto(page === 'home' ? '/' : '/' + page)
  }
</script>

<InstallPage {onNavigate} />
