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
    pkg?.scripts?.['format:check']?.includes('scripts/verify-stripe-billing.mjs') &&
      pkg?.scripts?.['format:check']?.includes('scripts/verify-account-deletion-live.mjs') &&
      pkg?.scripts?.['format:check']?.includes('supabase/functions/**/*.ts'),
    'format check covers live verifiers and Supabase Edge Functions',
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
    pkg?.scripts?.['native:android:gradle'] === 'node scripts/run-android-gradle.mjs' &&
      pkg?.scripts?.['native:android:build']?.includes(
        'npm run native:android:gradle -- assembleDebug',
      ) &&
      existsSync(rel('scripts/run-android-gradle.mjs')),
    'Android build uses the Gradle helper with local JDK discovery',
  )
  check(
    pkg?.scripts?.['release:check']?.includes('npm run store:smoke'),
    'local release check includes native store smoke test',
  )
  check(
    pkg?.scripts?.['release:check:live']?.includes('node scripts/verify-live-domain.mjs') &&
      pkg?.scripts?.['release:check:live']?.includes('npm run billing:check') &&
      pkg?.scripts?.['release:check:live']?.includes('npm run team-scope:check:live') &&
      pkg?.scripts?.['release:check:live']?.includes('npm run account:delete:check:live') &&
      pkg?.scripts?.['release:check:live']?.includes('npm run free-quota:check:live'),
    'live release check includes domain, billing, team-scope, account-deletion, and free-quota live gates',
  )
  check(
    pkg?.scripts?.['account:delete:check:live'] === 'node scripts/verify-account-deletion-live.mjs',
    'account deletion live check script is registered',
  )
  check(
    pkg?.scripts?.['free-quota:check:live'] === 'node scripts/verify-free-match-quota-live.mjs',
    'free match quota live check script is registered',
  )
  check(
    pkg?.scripts?.['supabase:migration:account-delete-auth-guard'] ===
      'node scripts/apply-supabase-migration.mjs supabase/migrations/20260617_account_deletion_rpc_auth_guard.sql',
    'account deletion auth-guard migration apply script is registered',
  )
  check(
    pkg?.scripts?.['supabase:migration:free-match-quota'] ===
      'node scripts/apply-supabase-migration.mjs supabase/migrations/20260618_free_match_quota.sql',
    'free match quota migration apply script is registered',
  )
  check(
    pkg?.scripts?.['supabase:migration:release-required'] ===
      'node scripts/apply-release-supabase-migrations.mjs' &&
      existsSync(rel('scripts/apply-release-supabase-migrations.mjs')),
    'ordered release-required Supabase migration apply script is registered',
  )
  check(existsSync(rel('scripts/seed-reviewer-account.mjs')), 'reviewer seed script exists')
  check(
    existsSync(rel('scripts/verify-reviewer-account.mjs')),
    'reviewer verification script exists',
  )
  check(existsSync(rel('scripts/sync-native-config.mjs')), 'native config sync script exists')
  check(existsSync(rel('scripts/native-store-doctor.mjs')), 'native doctor script exists')
  check(
    existsSync(rel('scripts/verify-account-deletion-live.mjs')),
    'account deletion live check script exists',
  )
  check(
    existsSync(rel('scripts/verify-free-match-quota-live.mjs')),
    'free match quota live check script exists',
  )
  const migrationApplyHelper = await readText('scripts/apply-supabase-migration.mjs')
  check(
    existsSync(rel('scripts/apply-supabase-migration.mjs')) &&
      migrationApplyHelper.includes("loadDotEnv('.env.local')") &&
      migrationApplyHelper.includes("loadDotEnv('.env')") &&
      migrationApplyHelper.includes('SUPABASE_DB_URL') &&
      migrationApplyHelper.includes('PSQL_BIN') &&
      migrationApplyHelper.includes('--no-psqlrc') &&
      migrationApplyHelper.includes('--single-transaction') &&
      migrationApplyHelper.includes('--set=ON_ERROR_STOP=1') &&
      migrationApplyHelper.includes('/opt/homebrew/opt/libpq/bin/psql'),
    'migration apply helper exists, reads local env files, discovers Homebrew psql, and applies SQL safely',
  )
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

  const androidGradleHelper = await readText('scripts/run-android-gradle.mjs')
  check(
    androidGradleHelper.includes('ANDROID_HOME') &&
      androidGradleHelper.includes('ANDROID_SDK_ROOT') &&
      androidGradleHelper.includes('Library/Android/sdk'),
    'Android Gradle helper discovers the local Android SDK',
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
  check(
    entitlements.includes('canSaveFinishedMatch') &&
      entitlements.includes('savedMatchCount < FREE_MATCH_LIMIT'),
    'central entitlement policy enforces the free saved-match cap',
  )
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
    settings.includes('hasWebBilling = $derived(!IS_NATIVE_STORE_BUILD') &&
      settings.includes("invoke('create-portal-session'"),
    'Settings keeps Stripe portal access behind the web-only guard',
  )

  const billingCheck = await readText('scripts/verify-stripe-billing.mjs')
  const billingShared = await readText('supabase/functions/_shared/billing.ts')
  const corsShared = await readText('supabase/functions/_shared/cors.ts')
  const checkoutFunction = await readText('supabase/functions/create-checkout-session/index.ts')
  const portalFunction = await readText('supabase/functions/create-portal-session/index.ts')
  const cancelFunction = await readText('supabase/functions/cancel-subscription/index.ts')
  const webhookFunction = await readText('supabase/functions/stripe-webhook/index.ts')
  check(
    billingCheck.includes("requireConfiguredEnv('STRIPE_PORTAL_CONFIGURATION_ID')") &&
      billingCheck.includes("requireConfiguredEnv('STRIPE_WEBHOOK_ENDPOINT_ID')") &&
      !billingCheck.includes('STRIPE_PORTAL_CONFIGURATION_ID is missing') &&
      !billingCheck.includes('STRIPE_WEBHOOK_ENDPOINT_ID is missing'),
    'Stripe billing verifier requires portal and webhook endpoint configuration',
  )
  check(
    billingCheck.includes('payment_method_update') &&
      billingCheck.includes('subscription_cancel') &&
      billingCheck.includes('invoice_history'),
    'Stripe billing verifier checks required Customer Portal features',
  )
  check(
    portalFunction.includes("Deno.env.get('STRIPE_PORTAL_CONFIGURATION_ID')") &&
      portalFunction.includes('Billing portal is not configured') &&
      portalFunction.includes('configuration: portalConfiguration'),
    'Customer Portal function requires the configured Stripe portal',
  )
  check(
    billingShared.includes('getAppBaseUrl') &&
      billingShared.includes('getSameOriginReturnUrl') &&
      billingShared.includes('APP_URL must use https outside localhost') &&
      billingShared.includes('isLocalhost') &&
      checkoutFunction.includes('getAppBaseUrl()') &&
      !checkoutFunction.includes("req.headers.get('origin')") &&
      portalFunction.includes('getSameOriginReturnUrl(return_url)') &&
      !portalFunction.includes("req.headers.get('origin')"),
    'Stripe billing redirects use configured app origin and same-origin return URLs',
  )
  const browserBillingFunctions = [checkoutFunction, portalFunction, cancelFunction]
  check(
    browserBillingFunctions.every(
      (text) =>
        !text.includes("new Response('Unauthorized', { status: 401 })") &&
        text.includes("JSON.stringify({ error: 'Unauthorized' })") &&
        text.includes("headers: { ...corsHeaders, 'Content-Type': 'application/json' }"),
    ),
    'Browser-facing billing functions return CORS JSON auth errors',
  )
  check(
    browserBillingFunctions.every((text) => text.includes('getCorsHeaders(req)')) &&
      corsShared.includes('Access-Control-Allow-Origin') &&
      !corsShared.includes("'Access-Control-Allow-Origin': '*'") &&
      corsShared.includes('ALLOWED_CORS_ORIGINS') &&
      corsShared.includes('capacitor://localhost') &&
      corsShared.includes('isLocalWebOrigin'),
    'Browser-facing billing functions use restricted origin-aware CORS',
  )
  check(
    browserBillingFunctions.every(
      (text) =>
        text.indexOf("req.headers.get('Authorization')") < text.indexOf('createClient(') &&
        text.indexOf('supabase.auth.getUser(token)') <
          text.indexOf("Deno.env.get('STRIPE_SECRET_KEY')") &&
        text.indexOf('supabase.auth.getUser(token)') < text.indexOf('new Stripe'),
    ),
    'Browser-facing billing functions authenticate before creating privileged clients',
  )
  check(
    cancelFunction.includes("Deno.env.get('STRIPE_SECRET_KEY')") &&
      cancelFunction.indexOf('if (!sub?.stripe_subscription_id)') <
        cancelFunction.indexOf("Deno.env.get('STRIPE_SECRET_KEY')") &&
      cancelFunction.indexOf("Deno.env.get('STRIPE_SECRET_KEY')") <
        cancelFunction.indexOf('new Stripe'),
    'Subscription cancellation no-ops before requiring Stripe configuration',
  )
  check(
    webhookFunction.includes('authUserExists') &&
      webhookFunction.includes('supabase.auth.admin.getUserById') &&
      webhookFunction.includes('Skipping subscription') &&
      webhookFunction.includes('fallback upsert for deleted auth user'),
    'Stripe webhook avoids recreating subscription rows for deleted auth users',
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
  const liveRoute = await readText('src/routes/app/live/+page.svelte')
  check(
    liveRoute.includes('canUseFeature(subscription, FEATURES.liveSharing)') &&
      liveRoute.includes(".from('live_sessions')") &&
      liveRoute.indexOf('canUseFeature(subscription, FEATURES.liveSharing)') <
        liveRoute.lastIndexOf('loadLiveSession(teamId, currentUser'),
    'live sharing route checks Club Pro access before live-session lookup',
  )
  check(
    liveRoute.includes('requestKey') &&
      liveRoute.includes('if (lookupKey !== requestKey) return') &&
      liveRoute.includes('if (error)') &&
      liveRoute.includes('showToast(loadError'),
    'live sharing route handles lookup errors and ignores stale session responses',
  )

  const sideline = await readText('src/lib/SidelineAI.svelte')
  check(
    sideline.includes("apiUrl('/api/voice/transcribe')"),
    'Sideline transcription endpoint uses apiUrl',
  )
  check(sideline.includes("apiUrl('/api/voice/answer')"), 'Sideline answer endpoint uses apiUrl')

  const match = await readText('src/lib/Match.svelte')
  check(
    match.includes('canSaveFinishedMatch($subscriptionStore') &&
      match.includes('countFinishedMatches()') &&
      match.includes('Free accounts can save'),
    'finished match save enforces the account-wide free saved-match cap',
  )
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

  const freeQuotaMigration = await readText(`${migrationDir}/20260618_free_match_quota.sql`)
  const freeQuotaVerifier = await readText('scripts/verify-free-match-quota-live.mjs')
  check(
    freeQuotaMigration.includes('create or replace function public.has_paid_match_entitlement') &&
      freeQuotaMigration.includes('create trigger enforce_free_match_quota') &&
      freeQuotaMigration.includes('after insert on public.matches') &&
      !freeQuotaMigration.includes('before insert or update on public.matches') &&
      freeQuotaMigration.includes('existing_count >= 2') &&
      freeQuotaMigration.includes('public.club_members cm') &&
      freeQuotaMigration.includes("s.plan in ('personal', 'club', 'club_pro')") &&
      freeQuotaMigration.includes(
        'revoke all on function public.has_paid_match_entitlement(uuid) from authenticated',
      ) &&
      !freeQuotaMigration.includes(
        'grant execute on function public.has_paid_match_entitlement(uuid) to authenticated',
      ),
    'Supabase migration enforces the free match quota while preserving paid club entitlements without exposing the helper RPC',
  )
  check(
    freeQuotaVerifier.includes('free account can sync-upsert an existing cloud match') &&
      freeQuotaVerifier.includes('free account cannot sync-upsert a third cloud match') &&
      freeQuotaVerifier.includes('club coach can save third club-entitled match') &&
      freeQuotaVerifier.includes('expectedError: quotaError') &&
      freeQuotaVerifier.includes("mode: 'upsert'") &&
      freeQuotaVerifier.includes('supabase/migrations/20260618_free_match_quota.sql'),
    'live free match quota checker covers free sync upserts, paid club access, and actionable SQL failure output',
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
      liveTeamScope.includes(
        'owner can sync-upsert existing own team-scoped match by id,user_id',
      ) &&
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

async function checkAccountDeletion() {
  const migration = await readText('supabase/migrations/20260617_account_deletion_rpc.sql')
  const authGuardMigration = await readText(
    'supabase/migrations/20260617_account_deletion_rpc_auth_guard.sql',
  )
  const settings = await readText('src/lib/Settings.svelte')
  const liveVerifier = await readText('scripts/verify-account-deletion-live.mjs')
  check(
    migration.includes('create or replace function public.delete_own_account()') &&
      migration.includes('security definer') &&
      migration.includes('set search_path = pg_catalog') &&
      migration.includes("coalesce(auth.role(), '') <> 'authenticated'") &&
      migration.includes("raise exception 'Authentication required'") &&
      migration.includes('delete from auth.users'),
    'account deletion RPC rejects anonymous callers and removes the authenticated auth user through a security-definer function',
  )
  check(
    authGuardMigration.includes('create or replace function public.delete_own_account()') &&
      authGuardMigration.includes('set search_path = pg_catalog') &&
      authGuardMigration.includes("coalesce(auth.role(), '') <> 'authenticated'") &&
      authGuardMigration.includes('revoke all on function public.delete_own_account() from anon') &&
      authGuardMigration.includes(
        'grant execute on function public.delete_own_account() to authenticated',
      ),
    'account deletion follow-up migration explicitly rejects anonymous RPC calls',
  )
  check(
    migration.includes('delete from public.matches where user_id = $1') &&
      migration.includes('delete from public.squad where user_id = $1') &&
      migration.includes('delete from public.subscriptions where user_id = $1') &&
      migration.includes('delete from public.profiles where id = $1'),
    'account deletion RPC removes user-owned cloud data',
  )
  check(
    migration.includes('revoke all on function public.delete_own_account() from public') &&
      migration.includes('revoke all on function public.delete_own_account() from anon') &&
      migration.includes('grant execute on function public.delete_own_account() to authenticated'),
    'account deletion RPC is executable only by authenticated users',
  )
  const deleteAccountStart = settings.indexOf('async function doDeleteAccount')
  const deleteAccountBlock = settings.slice(
    deleteAccountStart,
    settings.indexOf('async function openBillingPortal'),
  )
  check(
    deleteAccountBlock.includes(
      'throw new Error(`Could not cancel billing: ${cancelErr.message}`)',
    ) &&
      deleteAccountBlock.includes('Native builds still do not expose checkout') &&
      deleteAccountBlock.indexOf("invoke('cancel-subscription')") <
        deleteAccountBlock.indexOf("supabase.rpc('delete_own_account')") &&
      deleteAccountBlock.indexOf("supabase.rpc('delete_own_account')") <
        deleteAccountBlock.indexOf('await clearAllData()'),
    'Settings cancels billing before server deletion, deletes the server account before wiping local data, and blocks on billing cancellation errors',
  )
  check(
    liveVerifier.includes("anonymous.rpc('delete_own_account')") &&
      liveVerifier.includes("target.client.rpc('delete_own_account')") &&
      liveVerifier.includes('admin.auth.admin.getUserById') &&
      liveVerifier.includes('expectAuthUserMissing(target.id') &&
      liveVerifier.includes('control auth user remains') &&
      liveVerifier.includes('admin.auth.admin.deleteUser(userId)'),
    'account deletion live verifier checks auth, cloud cleanup, and control account safety',
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
await checkAccountDeletion()
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
