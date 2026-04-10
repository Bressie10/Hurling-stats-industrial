<script>
  import { goto } from '$app/navigation'
  import ContactPage from '$lib/ContactPage.svelte'

  function onNavigate(page) {
    goto(page === 'home' ? '/' : '/' + page)
  }
</script>

<ContactPage {onNavigate} />
