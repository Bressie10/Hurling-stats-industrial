<script>
  import { goto } from '$app/navigation'
  import PrivacyPage from '$lib/PrivacyPage.svelte'

  function onNavigate(page) {
    goto(page === 'home' ? '/' : '/' + page)
  }
</script>

<PrivacyPage {onNavigate} />
