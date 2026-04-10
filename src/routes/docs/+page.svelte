<script>
  export const prerender = true

  import { goto } from '$app/navigation'
  import DocsPage from '$lib/DocsPage.svelte'

  function onNavigate(page) {
    goto(page === 'home' ? '/' : '/' + page)
  }
</script>

<DocsPage {onNavigate} />
