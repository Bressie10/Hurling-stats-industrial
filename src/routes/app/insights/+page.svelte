<script>
  import EntitlementGate from '$lib/EntitlementGate.svelte'
  import Insights from '$lib/Insights.svelte'
  import { FEATURES } from '$lib/entitlements.js'
</script>

<EntitlementGate feature={FEATURES.proAnalytics} label="Insights">
  <Insights />
</EntitlementGate>
