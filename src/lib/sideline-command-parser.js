const NUMBER_WORDS = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30
}

const STAT_ALIASES = {
  point: 'Point',
  points: 'Point',
  score: 'Point',
  scores: 'Point',
  goal: 'Goal',
  goals: 'Goal',
  wide: 'Wide',
  wides: 'Wide',
  tackle: 'Tackle',
  tackles: 'Tackle',
  block: 'Block',
  blocks: 'Block',
  hook: 'Hook',
  hooks: 'Hook',
  'turnover won': 'Turnover Won',
  'turnovers won': 'Turnover Won',
  'won turnover': 'Turnover Won',
  'lost turnover': 'Turnover Lost',
  'turnover lost': 'Turnover Lost',
  'turnovers lost': 'Turnover Lost',
  'free won': 'Free Won',
  'frees won': 'Free Won',
  free: 'Free Won',
  frees: 'Free Won',
  'yellow card': 'Yellow Card',
  'yellow cards': 'Yellow Card',
  yellow: 'Yellow Card',
  'red card': 'Red Card',
  'red cards': 'Red Card',
  red: 'Red Card',
  'penalty won': 'Penalty Won',
  'penalties won': 'Penalty Won',
  'penalty scored': 'Penalty Scored',
  'penalties scored': 'Penalty Scored'
}

const PUCKOUT_SECTIONS = [
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
]

const PUCKOUT_SECTION_ALIASES = [
  ['opposition half bottom', 'opp-half-bottom'],
  ['opposition half lower', 'opp-half-bottom'],
  ['opp half bottom', 'opp-half-bottom'],
  ['opp half lower', 'opp-half-bottom'],
  ['opposition half top', 'opp-half-top'],
  ['opposition half upper', 'opp-half-top'],
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

const WRITE_STATS = new Set(['Point', 'Goal', 'Wide'])
const UNSUPPORTED_WRITE_RE = /^(?:log |add |record |make |do )?(?:sub|substitution|note|notes|sync)\b|\b(start timer|stop timer)\b/
const REMOVE_RE = /\b(remove|removed|subtract|subtracted|decrement|decremented|minus|delete|deleted|take away|took away)\b/
const OPEN_QUESTION_RE = /^(what|whats|what's|who|which|where|when|why|how|should|can|could|would|tell|give|show|recommend|analyse|analyze|advise)\b/
const RECOMMEND_RE = /\b(what should|should we|recommend|recommendation|advice|advise|next|best step|steps|go forward|work on|improve|change|adjust|tactic|plan|do now|need to do)\b/

function compact(value) {
  return String(value || '').trim().replace(/\s+/g, ' ')
}

function normalizeText(transcript) {
  let text = compact(transcript)
    .toLowerCase()
    .replace(/[.,!?;:]/g, ' ')
    .replace(/\bpuck[-\s]*(?:out|outs|put|puts|up|ups)\b/g, 'puckout')
    .replace(/\bpuck(?:out|outs|put|puts|up|ups)\b/g, 'puckout')
    .replace(/\bpoint\s+(?:out|outs|put|puts|up|ups)\b/g, 'puckout')
    .replace(/\bpoint\s+(short|long|midfield|own half|opposition half|opp half)\b/g, 'puckout $1')
    .replace(/\bpoint\s+(won|lost)\b/g, 'puckout $1')
    .replace(/\b(won|lost)\s+(?:the\s+)?point\b/g, '$1 puckout')
    .replace(/\s+/g, ' ')
    .trim()

  text = text.replace(/\b(twenty|thirty)[ -](one|two|three|four|five|six|seven|eight|nine)\b/g, (_, ten, unit) => {
    return String(NUMBER_WORDS[ten] + NUMBER_WORDS[unit])
  })

  text = text.replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty)\b/g, word => {
    return String(NUMBER_WORDS[word] || word)
  })

  return text
    .replace(/\b(?:number|num|no)\s+(?=\d{1,2}\b)/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
}

function firstPlayerNumber(context) {
  const player = (context.players || []).find(p => Number.isInteger(Number(p.number)) && p.name?.trim())
  return player ? Number(player.number) : 11
}

export function buildCommandSuggestions(context = {}) {
  const number = firstPlayerNumber(context)
  return [
    `Point ${number}`,
    `Stats for ${number}`,
    'What should we do next?',
    'Who is playing well?',
    'How are puckouts?'
  ]
}

function fail(kind, message, context) {
  return {
    kind,
    ok: false,
    message,
    suggestions: buildCommandSuggestions(context)
  }
}

function findPlayerNumber(text) {
  const explicit = text.match(/(?:#|for|from|to|by|player|jersey|jersy|shirt)\s*#?\s*(\d{1,2})\b/)
  if (explicit) return Number(explicit[1])

  const leading = text.match(/^(\d{1,2})\s+\w+/)
  if (leading) return Number(leading[1])

  const trailing = text.match(/\b(\d{1,2})$/)
  if (trailing) return Number(trailing[1])

  return null
}

function normalizeStat(rawStat, context = {}) {
  const cleaned = compact(rawStat)
    .toLowerCase()
    .replace(/\b(a|an|the|for|from|to|by|player|jersey|jersy|shirt|number|num|no|#)\b/g, ' ')
    .replace(/\d+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned) return null

  const aliased = STAT_ALIASES[cleaned] || cleaned
  const available = context.availableStats || context.allStats || []
  return available.find(stat => stat.toLowerCase() === String(aliased).toLowerCase()) || null
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function readStatFromText(text, context = {}, fallback = 'score') {
  if (/\b(top scorer|top scorers|scorer|scorers|score leader|score leaders|scoring leader|scoring leaders)\b/.test(text)) return 'score'
  if (/\bturnovers?\b/.test(text) && !/\bturnover won|turnovers won|turnover lost|turnovers lost\b/.test(text)) return 'turnovers'

  const available = context.availableStats || context.allStats || []
  const candidates = [
    ...Object.entries(STAT_ALIASES),
    ...available.map(stat => [String(stat).toLowerCase(), stat])
  ].sort((a, b) => b[0].length - a[0].length)

  for (const [phrase, stat] of candidates) {
    if (phrase === 'score' || phrase === 'scores') continue
    if (new RegExp(`\\b${escapeRegex(phrase)}\\b`).test(text)) {
      return available.find(s => s.toLowerCase() === String(stat).toLowerCase()) || stat
    }
  }

  return fallback
}

function smartAnswer(question) {
  return {
    kind: 'answer',
    toolName: 'answer_sideline_question',
    args: { question },
    question
  }
}

function statPhraseFromText(text) {
  return text
    .replace(REMOVE_RE, ' ')
    .replace(/\b(log|logged|add|added|record|recorded|mark|marked|give|gave|put down|put|down|a|an|the)\b/g, ' ')
    .replace(/(?:#|for|from|to|by|player|jersey|jersy|shirt)\s*#?\s*\d{1,2}\b.*$/, ' ')
    .replace(/^\d{1,2}\s+/, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parsePlayerWrite(text, context) {
  const countedMatch = text.match(/^(\d{1,2})\s+([a-z][a-z ]*?)\s+(?:for|from|to|by)\s*#?\s*(\d{1,2})\b/) ||
    text.match(/^(\d{1,2})\s+([a-z][a-z ]*?)\s+#\s*(\d{1,2})\b/) ||
    text.match(/^(\d{1,2})\s+(points?|scores?|goals?|wides?)\s+(\d{1,2})\b/)
  if (countedMatch && !REMOVE_RE.test(text)) {
    const count = Number(countedMatch[1])
    const stat = normalizeStat(countedMatch[2], context)
    const playerNumber = Number(countedMatch[3])
    if (stat && count > 1) {
      return fail('unsupported', 'Multiple counts not supported. Say one command at a time.', context)
    }
    if (stat && count === 1) {
      const toolName = stat === 'Goal' ? 'log_goal' : stat === 'Wide' ? 'log_wide' : stat === 'Point' ? 'log_point' : 'change_player_stat'
      return {
        kind: 'write',
        toolName,
        args: toolName === 'change_player_stat'
          ? { stat, playerNumber, operation: 'add' }
          : { playerNumber },
        summary: `${stat.toLowerCase()} #${playerNumber}`
      }
    }
  }

  const scoreMatch = text.match(/^(?:log |add |record |mark )?(?:a )?(points?|scores?|goals?|wides?)\s*(?:for )?(?:#\s*)?(\d{1,2})\b/) ||
    text.match(/^(?:#\s*)?(\d{1,2})\s+(points?|scores?|goals?|wides?)\b/)

  if (scoreMatch && !REMOVE_RE.test(text)) {
    const stat = Number(scoreMatch[1]) ? scoreMatch[2] : scoreMatch[1]
    const playerNumber = Number(Number(scoreMatch[1]) ? scoreMatch[1] : scoreMatch[2])
    const normalizedStat = STAT_ALIASES[stat]
    if (!normalizedStat) return null
    const toolName = normalizedStat === 'Goal' ? 'log_goal' : normalizedStat === 'Wide' ? 'log_wide' : 'log_point'
    return {
      kind: 'write',
      toolName,
      args: { playerNumber },
      summary: `${normalizedStat.toLowerCase()} #${playerNumber}`
    }
  }

  const playerNumber = findPlayerNumber(text)
  if (!playerNumber) {
    const possibleStat = normalizeStat(text, context)
    if (possibleStat) return fail('ambiguous', 'Need number.', context)
    return null
  }

  const stat = normalizeStat(statPhraseFromText(text), context)
  if (!stat) return null

  if (WRITE_STATS.has(stat) && !REMOVE_RE.test(text)) {
    const toolName = stat === 'Goal' ? 'log_goal' : stat === 'Wide' ? 'log_wide' : 'log_point'
    return {
      kind: 'write',
      toolName,
      args: { playerNumber },
      summary: `${stat.toLowerCase()} #${playerNumber}`
    }
  }

  const operation = REMOVE_RE.test(text) ? 'remove' : 'add'
  return {
    kind: 'write',
    toolName: 'change_player_stat',
    args: { stat, playerNumber, operation },
    summary: `${operation === 'remove' ? 'remove ' : ''}${stat.toLowerCase()} #${playerNumber}`
  }
}

function parseOppositionScore(text) {
  const type = /\b(goal|goals)\b/.test(text) ? 'goal' : /\b(point|points|score)\b/.test(text) ? 'point' : null
  if (!type) return null

  const isOpposition = /\b(their|they|them|opposition|opponent|opponents|conceded|against us)\b/.test(text)
  if (!isOpposition) return null

  const number = text.match(/(?:#|number |opposition |opponent )\s*(\d{1,2})\b/)?.[1]
  return {
    kind: 'write',
    toolName: 'log_opposition_score',
    args: {
      type,
      ...(number ? { oppPlayerNum: Number(number) } : {})
    },
    summary: `opposition ${type}${number ? ` #${number}` : ''}`
  }
}

function puckoutSectionFromText(text) {
  const exact = PUCKOUT_SECTIONS.find(section => text.includes(section) || text.includes(section.replace(/-/g, ' ')))
  if (exact) return exact
  return PUCKOUT_SECTION_ALIASES.find(([phrase]) => text.includes(phrase))?.[1] || null
}

function puckoutPlayerNumberFromText(text) {
  const explicit = text.match(/(?:#|by|for|player|jersey|jersy|shirt)\s*#?\s*(\d{1,2})\b/)
  if (explicit) return Number(explicit[1])

  const outcomeTrailing = text.match(/\bpuckout\s+(?:won|lost)\s+(\d{1,2})\b/) ||
    text.match(/\b(?:won|lost)\s+(?:the\s+)?puckout\s+(\d{1,2})\b/)
  if (outcomeTrailing) return Number(outcomeTrailing[1])

  return null
}

function puckoutOppPlayerNumberFromText(text) {
  const explicit = text.match(/\b(?:lost to|to|against|beaten by|opposition|opponent|their|them|opp)\s*(?:player|jersey|jersy|shirt|#)?\s*#?\s*(\d{1,2})\b/)
  return explicit ? Number(explicit[1]) : null
}

function puckoutOppositionPerspective(text) {
  return /\b(?:their|opposition|opponent|opp)\s+puckout\b/.test(text) ||
    /\b(?:they|them|opposition|opponent|opponents|opp)\s+(?:won|lost)\s+(?:the\s+)?puckout\b/.test(text) ||
    /\bpuckout\s+(?:won|lost)\s+by\s+(?:them|opposition|opponent|opponents|opp)\b/.test(text)
}

function parsePuckout(text, context) {
  if (!/\bpuckout\b/.test(text)) return null

  const rawOutcome = text.match(/\bpuckout\s+(won|lost)\b/)?.[1] || text.match(/\b(won|lost)\s+(?:the\s+)?puckout\b/)?.[1]
  if (!rawOutcome) return fail('ambiguous', 'Need puckout won or lost.', context)

  const oppositionPerspective = puckoutOppositionPerspective(text)
  const outcome = oppositionPerspective
    ? (rawOutcome === 'won' ? 'lost' : 'won')
    : rawOutcome

  const section = puckoutSectionFromText(text)
  let oppPlayerNum = puckoutOppPlayerNumberFromText(text)
  const rawPlayerNumber = puckoutPlayerNumberFromText(text)
  let playerNumber = oppPlayerNum && rawPlayerNumber === oppPlayerNum ? null : rawPlayerNumber
  if (oppositionPerspective && rawOutcome === 'won' && rawPlayerNumber && !oppPlayerNum) {
    oppPlayerNum = rawPlayerNumber
    playerNumber = null
  }
  return {
    kind: 'write',
    toolName: 'log_puckout',
    args: {
      outcome,
      ...(section ? { section } : {}),
      ...(playerNumber ? { playerNumber } : {}),
      ...(oppPlayerNum ? { oppPlayerNum } : {})
    },
    summary: `puckout ${outcome}${oppositionPerspective ? ` (${rawOutcome} by opposition)` : ''}${section ? `, ${section.replace(/-/g, ' ')}` : ''}${playerNumber ? ` for #${playerNumber}` : ''}${oppPlayerNum ? ` to #${oppPlayerNum}` : ''}`
  }
}

function parseRead(text, context) {
  const playerStats = text.match(/\bstats for\s*(?:#\s*)?(\d{1,2})\b/) ||
    text.match(/#\s*(\d{1,2})\b.*\b(stats|doing|done)\b/) ||
    text.match(/\b(\d{1,2})\s+(?:stats|doing|done)\b/) ||
    text.match(/\bhow is\s+(?:#\s*)?(\d{1,2})\s+doing\b/)
  if (playerStats) {
    return {
      kind: 'read',
      toolName: 'get_player_quick_stats',
      args: { playerNumber: Number(playerStats[1]) }
    }
  }

  const asksForVisualMap = /\b(heat ?map|shot map|pitch map|location map|map)\b/.test(text)
  const asksWhereOnPitch = /\bwhere (?:are|were|did|do)\b/.test(text) &&
    /\b(shots?|shooting|wides?|points?|goals?|puckout[s]?|locations?|pitch)\b/.test(text)
  const asksForPuckoutZones = /\b(show|open|display|view)\b.*\bpuckout[s]?\b.*\bzones?\b/.test(text) ||
    /\bpuckout[s]?\b.*\bzones?\b.*\b(show|open|display|view)\b/.test(text)
  if (asksForVisualMap || asksWhereOnPitch || asksForPuckoutZones) {
    if (/\bpuckout[s]?\b|\bzones?\b/.test(text)) {
      return { kind: 'read', toolName: 'show_heatmap', args: { type: 'puckouts' } }
    }
    const wantsAllLocations = /\b(pitch map|location map|all|actions?|events?|everything)\b/.test(text) &&
      !/\b(shots?|shooting|wides?|points?|goals?)\b/.test(text)
    return {
      kind: 'read',
      toolName: 'show_heatmap',
      args: { type: wantsAllLocations ? 'all' : 'shots' }
    }
  }

  if (RECOMMEND_RE.test(text)) {
    return smartAnswer(text)
  }

  if (/^(?:what'?s |whats |what is |give me |tell me )?(?:the )?score\b/.test(text) && !/(?:for|#)\s*\d{1,2}\b/.test(text)) {
    return { kind: 'read', toolName: 'get_score', args: {} }
  }

  if (/\b(clock|time|timer|period|half|minute)\b/.test(text) && /^(what|whats|what's|how|tell|give|show)\b/.test(text)) {
    return { kind: 'read', toolName: 'get_current_period_and_time', args: {} }
  }

  if (/\b(recent|latest|last)\b.*\b(events?|stats?|actions?|logs?)\b/.test(text) || /\bwhat happened last\b/.test(text)) {
    return { kind: 'read', toolName: 'get_recent_events', args: { limit: 5 } }
  }

  if (/\bpuckout[s]?\b/.test(text) && /\b(summary|stats|total|totals|how|best|worst|weak|winning|losing|going|doing)\b/.test(text)) {
    return { kind: 'read', toolName: 'get_puckout_summary', args: {} }
  }

  if (/\bpuckout[s]?\b/.test(text)) return null

  if (/\b(shooting|shot|shots|accuracy|conversion|wides?)\b/.test(text) && /^(what|whats|what's|how|tell|give|show)\b/.test(text)) {
    return { kind: 'read', toolName: 'get_shot_summary', args: {} }
  }

  if (/\b(conceded|against us|their scorer|their scorers|opposition scorer|opposition scorers|hurting us|marking)\b/.test(text)) {
    return { kind: 'read', toolName: 'get_conceded_summary', args: {} }
  }

  if (/\b(who|which|top|best|leader|leaders|leading|most)\b/.test(text) && /\b(playing well|impact|best players?|leaders?|leading|top|most|scorer|scorers|scores?|points?|goals?|wides?|tackles?|blocks?|turnovers?|frees?)\b/.test(text)) {
    if (/\b(playing well|impact|best players?)\b/.test(text)) {
      return { kind: 'read', toolName: 'get_player_impact_leaders', args: { limit: 5 } }
    }
    return {
      kind: 'read',
      toolName: 'get_player_stat_leaders',
      args: { stat: readStatFromText(text, context), limit: 5 }
    }
  }

  if (/\b(how many|how much|total|totals|count)\b/.test(text)) {
    return {
      kind: 'read',
      toolName: 'get_team_stat_total',
      args: { stat: readStatFromText(text, context, 'score') }
    }
  }

  if (/\b(summary|match summary|how are we doing|analysis|analyse|analyze|overview|full picture|big picture)\b/.test(text)) {
    return { kind: 'read', toolName: 'get_sideline_analysis', args: {} }
  }

  if (OPEN_QUESTION_RE.test(text)) {
    return smartAnswer(text)
  }

  return null
}

export function parseSidelineCommand(transcript, context = {}) {
  const raw = compact(transcript)
  const text = normalizeText(raw)
  if (!text) return fail('no_match', 'No speech heard.', context)

  if (/^(confirm|confirmed|yes|yeah|yep|go ahead|log it|do it|correct)\b/.test(text)) {
    return { kind: 'control', action: 'confirm', message: 'Confirm.' }
  }

  if (/^(cancel|cancel that|stop|never mind|nevermind|wrong)\b/.test(text)) {
    return { kind: 'control', action: 'cancel', message: 'Cancel.' }
  }

  if (UNSUPPORTED_WRITE_RE.test(text)) {
    return fail('unsupported', 'Not supported by voice yet.', context)
  }

  if (/\bundo\s+(?:the\s+)?last\s+(?:event|stat|action)?\b/.test(text) || /^undo$/.test(text)) {
    return { kind: 'write', toolName: 'undo_last_event', args: {}, summary: 'undo last event' }
  }

  const read = parseRead(text, context)
  if (read) return read

  const opposition = parseOppositionScore(text)
  if (opposition) return opposition

  const puckout = parsePuckout(text, context)
  if (puckout) return puckout

  const playerWrite = parsePlayerWrite(text, context)
  if (playerWrite) return playerWrite

  if (OPEN_QUESTION_RE.test(text) || text.split(' ').length >= 4) return smartAnswer(text)

  return fail('no_match', 'Could not match command.', context)
}

export function buildTranscriptionPrompt(context = {}) {
  const players = (context.players || [])
    .filter(player => player.name?.trim() && Number.isInteger(Number(player.number)))
    .slice(0, 30)
    .map(player => `#${player.number} ${player.name.trim()}`)
    .join(', ')
  const stats = (context.availableStats || context.allStats || [])
    .slice(0, 30)
    .join(', ')

  return [
    'Transcribe short Irish hurling sideline commands.',
    'Common words: hurling, puckout, point, goal, wide, tackle, block, turnover won, turnover lost, free won, recommendation, next step, top scorer, shot accuracy.',
    'Important distinction: point is a score and is normally followed by a jersey number, like point 11, or opposition wording, like their point.',
    'Important distinction: puckout is a restart and is normally followed by won, lost, or a zone. If the phrase has won or lost, prefer puckout over point.',
    'For puckouts, keep player phrases such as jersey 1, number 1, player 1, by 1, or for 1 as digits.',
    'For lost puckouts, keep opposition phrases such as lost to 8, against 8, or opposition jersey 8 as digits.',
    'If you hear puck put, puck up, puck-out, or puck out, transcribe it as puckout.',
    'Puckout zones: short top, short bottom, own half top, own half bottom, midfield top, midfield bottom, opposition half top, opposition half bottom, long top, long bottom.',
    stats ? `Available stats: ${stats}.` : '',
    players ? `Player numbers: ${players}.` : '',
    'Users may ask open questions about score, leaders, stats, puckouts, shooting, conceded scores, heatmaps, pitch maps, shot maps, or what to do next.',
    'Keep jersey numbers as digits. Do not add punctuation.'
  ].filter(Boolean).join(' ')
}
