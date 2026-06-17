import {
  ACTION_THRESHOLD,
  LOW_CONFIDENCE_THRESHOLD,
  PLAYER_THRESHOLD,
  VOICE_ACTIONS,
  voiceActionVocabulary,
} from './voice-log-config.js'

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
  thirty: 30,
}

const PLAYER_REFERENCE_FILLERS =
  /\b(?:a|an|the|that|thats|it|its|for|from|to|by|with|player|jersey|jersy|shirt|number|num|no|scored|scorer|got|gets|won|lost)\b/g

function compact(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
}

function normalizeNumberWords(value) {
  let text = String(value || '')

  text = text.replace(
    /\b(twenty|thirty)\s+(one|two|three|four|five|six|seven|eight|nine)\b/g,
    (_, ten, unit) => String(NUMBER_WORDS[ten] + NUMBER_WORDS[unit]),
  )

  return text.replace(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty)\b/g,
    (word) => String(NUMBER_WORDS[word] || word),
  )
}

export function normalizeVoiceText(value) {
  const text = compact(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9#\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalizeNumberWords(text).replace(/\s+/g, ' ').trim()
}

function tokenize(value) {
  const normalized = normalizeVoiceText(value)
  return normalized ? normalized.split(' ') : []
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function tokenOverlapScore(textTokens, phraseTokens) {
  if (!textTokens.length || !phraseTokens.length) return 0
  const remaining = [...textTokens]
  let hits = 0

  for (const token of phraseTokens) {
    const index = remaining.indexOf(token)
    if (index === -1) continue
    hits += 1
    remaining.splice(index, 1)
  }

  return hits / phraseTokens.length
}

function configuredActions(availableStats = []) {
  const available = new Set(availableStats.map((stat) => normalizeVoiceText(stat)))
  return Object.entries(VOICE_ACTIONS)
    .filter(([, action]) => available.has(normalizeVoiceText(action.stat)))
    .map(([canonical, action]) => ({ canonical, ...action }))
}

export function matchVoiceAction(text, { availableStats = [], threshold = ACTION_THRESHOLD } = {}) {
  const actions = configuredActions(availableStats)
  const textTokens = tokenize(text)
  let best = null

  for (const action of actions) {
    for (const variant of action.variants) {
      const phraseTokens = tokenize(variant)
      const score = tokenOverlapScore(textTokens, phraseTokens)
      const phraseLength = phraseTokens.length
      if (
        !best ||
        score > best.score ||
        (score === best.score && phraseLength > best.phraseTokens.length)
      ) {
        best = { ...action, phrase: normalizeVoiceText(variant), phraseTokens, score }
      }
    }
  }

  if (!best || best.score < threshold) return null
  return best
}

function stripMatchedAction(text, matchedAction) {
  let remaining = normalizeVoiceText(text)
  const phrase = matchedAction?.phrase
  if (!phrase) return remaining

  const exact = new RegExp(`(^|\\s)${escapeRegex(phrase)}(?=\\s|$)`)
  if (exact.test(remaining)) {
    return remaining.replace(exact, ' ').replace(/\s+/g, ' ').trim()
  }

  const tokens = remaining.split(' ')
  for (const phraseToken of matchedAction.phraseTokens) {
    const index = tokens.indexOf(phraseToken)
    if (index !== -1) tokens.splice(index, 1)
  }
  return tokens.join(' ').replace(/\s+/g, ' ').trim()
}

function levenshtein(a, b) {
  const left = normalizeVoiceText(a)
  const right = normalizeVoiceText(b)
  if (left === right) return 0
  if (!left) return right.length
  if (!right) return left.length

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  const current = Array.from({ length: right.length + 1 }, () => 0)

  for (let i = 1; i <= left.length; i += 1) {
    current[0] = i
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost)
    }
    for (let j = 0; j <= right.length; j += 1) previous[j] = current[j]
  }

  return previous[right.length]
}

export function levenshteinSimilarity(a, b) {
  const left = normalizeVoiceText(a)
  const right = normalizeVoiceText(b)
  const maxLength = Math.max(left.length, right.length)
  if (!maxLength) return 1
  return Math.max(0, 1 - levenshtein(left, right) / maxLength)
}

function rosterEntries(roster = []) {
  const surnames = new Map()
  const entries = roster
    .map((player, index) => {
      const name = compact(typeof player === 'string' ? player : player?.name)
      const normalizedName = normalizeVoiceText(name)
      const parts = normalizedName.split(' ').filter(Boolean)
      const surname = parts.at(-1) || ''
      const first = parts[0] || ''
      const number = Number(typeof player === 'string' ? null : player?.number)
      const entry = {
        player,
        playerId: typeof player === 'string' ? index + 1 : (player?.id ?? index + 1),
        number: Number.isFinite(number) && number > 0 ? number : null,
        name,
        normalizedName,
        first,
        surname,
      }
      if (surname) surnames.set(surname, (surnames.get(surname) || 0) + 1)
      return entry
    })
    .filter((entry) => entry.name && entry.surname)

  return entries.map((entry) => ({
    ...entry,
    hasSurnameCollision: (surnames.get(entry.surname) || 0) > 1,
  }))
}

function extractNumbers(text) {
  return [...normalizeVoiceText(text).matchAll(/\b(\d{1,2})\b/g)].map((match) => Number(match[1]))
}

function cleanPlayerReference(reference) {
  return normalizeVoiceText(reference)
    .replace(/#/g, ' ')
    .replace(PLAYER_REFERENCE_FILLERS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function hasCollisionDisambiguation(reference, entry) {
  const normalized = cleanPlayerReference(reference)
  const tokens = normalized.split(' ').filter(Boolean)
  const numbers = extractNumbers(normalized)
  const hasNumber = entry.number != null && numbers.includes(entry.number)
  const hasFirstName = entry.first && tokens.includes(entry.first)
  const hasInitial =
    entry.first &&
    entry.surname &&
    new RegExp(`\\b${escapeRegex(entry.first[0])}\\b\\s+${escapeRegex(entry.surname)}\\b`).test(
      normalized,
    )

  return hasNumber || hasFirstName || hasInitial
}

function scorePlayer(reference, entry) {
  const normalized = cleanPlayerReference(reference)
  const numbers = extractNumbers(normalized)
  const withoutNumbers = normalized.replace(/\b\d{1,2}\b/g, '').trim()
  const fullScore = levenshteinSimilarity(withoutNumbers || normalized, entry.normalizedName)
  const surnameScore = levenshteinSimilarity(withoutNumbers, entry.surname)
  const numberScore = entry.number != null && numbers.includes(entry.number) ? 0.97 : 0
  const hasInitial =
    entry.first &&
    entry.surname &&
    new RegExp(`\\b${escapeRegex(entry.first[0])}\\b\\s+${escapeRegex(entry.surname)}\\b`).test(
      normalized,
    )

  const scored = [
    { score: fullScore, matchSource: fullScore >= 0.98 ? 'full_name' : 'fuzzy' },
    { score: surnameScore, matchSource: surnameScore >= 0.98 ? 'surname' : 'fuzzy' },
    { score: numberScore, matchSource: 'number' },
    { score: hasInitial ? 0.96 : 0, matchSource: 'initial' },
  ].sort((a, b) => b.score - a.score)

  let best = scored[0] || { score: 0, matchSource: 'fuzzy' }

  if (!entry.hasSurnameCollision) {
    return best
  }

  if (!hasCollisionDisambiguation(normalized, entry)) {
    return {
      score: Math.min(Math.max(fullScore, numberScore), PLAYER_THRESHOLD - 0.01),
      matchSource: best.matchSource,
    }
  }

  best = scored.find((candidate) => candidate.score > 0) || best
  return { score: Math.max(best.score, 0.95), matchSource: best.matchSource }
}

export function matchVoicePlayer(reference, roster = [], { threshold = PLAYER_THRESHOLD } = {}) {
  const candidates = rosterEntries(roster)
    .map((entry) => {
      const scored = scorePlayer(reference, entry)
      return {
        player: entry.player,
        playerId: entry.playerId,
        name: entry.name,
        number: entry.number,
        score: scored.score,
        matchSource: scored.matchSource,
      }
    })
    .sort((a, b) => b.score - a.score)

  const topCandidates = candidates.slice(0, 3)
  const best = topCandidates[0] || null
  if (!best || best.score < threshold) {
    return { ok: false, candidates: topCandidates }
  }
  const second = topCandidates[1] || null
  if (second && second.score >= threshold && best.score - second.score < 0.01) {
    return { ok: false, candidates: topCandidates }
  }
  return { ok: true, match: best, candidates: topCandidates }
}

export function buildVoiceVocabulary(roster = [], availableStats = []) {
  const playerPhrases = rosterEntries(roster).flatMap((entry) => {
    const phrases = [entry.name]
    if (entry.surname && !entry.hasSurnameCollision) phrases.push(entry.surname)
    if (entry.number != null) {
      phrases.push(
        String(entry.number),
        `${entry.name} ${entry.number}`,
        `jersey ${entry.number}`,
        `number ${entry.number}`,
        `player ${entry.number}`,
      )
    }
    if (entry.first && entry.surname) phrases.push(`${entry.first[0]} ${entry.surname}`)
    return phrases
  })

  const actionPhrases = configuredActions(availableStats).flatMap((action) => action.variants)
  return [
    ...new Set(
      [...playerPhrases, ...actionPhrases, ...voiceActionVocabulary()].map(normalizeVoiceText),
    ),
  ]
    .filter(Boolean)
    .slice(0, 200)
}

function normalizeAlternatives(alternatives = []) {
  const rows = Array.isArray(alternatives) ? alternatives : []
  return rows
    .map((alternative) => {
      if (typeof alternative === 'string') {
        return { transcript: normalizeVoiceText(alternative), confidence: null }
      }
      return {
        transcript: normalizeVoiceText(alternative?.transcript || alternative?.text || ''),
        confidence:
          typeof alternative?.confidence === 'number' && Number.isFinite(alternative.confidence)
            ? alternative.confidence
            : null,
      }
    })
    .filter((alternative) => alternative.transcript)
}

function resultRank(result) {
  if (result.status === 'ok') return 3 + (result.confidence || 0)
  if (result.status === 'ambiguous_player') {
    const candidateScore = result.candidates?.[0]?.score || 0
    return 2 + Math.min(result.actionScore || 0, candidateScore)
  }
  if (result.status === 'no_action_detected') return 1
  return 0
}

function parseSingleVoiceLog(
  transcript,
  {
    roster = [],
    availableStats = [],
    currentHalf = '',
    now = () => Date.now(),
    actionThreshold = ACTION_THRESHOLD,
    playerThreshold = PLAYER_THRESHOLD,
    lowConfidenceThreshold = LOW_CONFIDENCE_THRESHOLD,
    trackLocations = false,
    locationStats = [],
  } = {},
) {
  const text = normalizeVoiceText(transcript)
  const matchedAction = matchVoiceAction(text, { availableStats, threshold: actionThreshold })
  if (!matchedAction) {
    return { status: 'no_action_detected', transcript: text }
  }

  const playerReference = stripMatchedAction(text, matchedAction)
  const playerResult = matchVoicePlayer(playerReference, roster, { threshold: playerThreshold })
  if (!playerResult.ok) {
    return {
      status: 'ambiguous_player',
      transcript: text,
      playerReference,
      action: matchedAction.canonical,
      stat: matchedAction.stat,
      actionScore: matchedAction.score,
      candidates: playerResult.candidates,
    }
  }

  const confidence = Math.min(matchedAction.score, playerResult.match.score)
  const locatedStats = new Set(locationStats.map((stat) => normalizeVoiceText(stat)))
  return {
    status: 'ok',
    transcript: text,
    player: playerResult.match.player,
    playerId: playerResult.match.playerId,
    playerName: playerResult.match.name,
    matchSource: playerResult.match.matchSource,
    action: matchedAction.canonical,
    stat: matchedAction.stat,
    timestamp: now(),
    half: currentHalf,
    confidence,
    lowConfidence: confidence < lowConfidenceThreshold,
    needsLocation: Boolean(
      trackLocations && locatedStats.has(normalizeVoiceText(matchedAction.stat)),
    ),
    candidates: playerResult.candidates,
  }
}

export function parseVoiceLog(transcript, options = {}) {
  const alternatives = normalizeAlternatives(options.alternatives)
  const seen = new Set()
  const transcripts = [
    normalizeVoiceText(transcript),
    ...alternatives.map((alternative) => alternative.transcript),
  ].filter((text) => {
    if (!text || seen.has(text)) return false
    seen.add(text)
    return true
  })

  const results = transcripts.map((text) => parseSingleVoiceLog(text, options))
  const best =
    results.sort((a, b) => resultRank(b) - resultRank(a))[0] || parseSingleVoiceLog('', options)

  return {
    ...best,
    alternatives,
  }
}
