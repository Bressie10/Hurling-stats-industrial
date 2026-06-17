import { describe, expect, it } from 'vitest'
import { LOW_CONFIDENCE_THRESHOLD, UNSUPPORTED_VOICE_ACTIONS } from './voice-log-config.js'
import { parseVoiceLog, buildVoiceVocabulary } from './voice-log-parser.js'

const roster = [
  { id: 1, number: 7, name: 'John Murphy' },
  { id: 2, number: 11, name: 'Sean O Brien' },
  { id: 3, number: 14, name: 'James Kelly' },
]

const collisionRoster = [
  { id: 1, number: 7, name: 'John Murphy' },
  { id: 2, number: 12, name: 'Tom Murphy' },
  { id: 3, number: 10, name: 'Sean O Brien' },
]

const availableStats = ['Point', 'Goal', 'Wide', 'Free Won', 'Turnover Lost', 'Yellow Card']

describe('voice log parser', () => {
  it('parses a clean player and action match', () => {
    const result = parseVoiceLog('John Murphy point', {
      roster,
      availableStats,
      currentHalf: '1st Half',
    })

    expect(result).toMatchObject({
      status: 'ok',
      playerId: 1,
      action: 'point',
      stat: 'Point',
      half: '1st Half',
    })
  })

  it('matches a misheard player name using fuzzy similarity', () => {
    const result = parseVoiceLog('Jon Murfy goal', { roster, availableStats })

    expect(result).toMatchObject({
      status: 'ok',
      playerId: 1,
      stat: 'Goal',
    })
  })

  it('matches player jersey numbers in short sideline commands', () => {
    const point = parseVoiceLog('point 11', { roster, availableStats })
    const goal = parseVoiceLog('goal number fourteen', { roster, availableStats })
    const wide = parseVoiceLog('wide jersey seven', { roster, availableStats })

    expect(point).toMatchObject({
      status: 'ok',
      playerId: 2,
      stat: 'Point',
      matchSource: 'number',
    })
    expect(goal).toMatchObject({ status: 'ok', playerId: 3, stat: 'Goal' })
    expect(wide).toMatchObject({ status: 'ok', playerId: 1, stat: 'Wide' })
  })

  it('keeps noisy score phrasing loggable by jersey number', () => {
    const result = parseVoiceLog("that's a point for jersey eleven", { roster, availableStats })

    expect(result).toMatchObject({
      status: 'ok',
      playerId: 2,
      stat: 'Point',
      matchSource: 'number',
    })
  })

  it('can recover a command from native STT alternatives', () => {
    const result = parseVoiceLog('muffled speech', {
      roster,
      availableStats,
      alternatives: [{ transcript: 'goal 14', confidence: 0.73 }],
    })

    expect(result).toMatchObject({
      status: 'ok',
      transcript: 'goal 14',
      playerId: 3,
      stat: 'Goal',
    })
    expect(result.alternatives).toEqual([{ transcript: 'goal 14', confidence: 0.73 }])
  })

  it('marks voice logs that should offer optional pitch location', () => {
    const point = parseVoiceLog('point 11', {
      roster,
      availableStats,
      trackLocations: true,
      locationStats: ['Point', 'Goal', 'Wide'],
    })
    const free = parseVoiceLog('free 11', {
      roster,
      availableStats,
      trackLocations: true,
      locationStats: ['Point', 'Goal', 'Wide'],
    })

    expect(point).toMatchObject({ status: 'ok', needsLocation: true })
    expect(free).toMatchObject({ status: 'ok', needsLocation: false })
  })

  it('requires disambiguation for duplicate surnames', () => {
    const ambiguous = parseVoiceLog('Murphy point', { roster: collisionRoster, availableStats })
    const byNumber = parseVoiceLog('Murphy 7 point', { roster: collisionRoster, availableStats })
    const byInitial = parseVoiceLog('J Murphy point', { roster: collisionRoster, availableStats })

    expect(ambiguous.status).toBe('ambiguous_player')
    expect(ambiguous.candidates.map((candidate) => candidate.name)).toContain('John Murphy')
    expect(byNumber).toMatchObject({ status: 'ok', playerId: 1 })
    expect(byInitial.status).toBe('ok')
  })

  it('returns top candidates for an ambiguous player reference', () => {
    const result = parseVoiceLog('Sean wide', { roster: collisionRoster, availableStats })

    expect(result.status).toBe('ambiguous_player')
    expect(result.candidates).toHaveLength(3)
    expect(result.action).toBe('wide')
  })

  it('returns no_action_detected when the action is missing', () => {
    const result = parseVoiceLog('John Murphy', { roster, availableStats })

    expect(result).toMatchObject({ status: 'no_action_detected' })
  })

  it('marks low-confidence logs for extra scrutiny', () => {
    const result = parseVoiceLog('Sean Brien score', {
      roster,
      availableStats,
      lowConfidenceThreshold: 0.95,
    })

    expect(result.status).toBe('ok')
    expect(result.confidence).toBeLessThan(LOW_CONFIDENCE_THRESHOLD + 0.2)
    expect(result.lowConfidence).toBe(true)
  })

  it('parses a supported card stat when the stat exists', () => {
    const result = parseVoiceLog('John Murphy yellow card', { roster, availableStats })

    expect(result).toMatchObject({
      status: 'ok',
      playerId: 1,
      action: 'yellow',
      stat: 'Yellow Card',
    })
  })

  it('documents unsupported v1 stat phrases instead of parsing them', () => {
    expect(Object.keys(UNSUPPORTED_VOICE_ACTIONS).sort()).toEqual(['45', 'black', 'sideline'])

    for (const phrase of [
      'John Murphy forty five',
      'John Murphy sideline cut',
      'John Murphy black card',
    ]) {
      const result = parseVoiceLog(phrase, {
        roster,
        availableStats: [...availableStats, '45', 'Sideline', 'Black Card'],
      })

      expect(result).toMatchObject({ status: 'no_action_detected' })
    }
  })

  it('excludes unsupported v1 stat phrases from the native recognizer vocabulary', () => {
    const vocabulary = buildVoiceVocabulary(roster, [
      ...availableStats,
      '45',
      'Sideline',
      'Black Card',
    ])

    expect(vocabulary).not.toContain('forty five')
    expect(vocabulary).not.toContain('sideline cut')
    expect(vocabulary).not.toContain('black card')
  })
})
