const REALTIME_URL = '/api/realtime/call'

export const SIDELINE_AI_INSTRUCTIONS = `
You are Sideline AI. Match-day GAA hurling stats only.
Use the fewest words possible. Default to 8 words or fewer.
Only say the required result, warning, or next action.
No waffle, explanations, recap, coaching, or extra context unless asked.
No politeness filler. Do not say "Sure", "Okay", "I heard", "I can", "I'll", or "Would you like me to".
Do not repeat the user's request.
Use command-style fragments: "Pending point #11. Confirm?", "Logged.", "Tap location.", "Cancelled.", "Need number.", "No #11.", "Duplicate #11. Use manual.", "No active match."
Avoid explanations unless the user asks for analysis.
Never invent stats. Use the available tools before answering any question about scores, players, puckouts, turnovers, periods, the clock, or recent events.
If the tool data is empty or missing, say "No data."
Ask for clarification only if needed.
Use natural GAA terms: points, goals, wides, puckouts, turnovers, frees, first half, second half.
For "number X stats", "stats for number X", "how is number X doing", or "what has number X done", call get_player_quick_stats with playerNumber X.
Keep player stats responses one line: "#11 O'Brien: 0-02, 1 wide, 2 turnovers."
For score, answer one line: "Score: 1-06 to 0-09."
For match summary, use one short line. No paragraphs.
If the player has no stats, say "#X Name: no stats."
After write tools, say only the tool message or error.
You can log our goals, points, and wides by jersey number, log opposition goals and points, and undo the last stat event.
You can also log puckouts with outcome "won" or "lost" and one exact section value.
Supported puckout sections are: short-top, own-half-top, midfield-top, opp-half-top, long-top, short-bottom, own-half-bottom, midfield-bottom, opp-half-bottom, long-bottom.
For puckout phrases, use the exact top or bottom zone the user says. For example: "puckout won long top" means log_puckout with outcome "won", section "long-top", confirm false. "puckout lost midfield bottom" means outcome "lost", section "midfield-bottom", confirm false. "puckout won short bottom by number 6" means section "short-bottom" and playerNumber 6.
Do not guess left, right, middle, near side, or far side for puckout zones. If the puckout section is ambiguous, ask the user to say one of the supported sections.
You must require confirmation before every write.
Do not merely explain write commands in speech. Always call the matching tool.
If the user says "goal for number X" or "log a goal for number X", call log_goal with playerNumber X and confirm false.
If the user says "log a point for number X", call log_point with playerNumber X and confirm false.
If the user says "score for number X", treat that as a point and call log_point with playerNumber X and confirm false.
If the user says "wide for number X", call log_wide with playerNumber X and confirm false.
If the user says "undo last event", call undo_last_event with confirm false.
If the user says "puckout won/lost SECTION", call log_puckout with outcome, section, optional playerNumber, and confirm false.
If the user says "point conceded", call log_opposition_score with type "point" and confirm false.
If the user says "goal conceded", call log_opposition_score with type "goal" and confirm false.
If the user says "point for opposition number X", call log_opposition_score with type "point", oppPlayerNum X, and confirm false.
If the user says "goal for opposition number X", call log_opposition_score with type "goal", oppPlayerNum X, and confirm false.
If a tool returns needsConfirmation, say only "Pending ACTION. Confirm?"
If the user says "confirm" while a pending write exists, call the matching pending write tool with confirm true.
If the user says cancel while a write is pending, call cancel_pending_action.
Do not claim you can log substitutions, custom stats, notes, or sync changes yet.
If asked for unsupported writes, say "Not supported."
`

export const SIDELINE_AI_TOOLS = [
  {
    type: 'function',
    name: 'get_match_summary',
    description: 'Get a concise live summary of the current match, score, period, leaders, puckouts, and recent events.',
    parameters: {
      type: 'object',
      properties: {},
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'get_score',
    description: 'Get the current match score for our team and the opposition.',
    parameters: {
      type: 'object',
      properties: {},
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'get_player_stat_leaders',
    description: 'Get player leaders for a stat such as Point, Goal, Wide, Tackle, Turnover Won, Turnover Lost, or score.',
    parameters: {
      type: 'object',
      properties: {
        stat: {
          type: 'string',
          description: 'The stat to rank. Use "score" for total scoring contribution.'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of leaders to return.'
        }
      },
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'get_player_quick_stats',
    description: 'Get compact current match stats for one player by jersey number.',
    parameters: {
      type: 'object',
      properties: {
        playerNumber: {
          type: 'number',
          description: 'The player jersey number.'
        }
      },
      required: ['playerNumber'],
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'get_team_stat_total',
    description: 'Get the team total for one stat.',
    parameters: {
      type: 'object',
      properties: {
        stat: {
          type: 'string',
          description: 'The stat name, for example Wide, Tackle, Turnover Won, Point, or Goal.'
        }
      },
      required: ['stat'],
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'get_puckout_summary',
    description: 'Get puckout win/loss totals and puckout leaders for the current match.',
    parameters: {
      type: 'object',
      properties: {},
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'get_recent_events',
    description: 'Get recent stat events from the current match timeline.',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of recent events to return.'
        }
      },
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'get_current_period_and_time',
    description: 'Get the current period and clock time.',
    parameters: {
      type: 'object',
      properties: {},
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'log_goal',
    description: 'Prepare or confirm logging a goal for one of our players by jersey number. With confirm false, this only creates a pending action and must not change match state. With confirm true, it opens the pitch picker for the current matching pending action.',
    parameters: {
      type: 'object',
      properties: {
        playerNumber: {
          type: 'number',
          description: 'The player jersey number.'
        },
        confirm: {
          type: 'boolean',
          description: 'Set true only after the user explicitly confirms the pending action.'
        }
      },
      required: ['playerNumber'],
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'log_point',
    description: 'Prepare or confirm logging a point for one of our players by jersey number. With confirm false, this only creates a pending action and must not change match state. With confirm true, it opens the pitch picker for the current matching pending action.',
    parameters: {
      type: 'object',
      properties: {
        playerNumber: {
          type: 'number',
          description: 'The player jersey number.'
        },
        confirm: {
          type: 'boolean',
          description: 'Set true only after the user explicitly confirms the pending action.'
        }
      },
      required: ['playerNumber'],
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'log_wide',
    description: 'Prepare or confirm logging a wide for one of our players by jersey number. With confirm false, this only creates a pending action and must not change match state. With confirm true, it opens the pitch picker for the current matching pending action.',
    parameters: {
      type: 'object',
      properties: {
        playerNumber: {
          type: 'number',
          description: 'The player jersey number.'
        },
        confirm: {
          type: 'boolean',
          description: 'Set true only after the user explicitly confirms the pending action.'
        }
      },
      required: ['playerNumber'],
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'undo_last_event',
    description: 'Prepare or confirm undoing the last logged stat event. With confirm false, this only creates a pending action and must not change match state. With confirm true, it undoes only the current matching pending action.',
    parameters: {
      type: 'object',
      properties: {
        confirm: {
          type: 'boolean',
          description: 'Set true only after the user explicitly confirms the pending undo.'
        }
      },
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'log_puckout',
    description: 'Prepare or confirm logging a puckout outcome and pitch section. With confirm false, this only creates a pending action and must not change match state. With confirm true, it logs only the current matching pending action.',
    parameters: {
      type: 'object',
      properties: {
        outcome: {
          type: 'string',
          enum: ['won', 'lost'],
          description: 'Whether we won or lost the puckout.'
        },
        section: {
          type: 'string',
          enum: [
            'short-top',
            'own-half-top',
            'midfield-top',
            'opp-half-top',
            'long-top',
            'short-bottom',
            'own-half-bottom',
            'midfield-bottom',
            'opp-half-bottom',
            'long-bottom'
          ],
          description: 'Exact puckout section key from the match UI.'
        },
        playerNumber: {
          type: 'number',
          description: 'Optional jersey number for one of our players involved in the puckout.'
        },
        confirm: {
          type: 'boolean',
          description: 'Set true only after the user explicitly confirms the pending puckout.'
        }
      },
      required: ['outcome', 'section'],
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'log_opposition_score',
    description: 'Prepare or confirm logging an opposition score. With confirm false, this only creates a pending action and must not change match state. With confirm true, it logs only the current matching pending action.',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['point', 'goal'],
          description: 'The opposition score type.'
        },
        oppPlayerNum: {
          type: 'number',
          description: 'Optional opposition jersey number.'
        },
        marker: {
          type: 'string',
          description: 'Optional marker text if supplied by the user.'
        },
        confirm: {
          type: 'boolean',
          description: 'Set true only after the user explicitly confirms the pending opposition score.'
        }
      },
      required: ['type'],
      additionalProperties: false
    }
  },
  {
    type: 'function',
    name: 'cancel_pending_action',
    description: 'Cancel the current pending Sideline AI write action without changing match state.',
    parameters: {
      type: 'object',
      properties: {},
      additionalProperties: false
    }
  }
]

const WRITE_TOOL_NAMES = new Set(['log_goal', 'log_point', 'log_wide', 'undo_last_event', 'log_puckout', 'log_opposition_score'])
const PENDING_ACTION_TTL_MS = 20_000

export async function startAssistant({
  getMatchContext,
  tools,
  debug = false,
  onStateChange = () => {},
  onText = () => {},
  onTranscript = () => {},
  onTalkStateChange = () => {},
  onPendingActionChange = () => {},
  onError = () => {}
} = {}) {
  if (typeof window === 'undefined') throw new Error('Sideline AI can only run in the browser.')
  if (!window.RTCPeerConnection) throw new Error('WebRTC is not available in this browser.')
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone access is not available in this browser.')

  let pc
  let dc
  let stream
  let audioEl
  let stopped = false
  let talking = false
  let acceptingUserTranscript = false
  let transcriptGraceTimer = null
  let textBuffer = ''
  let userTranscriptBuffer = ''
  const pendingArgs = new Map()
  const handledCallIds = new Set()
  const allowedToolNames = new Set(SIDELINE_AI_TOOLS.map(tool => tool.name))
  const listeners = []
  let pendingAction = null
  let pendingActionTimer = null

  const debugLog = (...args) => {
    if (debug) console.log('[Sideline AI]', ...args)
  }

  const safeDebugLog = (...args) => {
    if (debug) console.log('[Sideline AI debug]', ...args)
  }

  const setState = (state) => {
    if (!stopped) onStateChange(state)
  }

  const setTalkState = (state) => {
    if (!stopped) onTalkStateChange(state)
  }

  const addListener = (target, event, handler) => {
    target?.addEventListener?.(event, handler)
    listeners.push(() => target?.removeEventListener?.(event, handler))
  }

  const emitError = (message, detail = null) => {
    debugLog('error', message, detail)
    onError(message)
    setState('error')
  }

  const emitTranscript = (role, text, final = false) => {
    const clean = String(text || '').trim()
    if (!clean) return
    onTranscript({ role, text: clean, final })
  }

  const setPendingAction = (action) => {
    if (pendingActionTimer) {
      clearTimeout(pendingActionTimer)
      pendingActionTimer = null
    }
    pendingAction = action
    onPendingActionChange(action)
    if (action) {
      pendingActionTimer = setTimeout(() => {
        debugLog('pending action expired', action)
        if (pendingAction?.id === action.id) clearPendingAction()
      }, PENDING_ACTION_TTL_MS)
    }
  }

  const clearPendingAction = () => {
    setPendingAction(null)
  }

  const setMicEnabled = (enabled) => {
    stream?.getAudioTracks?.().forEach(track => {
      track.enabled = enabled
    })
  }

  const clearTranscriptGraceTimer = () => {
    if (transcriptGraceTimer) {
      clearTimeout(transcriptGraceTimer)
      transcriptGraceTimer = null
    }
  }

  const startTalking = () => {
    if (stopped || talking || pc?.connectionState === 'closed') return false
    talking = true
    acceptingUserTranscript = true
    clearTranscriptGraceTimer()
    setMicEnabled(true)
    setTalkState('talking')
    return true
  }

  const stopTalking = () => {
    if (stopped || !talking) return false
    talking = false
    setMicEnabled(false)
    setTalkState('processing')
    clearTranscriptGraceTimer()
    transcriptGraceTimer = setTimeout(() => {
      acceptingUserTranscript = false
      userTranscriptBuffer = ''
      setTalkState('idle')
    }, 5000)
    return true
  }

  const stop = ({ silent = false } = {}) => {
    stopped = true
    listeners.splice(0).forEach(remove => {
      try { remove() } catch (_) {}
    })

    if (pc) {
      pc.ontrack = null
      pc.onconnectionstatechange = null
      pc.oniceconnectionstatechange = null
    }

    if (dc) {
      dc.onopen = null
      dc.onmessage = null
      dc.onerror = null
      dc.onclose = null
    }

    clearTranscriptGraceTimer()
    setMicEnabled(false)

    try {
      pc?.getSenders?.().forEach(sender => sender.track?.stop())
      pc?.getReceivers?.().forEach(receiver => receiver.track?.stop())
      pc?.getTransceivers?.().forEach(transceiver => transceiver.stop?.())
    } catch (_) {}
    try { dc?.close() } catch (_) {}
    try { pc?.close() } catch (_) {}
    try { stream?.getTracks().forEach(track => track.stop()) } catch (_) {}

    if (audioEl) {
      try { audioEl.pause() } catch (_) {}
      audioEl.srcObject = null
      audioEl.removeAttribute('src')
      audioEl.remove()
    }

    dc = null
    pc = null
    stream = null
    audioEl = null
    textBuffer = ''
    userTranscriptBuffer = ''
    acceptingUserTranscript = false
    talking = false
    pendingArgs.clear()
    clearPendingAction()

    setTalkState('idle')
    if (!silent) onStateChange('idle')
  }

  const send = (event) => {
    if (dc?.readyState !== 'open') {
      debugLog('skipped send, data channel not open', event.type)
      return false
    }
    debugLog('client event', event)
    dc.send(JSON.stringify(event))
    return true
  }

  const parseArgs = (raw) => {
    if (!raw) return {}
    try {
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    } catch (error) {
      throw new Error(`Invalid JSON arguments for tool call: ${error.message}`)
    }
  }

  const pendingExpired = () => {
    if (!pendingAction) return false
    return Date.now() - pendingAction.createdAt > PENDING_ACTION_TTL_MS
  }

  const writeActionMatchesPending = (name, args) => {
    if (!pendingAction || pendingAction.toolName !== name) return false
    if (pendingAction.playerNumber != null && args?.playerNumber != null && Number(args.playerNumber) !== Number(pendingAction.playerNumber)) return false
    if (pendingAction.type != null && args?.type != null && String(args.type) !== String(pendingAction.type)) return false
    if (pendingAction.oppPlayerNum != null && args?.oppPlayerNum != null && Number(args.oppPlayerNum) !== Number(pendingAction.oppPlayerNum)) return false
    if (pendingAction.outcome != null && args?.outcome != null && String(args.outcome) !== String(pendingAction.outcome)) return false
    if (pendingAction.section != null && args?.section != null && String(args.section) !== String(pendingAction.section)) return false
    return true
  }

  const runHandler = async (name, args) => {
    const handler = tools?.[name]
    if (typeof handler !== 'function') {
      return { ok: false, error: 'Not supported.' }
    }
    return await handler(args, getMatchContext?.())
  }

  const runWriteTool = async (name, args) => {
    if (!args.confirm) {
      const result = await runHandler(name, { ...args, confirm: false })
      if (result?.needsConfirmation && result.pendingAction) {
        setPendingAction({
          ...result.pendingAction,
          id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
          toolName: name,
          args: { ...args, confirm: true },
          createdAt: Date.now()
        })
      } else {
        clearPendingAction()
      }
      return result
    }

    if (!pendingAction) {
      return { ok: false, error: 'No pending action.' }
    }

    if (pendingExpired()) {
      clearPendingAction()
      return { ok: false, error: 'Expired.' }
    }

    if (!writeActionMatchesPending(name, args)) {
      return { ok: false, error: 'Wrong pending action.' }
    }

    const confirmedArgs = { ...pendingAction.args, confirm: true }
    clearPendingAction()
    return await runHandler(name, confirmedArgs)
  }

  const runTool = async ({ name, call_id, arguments: rawArgs }) => {
    if (!name || !call_id || handledCallIds.has(call_id)) return
    handledCallIds.add(call_id)

    safeDebugLog('function/tool call received:', name)
    debugLog('tool call', { name, call_id, arguments: rawArgs })

    if (!allowedToolNames.has(name)) {
      sendToolOutput(call_id, { ok: false, error: 'Not supported.' })
      return
    }

    try {
      const args = parseArgs(rawArgs)
      if (name === 'cancel_pending_action') {
        clearPendingAction()
        sendToolOutput(call_id, { ok: true, action: 'cancel_pending_action', message: 'Cancelled.' })
        return
      }

      if (WRITE_TOOL_NAMES.has(name)) {
        const result = await runWriteTool(name, args)
        sendToolOutput(call_id, result ?? null)
        return
      }

      const handler = tools?.[name]
      if (typeof handler !== 'function') {
        sendToolOutput(call_id, { ok: false, error: 'Not supported.' })
        return
      }

      const result = await handler(args, getMatchContext?.())
      sendToolOutput(call_id, { ok: true, data: result ?? null })
    } catch (error) {
      sendToolOutput(call_id, { ok: false, error: error?.message || String(error) })
    }
  }

  const sendToolOutput = (callId, result) => {
    if (!callId) return
    safeDebugLog('tool result sent:', result)
    send({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: callId,
        output: JSON.stringify(result ?? null)
      }
    })
    send({ type: 'response.create' })
  }

  const runLocalWriteFallback = async (name, args) => {
    try {
      if (!WRITE_TOOL_NAMES.has(name)) return null
      safeDebugLog('local write fallback:', name)
      const result = await runWriteTool(name, args)
      if (result?.message || result?.error) onText(result.message || result.error)
      if (result?.error) onError(result.error)
      return result
    } catch (error) {
      const message = error?.message || String(error)
      onError(message)
      return { ok: false, error: message }
    }
  }

  const confirmPendingAction = async () => {
    if (!pendingAction) {
      const result = { ok: false, error: 'No pending action.' }
      onError(result.error)
      return result
    }
    const result = await runLocalWriteFallback(pendingAction.toolName, { ...pendingAction.args, confirm: true })
    if (result?.needsPitchLocation) onText('Tap location.')
    else if (result?.ok) onText('Logged.')
    return result
  }

  const numberFromTranscript = (text, pattern) => {
    const match = text.match(pattern)
    return match ? Number(match[1]) : null
  }

  const puckoutSectionFromTranscript = (text) => {
    const sectionAliases = [
      ['opposition half bottom', 'opp-half-bottom'],
      ['opposition half lower', 'opp-half-bottom'],
      ['opposition half top', 'opp-half-top'],
      ['opposition half upper', 'opp-half-top'],
      ['opp half bottom', 'opp-half-bottom'],
      ['opp half lower', 'opp-half-bottom'],
      ['opp half top', 'opp-half-top'],
      ['opp half upper', 'opp-half-top'],
      ['own half bottom', 'own-half-bottom'],
      ['own half lower', 'own-half-bottom'],
      ['own half top', 'own-half-top'],
      ['own half upper', 'own-half-top'],
      ['midfield bottom', 'midfield-bottom'],
      ['midfield lower', 'midfield-bottom'],
      ['midfield top', 'midfield-top'],
      ['midfield upper', 'midfield-top'],
      ['short bottom', 'short-bottom'],
      ['short lower', 'short-bottom'],
      ['short top', 'short-top'],
      ['short upper', 'short-top'],
      ['long bottom', 'long-bottom'],
      ['long lower', 'long-bottom'],
      ['long top', 'long-top'],
      ['long upper', 'long-top']
    ]
    return sectionAliases.find(([phrase]) => text.includes(phrase))?.[1] || null
  }

  const handleUserTranscriptFallback = (transcript) => {
    const text = String(transcript || '').trim().toLowerCase()
    if (!text) return
    safeDebugLog('input transcript received:', text)

    if (/^(confirm|confirmed|yes|yeah|yep|go ahead|log it|do it)\b/.test(text)) {
      if (!pendingAction) return
      runLocalWriteFallback(pendingAction.toolName, { ...pendingAction.args, confirm: true })
      return
    }

    if (/^(cancel|cancel that|stop|never mind|nevermind)\b/.test(text)) {
      if (!pendingAction) return
      clearPendingAction()
      onText('Cancelled.')
      return
    }

    const goalNumber = numberFromTranscript(text, /(?:log\s+)?(?:a\s+)?goal\s+(?:for\s+)?(?:number\s+|#)?(\d+)\b/)
    if (goalNumber) {
      runLocalWriteFallback('log_goal', { playerNumber: goalNumber, confirm: false })
      return
    }

    const oppositionGoalNumber = numberFromTranscript(text, /goal\s+(?:for\s+)?opposition\s+(?:number\s+|#)?(\d+)\b/)
    if (oppositionGoalNumber) {
      runLocalWriteFallback('log_opposition_score', { type: 'goal', oppPlayerNum: oppositionGoalNumber, confirm: false })
      return
    }

    if (/\bgoal\s+conceded\b|\bconceded\s+(?:a\s+)?goal\b|\bopposition\s+goal\b/.test(text)) {
      runLocalWriteFallback('log_opposition_score', { type: 'goal', confirm: false })
      return
    }

    const pointNumber = numberFromTranscript(text, /(?:log\s+)?(?:a\s+)?(?:point|score)\s+(?:for\s+)?(?:number\s+|#)?(\d+)\b/)
    if (pointNumber) {
      runLocalWriteFallback('log_point', { playerNumber: pointNumber, confirm: false })
      return
    }

    const oppositionPointNumber = numberFromTranscript(text, /point\s+(?:for\s+)?opposition\s+(?:number\s+|#)?(\d+)\b/)
    if (oppositionPointNumber) {
      runLocalWriteFallback('log_opposition_score', { type: 'point', oppPlayerNum: oppositionPointNumber, confirm: false })
      return
    }

    if (/\bpoint\s+conceded\b|\bconceded\s+(?:a\s+)?point\b|\bopposition\s+point\b/.test(text)) {
      runLocalWriteFallback('log_opposition_score', { type: 'point', confirm: false })
      return
    }

    const wideNumber = numberFromTranscript(text, /(?:log\s+)?(?:a\s+)?wide\s+(?:for\s+)?(?:number\s+|#)?(\d+)\b/)
    if (wideNumber) {
      runLocalWriteFallback('log_wide', { playerNumber: wideNumber, confirm: false })
      return
    }

    if (/\bundo\s+(?:the\s+)?last\s+(?:event|stat|action)\b/.test(text)) {
      runLocalWriteFallback('undo_last_event', { confirm: false })
      return
    }

    const puckoutOutcome = text.match(/\bpuckout\s+(won|lost)\b/)?.[1]
    if (puckoutOutcome) {
      const section = puckoutSectionFromTranscript(text)
      if (!section) return
      const playerNumber = numberFromTranscript(text, /(?:by|for)?\s*(?:number\s+|#)?(\d+)\b/)
      runLocalWriteFallback('log_puckout', {
        outcome: puckoutOutcome,
        section,
        ...(playerNumber ? { playerNumber } : {}),
        confirm: false
      })
    }
  }

  const handleServerEvent = (event) => {
    safeDebugLog('data channel event:', event.type)
    debugLog('server event', event)

    if (event.type === 'response.created') setState('speaking')
    if (event.type === 'response.done') {
      setState('listening')
      setTalkState('idle')
      const output = event.response?.output || event.output || []
      output
        .filter(item => item?.type === 'function_call')
        .forEach(item => {
          safeDebugLog('function/tool response item:', item.name)
          runTool({
            name: item.name,
            call_id: item.call_id,
            arguments: item.arguments
          })
        })
    }

    if (event.type === 'response.audio_transcript.delta' || event.type === 'response.text.delta' || event.type === 'response.output_text.delta') {
      textBuffer += event.delta || ''
      onText(textBuffer)
      emitTranscript('assistant', textBuffer, false)
    }

    if (event.type === 'response.audio_transcript.done' || event.type === 'response.text.done' || event.type === 'response.output_text.done') {
      const finalText = event.transcript || event.text || textBuffer
      if (finalText) {
        onText(finalText)
        emitTranscript('assistant', finalText, true)
      }
      textBuffer = ''
    }

    if (event.type === 'response.function_call_arguments.delta') {
      const key = event.call_id || event.item_id
      if (key) pendingArgs.set(key, (pendingArgs.get(key) || '') + (event.delta || ''))
    }

    if (event.type === 'response.function_call_arguments.done') {
      const key = event.call_id || event.item_id
      runTool({
        name: event.name,
        call_id: event.call_id,
        arguments: event.arguments || pendingArgs.get(key) || ''
      })
      if (key) pendingArgs.delete(key)
    }

    if (event.type === 'response.output_item.done' && event.item?.type === 'function_call') {
      safeDebugLog('function/tool output item:', event.item.name)
      runTool({
        name: event.item.name,
        call_id: event.item.call_id,
        arguments: event.item.arguments
      })
    }

    if ((event.type === 'conversation.item.input_audio_transcription.delta' || event.type === 'input_audio_transcription.delta') && acceptingUserTranscript) {
      userTranscriptBuffer += event.delta || ''
      emitTranscript('user', userTranscriptBuffer, false)
    }

    if (event.type === 'conversation.item.input_audio_transcription.completed' || event.type === 'input_audio_transcription.completed') {
      if (!acceptingUserTranscript) return
      const transcript = event.transcript || userTranscriptBuffer
      emitTranscript('user', transcript, true)
      userTranscriptBuffer = ''
      acceptingUserTranscript = false
      clearTranscriptGraceTimer()
      handleUserTranscriptFallback(transcript)
    }

    if (event.type === 'error') {
      emitError(event.error?.message || 'Realtime API error.', event.error)
      stop({ silent: true })
    }
  }

  try {
    setState('connecting')

    pc = new RTCPeerConnection()
    pc.onconnectionstatechange = () => {
      debugLog('peer connection state', pc?.connectionState)
      if (['failed', 'disconnected', 'closed'].includes(pc?.connectionState) && !stopped) {
        emitError('Sideline AI WebRTC connection closed unexpectedly.')
        stop({ silent: true })
      }
    }
    pc.oniceconnectionstatechange = () => {
      debugLog('ice connection state', pc?.iceConnectionState)
    }

    audioEl = document.createElement('audio')
    audioEl.autoplay = true
    audioEl.style.display = 'none'
    document.body.appendChild(audioEl)
    pc.ontrack = (event) => {
      audioEl.srcObject = event.streams[0]
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })
    } catch (error) {
      if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
        throw new Error('Microphone permission was denied. Allow microphone access to use Sideline AI.')
      }
      if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') {
        throw new Error('No microphone was found for Sideline AI.')
      }
      throw new Error(`Could not access the microphone: ${error?.message || String(error)}`)
    }
    stream.getAudioTracks().forEach(track => {
      track.enabled = false
      pc.addTrack(track, stream)
    })

    dc = pc.createDataChannel('oai-events')
    addListener(dc, 'message', (message) => {
      try {
        handleServerEvent(JSON.parse(message.data))
      } catch (error) {
        debugLog('invalid server event', message.data, error)
      }
    })
    addListener(dc, 'open', () => {
      safeDebugLog('session.update tools:', SIDELINE_AI_TOOLS.map(tool => tool.name))
      send({
        type: 'session.update',
        session: {
          type: 'realtime',
          model: 'gpt-realtime-2',
          instructions: SIDELINE_AI_INSTRUCTIONS,
          tool_choice: 'auto',
          tools: SIDELINE_AI_TOOLS
        }
      })
      setState('listening')
    })
    addListener(dc, 'error', () => {
      emitError('Sideline AI data channel failed.')
      stop({ silent: true })
    })
    addListener(dc, 'close', () => {
      debugLog('data channel closed')
      if (!stopped) {
        emitError('Sideline AI data channel closed unexpectedly.')
        stop({ silent: true })
      }
    })

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)

    const sdpResponse = await fetch(REALTIME_URL, {
      method: 'POST',
      body: offer.sdp,
      headers: {
        'Content-Type': 'application/sdp'
      }
    })

    if (!sdpResponse.ok) {
      const errorText = await sdpResponse.text().catch(() => '')
      throw new Error(errorText ? `Sideline AI WebRTC connection failed via /api/realtime/call: ${errorText}` : 'Sideline AI WebRTC connection failed via /api/realtime/call.')
    }

    await pc.setRemoteDescription({
      type: 'answer',
      sdp: await sdpResponse.text()
    })

    return { stop, startTalking, stopTalking, cancelPendingAction: clearPendingAction, confirmPendingAction }
  } catch (error) {
    stop({ silent: true })
    onError(error?.message || String(error))
    throw error
  }
}
