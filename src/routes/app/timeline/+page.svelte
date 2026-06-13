<script>
  import EntitlementGate from '$lib/EntitlementGate.svelte'
  import Timeline from '$lib/Timeline.svelte'
  import { FEATURES } from '$lib/entitlements.js'
</script>

<EntitlementGate feature={FEATURES.proAnalytics} label="Match Timeline">
  <Timeline />
</EntitlementGate>
