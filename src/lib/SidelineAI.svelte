<script>
  import { onDestroy, onMount } from 'svelte'
  import { startAssistant } from './realtime-assistant.js'

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
  let transcriptLines = $state([])
  let partialTranscript = $state({ user: '', assistant: '' })
  let talkState = $state('idle')
  let assistant = null

  const supported = $derived(
    typeof window !== 'undefined' &&
    !!window.RTCPeerConnection &&
    !!navigator.mediaDevices?.getUserMedia
  )

  const statusLabel = $derived((() => {
    if (!supported) return 'Unavailable'
    if (state === 'connecting') return 'Connecting'
    if (state === 'listening') return 'Ready'
    if (state === 'speaking') return 'Speaking'
    if (state === 'error') return 'Error'
    return 'Idle'
  })())

  const startDisabled = $derived(!supported || state === 'connecting' || state === 'listening' || state === 'speaking')
  const sessionActive = $derived(state === 'listening' || state === 'speaking')
  const stopDisabled = $derived(!sessionActive && state !== 'connecting')
  const talkDisabled = $derived(!sessionActive || state === 'speaking' || talkState === 'processing')
  const talkLabel = $derived((() => {
    if (talkState === 'talking') return 'Release to send'
    if (talkState === 'processing') return 'Processing...'
    if (state === 'speaking') return 'Speaking...'
    return 'Hold to talk'
  })())

  async function start() {
    if (!supported || state === 'connecting' || state === 'listening' || state === 'speaking') return
    error = ''
    lastText = ''
    pendingAction = null
    transcriptLines = []
    partialTranscript = { user: '', assistant: '' }
    talkState = 'idle'
    try {
      assistant = await startAssistant({
        getMatchContext,
        tools,
        debug,
        onStateChange: (next) => state = next,
        onText: (text) => lastText = text,
        onTranscript: updateTranscript,
        onTalkStateChange: (next) => talkState = next,
        onPendingActionChange: (action) => pendingAction = action,
        onError: (message) => {
          error = message
          state = 'error'
        }
      })
    } catch (e) {
      error = e?.message || String(e)
      state = 'error'
    }
  }

  function stop() {
    assistant?.stop()
    assistant = null
    state = 'idle'
    pendingAction = null
    partialTranscript = { user: '', assistant: '' }
    talkState = 'idle'
  }

  function cancelPending() {
    assistant?.cancelPendingAction?.()
    pendingAction = null
    lastText = 'Cancelled.'
  }

  async function confirmPending() {
    if (!pendingAction || !assistant?.confirmPendingAction) return
    error = ''
    try {
      await assistant.confirmPendingAction()
    } catch (e) {
      error = e?.message || String(e)
      state = 'error'
    }
  }

  function startTalk(event) {
    event?.preventDefault?.()
    if (talkDisabled || !assistant?.startTalking) return
    assistant.startTalking()
  }

  function stopTalk(event) {
    event?.preventDefault?.()
    if (!assistant?.stopTalking) return
    assistant.stopTalking()
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

  function updateTranscript({ role, text, final = false } = {}) {
    if (!role || !text) return
    if (!final) {
      partialTranscript = { ...partialTranscript, [role]: text }
      return
    }

    partialTranscript = { ...partialTranscript, [role]: '' }
    transcriptLines = [
      ...transcriptLines,
      {
        id: `${Date.now()}-${Math.random()}`,
        role,
        text
      }
    ].slice(-6)
  }

  onMount(() => {
    const handleVisibility = () => {
      if (document.hidden) stopTalk()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  })

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
    <div class="assistant-hint">Not listening unless you hold Talk.</div>
  {:else}
    <div class="assistant-hint">Start Sideline AI, then hold Talk.</div>
  {/if}

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

  {#if transcriptLines.length || partialTranscript.user || partialTranscript.assistant}
    <div class="transcript-box">
      {#each transcriptLines as line (line.id)}
        <div class="transcript-line">
          <span>{line.role === 'user' ? 'You' : 'Sideline AI'}:</span>
          <p>{line.text}</p>
        </div>
      {/each}
      {#if partialTranscript.user}
        <div class="transcript-line partial">
          <span>You:</span>
          <p>{partialTranscript.user}</p>
        </div>
      {/if}
      {#if partialTranscript.assistant}
        <div class="transcript-line partial">
          <span>Sideline AI:</span>
          <p>{partialTranscript.assistant}</p>
        </div>
      {/if}
    </div>
  {/if}

  {#if lastText}
    <div class="assistant-text">{lastText}</div>
  {/if}

  {#if error}
    <div class="assistant-error">{error}</div>
  {:else if !supported}
    <div class="assistant-error">Microphone or WebRTC is not available in this browser.</div>
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

  .assistant-hint {
    font-size: 12px;
    color: var(--text-faint);
    line-height: 1.3;
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

  .transcript-box {
    display: flex;
    flex-direction: column;
    gap: 5px;
    max-height: 132px;
    overflow: auto;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 7px;
    padding: 8px 9px;
  }

  .transcript-line {
    display: grid;
    grid-template-columns: 74px 1fr;
    gap: 6px;
    align-items: start;
    font-size: 12px;
    line-height: 1.35;
  }

  .transcript-line span {
    color: var(--text-faint);
    font-weight: 700;
    white-space: nowrap;
  }

  .transcript-line p {
    margin: 0;
    color: var(--text);
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .transcript-line.partial p {
    color: var(--text-muted);
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
