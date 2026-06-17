#!/usr/bin/env node

import { existsSync } from 'node:fs'
import { readFile, readdir } from 'node:fs/promises'
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
    return (
      bytes.length > 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    )
  } catch {
    return false
  }
}

function localStaticPath(src) {
  const clean = String(src || '')
    .replace(/^\.\//, '')
    .replace(/^\//, '')
  return `static/${clean}`
}

async function checkManifest() {
  const manifest = await readJson('static/manifest.json')
  if (!manifest) return

  check(manifest.name === 'PitchNote', 'manifest name is PitchNote')
  check(manifest.short_name === 'PitchNote', 'manifest short_name is PitchNote')
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
  const capacitor = await readJson('native/ios/capacitor.config.template.json')
  const activeCapacitor = await readJson('capacitor.config.json')
  const pkg = await readJson('package.json')
  if (!release || !capacitor) return

  check(release.appId === 'ie.pitchnote.app', 'shared release appId is ie.pitchnote.app')
  check(
    release.productionUrl === 'https://www.pitchnote.ie/',
    'shared release production URL is pitchnote.ie',
  )
  check(
    release.supportEmail === 'support@pitchnote.ie',
    'shared release support email is support@pitchnote.ie',
  )
  check(
    release.ios?.launchUrl === 'https://www.pitchnote.ie/?store_build=ios',
    'iOS launch URL uses store_build=ios',
  )
  check(
    release.android?.launchUrl === 'https://www.pitchnote.ie/?store_build=android',
    'Android launch URL uses store_build=android',
  )
  check(
    release.android?.wrapper === 'Capacitor',
    'Android wrapper is Capacitor for native speech recognition',
  )
  check(
    capacitor.appId === release.ios?.bundleId,
    'iOS Capacitor bundle matches shared release config',
  )
  check(!capacitor.server?.url, 'Capacitor template packages local web assets by default')
  check(
    capacitor.webDir === '.svelte-kit/output/client',
    'iOS Capacitor webDir points at SvelteKit client output',
  )
  check(
    activeCapacitor?.appId === release.ios?.bundleId,
    'active Capacitor config bundle matches shared release config',
  )
  check(
    !activeCapacitor?.server?.url,
    'active Capacitor config packages local web assets by default',
  )
  check(
    activeCapacitor?.webDir === '.svelte-kit/output/client',
    'active Capacitor config webDir points at SvelteKit client output',
  )
  check(
    pkg?.scripts?.['native:ios:sync']?.includes('PUBLIC_API_BASE_URL=https://www.pitchnote.ie'),
    'iOS native sync points packaged server calls at production API base URL',
  )
  check(
    pkg?.scripts?.['native:android:sync']?.includes('PUBLIC_API_BASE_URL=https://www.pitchnote.ie'),
    'Android native sync points packaged server calls at production API base URL',
  )
  check(
    pkg?.scripts?.['store:seed-reviewer'] === 'node scripts/seed-reviewer-account.mjs',
    'reviewer seed script is registered',
  )
  check(
    pkg?.scripts?.['store:verify-reviewer'] === 'node scripts/verify-reviewer-account.mjs',
    'reviewer verification script is registered',
  )
  check(pkg?.scripts?.test === 'vitest run', 'unit test script is registered')
  check(pkg?.scripts?.lint === 'eslint .', 'lint script is registered')
  check(
    pkg?.scripts?.['format:check']?.startsWith('prettier --check'),
    'format check script is registered',
  )
  check(
    pkg?.scripts?.['native:config'] === 'node scripts/sync-native-config.mjs',
    'native config script is registered',
  )
  check(
    pkg?.scripts?.['native:config:check'] === 'node scripts/sync-native-config.mjs --check',
    'native config check script is registered',
  )
  check(
    pkg?.scripts?.['native:doctor'] === 'node scripts/native-store-doctor.mjs',
    'native doctor script is registered',
  )
  check(
    pkg?.scripts?.['native:android:sync']?.includes('npx cap sync android'),
    'Android Capacitor sync script is registered',
  )
  check(
    pkg?.scripts?.['release:check']?.includes('npm run store:smoke'),
    'local release check includes native store smoke test',
  )
  check(
    pkg?.scripts?.['release:check:live']?.includes('node scripts/verify-live-domain.mjs') &&
      pkg?.scripts?.['release:check:live']?.includes('npm run billing:check') &&
      pkg?.scripts?.['release:check:live']?.includes('npm run team-scope:check:live'),
    'live release check includes domain, billing, and team-scope live gates',
  )
  check(existsSync(rel('scripts/seed-reviewer-account.mjs')), 'reviewer seed script exists')
  check(
    existsSync(rel('scripts/verify-reviewer-account.mjs')),
    'reviewer verification script exists',
  )
  check(existsSync(rel('scripts/sync-native-config.mjs')), 'native config sync script exists')
  check(existsSync(rel('scripts/native-store-doctor.mjs')), 'native doctor script exists')
  check(existsSync(rel('docs/reviewer-testing.md')), 'reviewer testing guide exists')
  check(existsSync(rel('android/app/build.gradle')), 'Android Capacitor project exists')
  check(
    existsSync(rel('android/app/src/main/java/ie/pitchnote/app/OnDeviceSpeechPlugin.java')),
    'Android on-device speech plugin exists',
  )
  check(
    existsSync(rel('ios/App/App/OnDeviceSpeechPlugin.swift')),
    'iOS on-device speech plugin exists',
  )

  const androidBuild = await readText('android/app/build.gradle')
  check(
    androidBuild.includes('applicationId "ie.pitchnote.app"'),
    'Android applicationId matches shared release config',
  )

  const androidManifest = await readText('android/app/src/main/AndroidManifest.xml')
  check(
    androidManifest.includes('android.permission.RECORD_AUDIO'),
    'Android microphone permission is present',
  )

  const publicUrls = release.publicUrls || {}
  for (const [name, url] of Object.entries(publicUrls)) {
    check(
      String(url).startsWith('https://www.pitchnote.ie/'),
      `public ${name} URL uses production domain`,
    )
  }
}

async function checkStoreModeCode() {
  const config = await readText('src/lib/config.js')
  check(config.includes('store_build'), 'config reads store_build query param')
  check(config.includes('pitchnote-store-build'), 'config persists store build mode')
  check(config.includes('PUBLIC_STORE_BUILD'), 'config supports PUBLIC_STORE_BUILD')
  check(
    config.includes('PUBLIC_ENABLE_VOICE_TEST') && config.includes('SHOW_VOICE_TEST_HARNESS'),
    'voice accuracy harness is controlled by an explicit public flag',
  )
  check(
    config.includes('window.Capacitor') && config.includes('getPlatform'),
    'config detects native Capacitor platform',
  )

  const entitlements = await readText('src/lib/entitlements.js')
  check(entitlements.includes('FREE_MATCH_LIMIT = 2'), 'free tier is capped at 2 saved matches')
  check(entitlements.includes('proAnalytics'), 'central entitlement policy defines Pro analytics')
  check(
    entitlements.includes('clubManagement'),
    'central entitlement policy defines Club management',
  )
  check(
    entitlements.includes('liveSharing'),
    'central entitlement policy defines Club Pro live sharing',
  )

  const appHtml = await readText('src/app.html')
  check(
    !appHtml.includes("register('./pwabuilder-sw.js'"),
    'service worker registration is not relative to the current route',
  )
  check(
    appHtml.includes("new URL('pwabuilder-sw.js'"),
    'service worker registration derives the root/base worker URL',
  )
  check(appHtml.includes('.catch((err) =>'), 'service worker registration errors are handled')

  for (const file of [
    'src/lib/Upgrade.svelte',
    'src/lib/PricingPage.svelte',
    'src/lib/History.svelte',
    'src/lib/Landing.svelte',
    'src/lib/InstallPage.svelte',
    'src/lib/Settings.svelte',
  ]) {
    const text = await readText(file)
    check(text.includes('IS_NATIVE_STORE_BUILD'), `${file} has native store-mode guard`)
  }

  const settings = await readText('src/lib/Settings.svelte')
  check(
    settings.includes('SHOW_VOICE_TEST_HARNESS') &&
      !/Temporary voice logging test harness|Remove this shortcut before release builds/i.test(
        settings,
      ),
    'Settings does not expose an ungated temporary voice test shortcut',
  )
  check(
    settings.includes('if (!IS_NATIVE_STORE_BUILD)') &&
      settings.includes("invoke('cancel-subscription')"),
    'Settings keeps Stripe cancellation behind the web-only guard',
  )
  check(
    settings.includes('hasWebBilling = $derived(!IS_NATIVE_STORE_BUILD') &&
      settings.includes("invoke('create-portal-session'"),
    'Settings keeps Stripe portal access behind the web-only guard',
  )

  const history = await readText('src/lib/History.svelte')
  check(
    history.includes('FREE_MATCH_LIMIT') && !history.includes('FREE_MATCH_LIMIT = 3'),
    'History uses the central free match limit',
  )

  for (const file of [
    'src/routes/app/player/+page.svelte',
    'src/routes/app/team/+page.svelte',
    'src/routes/app/timeline/+page.svelte',
    'src/routes/app/insights/+page.svelte',
    'src/routes/app/targets/+page.svelte',
    'src/routes/app/live/+page.svelte',
  ]) {
    const text = await readText(file)
    check(text.includes('EntitlementGate'), `${file} is entitlement gated`)
  }

  const sideline = await readText('src/lib/SidelineAI.svelte')
  check(
    sideline.includes("apiUrl('/api/voice/transcribe')"),
    'Sideline transcription endpoint uses apiUrl',
  )
  check(sideline.includes("apiUrl('/api/voice/answer')"), 'Sideline answer endpoint uses apiUrl')

  const match = await readText('src/lib/Match.svelte')
  check(
    match.includes('LiveVoiceLogger') && !match.includes('SidelineAI'),
    'live match screen uses on-device voice logger',
  )

  const liveVoice = await readText('src/lib/LiveVoiceLogger.svelte')
  check(
    liveVoice.includes('recognizeOnDeviceSpeech'),
    'live voice logger calls the native on-device speech module',
  )
  check(
    !liveVoice.includes('/api/voice/transcribe') && !liveVoice.includes('OpenAI'),
    'live voice logger does not call cloud transcription',
  )

  const parserConfig = await readText('src/lib/voice-log-config.js')
  check(
    parserConfig.includes('ACTION_THRESHOLD') && parserConfig.includes('PLAYER_THRESHOLD'),
    'voice log thresholds are centralized',
  )
  const voiceActionsStart = parserConfig.indexOf('export const VOICE_ACTIONS')
  const unsupportedStart = parserConfig.indexOf('export const UNSUPPORTED_VOICE_ACTIONS')
  const voiceActionsBlock = parserConfig.slice(voiceActionsStart, unsupportedStart)
  check(
    unsupportedStart > voiceActionsStart,
    'unsupported v1 voice actions are documented beside voice config',
  )
  check(
    !voiceActionsBlock.includes("stat: '45'"),
    '45 is not silently included in v1 live voice parsing',
  )
  check(
    !voiceActionsBlock.includes("stat: 'Sideline'"),
    'Sideline is not silently included in v1 live voice parsing',
  )
  check(
    !voiceActionsBlock.includes("stat: 'Black Card'"),
    'Black Card is not silently included in v1 live voice parsing',
  )
  check(
    existsSync(rel('src/routes/app/voice-test/+page.svelte')),
    'voice accuracy test harness route exists',
  )
  const voiceTestRoute = await readText('src/routes/app/voice-test/+page.js')
  check(
    voiceTestRoute.includes('SHOW_VOICE_TEST_HARNESS') && voiceTestRoute.includes('redirect(307'),
    'voice accuracy test route redirects unless the harness flag is enabled',
  )
  check(
    existsSync(rel('docs/voice-accuracy-testing.md')),
    'voice accuracy field-testing guide exists',
  )
  check(existsSync(rel('docs/store-listing-draft.md')), 'store listing draft exists')
}

async function checkTeamScopedSync() {
  const migrationDir = 'supabase/migrations'
  const schemaMigration = '20260617_team_scoped_data_and_rls.sql'
  const policyResetMigration = '20260617_team_scoped_policy_reset.sql'
  let migrations = []
  try {
    migrations = await readdir(rel(migrationDir))
  } catch (error) {
    fail(`${migrationDir} can be read: ${error.message}`)
  }

  check(
    migrations.includes(schemaMigration),
    `team-scoped data migration exists: ${schemaMigration}`,
  )
  check(
    migrations.includes(policyResetMigration),
    `team-scoped policy reset migration exists: ${policyResetMigration}`,
  )
  if (migrations.includes(schemaMigration) && migrations.includes(policyResetMigration)) {
    const ordered = migrations.slice().sort()
    check(
      ordered.indexOf(schemaMigration) < ordered.indexOf(policyResetMigration),
      'team-scoped policy reset migration runs after schema migration',
    )
  }

  const schema = await readText(`${migrationDir}/${schemaMigration}`)
  const teamIdColumns = schema.match(/add column if not exists team_id/g) || []
  check(teamIdColumns.length >= 2, 'team-scoped migration adds team_id to matches and squad')
  check(
    schema.includes('add constraint matches_pkey primary key (id, user_id)'),
    'team-scoped migration scopes match primary key by user',
  )
  check(
    schema.includes('idx_matches_user_team') && schema.includes('idx_squad_user_team'),
    'team-scoped migration adds user/team indexes',
  )
  check(
    schema.includes('can_access_team') && schema.includes('can_start_live_session'),
    'team-scoped migration defines membership-aware access helpers',
  )

  const policyReset = await readText(`${migrationDir}/${policyResetMigration}`)
  check(
    policyReset.includes('from pg_policies') && policyReset.includes('drop policy if exists %I'),
    'team-scoped policy reset removes stale policy variants',
  )
  check(
    policyReset.includes("tablename in ('teams', 'live_sessions', 'matches', 'squad')"),
    'team-scoped policy reset targets all affected tables',
  )

  const sync = await readText('src/lib/sync.js')
  const serviceWorker = await readText('src/service-worker.js')
  const seedReviewer = await readText('scripts/seed-reviewer-account.mjs')
  const liveTeamScope = await readText('scripts/verify-team-scope-live.mjs')
  const layout = await readText('src/routes/+layout.svelte')
  const teamScope = await readText('src/lib/team-scope.js')
  const teamScopeTest = await readText('src/lib/team-scope.test.js')
  const pkg = await readJson('package.json')
  const liveDomain = await readText('scripts/verify-live-domain.mjs')
  check(
    sync.includes("{ onConflict: 'id,user_id' }"),
    'foreground match sync upserts by id,user_id',
  )
  check(
    serviceWorker.includes("on_conflict: 'id,user_id'"),
    'background match sync upserts by id,user_id',
  )
  check(
    seedReviewer.includes(".upsert(matchRows, { onConflict: 'id,user_id' })") &&
      !seedReviewer.includes('deleteSeedMatch') &&
      !seedReviewer.includes('.insert(matchRows)'),
    'reviewer match seed upserts by id,user_id without broad deterministic-id deletes',
  )
  check(
    liveTeamScope.includes('.upsert(payload, { onConflict })') &&
      liveTeamScope.includes('subscriptionUserIds: []') &&
      liveTeamScope.includes("delete().in('user_id', created.subscriptionUserIds)") &&
      liveTeamScope.includes('profileIds: []') &&
      liveTeamScope.includes("delete().in('id', created.profileIds)"),
    'live team-scope RLS checker upserts trigger-created rows and cleans them up',
  )
  check(
    liveTeamScope.includes('clubMemberKeys: []') &&
      liveTeamScope.includes('teamMemberKeys: []') &&
      liveTeamScope.includes("from('club_members')") &&
      liveTeamScope.includes("from('team_members')"),
    'live team-scope RLS checker explicitly cleans up membership rows',
  )
  check(
    liveTeamScope.includes('coach cannot read an unassigned same-club team') &&
      liveTeamScope.includes('coach cannot tag match to unassigned same-club team') &&
      liveTeamScope.includes('coach cannot tag squad to unassigned same-club team') &&
      liveTeamScope.includes('coach cannot start live session for unassigned same-club team'),
    'live team-scope RLS checker blocks same-club unassigned team access',
  )
  check(
    pkg?.scripts?.['team-scope:check:live'] === 'node scripts/verify-team-scope-live.mjs',
    'package exposes live team-scope RLS checker',
  )
  check(
    liveDomain.includes('Contact Support') &&
      liveDomain.includes('Before A Match') &&
      liveDomain.includes('Request Deletion Without The App') &&
      liveDomain.includes('expected.contentType'),
    'live domain checker verifies route-specific legal/support content and content types',
  )
  check(
    layout.includes('shouldPromptForTeamSelection') &&
      teamScope.includes('if (!activeTeamId) return true') &&
      teamScope.includes('return !rememberLastTeam'),
    'multi-team users must pick a team when no active team is available or remember-last-team is disabled',
  )
  check(
    teamScopeTest.includes('no active team is available') &&
      teamScopeTest.includes('remember-last-team is disabled'),
    'team picker selection rules are covered by unit tests',
  )
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
    'src/routes/account/delete/+page.server.js',
  ]) {
    check(existsSync(rel(route)), `required review route exists: ${route}`)
  }
}

async function checkAssetLinksState() {
  const release = await readJson('native/shared/release.json')
  if (release?.android?.wrapper !== 'Trusted Web Activity') {
    pass('assetlinks.json is not required for Capacitor Android')
    return
  }

  const assetLinks = 'static/.well-known/assetlinks.json'
  if (!existsSync(rel(assetLinks))) {
    warn(
      'assetlinks.json is not present yet, which is expected until the final Play signing SHA-256 fingerprint is known',
    )
    return
  }

  const text = await readText(assetLinks)
  const hasPlaceholder = /TODO|PLACEHOLDER|SHA256_FINGERPRINT|REPLACE_ME/i.test(text)
  check(!hasPlaceholder, 'assetlinks.json does not contain placeholder values')
  check(text.includes('ie.pitchnote.app'), 'assetlinks.json includes package ie.pitchnote.app')
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
      accepted.some((expectedType) => type.includes(expectedType)),
      `live URL has ${accepted.join(' or ')} content-type: ${url} (${type || 'missing'})`,
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
  await checkLiveUrl('https://www.pitchnote.ie/manifest.json', [
    'application/manifest+json',
    'application/json',
  ])
  await checkLiveUrl('https://www.pitchnote.ie/icons/icon-192.png', 'image/png')
  await checkLiveUrl('https://www.pitchnote.ie/icons/icon-512.png', 'image/png')
}

await checkManifest()
await checkNativeConfig()
await checkStoreModeCode()
await checkTeamScopedSync()
checkRoutes()
await checkAssetLinksState()
if (live) await checkLiveProduction()

if (warnings.length) {
  console.warn(`\n${warnings.length} warning${warnings.length === 1 ? '' : 's'}`)
}

if (failures.length) {
  console.error(
    `\nStore release check failed: ${failures.length} issue${failures.length === 1 ? '' : 's'}`,
  )
  process.exit(1)
}

console.log('\nStore release check passed')
