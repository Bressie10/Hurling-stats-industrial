<script>
  import { buildVoiceVocabulary, parseVoiceLog } from './voice-log-parser.js'
  import { LOW_CONFIDENCE_THRESHOLD } from './voice-log-config.js'
  import { isOnDeviceSpeechAvailable, recognizeOnDeviceSpeech } from './on-device-speech.js'
  import { showToast } from './toast.js'

  const {
    players = [],
    availableStats = [],
    currentHalf = '',
    disabled = false,
    locationStats = [],
    trackLocations = false,
    onLog = () => null,
    onUndo = () => false,
    onFix = () => false,
    onAddLocation = () => false,
  } = $props()

  let status = $state('idle')
  let message = $state('')
  let ambiguousResult = $state(null)
  let correction = $state(null)
  let showCorrection = $state(false)

  const roster = $derived(players.filter((player) => player?.name?.trim()))
  const canListen = $derived(!disabled && status !== 'listening' && status !== 'processing')
  const statusText = $derived(
    (() => {
      if (status === 'checking') return 'Checking voice'
      if (status === 'listening') return 'Listening'
      if (status === 'processing') return 'Matching'
      if (message) return message
      return 'Offline voice log'
    })(),
  )

  async function startVoiceLog() {
    if (!canListen) return
    message = ''
    ambiguousResult = null
    correction = null
    showCorrection = false
    status = 'checking'

    const availability = await isOnDeviceSpeechAvailable({ locale: 'en-IE' })
    if (!availability?.available) {
      status = 'idle'
      message =
        availability?.reason === 'native_required'
          ? 'Voice logging is available in the native app.'
          : 'Offline speech recognition is unavailable on this device.'
      return
    }

    status = 'listening'
    try {
      const speech = await recognizeOnDeviceSpeech({
        contextualStrings: buildVoiceVocabulary(roster, availableStats),
        locale: 'en-IE',
      })
      status = 'processing'
      const parsed = parseVoiceLog(speech?.transcript || '', {
        alternatives: speech?.alternatives || [],
        roster,
        availableStats,
        currentHalf,
        locationStats,
        trackLocations,
      })
      handleParsedResult(parsed)
    } catch (e) {
      message = e?.message || String(e)
    } finally {
      status = 'idle'
    }
  }

  function handleParsedResult(parsed) {
    if (parsed.status === 'no_action_detected') {
      message = 'No stat heard. Repeat the player and action.'
      return
    }

    if (parsed.status === 'ambiguous_player') {
      ambiguousResult = parsed
      message = 'Pick the player.'
      return
    }

    if (parsed.status !== 'ok') {
      message = 'Could not log that.'
      return
    }

    const result = onLog(parsed)
    if (result?.eventSnapshot) {
      const actions = [
        {
          label: 'undo',
          onClick: () => {
            onUndo(result.eventSnapshot)
            correction = null
            showCorrection = false
          },
        },
        {
          label: 'fix',
          onClick: () => {
            showCorrection = true
          },
        },
      ]

      if (parsed.needsLocation) {
        actions.push({
          label: 'add location',
          onClick: () => {
            onAddLocation(result.eventSnapshot)
            correction = null
            showCorrection = false
          },
        })
      }

      correction = {
        eventSnapshot: result.eventSnapshot,
        stat: parsed.stat,
        action: parsed.action,
        candidates: parsed.candidates || [],
      }
      showToast(
        `Logged: ${parsed.playerName} — ${parsed.stat}`,
        parsed.lowConfidence ? 'warning' : 'success',
        {
          durationMs: parsed.needsLocation ? 5000 : 3000,
          actions,
        },
      )
    }
    message =
      parsed.lowConfidence && parsed.needsLocation
        ? 'Logged. Check it, then add location if needed.'
        : parsed.needsLocation
          ? 'Logged. Add location if needed.'
          : parsed.lowConfidence
            ? 'Logged. Check it.'
            : 'Logged.'
  }

  function resolveCandidate(candidate, source = ambiguousResult) {
    if (!source || !candidate) return
    const parsed = {
      status: 'ok',
      player: candidate.player,
      playerId: candidate.playerId,
      playerName: candidate.name,
      action: source.action,
      stat: source.stat,
      half: currentHalf,
      timestamp: Date.now(),
      confidence: Math.min(source.actionScore || 1, candidate.score || 0),
      lowConfidence:
        Math.min(source.actionScore || 1, candidate.score || 0) < LOW_CONFIDENCE_THRESHOLD,
      candidates: source.candidates || [],
    }
    ambiguousResult = null
    handleParsedResult(parsed)
  }

  function fixToCandidate(candidate) {
    if (!correction?.eventSnapshot || !candidate) return
    const ok = onFix(correction.eventSnapshot, candidate, correction.stat)
    message = ok ? 'Fixed.' : 'Could not fix after newer events.'
    correction = null
    showCorrection = false
  }
</script>

<div class="voice-logger">
  <div class="voice-main">
    <button
      type="button"
      class="voice-btn"
      class:listening={status === 'listening'}
      disabled={!canListen}
      onclick={startVoiceLog}
    >
      {status === 'listening' ? 'Listening...' : 'Voice log'}
    </button>
    <span class="voice-status">{statusText}</span>
  </div>

  <details class="voice-help">
    <summary>Voice limits</summary>
    <p>Black/red cards, 45s, and sideline balls are tap-only in this version.</p>
  </details>

  {#if ambiguousResult}
    <div class="voice-candidates">
      <span>Who was it?</span>
      {#each ambiguousResult.candidates as candidate}
        <button type="button" onclick={() => resolveCandidate(candidate)}>
          {candidate.number ? `#${candidate.number} ` : ''}{candidate.name}
        </button>
      {/each}
    </div>
  {/if}

  {#if showCorrection && correction?.candidates?.length}
    <div class="voice-candidates">
      <span>Fix to:</span>
      {#each correction.candidates as candidate}
        <button type="button" onclick={() => fixToCandidate(candidate)}>
          {candidate.number ? `#${candidate.number} ` : ''}{candidate.name}
        </button>
      {/each}
      <button
        type="button"
        onclick={() => {
          onUndo(correction.eventSnapshot)
          correction = null
          showCorrection = false
        }}
      >
        Undo
      </button>
    </div>
  {/if}
</div>

<style>
  .voice-logger {
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface);
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 14px;
  }
  .voice-main {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .voice-btn {
    border: none;
    border-radius: 8px;
    background: var(--primary);
    color: var(--primary-text);
    min-height: 40px;
    padding: 9px 14px;
    font: inherit;
    font-size: 14px;
    font-weight: 800;
    cursor: pointer;
  }
  .voice-btn.listening {
    background: #e0a020;
    color: #1a1a1a;
  }
  .voice-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  .voice-status {
    font-size: 12px;
    color: var(--text-muted);
    line-height: 1.4;
  }
  .voice-help {
    margin: 0;
    color: var(--text-muted);
    font-size: 12px;
    line-height: 1.4;
  }
  .voice-help summary {
    cursor: pointer;
    font-weight: 700;
  }
  .voice-help p {
    margin: 6px 0 0;
  }
  .voice-candidates {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    font-size: 12px;
    color: var(--text-muted);
  }
  .voice-candidates button {
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface-2);
    color: var(--text);
    padding: 7px 10px;
    font: inherit;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
  }
</style>
