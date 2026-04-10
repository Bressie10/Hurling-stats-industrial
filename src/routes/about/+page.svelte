<script>
  import { goto } from '$app/navigation'
  import AboutPage from '$lib/AboutPage.svelte'

  function onNavigate(page) {
    goto(page === 'home' ? '/' : '/' + page)
  }
</script>

<AboutPage {onNavigate} />
