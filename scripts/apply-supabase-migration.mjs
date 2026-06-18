#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const migrationFile = process.argv[2]
const psqlCandidates = [
  process.env.PSQL_BIN,
  'psql',
  '/opt/homebrew/opt/libpq/bin/psql',
  '/usr/local/opt/libpq/bin/psql',
  '/opt/homebrew/opt/postgresql@16/bin/psql',
  '/usr/local/opt/postgresql@16/bin/psql',
  '/opt/homebrew/bin/psql',
  '/usr/local/bin/psql',
].filter(Boolean)

function loadDotEnv(file) {
  if (!existsSync(file)) return
  const text = readFileSync(file, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
    const index = trimmed.indexOf('=')
    const key = trimmed.slice(0, index).trim()
    let value = trimmed.slice(index + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (key && process.env[key] == null) process.env[key] = value
  }
}

loadDotEnv('.env.local')
loadDotEnv('.env')

const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL

function fail(message) {
  console.error(message)
  process.exit(1)
}

if (!migrationFile) {
  fail('Usage: node scripts/apply-supabase-migration.mjs <supabase/migrations/file.sql>')
}

if (!dbUrl) {
  fail('Missing SUPABASE_DB_URL or DATABASE_URL. Use the Supabase pooled/session database URL.')
}

const root = process.cwd()
const fullPath = path.resolve(root, migrationFile)
const migrationRoot = path.resolve(root, 'supabase/migrations')

if (!fullPath.startsWith(`${migrationRoot}${path.sep}`)) {
  fail('Migration file must live under supabase/migrations.')
}

if (!existsSync(fullPath)) {
  fail(`Migration file not found: ${migrationFile}`)
}

function findPsql() {
  for (const candidate of psqlCandidates) {
    const check = spawnSync(candidate, ['--version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    if (check.status === 0) return candidate
  }
  return ''
}

const psql = findPsql()
if (!psql) fail('psql is not installed. Install PostgreSQL client tools, then retry.')

const result = spawnSync(
  psql,
  ['--no-psqlrc', '--single-transaction', '--set=ON_ERROR_STOP=1', '--file', fullPath],
  {
    env: {
      ...process.env,
      PGDATABASE: dbUrl,
    },
    stdio: 'inherit',
  },
)

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}

console.log(`Applied migration: ${migrationFile}`)
