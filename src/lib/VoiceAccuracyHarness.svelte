<script>
  import { onMount } from 'svelte'
  import { loadSquad } from './db.js'
  import { isOnDeviceSpeechAvailable, recognizeOnDeviceSpeech } from './on-device-speech.js'
  import { playerHasDisplayName, playerIdentity, playerLabel, playerName } from './team-players.js'
  import { VOICE_ACTIONS } from './voice-log-config.js'
  import { buildVoiceVocabulary, parseVoiceLog } from './voice-log-parser.js'

  const STORAGE_KEY = 'pitchnote-voice-accuracy-samples'
  const supportedStats = [...new Set(Object.values(VOICE_ACTIONS).map((action) => action.stat))]
  const annotationOptions = [
    { value: 'unreviewed', label: 'Unreviewed' },
    { value: 'correct_first_try', label: 'Correct first try' },
    { value: 'correctable', label: 'Correctable' },
    { value: 'reattempt', label: 'Re-attempt' },
    { value: 'bad_sample', label: 'Bad sample' },
  ]

  let players = $state([])
  let samples = $state([])
  let status = $state('idle')
  let message = $state('')
  let manualTranscript = $state('')
  let sampleLabel = $state('')
  let audioRef = $state('')
  let deviceLabel = $state('')
  let ambientNote = $state('')
  let devicePlatform = $state('')
  let deviceUserAgent = $state('')
  let connectionType = $state('')
  let networkOnline = $state(true)
  let expectedPlayerId = $state('')
  let expectedStat = $state('')
  let lastSpeechDiagnostics = $state('Not checked')

  let namedPlayers = $derived(players.filter(playerHasDisplayName))
  let latestSample = $derived(samples[0] || null)
  let networkMode = $derived(networkOnline ? 'online' : 'offline')
  let liveTranscript = $derived(
    status === 'listening'
      ? 'Listening...'
      : latestSample?.transcript ||
          latestSample?.sttError ||
          manualTranscript ||
          'No transcript yet',
  )
  let latestParsedResult = $derived(
    latestSample
      ? `${latestSample.parsedPlayer || 'None'} / ${latestSample.parsedStat || 'None'}`
      : 'No result yet',
  )
  let reviewedSamples = $derived(
    samples.filter((sample) =>
      ['correct_first_try', 'correctable', 'reattempt'].includes(sample.annotation),
    ),
  )
  let summary = $derived(buildSummary(reviewedSamples))

  onMount(() => {
    loadInitialState()
    refreshNetworkState()
    devicePlatform = navigator.platform || ''
    deviceUserAgent = navigator.userAgent || ''

    window.addEventListener('online', refreshNetworkState)
    window.addEventListener('offline', refreshNetworkState)
    navigator.connection?.addEventListener?.('change', refreshNetworkState)

    return () => {
      window.removeEventListener('online', refreshNetworkState)
      window.removeEventListener('offline', refreshNetworkState)
      navigator.connection?.removeEventListener?.('change', refreshNetworkState)
    }
  })

  async function loadInitialState() {
    try {
      players = (await loadSquad()).sort((a, b) => Number(a.number || 99) - Number(b.number || 99))
    } catch (e) {
      message = `Could not load squad: ${e?.message || e}`
    }

    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
      samples = Array.isArray(stored) ? stored : []
    } catch {
      samples = []
    }
  }

  function refreshNetworkState() {
    networkOnline = navigator.onLine
    const connection = navigator.connection
    connectionType = connection
      ? [connection.effectiveType || connection.type || '', connection.saveData ? 'saveData' : '']
          .filter(Boolean)
          .join(' ')
      : ''
  }

  function buildSummary(rows) {
    const total = rows.length
    const correct = rows.filter((sample) => sample.annotation === 'correct_first_try').length
    const correctable = rows.filter((sample) => sample.annotation === 'correctable').length
    const reattempt = rows.filter((sample) => sample.annotation === 'reattempt').length
    return {
      total,
      correctPct: percent(correct, total),
      correctablePct: percent(correctable, total),
      reattemptPct: percent(reattempt, total),
    }
  }

  function percent(value, total) {
    return total ? Math.round((value / total) * 1000) / 10 : 0
  }

  function expectedPlayerName() {
    return playerName(
      namedPlayers.find((player) => playerIdentity(player) === String(expectedPlayerId)),
    )
  }

  function sampleStatus(sample) {
    if (sample.sttError) return 'stt_error'
    if (sample.parsedStatus === 'ok' && sample.lowConfidence) return 'low_confidence'
    if (sample.parsedStatus === 'ambiguous_player') return 'ambiguous'
    if (sample.parsedStatus === 'no_action_detected') return 'no_action'
    return sample.parsedStatus || 'unknown'
  }

  function availabilitySummary(availability) {
    if (!availability || typeof availability !== 'object') return ''
    const base = [
      `available=${availability.available ?? ''}`,
      availability.reason ? `reason=${availability.reason}` : '',
    ].filter(Boolean)
    const diagnostics = speechDiagnosticSummary(availability.diagnostics)
    return [...base, diagnostics].filter(Boolean).join(', ')
  }

  function parseSample(transcript, source, sttError = '', capture = {}) {
    const speech = capture.speech || {}
    const availability = capture.availability || null
    const sttAlternatives = Array.isArray(speech.alternatives)
      ? speech.alternatives
          .map((alternative) => {
            const transcript = String(alternative?.transcript || '').trim()
            if (!transcript) return ''
            const confidence =
              typeof alternative?.confidence === 'number'
                ? ` (${alternative.confidence.toFixed(2)})`
                : ''
            return `${transcript}${confidence}`
          })
          .filter(Boolean)
          .join(' | ')
      : ''
    const parsed = sttError
      ? { status: 'stt_error', transcript: '' }
      : parseVoiceLog(transcript, {
          alternatives: speech.alternatives || [],
          roster: namedPlayers,
          availableStats: supportedStats,
          currentHalf: 'field-test',
        })

    const parsedPlayerId = parsed.playerId == null ? '' : String(parsed.playerId)
    const parsedStat = parsed.stat || ''
    const expectedId = expectedPlayerId == null ? '' : String(expectedPlayerId)

    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      capturedAt: new Date().toISOString(),
      source,
      label: sampleLabel.trim(),
      audioRef: audioRef.trim(),
      deviceLabel: deviceLabel.trim(),
      devicePlatform,
      deviceUserAgent,
      networkMode,
      networkOnline,
      connectionType,
      ambientNote: ambientNote.trim(),
      transcript: transcript.trim(),
      sttConfidence:
        typeof speech.confidence === 'number' && Number.isFinite(speech.confidence)
          ? speech.confidence
          : '',
      sttAlternatives,
      recognizerDiagnostics: availabilitySummary(availability),
      expectedPlayerId: expectedId,
      expectedPlayer: expectedPlayerName(),
      expectedAction: expectedStat,
      parsedStatus: parsed.status,
      reportStatus: '',
      parsedPlayerId,
      parsedPlayer: parsed.playerName || '',
      parsedAction: parsed.action || '',
      parsedStat,
      matchSource: parsed.matchSource || '',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : '',
      lowConfidence: Boolean(parsed.lowConfidence),
      candidates: (parsed.candidates || [])
        .map((candidate) => {
          const source = candidate.matchSource ? `/${candidate.matchSource}` : ''
          return `${candidate.number ? `#${candidate.number} ` : ''}${candidate.name}${source}`
        })
        .join(' | '),
      autoExactMatch: Boolean(
        expectedId && expectedStat && parsedPlayerId === expectedId && parsedStat === expectedStat,
      ),
      annotation: 'unreviewed',
      notes: sttError,
      sttError,
    }
  }

  function speechDiagnosticSummary(diagnostics) {
    if (!diagnostics || typeof diagnostics !== 'object') return ''
    return [
      `locale=${diagnostics.requestedLocale || ''}`,
      `auth=${diagnostics.authorizationStatus || ''}`,
      `initialized=${diagnostics.recognizerInitialized ?? ''}`,
      `recognizerLocale=${diagnostics.recognizerLocale || ''}`,
      `isAvailable=${diagnostics.recognizerIsAvailable ?? ''}`,
      `supportsOnDevice=${diagnostics.supportsOnDeviceRecognition ?? ''}`,
    ]
      .filter((part) => !part.endsWith('='))
      .join(', ')
  }

  function persist(nextSamples = samples) {
    samples = nextSamples
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSamples))
  }

  function addSample(sample) {
    sample.reportStatus = sampleStatus(sample)
    persist([sample, ...samples])
  }

  function addTextSample() {
    const transcript = manualTranscript.trim()
    if (!transcript) {
      message = 'Enter a transcript first.'
      return
    }
    addSample(parseSample(transcript, 'typed'))
    manualTranscript = ''
    message = 'Sample added.'
  }

  async function recordNativeSample() {
    status = 'checking'
    message = ''
    let availability = null
    try {
      availability = await isOnDeviceSpeechAvailable({ locale: 'en-IE' })
      lastSpeechDiagnostics = availabilitySummary(availability) || 'Checked'
      if (!availability?.available) {
        const diagnostics = speechDiagnosticSummary(availability?.diagnostics)
        const reason =
          availability?.reason === 'native_required'
            ? 'Native app required for on-device STT.'
            : 'Offline speech recognition is unavailable on this device.'
        const diagnosticReason = diagnostics ? `${reason} Diagnostics: ${diagnostics}` : reason
        addSample(parseSample('', 'native-stt', diagnosticReason, { availability }))
        message = diagnosticReason
        return
      }

      status = 'listening'
      const speech = await recognizeOnDeviceSpeech({
        contextualStrings: buildVoiceVocabulary(namedPlayers, supportedStats),
        locale: 'en-IE',
      })
      addSample(parseSample(speech?.transcript || '', 'native-stt', '', { speech, availability }))
      message = 'Native sample added.'
    } catch (e) {
      const reason = e?.message || String(e)
      lastSpeechDiagnostics = reason
      addSample(parseSample('', 'native-stt', reason, { availability }))
      message = reason
    } finally {
      status = 'idle'
    }
  }

  function updateSample(id, patch) {
    persist(samples.map((sample) => (sample.id === id ? { ...sample, ...patch } : sample)))
  }

  function quickAnnotate(sample, annotation) {
    if (!sample) return
    updateSample(sample.id, { annotation })
  }

  function deleteSample(id) {
    persist(samples.filter((sample) => sample.id !== id))
  }

  function clearSamples() {
    persist([])
  }

  function csvCell(value) {
    const text = String(value ?? '')
    return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
  }

  function exportCsv() {
    const headers = [
      'id',
      'captured_at',
      'source',
      'label',
      'audio_ref',
      'device_label',
      'device_platform',
      'device_user_agent',
      'network_mode',
      'network_online',
      'connection_type',
      'ambient_conditions',
      'transcript',
      'stt_confidence',
      'stt_alternatives',
      'recognizer_diagnostics',
      'expected_player',
      'expected_action',
      'parsed_status',
      'parsed_player',
      'parsed_action',
      'parsed_stat',
      'match_source',
      'confidence',
      'low_confidence',
      'candidates',
      'auto_exact_match',
      'annotation',
      'notes',
    ]
    const rows = samples.map((sample) => [
      sample.id,
      sample.capturedAt,
      sample.source,
      sample.label,
      sample.audioRef,
      sample.deviceLabel,
      sample.devicePlatform,
      sample.deviceUserAgent,
      sample.networkMode,
      sample.networkOnline,
      sample.connectionType,
      sample.ambientNote,
      sample.transcript,
      sample.sttConfidence,
      sample.sttAlternatives,
      sample.recognizerDiagnostics,
      sample.expectedPlayer,
      sample.expectedAction,
      sample.reportStatus,
      sample.parsedPlayer,
      sample.parsedAction,
      sample.parsedStat,
      sample.matchSource,
      sample.confidence,
      sample.lowConfidence,
      sample.candidates,
      sample.autoExactMatch,
      sample.annotation,
      sample.notes,
    ])
    const summaryRows = [
      [],
      ['summary_reviewed_samples', summary.total],
      ['summary_correct_first_try_pct', summary.correctPct],
      ['summary_correctable_pct', summary.correctablePct],
      ['summary_reattempt_pct', summary.reattemptPct],
    ]
    const csv = [headers, ...rows, ...summaryRows]
      .map((row) => row.map(csvCell).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `pitchnote-voice-accuracy-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
</script>

<section class="voice-test">
  <header class="test-header">
    <div>
      <p class="eyebrow">Field test</p>
      <h1>Voice Accuracy</h1>
    </div>
    <div class="header-actions">
      <div class:offline={!networkOnline} class="network-pill">
        {networkOnline ? 'Network online' : 'Offline / airplane mode'}
      </div>
      <button type="button" class="secondary" onclick={exportCsv} disabled={!samples.length}>
        Export CSV
      </button>
      <button type="button" class="danger" onclick={clearSamples} disabled={!samples.length}>
        Clear
      </button>
    </div>
  </header>

  <div class="summary-grid">
    <div>
      <span>Reviewed</span>
      <strong>{summary.total}</strong>
    </div>
    <div>
      <span>Correct first try</span>
      <strong>{summary.correctPct}%</strong>
    </div>
    <div>
      <span>Correctable</span>
      <strong>{summary.correctablePct}%</strong>
    </div>
    <div>
      <span>Re-attempt</span>
      <strong>{summary.reattemptPct}%</strong>
    </div>
  </div>

  <div class="capture-panel">
    <div class="capture-row">
      <label>
        <span>Expected player</span>
        <select bind:value={expectedPlayerId}>
          <option value="">Unset</option>
          {#each namedPlayers as player}
            <option value={playerIdentity(player)}>
              {playerLabel(player)}
            </option>
          {/each}
        </select>
      </label>
      <label>
        <span>Expected stat</span>
        <select bind:value={expectedStat}>
          <option value="">Unset</option>
          {#each supportedStats as stat}
            <option value={stat}>{stat}</option>
          {/each}
        </select>
      </label>
      <label>
        <span>Label</span>
        <input bind:value={sampleLabel} placeholder="Round, drill, location" />
      </label>
      <label>
        <span>Audio ref</span>
        <input bind:value={audioRef} placeholder="Optional clip filename" />
      </label>
      <label>
        <span>Device</span>
        <input bind:value={deviceLabel} placeholder="Phone model" />
      </label>
      <label>
        <span>Ambient</span>
        <input bind:value={ambientNote} placeholder="Wind, crowd, distance" />
      </label>
    </div>

    <div class="live-panel">
      <div>
        <span>Live transcript</span>
        <strong>{liveTranscript}</strong>
      </div>
      <div>
        <span>Status</span>
        <strong>{latestSample?.reportStatus || status}</strong>
      </div>
      <div>
        <span>Parsed result</span>
        <strong>{latestParsedResult}</strong>
      </div>
      <div>
        <span>Network mode</span>
        <strong>{networkMode}{connectionType ? ` / ${connectionType}` : ''}</strong>
      </div>
      <div>
        <span>Speech check</span>
        <strong>{lastSpeechDiagnostics}</strong>
      </div>
    </div>

    {#if latestSample}
      <div class="quick-annotation">
        <button
          type="button"
          class="correct"
          onclick={() => quickAnnotate(latestSample, 'correct_first_try')}
        >
          Correct
        </button>
        <button
          type="button"
          class="fixable"
          onclick={() => quickAnnotate(latestSample, 'correctable')}
        >
          Fixable
        </button>
        <button
          type="button"
          class="incorrect"
          onclick={() => quickAnnotate(latestSample, 'reattempt')}
        >
          Incorrect
        </button>
      </div>
    {/if}

    <div class="manual-row">
      <textarea
        bind:value={manualTranscript}
        rows="3"
        placeholder="Typed transcript for dry runs, or backup text from a separate recorder"
      ></textarea>
      <div class="button-stack">
        <button
          type="button"
          class="primary"
          onclick={recordNativeSample}
          disabled={status !== 'idle'}
        >
          {status === 'listening' ? 'Listening...' : 'Record STT'}
        </button>
        <button type="button" class="secondary" onclick={addTextSample}>Add Text</button>
      </div>
    </div>

    {#if message}
      <p class="message">{message}</p>
    {/if}
    <p class="limit-note">
      Known limitation: black/red cards, 45s, and sideline balls are not currently voice-loggable in
      v1. Use tap entry for these.
    </p>
  </div>

  <div class="sample-list">
    {#each samples as sample (sample.id)}
      <article class:low={sample.lowConfidence} class:error={sample.sttError}>
        <div class="sample-top">
          <div>
            <span class="status">{sample.reportStatus}</span>
            <strong>{sample.transcript || sample.sttError || 'No transcript'}</strong>
            <small>{sample.capturedAt} - {sample.source}</small>
          </div>
          <button type="button" class="ghost" onclick={() => deleteSample(sample.id)}>Delete</button
          >
        </div>

        <dl>
          <div>
            <dt>Expected</dt>
            <dd>{sample.expectedPlayer || 'Unset'} / {sample.expectedAction || 'Unset'}</dd>
          </div>
          <div>
            <dt>Parsed</dt>
            <dd>{sample.parsedPlayer || 'None'} / {sample.parsedStat || 'None'}</dd>
          </div>
          <div>
            <dt>Confidence</dt>
            <dd>{sample.confidence === '' ? 'n/a' : Number(sample.confidence).toFixed(2)}</dd>
          </div>
          <div>
            <dt>Matched by</dt>
            <dd>{sample.matchSource || 'n/a'}</dd>
          </div>
          <div>
            <dt>Candidates</dt>
            <dd>{sample.candidates || 'None'}</dd>
          </div>
        </dl>

        <div class="review-row">
          <div class="quick-annotation inline">
            <button
              type="button"
              class="correct"
              onclick={() => quickAnnotate(sample, 'correct_first_try')}
            >
              Correct
            </button>
            <button
              type="button"
              class="fixable"
              onclick={() => quickAnnotate(sample, 'correctable')}
            >
              Fixable
            </button>
            <button
              type="button"
              class="incorrect"
              onclick={() => quickAnnotate(sample, 'reattempt')}
            >
              Incorrect
            </button>
          </div>
          <label>
            <span>Annotation</span>
            <select
              value={sample.annotation}
              onchange={(event) =>
                updateSample(sample.id, { annotation: event.currentTarget.value })}
            >
              {#each annotationOptions as option}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
          </label>
          <label>
            <span>Notes</span>
            <input
              value={sample.notes}
              oninput={(event) => updateSample(sample.id, { notes: event.currentTarget.value })}
            />
          </label>
        </div>
      </article>
    {:else}
      <div class="empty">No samples yet.</div>
    {/each}
  </div>
</section>

<style>
  .voice-test {
    min-height: 100vh;
    background: var(--bg);
    color: var(--text);
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .test-header,
  .capture-panel,
  .sample-list article {
    border: 1px solid var(--border);
    background: var(--surface);
    border-radius: 8px;
  }

  .test-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 16px;
  }

  h1,
  p {
    margin: 0;
  }

  h1 {
    font-size: 28px;
    line-height: 1.1;
  }

  .eyebrow,
  label span,
  dt,
  small,
  .limit-note,
  .message {
    color: var(--text-muted);
    font-size: 12px;
  }

  .eyebrow {
    text-transform: uppercase;
    font-weight: 800;
    letter-spacing: 0;
    margin-bottom: 4px;
  }

  .header-actions,
  .button-stack,
  .capture-row,
  .manual-row,
  .review-row,
  .quick-annotation {
    display: flex;
    gap: 10px;
  }

  .network-pill {
    border: 1px solid rgba(45, 122, 45, 0.55);
    border-radius: 999px;
    background: rgba(45, 122, 45, 0.14);
    color: var(--text);
    display: inline-flex;
    align-items: center;
    min-height: 40px;
    padding: 8px 12px;
    font-size: 12px;
    font-weight: 900;
  }

  .network-pill.offline {
    border-color: rgba(183, 121, 31, 0.8);
    background: rgba(183, 121, 31, 0.18);
  }

  .summary-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }

  .summary-grid div {
    border: 1px solid var(--border);
    background: var(--surface-2);
    border-radius: 8px;
    padding: 12px;
  }

  .summary-grid span {
    display: block;
    color: var(--text-muted);
    font-size: 12px;
    margin-bottom: 6px;
  }

  .summary-grid strong {
    font-size: 24px;
  }

  .capture-panel {
    padding: 14px;
  }

  .capture-row {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .live-panel {
    display: grid;
    grid-template-columns: minmax(0, 1.5fr) minmax(120px, 0.7fr) minmax(0, 1fr) minmax(0, 1fr);
    gap: 10px;
    margin-top: 12px;
  }

  .live-panel div {
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface-2);
    min-height: 70px;
    padding: 10px;
  }

  .live-panel span {
    color: var(--text-muted);
    display: block;
    font-size: 12px;
    margin-bottom: 6px;
  }

  .live-panel strong {
    display: block;
    font-size: 14px;
    line-height: 1.35;
    overflow-wrap: anywhere;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }

  input,
  select,
  textarea {
    width: 100%;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface-2);
    color: var(--text);
    font: inherit;
    min-height: 40px;
    padding: 9px 10px;
  }

  textarea {
    resize: vertical;
    min-height: 88px;
  }

  .manual-row {
    align-items: stretch;
    margin-top: 12px;
  }

  .manual-row textarea {
    flex: 1;
  }

  .button-stack {
    flex-direction: column;
    min-width: 132px;
  }

  button {
    border: 1px solid transparent;
    border-radius: 8px;
    color: var(--text);
    font: inherit;
    font-size: 13px;
    font-weight: 800;
    min-height: 40px;
    padding: 9px 12px;
    cursor: pointer;
  }

  button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .primary {
    background: var(--primary);
    color: var(--primary-text);
  }

  .secondary {
    background: var(--surface-2);
    border-color: var(--border);
  }

  .danger {
    background: #7c1f1f;
    color: #fff;
  }

  .ghost {
    background: transparent;
    border-color: var(--border);
  }

  .quick-annotation {
    margin-top: 12px;
  }

  .quick-annotation.inline {
    margin-top: 0;
  }

  .quick-annotation button {
    flex: 1;
    min-height: 48px;
  }

  .correct {
    background: rgba(45, 122, 45, 0.18);
    border-color: rgba(45, 122, 45, 0.55);
  }

  .fixable {
    background: rgba(183, 121, 31, 0.18);
    border-color: rgba(183, 121, 31, 0.65);
  }

  .incorrect {
    background: rgba(197, 48, 48, 0.18);
    border-color: rgba(197, 48, 48, 0.65);
  }

  .message,
  .limit-note {
    margin-top: 10px;
  }

  .sample-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .sample-list article {
    padding: 12px;
  }

  .sample-list article.low {
    border-color: #b7791f;
  }

  .sample-list article.error {
    border-color: #c53030;
  }

  .sample-top {
    display: flex;
    justify-content: space-between;
    gap: 12px;
  }

  .sample-top strong,
  .sample-top small {
    display: block;
    margin-top: 4px;
  }

  .status {
    display: inline-flex;
    align-items: center;
    min-height: 24px;
    border-radius: 999px;
    background: var(--surface-2);
    color: var(--text);
    font-size: 12px;
    font-weight: 800;
    padding: 3px 8px;
  }

  dl {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
    margin: 12px 0;
  }

  dt,
  dd {
    margin: 0;
  }

  dd {
    margin-top: 4px;
    overflow-wrap: anywhere;
  }

  .review-row {
    display: grid;
    grid-template-columns: minmax(240px, 1fr) 180px minmax(0, 1fr);
    align-items: end;
  }

  .empty {
    border: 1px dashed var(--border);
    border-radius: 8px;
    padding: 22px;
    color: var(--text-muted);
    text-align: center;
  }

  @media (max-width: 760px) {
    .voice-test {
      padding: 12px;
    }

    .test-header,
    .manual-row,
    .header-actions {
      flex-direction: column;
      align-items: stretch;
    }

    .summary-grid,
    .capture-row,
    .live-panel,
    dl,
    .review-row {
      grid-template-columns: 1fr;
    }

    .button-stack {
      min-width: 0;
    }
  }
</style>
