#!/usr/bin/env node

import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const live = process.argv.includes('--live')
const failures = []
const warnings = []

function rel(...parts) {
  return path.join(root, ...parts)
}

function pass(message) {
  console.log(`ok - ${message}`)
}

function fail(message) {
  failures.push(message)
  console.error(`fail - ${message}`)
}

function warn(message) {
  warnings.push(message)
  console.warn(`warn - ${message}`)
}

function check(condition, message) {
  if (condition) pass(message)
  else fail(message)
}

async function readJson(file) {
  try {
    return JSON.parse(await readFile(rel(file), 'utf8'))
  } catch (error) {
    fail(`${file} is valid JSON: ${error.message}`)
    return null
  }
}

async function readText(file) {
  try {
    return await readFile(rel(file), 'utf8')
  } catch (error) {
    fail(`${file} can be read: ${error.message}`)
    return ''
  }
}

async function isPng(file) {
  try {
    const bytes = await readFile(rel(file))
    return bytes.length > 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
  } catch (_) {
    return false
  }
}

function localStaticPath(src) {
  const clean = String(src || '').replace(/^\.\//, '').replace(/^\//, '')
  return `static/${clean}`
}

async function checkManifest() {
  const manifest = await readJson('static/manifest.json')
  if (!manifest) return

  check(manifest.name === 'GAAstat', 'manifest name is GAAstat')
  check(manifest.short_name === 'GAAstat', 'manifest short_name is GAAstat')
  check(Array.isArray(manifest.icons) && manifest.icons.length > 0, 'manifest has icons')
  check(manifest.display === 'standalone', 'manifest display is standalone')

  for (const icon of manifest.icons || []) {
    const src = icon.src || ''
    const file = localStaticPath(src)
    check(!src.endsWith('.svg'), `manifest icon is not SVG: ${src}`)
    check(icon.type === 'image/png', `manifest icon declares image/png: ${src}`)
    check(existsSync(rel(file)), `manifest icon file exists: ${file}`)
    if (existsSync(rel(file))) {
      check(await isPng(file), `manifest icon has PNG signature: ${file}`)
    }
  }

  for (const shot of manifest.screenshots || []) {
    const src = shot.src || ''
    const file = localStaticPath(src)
    check(shot.type === 'image/png', `screenshot declares image/png: ${src}`)
    check(existsSync(rel(file)), `screenshot file exists: ${file}`)
    if (existsSync(rel(file))) {
      check(await isPng(file), `screenshot has PNG signature: ${file}`)
    }
  }
}

async function checkNativeConfig() {
  const release = await readJson('native/shared/release.json')
  const twa = await readJson('native/android/twa-manifest.template.json')
  const capacitor = await readJson('native/ios/capacitor.config.template.json')
  if (!release || !twa || !capacitor) return

  check(release.appId === 'com.gaastat.app', 'shared release appId is com.gaastat.app')
  check(release.productionUrl === 'https://www.gaastat.com/', 'shared release production URL is gaastat.com')
  check(release.ios?.launchUrl === 'https://www.gaastat.com/?store_build=ios', 'iOS launch URL uses store_build=ios')
  check(release.android?.launchUrl === 'https://www.gaastat.com/?store_build=android', 'Android launch URL uses store_build=android')
  check(twa.packageId === release.android?.packageName, 'Android TWA package matches shared release config')
  check(twa.startUrl === '/?store_build=android', 'Android TWA startUrl uses store mode')
  check(capacitor.appId === release.ios?.bundleId, 'iOS Capacitor bundle matches shared release config')
  check(capacitor.server?.url === release.ios?.launchUrl, 'iOS Capacitor server URL uses store mode')
  check(capacitor.webDir === '.svelte-kit/output/client', 'iOS Capacitor webDir points at SvelteKit client output')

  const publicUrls = release.publicUrls || {}
  for (const [name, url] of Object.entries(publicUrls)) {
    check(String(url).startsWith('https://www.gaastat.com/'), `public ${name} URL uses production domain`)
  }
}

async function checkStoreModeCode() {
  const config = await readText('src/lib/config.js')
  check(config.includes('store_build'), 'config reads store_build query param')
  check(config.includes('gaastat-store-build'), 'config persists store build mode')
  check(config.includes('PUBLIC_STORE_BUILD'), 'config supports PUBLIC_STORE_BUILD')

  const appHtml = await readText('src/app.html')
  check(!appHtml.includes("register('./pwabuilder-sw.js'"), 'service worker registration is not relative to the current route')
  check(appHtml.includes("new URL('pwabuilder-sw.js'"), 'service worker registration derives the root/base worker URL')
  check(appHtml.includes('.catch((err) =>'), 'service worker registration errors are handled')

  for (const file of [
    'src/lib/Upgrade.svelte',
    'src/lib/PricingPage.svelte',
    'src/lib/History.svelte',
    'src/lib/Landing.svelte',
    'src/lib/InstallPage.svelte',
    'src/lib/Settings.svelte'
  ]) {
    const text = await readText(file)
    check(text.includes('IS_NATIVE_STORE_BUILD'), `${file} has native store-mode guard`)
  }

  const settings = await readText('src/lib/Settings.svelte')
  check(settings.includes('if (!IS_NATIVE_STORE_BUILD)') && settings.includes("invoke('cancel-subscription')"), 'Settings keeps Stripe cancellation behind the web-only guard')

  const sideline = await readText('src/lib/SidelineAI.svelte')
  check(sideline.includes("apiUrl('/api/voice/transcribe')"), 'Sideline transcription endpoint uses apiUrl')
  check(sideline.includes("apiUrl('/api/voice/answer')"), 'Sideline answer endpoint uses apiUrl')
}

function checkRoutes() {
  for (const route of [
    'src/routes/privacy/+page.svelte',
    'src/routes/privacy/+page.server.js',
    'src/routes/terms/+page.svelte',
    'src/routes/terms/+page.server.js',
    'src/routes/support/+page.svelte',
    'src/routes/support/+page.server.js',
    'src/routes/account/delete/+page.svelte',
    'src/routes/account/delete/+page.server.js'
  ]) {
    check(existsSync(rel(route)), `required review route exists: ${route}`)
  }
}

async function checkAssetLinksState() {
  const assetLinks = 'static/.well-known/assetlinks.json'
  if (!existsSync(rel(assetLinks))) {
    warn('assetlinks.json is not present yet, which is expected until the final Play signing SHA-256 fingerprint is known')
    return
  }

  const text = await readText(assetLinks)
  const hasPlaceholder = /TODO|PLACEHOLDER|SHA256_FINGERPRINT|REPLACE_ME/i.test(text)
  check(!hasPlaceholder, 'assetlinks.json does not contain placeholder values')
  check(text.includes('com.gaastat.app'), 'assetlinks.json includes package com.gaastat.app')
}

async function checkLiveUrl(url, expectedTypes) {
  try {
    let response = await fetch(url, { method: 'HEAD', redirect: 'follow' })
    if (response.status === 405 || response.status === 403) {
      response = await fetch(url, { method: 'GET', redirect: 'follow' })
    }
    check(response.ok, `live URL returns success: ${url}`)
    const type = response.headers.get('content-type') || ''
    const accepted = Array.isArray(expectedTypes) ? expectedTypes : [expectedTypes]
    check(
      accepted.some(expectedType => type.includes(expectedType)),
      `live URL has ${accepted.join(' or ')} content-type: ${url} (${type || 'missing'})`
    )
  } catch (error) {
    fail(`live URL check failed for ${url}: ${error.message}`)
  }
}

async function checkLiveProduction() {
  const release = await readJson('native/shared/release.json')
  if (!release) return

  await checkLiveUrl(release.productionUrl, 'text/html')
  for (const url of Object.values(release.publicUrls || {})) {
    await checkLiveUrl(url, 'text/html')
  }
  await checkLiveUrl('https://www.gaastat.com/manifest.json', ['application/manifest+json', 'application/json'])
  await checkLiveUrl('https://www.gaastat.com/icons/icon-192.png', 'image/png')
  await checkLiveUrl('https://www.gaastat.com/icons/icon-512.png', 'image/png')
}

await checkManifest()
await checkNativeConfig()
await checkStoreModeCode()
checkRoutes()
await checkAssetLinksState()
if (live) await checkLiveProduction()

if (warnings.length) {
  console.warn(`\n${warnings.length} warning${warnings.length === 1 ? '' : 's'}`)
}

if (failures.length) {
  console.error(`\nStore release check failed: ${failures.length} issue${failures.length === 1 ? '' : 's'}`)
  process.exit(1)
}

console.log('\nStore release check passed')
