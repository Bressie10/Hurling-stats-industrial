<script>
  import EntitlementGate from '$lib/EntitlementGate.svelte'
  import PlayerStats from '$lib/PlayerStats.svelte'
  import { FEATURES } from '$lib/entitlements.js'
</script>

<EntitlementGate feature={FEATURES.proAnalytics} label="Player Stats">
  <PlayerStats />
</EntitlementGate>
