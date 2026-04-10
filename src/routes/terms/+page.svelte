<script>
  import { goto } from '$app/navigation'
  import TermsPage from '$lib/TermsPage.svelte'

  function onNavigate(page) {
    goto(page === 'home' ? '/' : '/' + page)
  }
</script>

<TermsPage {onNavigate} />
