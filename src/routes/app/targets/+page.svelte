<script>
  import EntitlementGate from '$lib/EntitlementGate.svelte'
  import StatTargets from '$lib/StatTargets.svelte'
  import { FEATURES } from '$lib/entitlements.js'
</script>

<EntitlementGate feature={FEATURES.proAnalytics} label="Stat Targets">
  <StatTargets />
</EntitlementGate>
