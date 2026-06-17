#!/usr/bin/env node

import { resolve4, resolve6, resolveCname } from 'node:dns/promises'

const DEFAULT_ORIGIN = 'https://www.pitchnote.ie'
const originArg = process.argv.find((arg) => arg.startsWith('--origin='))
const origin = (
  originArg ? originArg.slice('--origin='.length) : process.env.APP_URL || DEFAULT_ORIGIN
).replace(/\/+$/, '')
const originUrl = new URL(origin)

const failures = []

function pass(message) {
  console.log(`ok - ${message}`)
}

function fail(message) {
  failures.push(message)
  console.error(`fail - ${message}`)
}

async function resolves(hostname) {
  const attempts = await Promise.allSettled([
    resolve4(hostname),
    resolve6(hostname),
    resolveCname(hostname),
  ])
  return attempts.some((result) => result.status === 'fulfilled' && result.value.length > 0)
}

async function checkDns(hostname) {
  if (await resolves(hostname)) pass(`${hostname} resolves`)
  else fail(`${hostname} has no A, AAAA, or CNAME records`)
}

function checkContent(url, text, expected) {
  const required = Array.isArray(expected.includes)
    ? expected.includes
    : expected.includes
      ? [expected.includes]
      : []
  for (const marker of required) {
    if (text.includes(marker)) pass(`${url} contains ${marker}`)
    else fail(`${url} does not contain ${marker}`)
  }
}

async function fetchText(path, expected = {}) {
  const url = `${origin}${path}`
  let response
  try {
    response = await fetch(url, { redirect: 'follow' })
  } catch (error) {
    fail(`${url} fetch failed: ${error.message}`)
    return ''
  }

  if (response.ok) pass(`${url} returns ${response.status}`)
  else fail(`${url} returns ${response.status}`)

  if (expected.contentType) {
    const type = response.headers.get('content-type') || ''
    if (type.includes(expected.contentType)) pass(`${url} has ${expected.contentType} content-type`)
    else fail(`${url} content-type is ${type || '(missing)'}, expected ${expected.contentType}`)
  }

  const text = await response.text()
  checkContent(url, text, expected)
  return text
}

async function checkManifest() {
  const text = await fetchText('/manifest.json')
  if (!text) return
  try {
    const manifest = JSON.parse(text)
    if (manifest.name === 'PitchNote') pass('manifest name is PitchNote')
    else fail(`manifest name is ${manifest.name || '(missing)'}`)
    if (Array.isArray(manifest.icons) && manifest.icons.length > 0) pass('manifest has icons')
    else fail('manifest has no icons')
  } catch (error) {
    fail(`manifest is valid JSON: ${error.message}`)
  }
}

const hostnames = new Set(['pitchnote.ie', 'www.pitchnote.ie', originUrl.hostname])
for (const hostname of hostnames) await checkDns(hostname)

await fetchText('/', { contentType: 'text/html', includes: 'PitchNote' })
await fetchText('/privacy', {
  contentType: 'text/html',
  includes: ['Privacy Policy', 'How PitchNote collects, uses, stores, and deletes data'],
})
await fetchText('/terms', {
  contentType: 'text/html',
  includes: ['Terms of Use', 'The rules for using PitchNote on the web, iOS, Android'],
})
await fetchText('/support', {
  contentType: 'text/html',
  includes: ['Contact Support', 'Before A Match', 'Account And Data Requests'],
})
await fetchText('/account/delete', {
  contentType: 'text/html',
  includes: ['Delete Your Account', 'Request Deletion Without The App', 'What Is Deleted'],
})
await checkManifest()

if (failures.length) {
  console.error('')
  console.error(`Live domain check failed with ${failures.length} issue(s).`)
  process.exitCode = 1
} else {
  console.log('')
  console.log('Live domain check passed')
}
