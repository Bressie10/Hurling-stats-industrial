<script>
  import { onMount } from 'svelte'
  import { loadSquad } from './db.js'
  import {
    createLocalGpsSession,
    createLocalTrackerAssignment,
    endLocalGpsSession,
    endLocalTrackerAssignment,
    getGpsStorageSummary,
    GPS_SESSION_STATUS,
    isOpenActiveGpsAssignment,
    startLocalGpsSession,
    upsertLocalGpsTracker,
  } from './gps-local.js'
  import { loadLocalGpsDashboardState } from './gps-dashboard.js'
  import { createMockGpsReceiver, estimateMockGpsSimulation } from './gps-receiver.js'
  import { subscriptionStore } from './subscription-store.js'

  const DEV_FALLBACK_CLUB_ID = '00000000-0000-4000-8000-999999999999'
  const DEFAULT_SESSION_NAME = 'Mock GPS Session'

  let selectedTeamId = $state('')
  let selectedSessionId = $state('')
  let sessionName = $state(DEFAULT_SESSION_NAME)
  let sessionType = $state('training')
  let trackerSeedCount = $state(3)
  let sampleIntervalMs = $state(1000)
  let staleThresholdSeconds = $state(5)
  let assignmentDrafts = $state({})
  let speedDrafts = $state({})
  let dashboard = $state(emptyDashboard())
  let storageSummary = $state(null)
  let actionError = $state('')
  let actionLog = $state([])
  let loading = $state(false)
  let loadedTeamId = $state('')

  const receiver = createMockGpsReceiver()
  const selectedClubId = $derived($subscriptionStore.clubId || DEV_FALLBACK_CLUB_ID)
  const availableTeams = $derived($subscriptionStore.teams || [])
  const selectedTeam = $derived(availableTeams.find((team) => team.id === selectedTeamId) || null)
  const activeSession = $derived(dashboard.session)
  const rows = $derived(dashboard.rows || [])
  const trackers = $derived(dashboard.trackers || [])
  const players = $derived(dashboard.players || [])
  const pitchPoints = $derived(dashboard.pitchPoints || [])
  const thirtyTrackerEstimate = $derived(
    estimateMockGpsSimulation({
      trackerCount: 30,
      durationSeconds: 90 * 60,
      sampleIntervalMs: 1000,
    }),
  )

  $effect(() => {
    if ($subscriptionStore.loading || selectedTeamId || availableTeams.length === 0) return
    selectedTeamId = $subscriptionStore.activeTeamId || availableTeams[0].id
  })

  $effect(() => {
    if (!selectedTeamId || selectedTeamId === loadedTeamId) return
    loadedTeamId = selectedTeamId
    selectedSessionId = ''
    void refreshDashboard({ recover: true })
  })

  onMount(() => {
    void refreshDashboard({ recover: true })
    const refreshTimer = setInterval(() => {
      void refreshDashboard()
    }, 1000)

    return () => {
      clearInterval(refreshTimer)
      receiver.stopAllMockTrackers()
    }
  })

  function emptyDashboard() {
    return {
      session: null,
      sessions: [],
      players: [],
      trackers: [],
      assignments: [],
      latestStates: [],
      rows: [],
      pitchPoints: [],
    }
  }

  function trackerUuid(number) {
    return `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`
  }

  function trackerLabel(tracker) {
    return tracker?.label || tracker?.serialNumber || shortId(tracker?.trackerId)
  }

  function mockIntervalMs() {
    return Math.max(100, Number(sampleIntervalMs) || 1000)
  }

  function shortId(value) {
    return String(value || '').slice(0, 8)
  }

  function activeAssignmentForPlayer(teamPlayerId) {
    return dashboard.assignments.find(
      (assignment) =>
        assignment.teamPlayerId === teamPlayerId && isOpenActiveGpsAssignment(assignment),
    )
  }

  function mockSnapshotForTracker(trackerId) {
    return receiver.getMockTrackerSnapshots().find((snapshot) => snapshot.trackerId === trackerId)
  }

  function trackerStartPosition(trackerId) {
    const index = Math.max(
      0,
      trackers.findIndex((tracker) => tracker.trackerId === trackerId),
    )
    return {
      latitude: 53.345 + (index % 6) * 0.00012,
      longitude: -6.265 + Math.floor(index / 6) * 0.00012,
      headingDegrees: 35 + (index % 8) * 18,
      batteryPercent: Math.max(40, 96 - index),
    }
  }

  function appendLog(message, tone = 'info') {
    actionLog = [
      { id: `${Date.now()}:${Math.random()}`, message, tone, at: new Date().toLocaleTimeString() },
      ...actionLog,
    ].slice(0, 8)
  }

  function setError(error) {
    actionError = error?.message || String(error || 'Unknown GPS action error.')
  }

  async function runAction(fn) {
    actionError = ''
    try {
      return await fn()
    } catch (error) {
      setError(error)
      return null
    } finally {
      await refreshDashboard()
    }
  }

  async function refreshDashboard({ recover = false } = {}) {
    if (!selectedTeamId && availableTeams.length === 0) {
      dashboard = emptyDashboard()
      storageSummary = null
      return
    }

    const requestSessionId = selectedSessionId || null
    loading = true
    try {
      const next = await loadLocalGpsDashboardState({
        sessionId: requestSessionId,
        teamId: selectedTeamId || null,
        clubId: selectedClubId,
        receiverSnapshots: receiver.getMockTrackerSnapshots(),
        staleThresholdMs: staleThresholdSeconds * 1000,
      })
      dashboard = next
      if ((recover || !selectedSessionId) && next.session?.sessionId) {
        selectedSessionId = next.session.sessionId
      }
      storageSummary = next.session ? await getGpsStorageSummary(next.session.sessionId) : null
    } finally {
      loading = false
    }
  }

  async function createSession() {
    await runAction(async () => {
      if (!selectedTeamId) throw new Error('Select a team before creating a GPS session.')
      const session = await createLocalGpsSession({
        clubId: selectedClubId,
        teamId: selectedTeamId,
        sessionType,
        name: sessionName || DEFAULT_SESSION_NAME,
      })
      selectedSessionId = session.sessionId
      appendLog(`Created planned session ${shortId(session.sessionId)}.`)
    })
  }

  async function startSession() {
    await runAction(async () => {
      if (!activeSession) throw new Error('Create or recover a GPS session first.')
      const session = await startLocalGpsSession(activeSession.sessionId)
      appendLog(`Started session ${shortId(session.sessionId)}.`)
    })
  }

  async function endSession() {
    await runAction(async () => {
      if (!activeSession) throw new Error('No GPS session selected.')
      const session = await endLocalGpsSession(activeSession.sessionId)
      receiver.stopAllMockTrackers()
      appendLog(`Ended session ${shortId(session.sessionId)}.`, 'warn')
    })
  }

  async function registerMockTrackers(count = trackerSeedCount) {
    await runAction(async () => {
      const total = Math.max(1, Number(count) || 1)
      for (let index = 1; index <= total; index += 1) {
        await upsertLocalGpsTracker({
          trackerId: trackerUuid(index),
          clubId: selectedClubId,
          serialNumber: `MOCK-${String(index).padStart(2, '0')}`,
          label: `Tracker ${String(index).padStart(2, '0')}`,
          status: 'active',
        })
      }
      appendLog(`Registered ${total} mock tracker${total === 1 ? '' : 's'} locally.`)
    })
  }

  function ensureMockTracker(trackerId, { restartStream = false } = {}) {
    if (!activeSession)
      throw new Error('Create or recover a session before creating mock trackers.')
    const tracker = trackers.find((row) => row.trackerId === trackerId)
    const position = trackerStartPosition(trackerId)
    const speed = Number(speedDrafts[trackerId] || 4)
    let mock = receiver.getMockTracker(trackerId)
    if (!mock || mock.sessionId !== activeSession.sessionId) {
      mock = receiver.createMockTracker({
        trackerId,
        sessionId: activeSession.sessionId,
        speedMps: Number.isFinite(speed) ? speed : 4,
        accuracyM: 3,
        noiseM: 0.5,
        seed: trackerId,
        ...position,
      })
    }
    if (restartStream) receiver.restartMockTrackerStream(trackerId)
    return { mock, tracker }
  }

  async function createMockTracker(trackerId) {
    await runAction(async () => {
      ensureMockTracker(trackerId)
      appendLog(
        `Created mock runtime for ${trackerLabel(trackers.find((t) => t.trackerId === trackerId))}.`,
      )
    })
  }

  async function assignTracker(playerId) {
    await runAction(async () => {
      if (!activeSession) throw new Error('Create a GPS session before assigning trackers.')
      const trackerId = assignmentDrafts[playerId]
      if (!trackerId) throw new Error('Select a tracker for this player.')
      const assignment = await createLocalTrackerAssignment({
        sessionId: activeSession.sessionId,
        trackerId,
        teamPlayerId: playerId,
        assignedFrom: activeSession.startedAt || new Date().toISOString(),
      })
      ensureMockTracker(trackerId, { restartStream: true })
      appendLog(
        `Assigned ${trackerLabel(trackers.find((tracker) => tracker.trackerId === trackerId))} to ${shortId(assignment.teamPlayerId)}.`,
      )
    })
  }

  async function closeAssignment(assignmentId) {
    await runAction(async () => {
      const assignment = await endLocalTrackerAssignment(assignmentId)
      receiver.stopMockTracker(assignment.trackerId)
      appendLog(
        `Closed assignment for ${trackerLabel(trackers.find((t) => t.trackerId === assignment.trackerId))}.`,
      )
    })
  }

  async function startTracker(trackerId) {
    await runAction(async () => {
      ensureMockTracker(trackerId)
      receiver.intervalMs = mockIntervalMs()
      receiver.startMockTracker(trackerId, { intervalMs: mockIntervalMs() })
      appendLog(
        `Started ${trackerLabel(trackers.find((tracker) => tracker.trackerId === trackerId))}.`,
      )
    })
  }

  async function stopTracker(trackerId) {
    await runAction(async () => {
      receiver.stopMockTracker(trackerId)
      appendLog(
        `Stopped ${trackerLabel(trackers.find((tracker) => tracker.trackerId === trackerId))}.`,
        'warn',
      )
    })
  }

  async function disconnectTracker(trackerId) {
    await runAction(async () => {
      ensureMockTracker(trackerId)
      receiver.disconnectMockTracker(trackerId)
      appendLog(
        `Disconnected ${trackerLabel(trackers.find((tracker) => tracker.trackerId === trackerId))}.`,
        'warn',
      )
    })
  }

  async function reconnectTracker(trackerId) {
    await runAction(async () => {
      ensureMockTracker(trackerId)
      const results = await receiver.reconnectMockTracker(trackerId)
      appendLog(
        `Reconnected ${trackerLabel(trackers.find((tracker) => tracker.trackerId === trackerId))}; flushed ${results.length} buffered sample${results.length === 1 ? '' : 's'}.`,
      )
    })
  }

  async function flushBuffered(trackerId) {
    await runAction(async () => {
      ensureMockTracker(trackerId)
      const results = await receiver.flushBufferedTrackerSamples(trackerId)
      appendLog(`Flushed ${results.length} buffered sample${results.length === 1 ? '' : 's'}.`)
    })
  }

  async function tickTracker(trackerId) {
    await runAction(async () => {
      ensureMockTracker(trackerId)
      receiver.intervalMs = mockIntervalMs()
      const result = await receiver.tickTracker(trackerId, {
        stepSeconds: mockIntervalMs() / 1000,
      })
      appendLog(
        `Manual tick ${result.telemetry.sequence}: ${result.ingestion?.code || result.status}.`,
      )
    })
  }

  async function duplicateTrackerSample(trackerId) {
    await runAction(async () => {
      ensureMockTracker(trackerId)
      const snapshot = mockSnapshotForTracker(trackerId)
      const sequence = Number(snapshot?.sequence ?? 0) - 1
      if (sequence < 0)
        throw new Error('Generate at least one sample before resending a duplicate.')
      const result = await receiver.resendTrackerSample(trackerId, sequence)
      appendLog(`Duplicate resend ${sequence}: ${result.ingestion?.code || result.status}.`)
    })
  }

  async function applySpeed(trackerId) {
    await runAction(async () => {
      ensureMockTracker(trackerId)
      const speed = Math.max(0, Number(speedDrafts[trackerId]) || 0)
      receiver.setMockTrackerSpeed(trackerId, speed)
      appendLog(
        `Set ${trackerLabel(trackers.find((tracker) => tracker.trackerId === trackerId))} to ${(speed * 3.6).toFixed(1)} km/h.`,
      )
    })
  }

  async function startAssignedTrackers() {
    await runAction(async () => {
      for (const row of rows) {
        if (row.trackerId) {
          ensureMockTracker(row.trackerId)
          receiver.intervalMs = mockIntervalMs()
          receiver.startMockTracker(row.trackerId, { intervalMs: mockIntervalMs() })
        }
      }
      appendLog(`Started ${rows.length} assigned mock tracker${rows.length === 1 ? '' : 's'}.`)
    })
  }

  async function setupThirtyTrackerRun() {
    await runAction(async () => {
      await registerMockTrackers(30)
      const currentPlayers = await loadSquad({ teamScope: selectedTeamId })
      if (currentPlayers.length < 30) {
        throw new Error('The 30-tracker test needs 30 canonical players in this team roster.')
      }
      await refreshDashboard()
      for (let index = 0; index < 30; index += 1) {
        const player = currentPlayers[index]
        if (activeAssignmentForPlayer(player.id)) continue
        const trackerId = trackerUuid(index + 1)
        await createLocalTrackerAssignment({
          sessionId: activeSession.sessionId,
          trackerId,
          teamPlayerId: player.id,
          assignedFrom: activeSession.startedAt || new Date().toISOString(),
        })
        ensureMockTracker(trackerId, { restartStream: true })
      }
      appendLog('Prepared 30 assigned mock trackers for the active session.')
    })
  }
</script>

<svelte:head>
  <title>Mock GPS Dev | PitchNote</title>
</svelte:head>

<section class="gps-dev">
  <header class="dev-header">
    <div>
      <p class="mode-label">MOCK GPS / DEVELOPMENT MODE</p>
      <h1>Offline Live GPS Proof</h1>
      <p class="subhead">Local receiver → IndexedDB → gps_latest. No cloud live path.</p>
    </div>
    <div class="status-box">
      <span class="status-dot" class:active={activeSession?.status === GPS_SESSION_STATUS.ACTIVE}
      ></span>
      <div>
        <strong>{activeSession?.status?.toUpperCase() || 'NO SESSION'}</strong>
        <small>{activeSession ? shortId(activeSession.sessionId) : 'local only'}</small>
      </div>
    </div>
  </header>

  {#if actionError}
    <div class="error-banner" role="alert">{actionError}</div>
  {/if}

  <div class="dev-grid">
    <section class="panel">
      <h2>Session</h2>
      <div class="form-grid">
        <label>
          Team
          <select bind:value={selectedTeamId} onchange={() => refreshDashboard({ recover: true })}>
            <option value="">Select team</option>
            {#each availableTeams as team}
              <option value={team.id}>{team.name || team.code || team.id}</option>
            {/each}
          </select>
        </label>
        <label>
          Existing local session
          <select bind:value={selectedSessionId} onchange={() => refreshDashboard()}>
            <option value="">Auto-recover active/planned</option>
            {#each dashboard.sessions as session}
              <option value={session.sessionId}>
                {session.name || session.sessionType} · {session.status} · {shortId(
                  session.sessionId,
                )}
              </option>
            {/each}
          </select>
        </label>
        <label>
          Session name
          <input bind:value={sessionName} placeholder="Mock GPS Session" />
        </label>
        <label>
          Session type
          <select bind:value={sessionType}>
            <option value="training">training</option>
            <option value="match">match</option>
          </select>
        </label>
      </div>
      <div class="button-row">
        <button class="primary-btn" onclick={createSession} disabled={!selectedTeamId}
          >Create Session</button
        >
        <button
          onclick={startSession}
          disabled={!activeSession || activeSession.status !== GPS_SESSION_STATUS.PLANNED}
          >Start Session</button
        >
        <button
          class="danger-btn"
          onclick={endSession}
          disabled={!activeSession || activeSession.status !== GPS_SESSION_STATUS.ACTIVE}
          >End Session</button
        >
      </div>
      <div class="meta-grid">
        <span>Team: {selectedTeam?.name || 'none'}</span>
        <span>Players: {players.length}</span>
        <span>Samples: {storageSummary?.sampleCount || 0}</span>
        <span>Chunks: {storageSummary?.chunkCount || 0}</span>
      </div>
    </section>

    <section class="panel">
      <h2>Tracker Registry</h2>
      <div class="inline-controls">
        <label>
          Count
          <input type="number" min="1" max="30" bind:value={trackerSeedCount} />
        </label>
        <button onclick={() => registerMockTrackers()}>Seed Trackers</button>
        <button onclick={() => registerMockTrackers(30)}>Seed 30</button>
      </div>
      <div class="tracker-list">
        {#each trackers as tracker}
          <button class="tracker-pill" onclick={() => createMockTracker(tracker.trackerId)}>
            {trackerLabel(tracker)}
          </button>
        {:else}
          <p class="empty">No local trackers registered for this club.</p>
        {/each}
      </div>
    </section>
  </div>

  <section class="panel">
    <div class="panel-head">
      <h2>Player / Tracker Assignments</h2>
      <button onclick={setupThirtyTrackerRun} disabled={!activeSession || players.length < 30}
        >Prepare 30-Tracker Test</button
      >
    </div>
    <div class="assignment-grid">
      {#each players as player}
        <div class="assignment-row">
          <div>
            <strong>{player.name || player.display_name}</strong>
            <small>{player.id}</small>
          </div>
          <select
            value={assignmentDrafts[player.id] || ''}
            onchange={(event) => (assignmentDrafts[player.id] = event.currentTarget.value)}
            disabled={!activeSession || activeSession.status === GPS_SESSION_STATUS.ENDED}
          >
            <option value="">Select tracker</option>
            {#each trackers as tracker}
              <option value={tracker.trackerId}>{trackerLabel(tracker)}</option>
            {/each}
          </select>
          <button
            onclick={() => assignTracker(player.id)}
            disabled={!activeSession || !assignmentDrafts[player.id]}
          >
            Assign
          </button>
          {#if activeAssignmentForPlayer(player.id)}
            <button
              class="danger-btn"
              onclick={() => closeAssignment(activeAssignmentForPlayer(player.id).assignmentId)}
            >
              Close
            </button>
          {/if}
        </div>
      {:else}
        <p class="empty">No canonical players cached locally for this team.</p>
      {/each}
    </div>
  </section>

  <div class="live-layout">
    <section class="panel live-panel">
      <div class="panel-head">
        <h2>Live Player State</h2>
        <div class="inline-controls compact">
          <label>
            Stale seconds
            <input type="number" min="2" max="60" bind:value={staleThresholdSeconds} />
          </label>
          <button onclick={startAssignedTrackers} disabled={rows.length === 0}
            >Start Assigned</button
          >
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th>Tracker</th>
              <th>Connection</th>
              <th>Speed</th>
              <th>Accuracy</th>
              <th>Battery</th>
              <th>Last Update</th>
            </tr>
          </thead>
          <tbody>
            {#each rows as row}
              <tr>
                <td>{row.playerName}</td>
                <td>{row.trackerLabel}</td>
                <td
                  ><span class="connection" class:live={row.connection === 'LIVE'}
                    >{row.connection}</span
                  ></td
                >
                <td>{row.speedDisplay}</td>
                <td>{row.accuracyDisplay}</td>
                <td>{row.batteryDisplay}</td>
                <td>{row.lastUpdateDisplay}</td>
              </tr>
            {:else}
              <tr>
                <td colspan="7" class="empty-cell"
                  >Assign trackers to players to populate live state.</td
                >
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel pitch-panel">
      <h2>Mock Pitch View</h2>
      <div class="pitch">
        <div class="midline"></div>
        {#each pitchPoints as point}
          <div
            class="pitch-dot"
            class:stale={point.connection !== 'LIVE'}
            style={`left: ${point.x}%; top: ${point.y}%`}
            title={point.label}
          >
            <span></span>
            <em>{point.label}</em>
          </div>
        {/each}
      </div>
      <p class="caption">Mock normalization only. This is not real pitch calibration.</p>
    </section>
  </div>

  <section class="panel">
    <div class="panel-head">
      <h2>Mock Receiver Controls</h2>
      <div class="inline-controls compact">
        <label>
          Interval ms
          <input type="number" min="100" step="100" bind:value={sampleIntervalMs} />
        </label>
      </div>
    </div>
    <div class="mock-grid">
      {#each trackers as tracker}
        {@const snapshot = mockSnapshotForTracker(tracker.trackerId)}
        <div class="mock-card">
          <div class="mock-title">
            <strong>{trackerLabel(tracker)}</strong>
            <span class:running={snapshot?.running}>{snapshot?.running ? 'running' : 'idle'}</span>
          </div>
          <div class="mock-meta">
            <span>seq {snapshot?.sequence ?? '—'}</span>
            <span>buffer {snapshot?.bufferedCount ?? 0}</span>
            <span>{snapshot?.connected === false ? 'disconnected' : 'connected'}</span>
          </div>
          <div class="speed-control">
            <input
              type="number"
              min="0"
              step="0.5"
              value={speedDrafts[tracker.trackerId] || 4}
              onchange={(event) => (speedDrafts[tracker.trackerId] = event.currentTarget.value)}
            />
            <button onclick={() => applySpeed(tracker.trackerId)}>Set m/s</button>
          </div>
          <div class="button-grid">
            <button onclick={() => createMockTracker(tracker.trackerId)}>Create</button>
            <button onclick={() => startTracker(tracker.trackerId)}>Start</button>
            <button onclick={() => stopTracker(tracker.trackerId)}>Stop</button>
            <button onclick={() => tickTracker(tracker.trackerId)}>Tick</button>
            <button onclick={() => disconnectTracker(tracker.trackerId)}>Disconnect</button>
            <button onclick={() => reconnectTracker(tracker.trackerId)}>Reconnect</button>
            <button onclick={() => flushBuffered(tracker.trackerId)}>Flush</button>
            <button onclick={() => duplicateTrackerSample(tracker.trackerId)}>Duplicate</button>
          </div>
        </div>
      {:else}
        <p class="empty">Seed local trackers to enable mock controls.</p>
      {/each}
    </div>
  </section>

  <section class="panel debug-panel">
    <h2>Local Proof Notes</h2>
    <div class="proof-grid">
      <span>Supabase live path: not used</span>
      <span>Realtime: not used</span>
      <span>Raw sample store: chunked</span>
      <span
        >30-tracker estimate: {thirtyTrackerEstimate.totalSamples} samples, {thirtyTrackerEstimate.chunkCount}
        chunks</span
      >
    </div>
    <div class="log-list">
      {#each actionLog as item}
        <div class="log-row" class:warn={item.tone === 'warn'}>
          <span>{item.at}</span>
          <p>{item.message}</p>
        </div>
      {:else}
        <p class="empty">No mock receiver events yet.</p>
      {/each}
    </div>
  </section>

  {#if loading}
    <div class="loading-strip">Refreshing local GPS state…</div>
  {/if}
</section>

<style>
  .gps-dev {
    min-height: 100vh;
    padding: 24px;
    padding-bottom: 96px;
    background: var(--bg);
    color: var(--text);
  }
  .dev-header,
  .dev-grid,
  .live-layout {
    display: grid;
    gap: 16px;
  }
  .dev-header {
    grid-template-columns: 1fr auto;
    align-items: end;
    margin-bottom: 16px;
  }
  .mode-label {
    margin: 0 0 8px;
    color: #ffb74d;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.08em;
  }
  h1,
  h2,
  p {
    margin: 0;
  }
  h1 {
    font-size: clamp(26px, 4vw, 40px);
    line-height: 1.05;
    letter-spacing: 0;
  }
  h2 {
    font-size: 16px;
    line-height: 1.2;
  }
  .subhead,
  .caption,
  .empty,
  small {
    color: var(--text-muted);
    font-size: 13px;
    line-height: 1.45;
  }
  .status-box {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 180px;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
    background: var(--surface);
  }
  .status-box strong,
  .status-box small {
    display: block;
  }
  .status-dot {
    width: 10px;
    height: 10px;
    border-radius: 999px;
    background: #777;
  }
  .status-dot.active {
    background: var(--primary);
    box-shadow: 0 0 0 5px rgba(var(--primary-rgb), 0.12);
  }
  .panel {
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
    padding: 16px;
    background: var(--surface);
    box-shadow: var(--shadow-sm);
  }
  .dev-grid {
    grid-template-columns: minmax(0, 1.4fr) minmax(280px, 0.6fr);
    margin-bottom: 16px;
  }
  .live-layout {
    grid-template-columns: minmax(0, 1.4fr) minmax(300px, 0.6fr);
    margin: 16px 0;
  }
  .panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;
  }
  .form-grid,
  .inline-controls,
  .meta-grid,
  .proof-grid {
    display: grid;
    gap: 10px;
  }
  .form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .inline-controls {
    grid-template-columns: auto auto auto;
    align-items: end;
  }
  .inline-controls.compact {
    grid-template-columns: auto auto;
  }
  .meta-grid,
  .proof-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    margin-top: 12px;
  }
  label {
    display: grid;
    gap: 6px;
    color: var(--text-muted);
    font-size: 12px;
    font-weight: 700;
  }
  input,
  select {
    min-height: 38px;
    width: 100%;
    border: 1px solid var(--input-border);
    border-radius: var(--r-sm);
    padding: 0 10px;
    font: inherit;
    font-size: 14px;
  }
  button {
    min-height: 38px;
    border: 1px solid var(--border);
    border-radius: var(--r-sm);
    padding: 0 12px;
    color: var(--text);
    background: var(--surface-2);
    font: inherit;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
  }
  button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
  .primary-btn {
    border-color: var(--primary);
    color: var(--primary-text);
    background: var(--primary);
  }
  .danger-btn {
    border-color: rgba(239, 83, 80, 0.5);
    color: #ff8a80;
  }
  .button-row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 12px;
  }
  .tracker-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }
  .tracker-pill {
    min-height: 34px;
    border-color: rgba(var(--primary-rgb), 0.28);
    color: var(--primary);
    background: rgba(var(--primary-rgb), 0.08);
  }
  .assignment-grid {
    display: grid;
    gap: 8px;
  }
  .assignment-row {
    display: grid;
    grid-template-columns: minmax(180px, 1fr) minmax(180px, 0.8fr) auto auto;
    gap: 10px;
    align-items: center;
    padding: 10px;
    border: 1px solid var(--divider);
    border-radius: var(--r-sm);
    background: var(--surface-2);
  }
  .assignment-row strong,
  .assignment-row small {
    display: block;
    overflow-wrap: anywhere;
  }
  .table-wrap {
    overflow-x: auto;
  }
  table {
    width: 100%;
    min-width: 760px;
    border-collapse: collapse;
  }
  th,
  td {
    padding: 11px 10px;
    border-bottom: 1px solid var(--divider);
    text-align: left;
    font-size: 13px;
  }
  th {
    color: var(--text-muted);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .connection {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 86px;
    min-height: 24px;
    border-radius: 999px;
    color: #ffcc80;
    background: rgba(255, 183, 77, 0.12);
    font-size: 11px;
    font-weight: 800;
  }
  .connection.live {
    color: var(--primary);
    background: rgba(var(--primary-rgb), 0.12);
  }
  .empty-cell {
    color: var(--text-muted);
    text-align: center;
  }
  .pitch {
    position: relative;
    width: 100%;
    aspect-ratio: 0.68;
    min-height: 320px;
    overflow: hidden;
    border: 2px solid rgba(var(--primary-rgb), 0.28);
    border-radius: var(--r-sm);
    background:
      linear-gradient(90deg, transparent 49.7%, rgba(255, 255, 255, 0.16) 50%, transparent 50.3%),
      repeating-linear-gradient(0deg, #15381f 0 44px, #183f24 44px 88px);
  }
  .midline {
    position: absolute;
    top: 50%;
    left: 0;
    width: 100%;
    height: 1px;
    background: rgba(255, 255, 255, 0.18);
  }
  .pitch-dot {
    position: absolute;
    display: flex;
    align-items: center;
    gap: 5px;
    transform: translate(-8px, -8px);
    white-space: nowrap;
  }
  .pitch-dot span {
    width: 13px;
    height: 13px;
    border: 2px solid #0d0d0d;
    border-radius: 999px;
    background: var(--primary);
    box-shadow: 0 0 0 3px rgba(var(--primary-rgb), 0.18);
  }
  .pitch-dot.stale span {
    background: #ffb74d;
  }
  .pitch-dot em {
    max-width: 84px;
    overflow: hidden;
    color: #fff;
    font-size: 11px;
    font-style: normal;
    font-weight: 800;
    text-overflow: ellipsis;
    text-shadow: 0 1px 3px #000;
  }
  .mock-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 12px;
  }
  .mock-card {
    display: grid;
    gap: 10px;
    border: 1px solid var(--divider);
    border-radius: var(--r-sm);
    padding: 12px;
    background: var(--surface-2);
  }
  .mock-title,
  .mock-meta,
  .speed-control {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .mock-title span {
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
  }
  .mock-title span.running {
    color: var(--primary);
  }
  .mock-meta {
    color: var(--text-muted);
    font-size: 12px;
  }
  .speed-control {
    display: grid;
    grid-template-columns: 1fr auto;
  }
  .button-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }
  .button-grid button {
    min-height: 32px;
    padding: 0 6px;
    font-size: 11px;
  }
  .debug-panel {
    margin-top: 16px;
  }
  .log-list {
    display: grid;
    gap: 8px;
    margin-top: 12px;
  }
  .log-row {
    display: grid;
    grid-template-columns: 74px 1fr;
    gap: 10px;
    color: var(--text-2);
    font-size: 13px;
  }
  .log-row span {
    color: var(--text-muted);
  }
  .log-row.warn p {
    color: #ffcc80;
  }
  .error-banner {
    margin-bottom: 16px;
    border: 1px solid rgba(239, 83, 80, 0.45);
    border-radius: var(--r-sm);
    padding: 12px;
    color: #ff8a80;
    background: rgba(239, 83, 80, 0.1);
  }
  .loading-strip {
    position: fixed;
    right: 16px;
    bottom: 16px;
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 8px 12px;
    color: var(--text-muted);
    background: var(--surface);
    font-size: 12px;
  }
  @media (max-width: 920px) {
    .gps-dev {
      padding: 16px;
      padding-bottom: 96px;
    }
    .dev-header,
    .dev-grid,
    .live-layout,
    .form-grid,
    .meta-grid,
    .proof-grid {
      grid-template-columns: 1fr;
    }
    .assignment-row {
      grid-template-columns: 1fr;
    }
    .panel-head {
      align-items: stretch;
      flex-direction: column;
    }
  }
</style>
