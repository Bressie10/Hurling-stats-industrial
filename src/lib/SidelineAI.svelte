<script>
  import { onDestroy } from 'svelte'
  import { buildCommandSuggestions, buildTranscriptionPrompt, parseSidelineCommand } from './sideline-command-parser.js'
  import { buildSidelineAnswerSnapshot } from './match-tools.js'
  import { supabase } from './supabase.js'

  const TRANSCRIBE_URL = '/api/voice/transcribe'
  const ANSWER_URL = '/api/voice/answer'
  const MIN_CLIP_MS = 650
  const MIN_AUDIO_BYTES = 900
  const MAX_CLIP_MS = 5500
  const PENDING_ACTION_TTL_MS = 20_000

  const {
    getMatchContext = () => ({}),
    tools = {},
    debug = false,
    pitchPrompt = ''
  } = $props()

  let state = $state('idle')
  let error = $state('')
  let lastText = $state('')
  let pendingAction = $state(null)
  let talkState = $state('idle')
  let commandCount = $state(0)
  let lastParseSuggestions = $state([])
  let typedCommand = $state('')
  let mediaStream = null
  let mediaRecorder = null
  let audioChunks = []
  let recordStartedAt = 0
  let recordStopTimer = null
  let pendingActionTimer = null
  let discardCurrentRecording = false
  let sessionGeneration = 0

  const supported = $derived(
    typeof window !== 'undefined' &&
    !!window.MediaRecorder &&
    !!navigator.mediaDevices?.getUserMedia
  )

  const statusLabel = $derived((() => {
    if (!supported) return 'Unavailable'
    if (state === 'connecting') return 'Starting'
    if (talkState === 'processing') return 'Processing'
    if (state === 'listening') return 'Ready'
    if (state === 'error') return 'Error'
    return 'Idle'
  })())

  const startDisabled = $derived(!supported || state === 'connecting' || state === 'listening')
  const sessionActive = $derived(state === 'listening')
  const stopDisabled = $derived(!sessionActive && state !== 'connecting')
  const talkDisabled = $derived(!sessionActive || talkState === 'processing')
  const talkLabel = $derived((() => {
    if (talkState === 'talking') return 'Release to send'
    if (talkState === 'processing') return 'Processing...'
    return 'Hold to talk'
  })())
  const commandSuggestions = $derived((() => {
    return lastParseSuggestions.length ? lastParseSuggestions : buildCommandSuggestions(getMatchContext?.() || {})
  })())

  function recorderOptions() {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/wav'
    ]
    const mimeType = types.find(type => window.MediaRecorder?.isTypeSupported?.(type))
    return mimeType ? { mimeType } : {}
  }

  function clearRecordStopTimer() {
    if (recordStopTimer) {
      clearTimeout(recordStopTimer)
      recordStopTimer = null
    }
  }

  function audioExtension(mimeType = '') {
    if (mimeType.includes('mp4')) return 'm4a'
    if (mimeType.includes('wav')) return 'wav'
    if (mimeType.includes('ogg')) return 'ogg'
    return 'webm'
  }

  function speakReply(message) {
    if (typeof window === 'undefined' || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return
    const text = String(message || '')
      .replace(/#/g, 'number ')
      .replace(/\b0-00\b/g, 'nil')
      .trim()
    if (!text) return

    try {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 1.05
      utterance.pitch = 1
      window.speechSynthesis.speak(utterance)
    } catch (_) {}
  }

  function setReply(message, { speak = true } = {}) {
    const text = String(message || '').trim()
    if (!text) return
    lastText = text
    if (speak) speakReply(text)
  }

  function setPending(action) {
    if (pendingActionTimer) {
      clearTimeout(pendingActionTimer)
      pendingActionTimer = null
    }

    pendingAction = action
    if (action) {
      pendingActionTimer = setTimeout(() => {
        if (pendingAction?.id === action.id) {
          pendingAction = null
          setReply('Expired.')
        }
      }, PENDING_ACTION_TTL_MS)
    }
  }

  function clearPending() {
    setPending(null)
  }

  async function start() {
    if (!supported || state === 'connecting' || state === 'listening') return
    error = ''
    lastText = ''
    clearPending()
    lastParseSuggestions = []
    talkState = 'idle'
    state = 'connecting'
    const generation = ++sessionGeneration
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })

      if (generation !== sessionGeneration) {
        stream.getTracks?.().forEach(track => track.stop())
        return
      }

      mediaStream = stream
      mediaStream.getAudioTracks().forEach(track => { track.enabled = false })
      state = 'listening'
    } catch (e) {
      if (generation !== sessionGeneration) return
      if (e?.name === 'NotAllowedError' || e?.name === 'PermissionDeniedError') {
        error = 'Microphone permission was denied. Allow microphone access to use Sideline AI.'
      } else if (e?.name === 'NotFoundError' || e?.name === 'DevicesNotFoundError') {
        error = 'No microphone was found for Sideline AI.'
      } else {
        error = e?.message || String(e)
      }
      setReply('Mic failed.')
      state = 'error'
    }
  }

  function stop() {
    sessionGeneration += 1
    if (typeof window !== 'undefined') {
      try { window.speechSynthesis?.cancel?.() } catch (_) {}
    }
    stopActiveRecording({ discard: true })
    mediaStream?.getTracks?.().forEach(track => track.stop())
    mediaStream = null
    state = 'idle'
    clearPending()
    talkState = 'idle'
    clearRecordStopTimer()
  }

  function cancelPending() {
    clearPending()
    setReply('Cancelled.')
  }

  function pendingExpired() {
    return pendingAction && Date.now() - pendingAction.createdAt > PENDING_ACTION_TTL_MS
  }

  async function runHandler(name, args = {}) {
    const handler = tools?.[name]
    if (typeof handler !== 'function') return { ok: false, error: 'Not supported.' }
    return await handler(args, getMatchContext?.())
  }

  async function currentAccessToken() {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) throw new Error(sessionError.message || 'Sign in required.')
    const token = sessionData?.session?.access_token
    if (!token) throw new Error('Sign in required.')
    return token
  }

  async function confirmPending() {
    if (!pendingAction) {
      setReply('Nothing to confirm.')
      return
    }
    if (pendingExpired()) {
      clearPending()
      setReply('Expired.')
      return
    }

    const action = pendingAction
    clearPending()
    error = ''
    try {
      const result = await runHandler(action.toolName, { ...action.args, confirm: true })
      if (result?.error) {
        setReply(result.error)
        return
      }
      if (result?.needsPitchLocation || result?.needsPuckoutZone) setReply(result.message || 'Tap location.')
      else if (result?.ok) setReply(result.message || 'Logged.')
      else setReply(result?.message || 'Done.')
    } catch (e) {
      setReply(e?.message || String(e))
    }
  }

  function startTalk(event) {
    event?.preventDefault?.()
    if (talkDisabled || !mediaStream) return
    error = ''
    lastText = ''
    lastParseSuggestions = []

    try {
      audioChunks = []
      discardCurrentRecording = false
      recordStartedAt = Date.now()
      mediaStream.getAudioTracks().forEach(track => { track.enabled = true })

      const recorder = new MediaRecorder(mediaStream, recorderOptions())
      mediaRecorder = recorder
      recorder.addEventListener('dataavailable', event => {
        if (event.data?.size) audioChunks.push(event.data)
      })
      recorder.addEventListener('stop', () => handleRecordingStop(recorder))
      recorder.start(250)
      talkState = 'talking'
      clearRecordStopTimer()
      recordStopTimer = setTimeout(() => stopTalk(), MAX_CLIP_MS)
    } catch (e) {
      mediaStream.getAudioTracks().forEach(track => { track.enabled = false })
      error = e?.message || String(e)
      talkState = 'idle'
    }
  }

  function stopTalk(event) {
    event?.preventDefault?.()
    stopActiveRecording()
  }

  function stopActiveRecording({ discard = false } = {}) {
    if (!mediaRecorder || mediaRecorder.state !== 'recording') return
    discardCurrentRecording = discard
    clearRecordStopTimer()
    talkState = discard ? 'idle' : 'processing'
    if (!discard) setReply('Processing voice...', { speak: false })
    try {
      mediaRecorder.requestData?.()
    } catch (_) {}
    mediaRecorder.stop()
  }

  async function handleRecordingStop(recorder) {
    clearRecordStopTimer()
    mediaStream?.getAudioTracks?.().forEach(track => { track.enabled = false })
    const durationMs = Date.now() - recordStartedAt
    const discard = discardCurrentRecording
    const mimeType = recorder.mimeType || 'audio/webm'
    const blob = new Blob(audioChunks, { type: mimeType })
    audioChunks = []
    mediaRecorder = null
    discardCurrentRecording = false

    if (discard) return
    if (durationMs < MIN_CLIP_MS || blob.size < MIN_AUDIO_BYTES) {
      setReply('Hold a little longer.')
      talkState = 'idle'
      return
    }

    await transcribeAndRun(blob, durationMs)
  }

  async function transcribeAndRun(blob, clipDurationMs) {
    const context = getMatchContext?.() || {}
    const form = new FormData()
    form.set('audio', blob, `sideline-command-${Date.now()}.${audioExtension(blob.type)}`)
    form.set('prompt', buildTranscriptionPrompt(context))

    try {
      const token = await currentAccessToken()
      const response = await fetch(TRANSCRIBE_URL, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(data?.hint || data?.detail || data?.error || 'Voice transcription failed.')
      }

      const transcript = String(data?.transcript || '').trim()
      if (!transcript) {
        setReply('No speech heard.')
        return
      }

      commandCount += 1
      if (debug) {
        console.info('[Sideline AI] voice command', {
          model: data?.model,
          requestMs: data?.durationMs,
          clipMs: clipDurationMs,
          transcript
        })
      }

      await handleParsedCommand(parseSidelineCommand(transcript, context), transcript)
    } catch (e) {
      const message = e?.message || String(e)
      error = message
      setReply(message || 'Voice failed.')
    } finally {
      talkState = 'idle'
      if (state !== 'idle' && state !== 'error') state = 'listening'
    }
  }

  async function handleParsedCommand(parsed, sourceText = '') {
    if (!parsed) {
      setReply('Could not match command.')
      lastParseSuggestions = buildCommandSuggestions(getMatchContext?.() || {})
      return
    }

    if (parsed.kind === 'control') {
      if (parsed.action === 'confirm') await confirmPending()
      else if (parsed.action === 'cancel') cancelPending()
      return
    }

    if (parsed.kind === 'read') {
      await runReadCommand(parsed)
      return
    }

    if (parsed.kind === 'answer') {
      await runSmartAnswer(parsed.question || parsed.args?.question || sourceText)
      return
    }

    if (parsed.kind === 'write') {
      await prepareWriteCommand(parsed)
      return
    }

    setReply(parsed.message || 'Could not match command.')
    lastParseSuggestions = parsed.suggestions || buildCommandSuggestions(getMatchContext?.() || {})
  }

  async function prepareWriteCommand(parsed) {
    try {
      const result = await runHandler(parsed.toolName, { ...parsed.args, confirm: false })
      if (result?.needsConfirmation && result.pendingAction) {
        setPending({
          ...result.pendingAction,
          id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
          toolName: parsed.toolName,
          args: { ...parsed.args, ...result.pendingAction, confirm: true },
          summary: result.pendingAction.summary || parsed.summary,
          createdAt: Date.now()
        })
        setReply(result.message || `Pending ${parsed.summary}. Confirm?`)
        return
      }

      if (result?.error) {
        setReply(result.error)
        lastParseSuggestions = buildCommandSuggestions(getMatchContext?.() || {})
        return
      }

      setReply(result?.message || 'Done.')
    } catch (e) {
      setReply(e?.message || String(e))
    }
  }

  async function runReadCommand(parsed) {
    try {
      const result = await runHandler(parsed.toolName, parsed.args)
      setReply(formatReadResult(parsed.toolName, result))
    } catch (e) {
      setReply(e?.message || String(e))
    }
  }

  async function fallbackAnalysisReply() {
    const result = await runHandler('get_sideline_analysis', {})
    return formatReadResult('get_sideline_analysis', result)
  }

  async function runSmartAnswer(question) {
    const cleanQuestion = String(question || '').trim()
    if (!cleanQuestion) {
      setReply(await fallbackAnalysisReply())
      return
    }

    const context = getMatchContext?.() || {}
    const fallback = await fallbackAnalysisReply()

    try {
      const token = await currentAccessToken()
      const response = await fetch(ANSWER_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          question: cleanQuestion,
          context: buildSidelineAnswerSnapshot(context)
        })
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(data?.hint || data?.detail || data?.error || 'Smart answer failed.')
      }
      setReply(data?.answer || fallback)
    } catch (e) {
      if (debug) console.warn('[Sideline AI] smart answer fallback', e)
      setReply(fallback || 'I can answer once more match data is logged.')
    }
  }

  function formatLeaderName(row) {
    return row?.number ? `#${row.number} ${row.player || ''}`.trim() : row?.player
  }

  function formatReadResult(toolName, result) {
    if (result?.ok === false) return result.error || 'No data.'
    if (toolName === 'show_heatmap') return result?.message || 'Opened heatmap.'
    if (toolName === 'get_player_quick_stats') return result?.summary || 'No data.'
    if (toolName === 'get_score') return `Score: ${result?.home?.formatted || '0-00'} to ${result?.away?.formatted || '0-00'}.`
    if (toolName === 'get_puckout_summary') {
      const pct = result?.winPercentage == null ? '' : `, ${result.winPercentage}%`
      const best = result?.bestZone ? ` Best zone: ${result.bestZone.label}, ${result.bestZone.won}/${result.bestZone.total}.` : ''
      return `Puckouts: ${result?.won || 0} won, ${result?.lost || 0} lost${pct}.${best}`
    }
    if (toolName === 'get_player_stat_leaders') {
      const leaders = result?.leaders || []
      if (!leaders.length) return `No ${result?.stat || 'stat'} leaders yet.`
      if (result.stat === 'score') {
        return `Top scorers: ${leaders.map(row => `${formatLeaderName(row)} ${row.formatted}`).join(', ')}.`
      }
      if (result.stat === 'turnovers') {
        return `Turnover leaders: ${leaders.map(row => `${formatLeaderName(row)} ${row.won} won, ${row.lost} lost`).join(', ')}.`
      }
      return `Top ${String(result.stat || 'stat').toLowerCase()}: ${leaders.map(row => `${formatLeaderName(row)} ${row.value}`).join(', ')}.`
    }
    if (toolName === 'get_team_stat_total') {
      if (result?.stat === 'score') return `Score total: ${result.formatted}, ${result.totalPoints} points.`
      if (result?.stat === 'turnovers') return `Turnovers: ${result.won} won, ${result.lost} lost.`
      return `${result?.stat || 'Total'}: ${result?.total || 0}.`
    }
    if (toolName === 'get_recent_events') {
      if (!result?.length) return 'No events logged yet.'
      return `Recent: ${result.map(event => `${event.time} ${event.stat} ${event.player}`).join('; ')}.`
    }
    if (toolName === 'get_current_period_and_time') {
      return `${result?.period || 'Period'} ${result?.clock || '00:00'}${result?.running ? ', clock running' : ', clock stopped'}.`
    }
    if (toolName === 'get_shot_summary') return result?.summary || 'No shots logged yet.'
    if (toolName === 'get_conceded_summary') return result?.summary || 'No conceded data.'
    if (toolName === 'get_player_impact_leaders') {
      const leaders = result?.leaders || []
      if (!leaders.length) return 'No player impact data yet.'
      return `Impact leaders: ${leaders.map(row => `${formatLeaderName(row)} impact ${row.impact}`).join(', ')}.`
    }
    if (toolName === 'get_coaching_recommendations') {
      return (result?.recommendations || []).slice(0, 3).join(' ')
    }
    if (toolName === 'get_sideline_analysis') {
      const score = result?.score
      const clock = result?.periodAndTime
      const shots = result?.shots
      const puckouts = result?.puckouts
      const recommendation = result?.recommendations?.[0] || ''
      return `Score: ${score?.home?.formatted || '0-00'} to ${score?.away?.formatted || '0-00'}. ${clock?.period || ''} ${clock?.clock || ''}. Shooting: ${shots?.summary || 'no shots yet'} Puckouts ${puckouts?.won || 0}-${puckouts?.lost || 0}. ${recommendation}`.trim()
    }
    if (toolName === 'get_match_summary') {
      const score = result?.score
      const puckouts = result?.puckouts
      const recommendation = result?.recommendations?.[0] || ''
      return `Score: ${score?.home?.formatted || '0-00'} to ${score?.away?.formatted || '0-00'}. Wides ${result?.wides || 0}. Puckouts ${puckouts?.won || 0}-${puckouts?.lost || 0}. ${recommendation}`.trim()
    }
    return result?.message || 'No data.'
  }

  async function runExample(suggestion) {
    if (talkState === 'processing') return
    error = ''
    setReply('Processing command...', { speak: false })
    try {
      await handleParsedCommand(parseSidelineCommand(suggestion, getMatchContext?.() || {}), suggestion)
    } catch (e) {
      error = e?.message || String(e)
      setReply(error || 'Command failed.')
    }
  }

  async function submitTypedCommand() {
    const command = typedCommand.trim()
    if (!command || talkState === 'processing') return
    error = ''
    typedCommand = ''
    setReply('Processing command...', { speak: false })
    try {
      await handleParsedCommand(parseSidelineCommand(command, getMatchContext?.() || {}), command)
    } catch (e) {
      error = e?.message || String(e)
      setReply(error || 'Command failed.')
    }
  }

  function handleTypedKeydown(event) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    submitTypedCommand()
  }

  function isTextEntryTarget(target) {
    const tagName = target?.tagName?.toLowerCase()
    return target?.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select'
  }

  function handleKeyDown(event) {
    if (event?.code !== 'Space' || event.repeat || isTextEntryTarget(event.target) || !sessionActive) return
    startTalk(event)
  }

  function handleKeyUp(event) {
    if (event?.code !== 'Space' || isTextEntryTarget(event.target) || !sessionActive) return
    stopTalk(event)
  }

  onDestroy(() => stop())
</script>

<svelte:window
  onpointerup={stopTalk}
  onpointercancel={stopTalk}
  onblur={stopTalk}
  onkeydown={handleKeyDown}
  onkeyup={handleKeyUp}
/>

<div class="sideline-ai">
  <div class="sideline-main">
    <div class="sideline-title">
      <span class="ai-dot" class:on={talkState === 'talking'}></span>
      <span>Sideline AI</span>
      <span class="status" class:error={state === 'error'}>{statusLabel}</span>
      {#if commandCount}
        <span class="usage-count">{commandCount} commands</span>
      {/if}
    </div>

    <div class="sideline-actions">
      <button class="mic-btn" onclick={start} disabled={startDisabled}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
          <path d="M19 10v1a7 7 0 0 1-14 0v-1"/>
          <line x1="12" y1="19" x2="12" y2="22"/>
        </svg>
        Start
      </button>
      <button class="stop-btn" onclick={stop} disabled={stopDisabled}>
        Stop
      </button>
    </div>
  </div>

  {#if sessionActive}
    <button
      class="talk-btn"
      class:talking={talkState === 'talking'}
      class:processing={talkState === 'processing'}
      disabled={talkDisabled}
      onpointerdown={startTalk}
      onpointerleave={stopTalk}
      onpointercancel={stopTalk}
    >
      <span>{talkLabel}</span>
    </button>
    <div class="assistant-hint">Records only while Talk is held. Max {Math.round(MAX_CLIP_MS / 1000)} seconds.</div>
  {:else}
    <div class="assistant-hint">Start Sideline AI, then hold Talk.</div>
  {/if}

  <div class="command-examples">
    <span>Try</span>
    {#each commandSuggestions as suggestion}
      <button onclick={() => runExample(suggestion)} disabled={talkState === 'processing'}>{suggestion}</button>
    {/each}
  </div>

  <div class="command-entry">
    <input
      bind:value={typedCommand}
      onkeydown={handleTypedKeydown}
      placeholder="Point 11 or what should we do next?"
      disabled={talkState === 'processing'}
    />
    <button onclick={submitTypedCommand} disabled={!typedCommand.trim() || talkState === 'processing'}>Run</button>
  </div>

  {#if pendingAction}
    <div class="pending-action">
      <span>Pending: {pendingAction.summary}</span>
      <div class="pending-buttons">
        <button class="confirm-pending" onclick={confirmPending}>Confirm</button>
        <button onclick={cancelPending}>Cancel</button>
      </div>
    </div>
  {/if}

  {#if pitchPrompt}
    <div class="pitch-state">
      <span>{pitchPrompt}</span>
    </div>
  {/if}

  {#if lastText}
    <div class="assistant-text" aria-live="polite">{lastText}</div>
  {/if}

  {#if error}
    <div class="assistant-error">{error}</div>
  {:else if !supported}
    <div class="assistant-error">Microphone recording is not available in this browser.</div>
  {/if}
</div>

<style>
  .sideline-ai {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    box-shadow: var(--shadow-sm);
  }

  .sideline-main {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .sideline-title {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    font-size: 13px;
    font-weight: 700;
    color: var(--text);
  }

  .ai-dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: var(--text-faint);
    flex-shrink: 0;
  }

  .ai-dot.on {
    background: var(--primary);
    box-shadow: 0 0 0 4px rgba(var(--primary-rgb), 0.12);
  }

  .status {
    font-size: 11px;
    color: var(--text-muted);
    font-weight: 600;
    padding: 2px 7px;
    border-radius: 999px;
    background: var(--surface-2);
  }

  .status.error { color: #e53935; }

  .usage-count {
    font-size: 11px;
    color: var(--text-faint);
    font-weight: 600;
    white-space: nowrap;
  }

  .assistant-hint {
    font-size: 12px;
    color: var(--text-faint);
    line-height: 1.3;
  }

  .command-examples {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .command-examples span {
    font-size: 11px;
    line-height: 1;
    color: var(--text-faint);
    font-weight: 700;
  }

  .command-examples button {
    border: 1px solid var(--border);
    border-radius: 999px;
    min-height: 28px;
    padding: 0 9px;
    font-size: 11px;
    font-weight: 700;
    font-family: inherit;
    color: var(--text);
    background: var(--surface-2);
    cursor: pointer;
  }

  .command-examples button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .command-entry {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 6px;
  }

  .command-entry input {
    min-width: 0;
    height: 34px;
    border: 1px solid var(--border);
    border-radius: 7px;
    padding: 0 10px;
    font-size: 13px;
    font-family: inherit;
    color: var(--text);
    background: var(--surface-2);
  }

  .command-entry input:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(var(--primary-rgb), 0.1);
  }

  .command-entry button {
    height: 34px;
    border: 1px solid var(--primary);
    border-radius: 7px;
    padding: 0 12px;
    font-size: 12px;
    font-weight: 800;
    font-family: inherit;
    color: var(--primary);
    background: rgba(var(--primary-rgb), 0.08);
    cursor: pointer;
  }

  .command-entry input:disabled,
  .command-entry button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .pending-action {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 12px;
    line-height: 1.3;
    color: var(--text);
    background: rgba(var(--primary-rgb), 0.08);
    border: 1px solid rgba(var(--primary-rgb), 0.18);
    border-radius: 7px;
    padding: 8px 9px;
  }

  .pending-buttons {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .pending-action button {
    border: 1px solid var(--border);
    border-radius: 6px;
    height: 26px;
    padding: 0 9px;
    font-size: 11px;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    color: var(--text);
    background: var(--surface);
    flex-shrink: 0;
  }

  .pending-action .confirm-pending {
    border-color: var(--primary);
    color: var(--primary);
    background: rgba(var(--primary-rgb), 0.1);
  }

  .pitch-state {
    font-size: 12px;
    font-weight: 700;
    line-height: 1.3;
    color: var(--primary);
    background: rgba(var(--primary-rgb), 0.08);
    border: 1px solid rgba(var(--primary-rgb), 0.18);
    border-radius: 7px;
    padding: 8px 9px;
  }

  .talk-btn {
    width: 100%;
    min-height: 58px;
    border: 1px solid var(--primary);
    border-radius: 8px;
    background: rgba(var(--primary-rgb), 0.1);
    color: var(--primary);
    font-size: 17px;
    font-weight: 800;
    font-family: inherit;
    cursor: pointer;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }

  .talk-btn.talking {
    background: var(--primary);
    color: var(--primary-text);
  }

  .talk-btn.processing {
    border-color: var(--border);
    background: var(--surface-2);
    color: var(--text-muted);
  }

  .talk-btn:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }

  .sideline-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .mic-btn,
  .stop-btn {
    border: 1px solid var(--border);
    border-radius: 7px;
    height: 34px;
    padding: 0 11px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    background: var(--surface-2);
    color: var(--text);
  }

  .mic-btn {
    border-color: var(--primary);
    color: var(--primary);
    background: rgba(var(--primary-rgb), 0.08);
  }

  .mic-btn svg {
    width: 14px;
    height: 14px;
  }

  .mic-btn:disabled,
  .stop-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .assistant-text {
    font-size: 13px;
    line-height: 1.4;
    color: var(--text-2);
    background: var(--surface-2);
    border-radius: 7px;
    padding: 9px 10px;
  }

  .assistant-error {
    font-size: 12px;
    line-height: 1.35;
    color: #e53935;
  }

  @media (max-width: 640px) {
    .sideline-main {
      align-items: stretch;
      flex-direction: column;
    }

    .sideline-actions {
      width: 100%;
    }

    .mic-btn,
    .stop-btn {
      flex: 1;
      justify-content: center;
    }
  }
</style>
