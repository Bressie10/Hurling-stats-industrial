import {
  ACTION_THRESHOLD,
  LOW_CONFIDENCE_THRESHOLD,
  PLAYER_THRESHOLD,
  VOICE_ACTIONS,
  voiceActionVocabulary,
} from './voice-log-config.js'

function compact(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
}

export function normalizeVoiceText(value) {
  return compact(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9#\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
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

function hasCollisionDisambiguation(reference, entry) {
  const normalized = normalizeVoiceText(reference)
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
  const normalized = normalizeVoiceText(reference)
  const numbers = extractNumbers(normalized)
  const fullScore = levenshteinSimilarity(normalized, entry.normalizedName)
  const surnameScore = levenshteinSimilarity(
    normalized.replace(/\b\d{1,2}\b/g, '').trim(),
    entry.surname,
  )
  const numberScore = entry.number != null && numbers.includes(entry.number) ? 0.92 : 0

  if (!entry.hasSurnameCollision) {
    return Math.max(fullScore, surnameScore, numberScore)
  }

  if (!hasCollisionDisambiguation(normalized, entry)) {
    return Math.min(Math.max(fullScore, numberScore), PLAYER_THRESHOLD - 0.01)
  }

  return Math.max(fullScore, surnameScore, numberScore, 0.95)
}

export function matchVoicePlayer(reference, roster = [], { threshold = PLAYER_THRESHOLD } = {}) {
  const candidates = rosterEntries(roster)
    .map((entry) => ({
      player: entry.player,
      playerId: entry.playerId,
      name: entry.name,
      number: entry.number,
      score: scorePlayer(reference, entry),
    }))
    .sort((a, b) => b.score - a.score)

  const topCandidates = candidates.slice(0, 3)
  const best = topCandidates[0] || null
  if (!best || best.score < threshold) {
    return { ok: false, candidates: topCandidates }
  }
  return { ok: true, match: best, candidates: topCandidates }
}

export function buildVoiceVocabulary(roster = [], availableStats = []) {
  const playerPhrases = rosterEntries(roster).flatMap((entry) => {
    const phrases = [entry.name]
    if (entry.surname && !entry.hasSurnameCollision) phrases.push(entry.surname)
    if (entry.number != null) phrases.push(String(entry.number), `${entry.name} ${entry.number}`)
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

export function parseVoiceLog(
  transcript,
  {
    roster = [],
    availableStats = [],
    currentHalf = '',
    now = () => Date.now(),
    actionThreshold = ACTION_THRESHOLD,
    playerThreshold = PLAYER_THRESHOLD,
    lowConfidenceThreshold = LOW_CONFIDENCE_THRESHOLD,
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
  return {
    status: 'ok',
    transcript: text,
    player: playerResult.match.player,
    playerId: playerResult.match.playerId,
    playerName: playerResult.match.name,
    action: matchedAction.canonical,
    stat: matchedAction.stat,
    timestamp: now(),
    half: currentHalf,
    confidence,
    lowConfidence: confidence < lowConfidenceThreshold,
    candidates: playerResult.candidates,
  }
}
