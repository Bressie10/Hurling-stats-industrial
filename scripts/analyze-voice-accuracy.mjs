#!/usr/bin/env node

import { readFileSync } from 'node:fs'

const file = process.argv[2]
const minSamples = Number(process.env.VOICE_MIN_SAMPLES || 50)
const minCorrectPct = Number(process.env.VOICE_MIN_CORRECT_PCT || 85)
const maxReattemptPct = Number(process.env.VOICE_MAX_REATTEMPT_PCT || 10)

if (!file) {
  console.error('Usage: npm run voice:analyze -- path/to/voice-samples.csv')
  process.exit(1)
}

function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    const next = text[i + 1]
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"'
        i += 1
      } else if (char === '"') {
        quoted = false
      } else {
        cell += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === ',') {
      row.push(cell)
      cell = ''
    } else if (char === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else if (char !== '\r') {
      cell += char
    }
  }

  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

function pct(value, total) {
  return total ? Math.round((value / total) * 1000) / 10 : 0
}

function groupCount(rows, key) {
  const counts = new Map()
  for (const row of rows) {
    const value = row[key] || '(blank)'
    counts.set(value, (counts.get(value) || 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])
}

const [headers, ...records] = parseCsv(readFileSync(file, 'utf8'))
if (!headers?.length) throw new Error('CSV has no header row')

const rows = records
  .filter((row) => row.some(Boolean))
  .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || ''])))

const reviewed = rows.filter((row) =>
  ['correct_first_try', 'correctable', 'reattempt'].includes(row.annotation),
)
const correct = reviewed.filter((row) => row.annotation === 'correct_first_try')
const correctable = reviewed.filter((row) => row.annotation === 'correctable')
const reattempt = reviewed.filter((row) => row.annotation === 'reattempt')
const sttErrors = rows.filter((row) => row.parsed_status === 'stt_error' || row.stt_error)

const correctPct = pct(correct.length, reviewed.length)
const correctablePct = pct(correctable.length, reviewed.length)
const reattemptPct = pct(reattempt.length, reviewed.length)
const failures = []

console.log(`rows: ${rows.length}`)
console.log(`reviewed: ${reviewed.length}`)
console.log(`correct_first_try: ${correct.length} (${correctPct}%)`)
console.log(`correctable: ${correctable.length} (${correctablePct}%)`)
console.log(`reattempt: ${reattempt.length} (${reattemptPct}%)`)
console.log(`stt_errors: ${sttErrors.length}`)

console.log('')
console.log('Failures by expected action:')
for (const [action, count] of groupCount(reattempt, 'expected_action').slice(0, 12)) {
  console.log(`- ${action}: ${count}`)
}

console.log('')
console.log('Failures by match source:')
for (const [source, count] of groupCount(reattempt, 'match_source').slice(0, 12)) {
  console.log(`- ${source}: ${count}`)
}

if (reviewed.length < minSamples) {
  failures.push(`reviewed sample count ${reviewed.length} is below ${minSamples}`)
}
if (correctPct < minCorrectPct) {
  failures.push(`correct-first-try ${correctPct}% is below ${minCorrectPct}%`)
}
if (reattemptPct > maxReattemptPct) {
  failures.push(`reattempt ${reattemptPct}% is above ${maxReattemptPct}%`)
}

if (failures.length) {
  console.error('')
  for (const failure of failures) console.error(`fail - ${failure}`)
  process.exitCode = 1
} else {
  console.log('')
  console.log('Voice accuracy analysis passed')
}
