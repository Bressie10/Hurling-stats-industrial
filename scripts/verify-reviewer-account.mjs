#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const DEFAULT_EMAIL = 'reviewer@gaastat.com'

function loadDotEnv(file) {
  if (!existsSync(file)) return
  const text = readFileSync(file, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
    const index = trimmed.indexOf('=')
    const key = trimmed.slice(0, index).trim()
    let value = trimmed.slice(index + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (key && process.env[key] == null) process.env[key] = value
  }
}

function parseArgs(argv) {
  const options = {
    email: process.env.REVIEWER_EMAIL || DEFAULT_EMAIL,
    password: process.env.REVIEWER_PASSWORD || '',
    minSquadRows: 25,
    minMatchRows: 3
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--email') options.email = argv[++i]
    else if (arg.startsWith('--email=')) options.email = arg.slice('--email='.length)
    else if (arg === '--password') options.password = argv[++i]
    else if (arg.startsWith('--password=')) options.password = arg.slice('--password='.length)
    else if (arg === '--min-squad-rows') options.minSquadRows = Number(argv[++i])
    else if (arg.startsWith('--min-squad-rows=')) options.minSquadRows = Number(arg.slice('--min-squad-rows='.length))
    else if (arg === '--min-match-rows') options.minMatchRows = Number(argv[++i])
    else if (arg.startsWith('--min-match-rows=')) options.minMatchRows = Number(arg.slice('--min-match-rows='.length))
    else throw new Error(`Unknown option: ${arg}`)
  }

  return options
}

async function countRows(supabase, table, userId) {
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  if (error) throw error
  return count ?? 0
}

loadDotEnv('.env.local')
loadDotEnv('.env')

const options = parseArgs(process.argv.slice(2))
const supabaseUrl = process.env.PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const anonKey = process.env.PUBLIC_SUPABASE_ANON_KEY
const email = options.email.trim()

if (!supabaseUrl) throw new Error('Missing PUBLIC_SUPABASE_URL or SUPABASE_URL')
if (!anonKey) throw new Error('Missing PUBLIC_SUPABASE_ANON_KEY')
if (!email) throw new Error('Missing reviewer email')
if (!options.password) throw new Error('Missing REVIEWER_PASSWORD')
if (!Number.isFinite(options.minSquadRows) || options.minSquadRows < 0) throw new Error('Invalid --min-squad-rows value')
if (!Number.isFinite(options.minMatchRows) || options.minMatchRows < 0) throw new Error('Invalid --min-match-rows value')

const supabase = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password: options.password
})
if (error) throw new Error(`Reviewer sign-in failed: ${error.message}`)

const userId = data.user?.id
if (!userId) throw new Error('Reviewer sign-in did not return a user id')

const [{ data: subscription, error: subError }, squadRows, matchRows] = await Promise.all([
  supabase
    .from('subscriptions')
    .select('plan, status, custom_features')
    .eq('user_id', userId)
    .maybeSingle(),
  countRows(supabase, 'squad', userId),
  countRows(supabase, 'matches', userId)
])

if (subError) throw subError
if (!subscription) throw new Error('Reviewer subscription row is missing')
if (!['active', 'trialing'].includes(subscription.status)) {
  throw new Error(`Reviewer subscription is not active: ${subscription.status}`)
}
if (squadRows < options.minSquadRows) {
  throw new Error(`Reviewer squad has ${squadRows} rows; expected at least ${options.minSquadRows}`)
}
if (matchRows < options.minMatchRows) {
  throw new Error(`Reviewer matches has ${matchRows} rows; expected at least ${options.minMatchRows}`)
}

await supabase.auth.signOut()

console.log('Reviewer account verified')
console.log(`email: ${email}`)
console.log(`user id: ${userId}`)
console.log(`subscription: ${subscription.plan} / ${subscription.status}`)
console.log(`squad rows: ${squadRows}`)
console.log(`match rows: ${matchRows}`)
