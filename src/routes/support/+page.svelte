<script>
  import { goto } from '$app/navigation'
  import LegalPage from '$lib/LegalPage.svelte'

  function onNavigate(page) {
    goto(page === 'home' ? '/' : '/' + page)
  }
</script>

<LegalPage pageType="support" {onNavigate} />
