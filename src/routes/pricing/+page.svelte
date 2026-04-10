<script>
  export const prerender = true

  import { goto } from '$app/navigation'
  import PricingPage from '$lib/PricingPage.svelte'

  function onNavigate(page) {
    goto(page === 'home' ? '/' : '/' + page)
  }
</script>

<PricingPage {onNavigate} />
