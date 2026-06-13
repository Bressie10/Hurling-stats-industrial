<script>
  import EntitlementGate from '$lib/EntitlementGate.svelte'
  import TeamStats from '$lib/TeamStats.svelte'
  import { FEATURES } from '$lib/entitlements.js'
</script>

<EntitlementGate feature={FEATURES.proAnalytics} label="Team Stats">
  <TeamStats />
</EntitlementGate>
