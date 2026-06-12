import assert from 'node:assert/strict'
import { parseSidelineCommand } from '../src/lib/sideline-command-parser.js'

const context = {
  players: Array.from({ length: 30 }, (_, index) => ({
    number: index + 1,
    name: `Player ${index + 1}`
  })),
  availableStats: [
    'Point',
    'Goal',
    'Wide',
    'Tackle',
    'Block',
    'Turnover Won',
    'Turnover Lost',
    'Free Won'
  ]
}

function assertArgs(actualArgs = {}, expectedArgs = {}) {
  for (const [key, value] of Object.entries(expectedArgs)) {
    assert.deepEqual(actualArgs[key], value, `Expected args.${key} to be ${JSON.stringify(value)}, got ${JSON.stringify(actualArgs[key])}`)
  }
}

function assertCommand(command, expected) {
  const parsed = parseSidelineCommand(command, context)
  assert.equal(parsed.kind, expected.kind, `${command}: wrong kind`)
  if (expected.toolName) assert.equal(parsed.toolName, expected.toolName, `${command}: wrong tool`)
  if (expected.action) assert.equal(parsed.action, expected.action, `${command}: wrong action`)
  assertArgs(parsed.args, expected.args)
}

for (let number = 1; number <= 30; number += 1) {
  assertCommand(`puckout won jersey ${number}`, {
    kind: 'write',
    toolName: 'log_puckout',
    args: { outcome: 'won', playerNumber: number }
  })
}

const cases = [
  ['puck out won jersey 1', { kind: 'write', toolName: 'log_puckout', args: { outcome: 'won', playerNumber: 1 } }],
  ['puck put lost player 9', { kind: 'write', toolName: 'log_puckout', args: { outcome: 'lost', playerNumber: 9 } }],
  ['won the puckout for 6', { kind: 'write', toolName: 'log_puckout', args: { outcome: 'won', playerNumber: 6 } }],
  ['puckout won no 11', { kind: 'write', toolName: 'log_puckout', args: { outcome: 'won', playerNumber: 11 } }],
  ['puckout won number eleven', { kind: 'write', toolName: 'log_puckout', args: { outcome: 'won', playerNumber: 11 } }],
  ['puckout won jersey number 12', { kind: 'write', toolName: 'log_puckout', args: { outcome: 'won', playerNumber: 12 } }],
  ['puckout won short top jersey 3', { kind: 'write', toolName: 'log_puckout', args: { outcome: 'won', section: 'short-top', playerNumber: 3 } }],
  ['puckout lost to 8', { kind: 'write', toolName: 'log_puckout', args: { outcome: 'lost', oppPlayerNum: 8 } }],
  ['puckout lost to opposition jersey 8', { kind: 'write', toolName: 'log_puckout', args: { outcome: 'lost', oppPlayerNum: 8 } }],
  ['opposition won the puckout jersey 8', { kind: 'write', toolName: 'log_puckout', args: { outcome: 'lost', oppPlayerNum: 8 } }],
  ['their puckout lost jersey 5', { kind: 'write', toolName: 'log_puckout', args: { outcome: 'won', playerNumber: 5 } }],
  ['point jersey 11', { kind: 'write', toolName: 'log_point', args: { playerNumber: 11 } }],
  ['goal no 14', { kind: 'write', toolName: 'log_goal', args: { playerNumber: 14 } }],
  ['wide player 7', { kind: 'write', toolName: 'log_wide', args: { playerNumber: 7 } }],
  ['their point', { kind: 'write', toolName: 'log_opposition_score', args: { type: 'point' } }],
  ['show puckout zones', { kind: 'read', toolName: 'show_heatmap', args: { type: 'puckouts' } }],
  ['show shot map', { kind: 'read', toolName: 'show_heatmap', args: { type: 'shots' } }],
  ['what should we do next', { kind: 'answer', toolName: 'answer_sideline_question', args: { question: 'what should we do next' } }]
]

for (const [command, expected] of cases) {
  assertCommand(command, expected)
}

console.log(`Sideline parser smoke passed: ${cases.length + 30} checks`)
