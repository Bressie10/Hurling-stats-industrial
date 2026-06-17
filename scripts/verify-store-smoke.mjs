#!/usr/bin/env node

import { readFileSync } from 'node:fs'

const failures = []

function pass(message) {
  console.log(`ok - ${message}`)
}

function fail(message) {
  failures.push(message)
  console.error(`fail - ${message}`)
}

function read(file) {
  return readFileSync(file, 'utf8')
}

function includes(file, needle, message) {
  const text = read(file)
  if (text.includes(needle)) pass(message)
  else fail(`${message}: missing ${needle}`)
  return text
}

function guardedBy(file, forbidden, guard, message) {
  const text = read(file)
  if (!text.includes(forbidden)) {
    pass(`${message} is absent from ${file}`)
    return
  }
  if (!text.includes(guard)) {
    fail(`${message}: ${file} contains ${forbidden} without expected guard ${guard}`)
    return
  }
  pass(`${message} is guarded for native store mode`)
}

includes(
  'src/lib/config.js',
  'pitchnote-store-build',
  'store mode persists from runtime query/native platform',
)
includes('src/lib/config.js', 'PUBLIC_STORE_BUILD', 'store mode supports build-time env')
includes('src/lib/config.js', 'store_build', 'store mode supports launch query')

includes(
  'src/lib/PricingPage.svelte',
  'Plan purchases and plan changes are not offered inside this app.',
  'native pricing page explains why purchases are unavailable',
)
includes(
  'src/lib/Upgrade.svelte',
  'Sign in with an account that already has access',
  'native upgrade gate avoids purchase CTA',
)
includes(
  'src/lib/Settings.svelte',
  'hasWebBilling = $derived(!IS_NATIVE_STORE_BUILD',
  'settings web billing controls are hidden in native store mode',
)
includes('src/lib/History.svelte', 'FREE_MATCH_LIMIT', 'history uses central free match limit')

guardedBy(
  'src/lib/Upgrade.svelte',
  "invoke('create-checkout-session'",
  'if (IS_NATIVE_STORE_BUILD)',
  'upgrade checkout flow',
)
guardedBy(
  'src/lib/Settings.svelte',
  "invoke('create-portal-session'",
  'hasWebBilling = $derived(!IS_NATIVE_STORE_BUILD',
  'billing portal flow',
)
guardedBy(
  'src/lib/Settings.svelte',
  'cancel-subscription',
  'if (!IS_NATIVE_STORE_BUILD)',
  'subscription cancel flow',
)

if (failures.length) {
  console.error('')
  console.error(`Native store smoke failed with ${failures.length} issue(s).`)
  process.exitCode = 1
} else {
  console.log('')
  console.log('Native store smoke passed')
}
