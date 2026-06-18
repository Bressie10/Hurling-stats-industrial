# PitchNote Project Status

Last updated: 2026-06-18

This document is a practical project handoff: what PitchNote is, what has been built, what has been verified, what still needs work, and where the main risks are. It is written from the current local workspace state.

## Short Version

PitchNote is in late integration / pre-release shape. The core web app is substantially built, the rebrand to PitchNote is in place, Stripe-first billing has been implemented for the web, native iOS and Android wrappers exist, team-scoped data/RLS has been verified against Supabase, and on-device voice logging has been implemented. It is not yet field-ready or store-submission-ready because the production domain is not registered/active, Android/iOS physical-device voice tests and real pitch accuracy testing remain, live billing deployment checks remain, and app-store signing, store metadata, and final native review passes still need to be completed.

The current launch strategy is:

- Web is the paid signup and billing channel.
- Native iOS and Android are free companion clients.
- Free accounts are capped at 2 saved matches.
- Personal Pro unlocks analytics, unlimited history, PDF reports, and targets.
- Club unlocks team management and join codes.
- Club Pro unlocks live sharing.
- Native builds must not show Stripe checkout, prices, external payment CTAs, or web billing links.

Current rough progress by area:

| Area                       | Status                                                                                                                                   | Practical estimate |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| Core web match app         | Built and usable, needs normal QA                                                                                                        | 80-90%             |
| Offline data and sync      | Implemented with regression tests; team-scoped local/cloud sync and live Supabase RLS verification pass; deployed/device sync QA remains | 80-90%             |
| PitchNote rebrand          | Code/docs mostly switched                                                                                                                | 85-90%             |
| Stripe web billing         | Implemented in test-mode shape; Supabase function URLs are reachable, end-to-end checkout/webhook testing remains                        | 80-85%             |
| Native store-safe mode     | Implemented, needs full real-device review                                                                                               | 70-80%             |
| iOS wrapper                | Generated, simulator build works, signed physical-device Debug build/install passes; TestFlight and real-device launch/voice QA pending  | 70-80%             |
| Android wrapper            | Debug APK builds and emulator launch passed; physical install/voice still pending                                                        | 55-65%             |
| On-device voice logging    | Implemented, unit-tested, parser improved for jersey numbers/STT alternatives, not field-validated                                       | 50-65%             |
| Store submission readiness | Docs/scaffolding exist, accounts/forms/signing still pending                                                                             | 45-55%             |
| Overall release posture    | Pre-release integration, not final launch                                                                                                | 65-75%             |

## Current Git State

Current branch:

- `main`
- `main` is the approved integration and deployment target.
- Do not push release, PWA, or native work to `Voice-Changes`.

Last known branch relationship:

- Local `main` is ahead of `origin/main` by 2 commits:
  - `2be93ce` - Finish Stripe billing integration
  - `3e98858` - Add on-device voice logging
- `origin/main` is at `96c4036` - Rebrand app to PitchNote

Important current local state:

- There are uncommitted changes for voice field-test scaffolding, docs, Android/native notes, validation tooling, team-scoped data/sync/RLS, and native config/tooling.
- The uncommitted changes include the `/app/voice-test` harness, voice accuracy documentation, `src/lib/team-scope.js`, `supabase/migrations/20260617_team_scoped_data_and_rls.sql`, and `supabase/migrations/20260617_team_scoped_policy_reset.sql`.
- Do not assume the local tree is clean.
- Do not revert unrelated changes without checking first.

Current independence status of the two unpushed commits:

- The Stripe billing commit and voice logging commit are mostly separate in purpose.
- They are not perfectly independent mechanically because they share some files such as `package.json`, docs, and verification scripts.
- A revert test showed reverting voice after Stripe applies cleanly.
- Reverting Stripe after voice caused a conflict in `eslint.config.js`.
- That means they can probably be managed as separate features, but they are not zero-conflict independent.

## Product Summary

PitchNote is an offline-first hurling match stats app for coaches, selectors, analysts, and club teams. The main pitch-side value is fast event logging during a match, even with poor connectivity. The app stores match data locally first, then syncs to Supabase when online.

Main user jobs:

- Set up a squad.
- Log match events quickly during live play.
- Track scores, wides, frees, turnovers, puckouts, substitutions, notes, and pitch locations.
- Review match history, player stats, team stats, timelines, and insights.
- Export reports.
- Use team/club features for shared squads and live match viewing.
- Use voice as a second input path on the sideline, without paying cloud STT costs during matches.

The product is now called PitchNote and uses `pitchnote.ie` as the public domain.

## Branding State

Done:

- Rebrand away from GAA-related naming because GAA is trademarked.
- App identity changed to PitchNote.
- Production URL documented as `https://www.pitchnote.ie/`.
- Support email documented as `support@pitchnote.ie`.
- Store and native docs now refer to PitchNote.
- Native IDs use `ie.pitchnote.app`.

Still needed:

- Final logo/icon set should be checked visually.
- User mentioned they may remake logos; this remains a design asset task unless already completed outside the repo.
- App Store and Google Play screenshots should use final branding.
- Any remaining old references should be searched before submission.
- Cloudflare Email Routing for `support@pitchnote.ie` must be externally verified.

Useful checks:

```sh
rg -i "gaa|doora|hurling stats|contact@" .
```

## Core Web App

Implemented:

- SvelteKit app with Vercel adapter.
- Main app shell under `/app`.
- Landing page, docs page, install page, pricing page, privacy, terms, support, and account deletion pages.
- Auth through Supabase.
- Offline-first IndexedDB persistence.
- Durable sync outbox for cloud backup/restore through Supabase.
- Team-scoped local data support: personal scope plus active-team scope for squad, drafts, matches, and sync mutations.
- Match logging UI.
- Squad management.
- History.
- Player stats.
- Team stats.
- Timeline.
- Insights.
- Targets.
- Settings.
- Live viewer route.
- Optional Sideline AI server routes.

Important routes:

- `/`
- `/pricing`
- `/docs`
- `/install`
- `/privacy`
- `/terms`
- `/support`
- `/account/delete`
- `/app`
- `/app/match`
- `/app/squad`
- `/app/history`
- `/app/player`
- `/app/team`
- `/app/timeline`
- `/app/insights`
- `/app/targets`
- `/app/live`
- `/app/settings`
- `/app/voice-test` (dev or `PUBLIC_ENABLE_VOICE_TEST=1` field-test builds)

Important components:

- `src/lib/Match.svelte`
- `src/lib/Squad.svelte`
- `src/lib/History.svelte`
- `src/lib/PlayerStats.svelte`
- `src/lib/TeamStats.svelte`
- `src/lib/Timeline.svelte`
- `src/lib/Insights.svelte`
- `src/lib/StatTargets.svelte`
- `src/lib/Settings.svelte`
- `src/lib/LiveVoiceLogger.svelte`
- `src/lib/VoiceAccuracyHarness.svelte`
- `src/lib/EntitlementGate.svelte`
- `src/lib/Upgrade.svelte`
- `src/lib/PricingPage.svelte`

## Data And Sync

Implemented:

- IndexedDB stores local app data.
- IndexedDB is at v3 in the current workspace and adds `squad_by_team` for team-scoped squads while preserving legacy personal squad reads.
- Local match/squad mutations are added to a sync outbox.
- Sync outbox drains to Supabase when online.
- Match/squad sync mutations now carry `teamScope` and `team_id` where an active team exists.
- Background Sync is used where supported.
- Fallback sync runs on app start, online events, foreground activity, and manual Sync.
- Draft matches remain local until saved.
- Drafts are scoped: `draft` for personal data and `draft:<teamScope>` for active-team data.
- Signing out attempts to flush the outbox before local data is cleared.

Tests exist for:

- Match and squad outbox writes.
- Retry backoff.
- Completed mutation removal.
- Full local wipe behavior.
- Cloud restore.
- Stale cloud protection.
- Pending delete skip.
- Numeric ID preservation.
- Outbox drain before pull.
- Team-scoped stale-cloud match protection.
- Empty-squad remote deletion within the same scope.

Key files:

- `src/lib/db.js`
- `src/lib/db.test.js`
- `src/lib/sync.js`
- `src/lib/sync.test.js`
- `src/lib/sync-payloads.js`
- `src/lib/team-scope.js`
- `src/service-worker.js`
- `static/pwabuilder-sw.js`
- `supabase/migrations/20260617_team_scoped_data_and_rls.sql`

Remaining risks:

- Real-world sync testing across multiple devices should continue.
- Team-scoped sync/RLS must be applied and verified against production Supabase before relying on multi-team cloud data isolation.
- Edge cases around account switching, stale sessions, interrupted syncs, and long offline periods need practical QA.
- Background Sync support varies by browser, so the fallback path matters.

## Billing And Entitlements

Current strategy:

- Stripe Checkout and Stripe Billing on the web.
- Native builds are companion clients only.
- Native builds must not expose Stripe checkout, prices, external payment calls to action, or web billing links.

Plans:

| Plan         | Lookup key                   | Price          |
| ------------ | ---------------------------- | -------------- |
| Personal Pro | `pitchnote_personal_monthly` | EUR 7.99/month |
| Club         | `pitchnote_club_monthly`     | EUR 15/month   |
| Club Pro     | `pitchnote_club_pro_monthly` | EUR 25/month   |

Implemented:

- Stripe checkout Edge Function.
- Stripe portal Edge Function.
- Stripe cancellation Edge Function.
- Stripe webhook Edge Function.
- Subscription/profile hardening migration.
- Entitlement gating in the app.
- Free match cap behavior, including blocking third finished-match saves for free accounts while leaving drafts intact.
- Supabase free match quota migration to enforce the same 2-match cap at the database boundary after it is applied.
- Native store mode hiding Stripe UI.
- Billing verification script.
- Stripe billing docs.

Webhook endpoint:

```text
https://syikhsgovqogzkmmhuis.supabase.co/functions/v1/stripe-webhook
```

Expected webhook events:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

Required Supabase Edge Function secrets:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PORTAL_CONFIGURATION_ID`
- `STRIPE_PERSONAL_PRICE_ID`
- `STRIPE_CLUB_PRICE_ID`
- `STRIPE_CLUB_PRO_PRICE_ID`
- `APP_URL=https://www.pitchnote.ie`

Local optional verification secret:

- `STRIPE_WEBHOOK_ENDPOINT_ID`

Verification command:

```sh
npm run billing:check
```

Still needed before live billing can be considered finished:

- Confirm Supabase Edge Functions are deployed from the intended code, not only reachable.
- Confirm all Supabase function secrets are set in the target project.
- Run `npm run billing:check` against the intended Stripe mode.
- Run at least one test checkout end-to-end.
- Confirm webhook updates the correct Supabase subscription/profile fields.
- Confirm portal opens for subscribed web users.
- Confirm cancellation flow does not appear in native store mode.
- Confirm live-mode Stripe products/prices/webhooks before taking real money.

Verified on 2026-06-17:

- `npm run billing:check` passes against the configured Stripe test-mode resources.
- Live Supabase function URLs are reachable: `create-checkout-session`, `create-portal-session`, and `cancel-subscription` return `200` to unauthenticated CORS preflight requests; `stripe-webhook` returns `400` to an unsigned request as expected.

## Supabase State

The repo contains:

- Supabase client integration.
- Auth usage.
- Cloud sync logic.
- Supabase migrations.
- Supabase Edge Functions for billing.
- Reviewer account seed and verification scripts.

Supabase migrations present:

- `20260404_add_stripe_columns.sql`
- `20260404_subscription_bulletproof.sql`
- `20260408_two_tier_roles.sql`
- `20260409_custom_features.sql`
- `20260610_squad_composite_key.sql`
- `20260611_fix_rls_holes.sql`
- `20260613_stripe_billing_hardening.sql`
- `20260617_team_scoped_data_and_rls.sql`
- `20260617_team_scoped_policy_reset.sql`
- `20260617_account_deletion_rpc.sql`
- `20260617_account_deletion_rpc_auth_guard.sql`
- `20260618_free_match_quota.sql`

Edge Functions present:

- `create-checkout-session`
- `create-portal-session`
- `cancel-subscription`
- `stripe-webhook`

Still needed / confirm:

- The target Supabase project has every future migration applied before relying on the changed behavior.
- Apply release-required Supabase SQL with `npm run supabase:migration:release-required` when `SUPABASE_DB_URL` is set, or paste the three SQL files in order, then run `npm run team-scope:check:live` and `npm run free-quota:check:live`.
- Edge Functions are deployed.
- Secrets are set correctly.
- Reviewer account works after any database or entitlement changes.
- RLS remains correct for seeded reviewer data, normal users, teams, and subscriptions.

## Native Store Mode

Store-safe mode is required because the native apps are not the payment channel.

Store mode can be enabled by:

- `PUBLIC_STORE_BUILD=ios`
- `PUBLIC_STORE_BUILD=android`
- `https://www.pitchnote.ie/?store_build=ios`
- `https://www.pitchnote.ie/?store_build=android`

The launch-query fallback persists in local storage under:

```text
pitchnote-store-build
```

Implemented:

- Native store mode hides prices.
- Native store mode hides Stripe checkout buttons.
- Native store mode hides web billing links.
- Native store mode hides external payment calls to action.
- Settings account deletion cancels existing web billing server-side before deleting the account, while native store mode still hides checkout, prices, portal links, and billing-management UI.
- Pricing and upgrade surfaces are checked by `npm run store:check`.

Still needed:

- Physical iOS device review.
- Physical Android device review.
- Manual pass through all locked-feature states in store mode.
- Final App Store / Play Store metadata and privacy answers.

## iOS Native Status

Implemented:

- Capacitor iOS project generated under `ios/`.
- Bundle ID is `ie.pitchnote.app`.
- Initial URL is `https://www.pitchnote.ie/?store_build=ios`.
- Production web build can be synced into the iOS wrapper.
- PitchNote app icon and splash replaced Capacitor defaults.
- Microphone and speech recognition usage descriptions are present.
- Unsigned iOS simulator build passed.
- Manual launch in iPhone 17 simulator passed.
- Signed Debug build for paired physical iPhone passed.
- Synced current web build installed on paired physical iPhone through `devicectl`.
- Xcode recommended settings were applied.

Current blocker:

- TestFlight/archive flow and automated `devicectl` launch are not complete.
- `xcrun devicectl device process launch` currently times out waiting for CoreDeviceService, even though install succeeds.

Still needed:

- App Store Connect app record and TestFlight signing/archive setup.
- Signed archive from Xcode.
- Upload to App Store Connect.
- App Privacy answers.
- Reviewer account verification inside the native build.
- Manual physical-device launch, microphone permission, and on-device speech test.
- Confirm no Stripe/payment UI appears in the iOS store build.

Useful commands:

```sh
npm run native:ios:sync
npm run native:ios:open
```

## Android Native Status

Implemented:

- Capacitor Android project exists under `android/`.
- Package name is `ie.pitchnote.app`.
- Launch URL is `https://www.pitchnote.ie/?store_build=android`.
- JDK 21 and Android SDK were configured locally.
- `npm run native:android:build` passed on 2026-06-18 through `scripts/run-android-gradle.mjs`, which discovers local JDK 21 and `/Users/ultanbreslin/Library/Android/sdk` without manual shell exports.
- Debug APK was built.
- Debug APK previously installed and launched on the `Pitchnote_API_36` emulator.
- The emulator was later removed to recover disk space.

Current APK path:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Current known physical-device state:

- `/Users/ultanbreslin/Library/Android/sdk/platform-tools/adb devices` runs outside the sandbox.
- As of 2026-06-18 it shows no attached Android devices.
- `adb` is not on the default shell `PATH`; use the full SDK path above or add platform-tools to `PATH`.
- Most likely causes are no phone connected, cable, phone locked, USB mode, developer options, USB debugging, or the debugging authorization prompt.

Still needed:

- Connect real Android phone with a data-capable cable.
- Enable Developer Options.
- Enable USB debugging.
- Unlock phone and accept the ADB authorization prompt.
- Confirm `adb devices -l` shows the device.
- Install debug APK.
- Launch app.
- Build/sync with `PUBLIC_ENABLE_VOICE_TEST=1`, then open `/app/voice-test`.
- Put phone in airplane mode.
- Confirm offline indicator on screen.
- Record real microphone samples.
- Confirm offline STT behavior.

Useful commands:

```sh
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME="$HOME/Library/Android/sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:/opt/homebrew/bin:$PATH"

adb devices -l
npm run native:android:build
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n ie.pitchnote.app/.MainActivity
```

Storage note:

- After cleanup, Android SDK data was around 1.8 GB.
- `.gradle` was around 1.0 GB.
- The Android emulator system image/AVD was removed.
- Re-testing on emulator may require downloading a system image again.

## Voice Logging

Goal:

- Replace OpenAI Realtime API voice logging for live match entry.
- Use native on-device STT only for live logging.
- Feed voice results into the same event creation path as tap logging.
- Avoid match-day cloud STT cost, latency, and pitch connectivity failures.

Implemented:

- `LiveVoiceLogger` component.
- `on-device-speech.js` native wrapper.
- iOS SFSpeechRecognizer bridge behavior with contextual strings.
- Android SpeechRecognizer behavior using `RecognizerIntent.EXTRA_PREFER_OFFLINE`.
- Android biasing strings through supported intent extras.
- Parser pipeline in `voice-log-parser.js`.
- Configurable thresholds in `voice-log-config.js`.
- Unit tests in `voice-log-parser.test.js`.
- Toast-based confirmation UI.
- Undo path.
- Fix path.
- Ambiguous-player candidate selection.
- Low-confidence visual handling.
- Voice output uses the same event shape as tap entry:

```js
{
  ;(playerId, stat, timestamp, half)
}
```

Parser pipeline:

1. Normalize raw STT text.
2. Match action first using token-overlap scoring against action variants.
3. Return `no_action_detected` when action score is below threshold.
4. Strip matched action phrase from text.
5. Match player against roster using Levenshtein similarity.
6. Compare jersey number, number words, full name, surname-only, first initial, and fuzzy name candidates.
7. Detect duplicate surnames.
8. Require disambiguation for duplicate surnames by first initial or jersey number.
9. Try native STT alternatives if the first transcript does not produce the best parse.
10. Return `ambiguous_player` with top 3 candidates when below player threshold or tied too closely.
11. Return `ok` with player, action/stat, timestamp, half, confidence, match source, and optional `needsLocation` when matched.

Thresholds:

- Action threshold starts at 0.6.
- Player threshold starts at 0.65.
- Low-confidence band is configurable.

Important limitation:

- Code and unit tests passing does not make this field-ready.
- Field-ready means actual real-world accuracy on a real pitch with a real device microphone.

## Voice Stat Scope

Current v1 field-test voice stats:

- Point
- Goal
- Wide
- Free Won
- Turnover Lost
- Yellow Card

Known limitation:

- Black/red cards are not currently voice-loggable in v1 field testing.
- 45s are not currently voice-loggable in v1 field testing.
- Sideline balls are not currently voice-loggable in v1 field testing.
- Use tap entry for these during tests.

Schema audit result:

- The default app stat schema does not expose `45`, `Sideline`, or `Black Card` as normal loggable voice targets.
- These should not be silently included in voice parsing.
- The current field-test decision is to exclude them from voice v1 and document the limitation.
- A later schema/product decision can add them properly.

Potential future decision:

- Add `45`, `Sideline`, `Black Card`, Red Card, and related discipline/set-play stats as first-class stat types across the whole app.
- Or keep them tap-only if the match-day workflow does not justify voice support.

## Voice Accuracy Harness

Implemented locally:

- `/app/voice-test` (dev or `PUBLIC_ENABLE_VOICE_TEST=1` field-test builds)
- `src/lib/VoiceAccuracyHarness.svelte`
- `docs/voice-accuracy-testing.md`

The harness:

- Loads local squad roster.
- Uses the same native STT wrapper as live voice logging.
- Runs transcripts through the same parser.
- Shows live transcript.
- Shows parsed result.
- Shows status.
- Shows confidence.
- Shows recognizer availability diagnostics after native STT checks.
- Shows top candidates where relevant.
- Records whether the parser matched by number, full name, surname, initial, or fuzzy match.
- Shows network/offline indicator.
- Supports typed transcript fallback for dry runs.
- Stores samples in `localStorage`.
- Exports CSV.
- Has quick one-handed annotations:
  - Correct
  - Fixable
  - Incorrect
  - Bad sample

CSV metadata includes:

- Timestamp.
- Device label.
- Platform / user agent.
- Network mode.
- Connection type.
- Ambient condition note.
- Transcript.
- Native STT confidence.
- Native STT alternatives.
- Recognizer diagnostics.
- Expected player/stat.
- Parsed player/stat.
- Parser match source.
- Parser status.
- Confidence.
- Candidate list.
- Manual annotation.

Still needed:

- Install on a real Android phone.
- Manually launch the installed iPhone build and grant microphone/speech permissions.
- Put device in airplane mode.
- Confirm offline indicator.
- Confirm offline STT is actually available.
- Collect real pitch samples.
- Review CSV.
- Tune parser thresholds/vocabulary only after real data is collected.

Suggested minimum field-test sample:

- At least 50 commands for an early smoke test.
- Prefer 100-200 commands before calling voice strong enough for beta.
- Include repeated surnames, noisy background, wind, distance from phone, different speaking speeds, and local accent variation.

## Optional Sideline AI

Current state:

- Optional Sideline AI routes still exist separately from live voice logging.
- These routes are server-side and use OpenAI only for optional post-match/read-only assistant behavior.
- Live match voice logging does not call OpenAI.

Routes:

- `src/routes/api/voice/transcribe/+server.js`
- `src/routes/api/voice/answer/+server.js`

Important distinction:

- Live stat logging must remain cloud-free.
- Optional Sideline AI can remain cloud-backed if kept separate and properly disclosed.

## Reviewer And Store Testing

Implemented:

- Reviewer account seed script.
- Reviewer account verification script.
- Reviewer testing docs.
- Store release checklist.
- Store listing draft.
- Store-safe checks.

Commands:

```sh
npm run store:seed-reviewer
npm run store:verify-reviewer
npm run store:check
npm run store:check:live
```

Still needed:

- Confirm seeded data appears in native store mode.
- Confirm free account limits for store reviewers.
- Confirm locked features show entitlement-only messaging.
- Confirm no purchase paths are visible in native builds.
- Fill final Apple App Review notes.
- Fill final Google Play test account notes.

Verified on 2026-06-17:

- `npm run store:seed-reviewer` completed for `reviewer@pitchnote.ie`.
- `npm run store:verify-reviewer` signed in through the public Supabase anon/RLS path and confirmed `personal / active`, 25 squad rows, and 3 match rows.

## Verification Already Known

Current checks passing on 2026-06-18:

- `npm run release:check`
- `npm run test`
- `npm run lint`
- `npm run format:check`
- `npm run store:check`
- `npm run store:seed-reviewer`
- `npm run store:verify-reviewer`
- `npm run team-scope:check:live`
- `npm run native:doctor`
- `npm run native:android:build`
- `npm run native:ios:sync`
- `xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug -sdk iphonesimulator -derivedDataPath /private/tmp/pitchnote-ios-derived CODE_SIGNING_ALLOWED=NO build`
- `npm run billing:check`
- `npm run account:delete:check:live`

Known test count:

- Voice/parser and app regression suite is currently 36 passing tests.

Current known failing check:

- `npm run store:check:live` fails only on live URL fetches because `whois pitchnote.ie` returns `Not found` and the domain returns `NXDOMAIN`.
- `npm run team-scope:check:live` now reaches Supabase but fails because live `matches` does not accept `onConflict=id,user_id`; apply `20260617_team_scoped_data_and_rls.sql` and `20260617_team_scoped_policy_reset.sql`, then rerun it.
- `npm run free-quota:check:live` also requires the team-scoped match key first, then `supabase/migrations/20260618_free_match_quota.sql`.

Known warnings:

- Lint passes with no output in the latest run.
- Build previously passed with existing warnings only.
- Existing warnings include unused variables/CSS in older components and a large match chunk.
- Capacitor/Gradle may show normal flatDir-style warnings.

Important not-yet-verified items:

- Android physical-device install.
- Android real offline speech model behavior.
- Android real microphone voice accuracy.
- iOS physical-device voice accuracy.
- Real pitch accuracy.
- Live Stripe mode; current `npm run billing:check` is passing against configured Stripe test-mode resources.
- Live free-quota database enforcement after applying `supabase/migrations/20260618_free_match_quota.sql`; the verifier currently proves the live DB is not enforcing this yet.
- Store submission review.

## Quality Baseline

Tooling added:

- Vitest.
- fake-indexeddb.
- ESLint.
- Prettier.
- Store release verification script.
- Billing verification script.
- Native doctor/config scripts.

Useful commands:

```sh
npm run test
npm run lint
npm run format:check
npm run build
npm run store:check
npm run release:check
npm run billing:check
npm run native:doctor
npm run native:config:check
```

Before a release-critical push, run:

```sh
npm run test
npm run lint
npm run format:check
npm run store:check
npm run release:check
npm run build
```

Before billing changes are trusted:

```sh
npm run billing:check
```

Before native submission:

```sh
npm run store:check
npm run store:check:live
npm run store:verify-reviewer
```

Current live-domain blocker on 2026-06-18: `whois pitchnote.ie` returns `Not found`; `pitchnote.ie` and `www.pitchnote.ie` return `NXDOMAIN`, which is expected while the domain is not yet bought/activated. Keep release config on `https://www.pitchnote.ie/`; `npm run store:check:live` cannot pass until the domain is registered or activated and DNS/hosting records are configured.

## Immediate Next Steps

Recommended order:

1. Apply release-required Supabase SQL with `npm run supabase:migration:release-required` when `SUPABASE_DB_URL` is set, or paste the three SQL files in order, then run `npm run team-scope:check:live` and `npm run free-quota:check:live`.
2. Register or activate `pitchnote.ie`, configure `pitchnote.ie` and `www.pitchnote.ie` DNS/hosting records, then rerun `npm run store:check:live`.
3. Once DNS resolves, run `npm run release:check:live` to cover local gates, live URL checks, live-domain checks, billing config, team-scoped RLS, account-deletion verification, and free-quota verification.
4. Deploy/verify Supabase Edge Functions and Stripe secrets in the intended live environment.
5. Run test checkout and webhook verification.
6. Finish the Android physical-device connection.
7. Build with `PUBLIC_ENABLE_VOICE_TEST=1`, then install `android/app/build/outputs/apk/debug/app-debug.apk` on the real Android phone.
8. Open `/app/voice-test` on the phone.
9. Put the phone in airplane mode.
10. Confirm the harness shows offline/airplane mode.
11. Confirm STT either works offline or fails with the documented unavailable behavior.
12. Record at least 50 voice samples.
13. Export CSV.
14. Review accuracy before changing thresholds or vocabulary.
15. Decide whether black/red cards, 45s, and sideline balls stay tap-only for v1 or become real schema work.
16. Manually launch the installed iPhone Debug build or use Xcode Run, then verify microphone and speech permission prompts.
17. Confirm seeded reviewer data appears in native store mode.
18. Confirm free account limits, locked feature messaging, and no native purchase paths on real devices.
19. Resolve whether the unpushed commits should be pushed as-is or split further.
20. Push approved work to `main`, not `Voice-Changes`.
21. Start App Store / Play Store signing and metadata work.

## Android Phone Connection Checklist

If `adb devices -l` shows no phone:

1. Use a data-capable USB cable, not a charge-only cable.
2. Unlock the phone.
3. Enable Developer Options.
4. Enable USB debugging.
5. Set USB mode to File Transfer / MTP if available.
6. Watch for the "Allow USB debugging" prompt and accept it.
7. Try another USB port/cable.
8. Restart ADB:

```sh
adb kill-server
adb start-server
adb devices -l
```

If the device shows `unauthorized`:

- Unlock the phone and accept the debugging prompt.
- If no prompt appears, revoke USB debugging authorizations on the phone and reconnect.

## Store Submission Still Needed

Apple:

- Apple Developer account.
- Signing team.
- Bundle ID setup.
- Archive upload.
- App Store Connect metadata.
- App Privacy answers.
- Reviewer account notes.
- Real iPhone review pass.
- On-device speech permission and functionality review.

Google:

- Google Play developer account.
- App signing setup.
- Release `.aab`.
- Data Safety form.
- Store listing.
- Privacy policy/support/account deletion links.
- Reviewer account notes.
- Real Android review pass.
- Offline STT behavior documented and tested.

Both:

- Final app icon/screenshots.
- Final store description.
- Final release notes.
- Support mailbox verification.
- Account deletion verification.
- No native payment-link violations.

## Known Risks

Voice accuracy:

- Unit tests only prove parser behavior.
- Speech recognition quality depends on device, offline language model, accent, wind, crowd noise, and microphone position.
- This is the largest practical field-readiness risk.

Android offline STT:

- Android does not give a reliable app-level guarantee that an offline model exists.
- `EXTRA_PREFER_OFFLINE` is a request, not a proof.
- The app must treat offline STT failure as no event logged and tell the user to use tap entry or install/download the offline speech model.

Native store policy:

- Native builds must not show Stripe checkout, prices, web billing links, or external payment CTAs.
- Any accidental payment prompt in native mode is a store-review risk.

Billing:

- Test-mode resources exist, but live-mode resources and Supabase secrets must be verified before real payments.
- Webhooks must be tested end-to-end because entitlement state depends on them.

Supabase/RLS:

- Sync and entitlements depend on correct RLS.
- Reviewer account checks help, but real multi-user/team testing is still needed.

Git/release hygiene:

- `main` is ahead by two commits and the worktree is dirty.
- Uncommitted harness/docs changes should be deliberately committed or discarded later.
- Do not push to `Voice-Changes`.

Brand/legal:

- The GAA trademark issue was the reason for the PitchNote rebrand.
- Final copy should avoid implying official GAA affiliation.
- Store copy should describe the sport/workflow without using protected branding in a way that suggests endorsement.

## Definition Of Done For Voice V1

Voice logging should not be called field-ready until:

- Android physical-device build installs and launches.
- iOS physical-device build installs and launches, or TestFlight build is available.
- Offline/airplane-mode STT test passes on the target Android device.
- iOS on-device recognition works without live cloud STT for the logging flow.
- `/app/voice-test` CSV contains enough real pitch samples.
- Accuracy is reviewed.
- Thresholds/vocabulary are tuned from real data.
- Ambiguous and low-confidence flows are tested by a human during a realistic session.
- Unsupported stats are clearly documented.
- No event is logged on STT failure.
- Voice-created events match tap-created event objects.

## Definition Of Done For Billing

Billing should not be called launch-ready until:

- Stripe products and prices exist in the intended mode.
- Supabase secrets are set for that mode.
- Edge Functions are deployed.
- Checkout creates a subscription.
- Webhook receives events and updates Supabase.
- Entitlements update in the app after checkout.
- Portal opens for the customer.
- Cancellation/expired subscription behavior is correct.
- Native store mode hides all payment surfaces.
- `npm run billing:check` passes.

## Definition Of Done For Native Store Release

Native release should not be called ready until:

- iOS signed build is uploaded to TestFlight.
- Android signed `.aab` is uploaded to Play internal testing.
- Reviewer account works on real devices.
- Store-safe mode is confirmed on real devices.
- Account deletion works.
- Privacy/support/terms URLs work.
- Voice permissions are correct.
- No native Stripe/payment UI appears.
- App icons and screenshots are final.
- App Store privacy and Play Data Safety answers are complete.
- At least one full offline match workflow has been tested.

## Important Files

Project docs:

- `README.md`
- `docs/session-handoff.md`
- `docs/store-release.md`
- `docs/reviewer-testing.md`
- `docs/stripe-billing.md`
- `docs/voice-accuracy-testing.md`
- `docs/store-listing-draft.md`

Billing:

- `supabase/functions/_shared/billing.ts`
- `supabase/functions/create-checkout-session/index.ts`
- `supabase/functions/create-portal-session/index.ts`
- `supabase/functions/cancel-subscription/index.ts`
- `supabase/functions/stripe-webhook/index.ts`
- `supabase/migrations/20260613_stripe_billing_hardening.sql`
- `scripts/verify-stripe-billing.mjs`

Native:

- `capacitor.config.json`
- `native/shared/release.json`
- `native/README.md`
- `native/android/README.md`
- `native/ios/capacitor.config.template.json`
- `android/`
- `ios/`
- `scripts/sync-native-config.mjs`
- `scripts/native-store-doctor.mjs`

Voice:

- `src/lib/LiveVoiceLogger.svelte`
- `src/lib/VoiceAccuracyHarness.svelte`
- `src/lib/on-device-speech.js`
- `src/lib/voice-log-config.js`
- `src/lib/voice-log-parser.js`
- `src/lib/voice-log-parser.test.js`
- `src/routes/app/voice-test/+page.svelte`
- `src/routes/app/voice-test/+page.js`

Core app:

- `src/lib/Match.svelte`
- `src/lib/Squad.svelte`
- `src/lib/History.svelte`
- `src/lib/PlayerStats.svelte`
- `src/lib/TeamStats.svelte`
- `src/lib/Timeline.svelte`
- `src/lib/Insights.svelte`
- `src/lib/StatTargets.svelte`
- `src/lib/Settings.svelte`
- `src/lib/db.js`
- `src/lib/sync.js`
- `src/lib/entitlements.js`
- `src/lib/subscription-store.js`

Store/reviewer:

- `scripts/verify-store-release.mjs`
- `scripts/seed-reviewer-account.mjs`
- `scripts/verify-reviewer-account.mjs`
- `docs/reviewer-testing.md`
- `docs/store-release.md`

## Environment Variables

Common local and deployment variables:

```sh
PUBLIC_SUPABASE_URL=https://syikhsgovqogzkmmhuis.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
OPENAI_API_KEY=your_openai_server_key
SIDELINE_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe
SIDELINE_ANSWER_MODEL=gpt-4o-mini
STRIPE_SECRET_KEY=your_stripe_test_or_live_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_signing_secret
STRIPE_PORTAL_CONFIGURATION_ID=your_stripe_customer_portal_configuration_id
APP_URL=https://www.pitchnote.ie
PUBLIC_STORE_BUILD=web
PUBLIC_API_BASE_URL=
```

Important notes:

- Do not expose OpenAI keys as public variables.
- Live match voice logging does not need OpenAI.
- Optional Sideline AI routes use OpenAI server-side only.
- `PUBLIC_API_BASE_URL` is normally blank for the web app.
- For a packaged native/static shell that needs production server routes, set `PUBLIC_API_BASE_URL=https://www.pitchnote.ie`.

## Recommended Next Commit Shape

Given the current repo state, a clean path would be:

1. Keep the two existing commits on `main` as the Stripe and voice base.
2. Commit the field-test harness/docs as a separate commit:

```text
Prepare voice logging field-test harness
```

3. Commit any Android physical-device documentation updates separately if the device test changes docs.
4. Push to `origin/main` only after deciding the two unpushed commits are acceptable as a pair.

Do not commit generated APKs, AABs, keystores, signing files, or local secrets.

## Final Practical Read

The app is no longer a rough prototype. It has the main product workflows, data model, billing model, native wrappers, release docs, and automated checks expected of a serious pre-release app. The remaining work is less about inventing the product and more about proving it in the real deployment environment:

- prove billing against the live Supabase/Stripe setup
- prove native store-safe behavior on real devices
- prove voice logging on a real pitch
- finish signing and store submission assets
- keep `main` clean and release-focused

The biggest single unknown is not whether the parser code runs. It does. The unknown is whether real offline STT on actual phones is accurate enough in match conditions. That needs field data before the feature is treated as ready.
