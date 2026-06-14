import { describe, expect, it } from 'vitest'
import { LOW_CONFIDENCE_THRESHOLD } from './voice-log-config.js'
import { parseVoiceLog } from './voice-log-parser.js'

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
})
