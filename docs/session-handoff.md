# Session Handoff

Last updated: 2026-06-18

## Project State

- Repository: `Hurling-stats-industrial`
- Local workspace: `/Users/ultanbreslin/Downloads/Hurling-stats-industrial 16.30.38`
- `main` is now the approved integration/deployment target and is connected to Vercel.
- Do not push this work to `Voice-Changes`; that branch is no longer the safe target.
- `app-development` is still the current GitHub Pages preview branch unless the workflow is changed.
- Local `main` is ahead of `origin/main` by the Stripe billing and on-device voice commits. There are also substantial uncommitted changes in this workspace, including team-scoped data/RLS work, native config/tooling updates, voice accuracy harness work, and documentation updates. Use `git status --short` before editing and do not assume a clean tree.
- Current stage: iOS native wrapper has been generated, synced, branded, verified with a simulator build, and manually launched in the iPhone 17 simulator. Android Capacitor wrapper generation exists, local debug build/emulator install/emulator launch have passed, and a physical Android airplane-mode microphone test remains required. The app is PitchNote at `pitchnote.ie`; support email is `support@pitchnote.ie`. Stripe-first web billing is the launch payment path, with native apps as free companion clients.
- Capacitor now packages local web assets by default and omits `server.url`. Native sync scripts set `PUBLIC_API_BASE_URL=https://www.pitchnote.ie` so packaged builds can still call production server endpoints when needed.
- Because the Vercel build keeps prerendered HTML outside Capacitor's `webDir`, `npm run native:ios:sync` and `npm run native:android:sync` now run `scripts/prepare-capacitor-webdir.mjs` after `npm run build`. That script copies `.svelte-kit/output/prerendered/pages/index.html` into `.svelte-kit/output/client/index.html` and writes `_app/env.js` so local bundled Capacitor builds can start without a remote `server.url`.
- Live voice logging v1 writes only stat types present in the default app schema: Point, Goal, Wide, Free Won, Turnover Lost, and Yellow Card. It now handles jersey numbers, number words, roster names, fuzzy names, and native STT alternatives. Voice-logged Point/Goal/Wide events can offer optional post-log pitch location when pitch tracking is enabled. `45`, `Sideline`, `Black Card`, and red cards remain tap-only.

## URLs

- Production app: `https://www.pitchnote.ie/`
- iOS wrapper launch URL: `https://www.pitchnote.ie/?store_build=ios`
- Android wrapper launch URL: `https://www.pitchnote.ie/?store_build=android`
- GitHub Pages preview for PWABuilder checks:

`https://bressie10.github.io/Hurling-stats-industrial/`

PWABuilder optional warnings are not the release target. The release target is Apple App Store and Google Play.

## Already Done

- Earlier voice command work and parser improvements were kept off `main`; new approved deployment work can now go to `main`.
- GitHub Pages deployment was set up from `app-development`.
- GitHub Pages asset paths were fixed so logos and icons load correctly.
- PWABuilder manifest polish was added:
  - `lang`
  - `dir`
  - `display_override`
  - screenshots
  - shortcuts
  - launch handling
  - relative app paths for GitHub Pages
- Service worker detection was fixed for PWABuilder using `static/pwabuilder-sw.js`.
- The app registers the service worker explicitly from `src/app.html`.
- Progressive Background Sync was added for the existing IndexedDB outbox:
  - local mutations still drain immediately in the foreground
  - supported browsers register one-shot Background Sync with `pitchnote-sync-outbox`
  - the service worker can ask visible clients to drain or directly drain with a short-lived Supabase access token
  - unsupported browsers keep the existing app-start, online, foreground, and manual Sync fallback paths
- Store release readiness mode was implemented and pushed to `main`:
  - `src/lib/config.js` supports `PUBLIC_STORE_BUILD=ios`, `PUBLIC_STORE_BUILD=android`, and the `store_build` launch query param
  - native store mode persists in `localStorage` under `pitchnote-store-build`
  - `Upgrade.svelte`, `PricingPage.svelte`, and `History.svelte` hide prices, Stripe checkout, upgrade buttons, and web purchase CTAs in native store mode
  - marketing/docs/install/footer navigation avoids PWA-install and "no app store" copy inside native store mode
  - public privacy, terms, support, and account deletion routes were added
  - `docs/store-release.md` tracks the App Store / Google Play release checklist
  - `README.md` and this handoff document record that `main` is the deployment branch and `Voice-Changes` must not be used
- Native release scaffolding was added:
  - `native/shared/release.json` records app IDs, platform launch URLs, public review URLs, and support email
  - generated `android/` project is the Android Capacitor release reference
  - `native/ios/capacitor.config.template.json` is the iOS Capacitor release reference
  - `scripts/verify-store-release.mjs` powers `npm run store:check` and `npm run store:check:live`
  - `src/lib/api.js` adds `PUBLIC_API_BASE_URL` support for native/static shells that need production voice endpoints
- Service worker registration path was fixed and pushed to `main`:
  - `src/app.html` no longer registers `./pwabuilder-sw.js` relative to the current route
  - app routes such as `/app/match` now resolve the worker from the manifest location, so registration targets `/pwabuilder-sw.js`
  - service worker registration and legacy `/sw.js` cleanup failures are caught to avoid unhandled promise rejections
  - `scripts/verify-store-release.mjs` now checks this does not regress
- Native Settings hardening and cleanup scan were completed:
  - `src/lib/Settings.svelte` imports the native store-build guard
  - native store builds still hide Stripe checkout, pricing, portal, and billing-management UI
  - Settings account deletion calls the backend cancellation function before server deletion so web-billed users are not left with future renewals after deleting from native
  - Settings account deletion copy states that purchases and plan changes are not available inside the native build
  - stale unused Settings subscription CSS and an unused subscription import were removed
  - `scripts/verify-store-release.mjs` now includes `Settings.svelte` in the native store-mode checks
  - `src/lib/LiveViewer.svelte` no longer captures initial match data in a Svelte state initializer
  - `src/routes/app/live/+page.svelte` now styles the actual live loading screen selector
- Support email setup was completed in code/docs:
  - user-facing contact links now use `support@pitchnote.ie`
  - `native/shared/release.json` now uses `support@pitchnote.ie`
  - Cloudflare Email Routing must be configured and externally tested for `pitchnote.ie`
  - the old misspelled domain was removed from user-facing docs
- Reviewer-account release tooling was added:
  - `scripts/seed-reviewer-account.mjs` creates/confirms a Supabase Auth reviewer user, seeds profile/subscription records, and seeds cloud squad/match rows
  - `npm run store:seed-reviewer` runs the script
  - `scripts/verify-reviewer-account.mjs` verifies reviewer sign-in through the public Supabase anon/RLS path and checks seeded squad/match rows
  - `npm run store:verify-reviewer` runs the verification without printing the password
  - `docs/reviewer-testing.md` documents the reviewer credentials process and real-device store-mode checks
  - `npm run store:check` verifies the reviewer seed/verify scripts and guide exist
- Quality hardening was started after the reviewer login was verified:
  - Vitest and `fake-indexeddb` were added for regression tests
  - `src/lib/db.test.js` covers match/squad outbox writes, retry backoff, completed mutation removal, and full local wipe behavior
  - `src/lib/sync.test.js` covers cloud restore, stale-cloud protection, pending-delete skip, numeric ID preservation, and outbox drain before pull
  - ESLint and Prettier config were added with a conservative baseline that avoids app-wide formatting churn
  - `npm run test`, `npm run lint`, `npm run format`, and `npm run format:check` are available
  - root Svelte layouts now use `{@render children()}` instead of deprecated `<slot>`
  - stale tracked `codex-fix-prompt.md` was removed from the release tree
- Native wrapper tooling was started:
  - Capacitor 8 was added as local native tooling
  - `capacitor.config.json` is the active iOS Capacitor config generated from `native/shared/release.json`
  - `npm run native:config` and `npm run native:config:check` keep native config in sync
  - `npm run native:doctor` checks local JDK, Android SDK, Xcode, and generated native project status
  - `npm run native:ios:add`, `npm run native:ios:sync`, and `npm run native:ios:open` are available once full Xcode is installed/selected
  - `npm run native:android:init`, `npm run native:android:sync`, `npm run native:android:open`, and `npm run native:android:build` are available once JDK/Android SDK setup is complete
  - root `.gitignore` now blocks native signing keys and Android/iOS build artifacts
- iOS wrapper generation was completed locally:
  - Full Xcode 26.5 is installed and selected at `/Applications/Xcode.app/Contents/Developer`
  - `npm run native:ios:add` generated the Capacitor project under `ios/`
  - `npm run native:ios:sync` copied a fresh `PUBLIC_STORE_BUILD=ios` production web build into the iOS wrapper
  - iOS bundle ID is `ie.pitchnote.app`
  - the default Capacitor app icon and splash image were replaced with branded PitchNote assets
  - unsigned simulator build succeeds; Apple signing/team setup is the next iOS blocker
  - Xcode recommended settings were applied after the project opened successfully
  - manual launch in the iPhone 17 simulator works
- Stripe-first subscription/paywall planning is now the launch direction:
  - web Stripe remains the paid signup and plan-management channel
  - native iOS/Android builds remain free companion clients with no Stripe checkout, prices, external payment CTAs, or web billing links
  - the launch free tier is capped at 2 saved finished matches; drafts still work locally, and a third finished-match save is blocked until an older match is deleted or the account has Pro access
  - Personal Pro unlocks unlimited history, analytics routes, Stat Targets, and PDF reports
  - Club unlocks team/club management and join codes
  - Club Pro unlocks live match sharing/viewer mode
- Stripe test-mode billing resources are configured for PitchNote lookup keys:
  - `pitchnote_personal_monthly`: Personal Pro, EUR 7.99/month
  - `pitchnote_club_monthly`: Club, EUR 15/month
  - `pitchnote_club_pro_monthly`: Club Pro, EUR 25/month
  - webhook endpoint includes checkout completion, subscription created/updated/deleted, and invoice payment success/failure events
  - `docs/stripe-billing.md` documents the required Supabase Edge Function secrets and `npm run billing:check` verification
- Team-scoped local data and cloud sync are in progress/current in this workspace:
  - `src/lib/team-scope.js` centralizes the personal/team scope and `active-team-id` localStorage key.
  - IndexedDB is bumped to v3 with `squad_by_team`; personal legacy squad rows can still load through the old `squad` store.
  - Draft IDs are `draft` for personal scope and `draft:<teamScope>` for team scope.
  - Match and squad sync mutations carry `teamScope` and `team_id`.
  - Supabase migration `20260617000200_team_scoped_data_and_rls.sql` adds `team_id` to `matches` and `squad`, changes match cloud conflicts to `(id, user_id)`, adds membership-aware helper functions, tightens `teams`/`live_sessions` RLS, and validates that user-owned match/squad rows are tagged only to teams the user can access.
  - Supabase migration `20260617000300_team_scoped_policy_reset.sql` must run after it; it removes stale policy variants on the affected tables and recreates the intended policy set.
  - Supabase migration `20260618_free_match_quota.sql` adds a database trigger for the free 2-match cap so direct Supabase writes and background sync upserts cannot bypass the local app check. Apply the ordered release SQL with `npm run supabase:migration:release-required` when `SUPABASE_DB_URL` is set, or paste the three SQL files into Supabase in order.
- Voice parser accuracy was tightened:
  - `parseVoiceLog` accepts native STT alternatives and returns `matchSource`/`needsLocation`.
  - Number-word and jersey-number commands such as `point 11`, `goal number fourteen`, and `wide jersey seven` are covered by tests.
  - `/app/voice-test` CSV includes STT confidence, alternatives, recognizer diagnostics, and match source.

## Important Files

- `.github/workflows/deploy-app-development-pages.yml`
- `svelte.config.js`
- `src/app.html`
- `src/service-worker.js`
- `src/lib/sync.js`
- `src/lib/sync-payloads.js`
- `src/lib/config.js`
- `src/lib/api.js`
- `src/lib/Upgrade.svelte`
- `src/lib/PricingPage.svelte`
- `src/lib/History.svelte`
- `src/lib/Settings.svelte`
- `src/lib/LegalPage.svelte`
- `src/routes/privacy/+page.svelte`
- `src/routes/terms/+page.svelte`
- `src/routes/support/+page.svelte`
- `src/routes/account/delete/+page.svelte`
- `docs/store-release.md`
- `docs/reviewer-testing.md`
- `docs/voice-accuracy-testing.md`
- `native/shared/release.json`
- `native/android/twa-manifest.template.json`
- `native/ios/capacitor.config.template.json`
- `scripts/verify-store-release.mjs`
- `scripts/seed-reviewer-account.mjs`
- `scripts/verify-reviewer-account.mjs`
- `src/lib/db.test.js`
- `src/lib/sync.test.js`
- `eslint.config.js`
- `prettier.config.js`
- `capacitor.config.json`
- `scripts/sync-native-config.mjs`
- `scripts/native-store-doctor.mjs`
- `static/manifest.json`
- `static/pwabuilder-sw.js`
- `scripts/generate-pwa-screenshots.mjs`

## Known Verification

- `npm run build` passes with `GITHUB_PAGES=true`.
- `npm run smoke:voice` passed.
- After Background Sync work, `npm run smoke:voice` passed and `GITHUB_PAGES=true PUBLIC_SUPABASE_URL=https://example.supabase.co PUBLIC_SUPABASE_ANON_KEY=dummy OPENAI_API_KEY=dummy npm run build` passed.
- The generated GitHub Pages worker contains the `pitchnote-sync-outbox` handler and is still imported by `pwabuilder-sw.js`.
- GitHub Pages preview is live.
- Manifest, logos, screenshots, `service-worker.js`, and `pwabuilder-sw.js` returned `200` on the live preview.
- Store-release verification on 2026-06-12:
  - `npm run smoke:voice` passed.
  - `git diff --check` passed before commit.
  - `GITHUB_PAGES=true PUBLIC_STORE_BUILD=ios PUBLIC_SUPABASE_URL=https://example.supabase.co PUBLIC_SUPABASE_ANON_KEY=dummy OPENAI_API_KEY=dummy npm run build` passed.
  - `PUBLIC_SUPABASE_URL=https://example.supabase.co PUBLIC_SUPABASE_ANON_KEY=dummy OPENAI_API_KEY=dummy npm run build` passed for Vercel-style production output.
  - `origin/main` was fast-forwarded through `ad5c954`, `d985470`, and `55705c6`.
  - Production URLs returned `200`: `/privacy`, `/terms`, `/support`, `/account/delete`.
- Native scaffold verification on 2026-06-12:
  - `npm run store:check` passed. At that point Android was still being evaluated as a TWA, so the missing `assetlinks.json` warning was expected.
  - `npm run store:check:live` passed against `https://www.pitchnote.ie/` at that time.
  - `npm run smoke:voice` passed.
  - Vercel-style `npm run build` passed.
- Current live DNS status on 2026-06-18:
  - `npm run store:check:live` fails on live URL fetches.
  - `dig pitchnote.ie A` and `dig www.pitchnote.ie A` return `NXDOMAIN`.
  - `whois pitchnote.ie` returns `Not found`.
  - This is expected while the domain is not yet bought/activated. Keep release config on `https://www.pitchnote.ie/`, then unblock production/live store verification by registering or activating the domain, configuring DNS/hosting, and rerunning the live check.
- Service worker verification on 2026-06-12:
  - Production `/pwabuilder-sw.js` returns `200`.
  - Production `/app/match` HTML contains the corrected worker registration.
  - `/app/pwabuilder-sw.js` still returns `404`, which is expected; the app should no longer request that route.
- Cleanup verification on 2026-06-12:
  - `npm run store:check` passed with the then-expected TWA `assetlinks.json` warning.
  - `npm run smoke:voice` passed.
  - `git diff --check` passed.
  - `PUBLIC_SUPABASE_URL=https://example.supabase.co PUBLIC_SUPABASE_ANON_KEY=dummy OPENAI_API_KEY=dummy npm run build` passed.
  - The build still has pre-existing cleanup warnings: deprecated Svelte `<slot>` usage in layouts, unused CSS in large components such as `Match.svelte` and `Landing.svelte`, a LightningCSS warning for `:global(html:has(.lp))`, and a large `Match.svelte` client chunk.
- Reviewer-account verification on 2026-06-13:
  - Real seed completed for `reviewer@pitchnote.ie`.
  - Direct Supabase auth with the password in local `.env` passed for user `b01a21a4-e1a4-4992-9f72-82ed47cefb67`.
  - Re-verified on 2026-06-17: `npm run store:seed-reviewer` and `npm run store:verify-reviewer` passed for `reviewer@pitchnote.ie`; the public anon/RLS path sees a `personal / active` subscription, 25 squad rows, and 3 match rows.
  - If browser login fails after this, first suspect wrong email, copied password whitespace, a stale saved password, or a cached session. Use a private window at `https://www.pitchnote.ie/?store_build=ios` and confirm the email is `reviewer@pitchnote.ie` with no extra `s`.
- Quality-hardening verification on 2026-06-13:
  - `npm run test` passed: 11 sync/outbox regression tests.
  - `npm run lint` passed with warnings only; existing unused variables remain as cleanup items.
  - `npm run format:check` passed for the new formatting baseline.
  - `npm run store:check` passed with the then-expected TWA `assetlinks.json` warning.
- Native tooling verification on 2026-06-13:
  - `npm run native:config:check` passed.
  - Full Xcode is now selected and detected correctly: Xcode 26.5, build 17F42.
  - `npm run native:ios:add` passed and generated `ios/`.
  - `npm run native:ios:sync` passed after a production store-mode web build.
  - `xcodebuild -list -project ios/App/App.xcodeproj` resolved Capacitor Swift Package Manager dependencies and found the `App` scheme.
  - Unsigned simulator build passed with `CODE_SIGNING_ALLOWED=NO`.
  - Manual Xcode run in the iPhone 17 simulator passed.
  - At that point, `npm run native:doctor` reported Android local-machine blockers when no JDK or Android SDK command-line tools were available; Android prerequisites were later installed for the 2026-06-14 debug build.
- Voice accuracy readiness on 2026-06-14:
  - `/app/voice-test` is the local field-test harness for collecting native STT or typed samples, annotating correctness, and exporting CSV summaries. It is hidden by default in production and native store builds; set `PUBLIC_ENABLE_VOICE_TEST=1` only for deliberate field-test builds.
  - `docs/voice-accuracy-testing.md` documents the real-pitch test process, Android offline speech model check, and fallback behavior when offline STT is unavailable.
  - Local Android prerequisites were installed: JDK 21, Android SDK platform/build tools, platform-tools, emulator, and the Android 36 Google APIs ARM system image.
  - `npm run native:android:build` passed with JDK 21. The debug APK installed and launched on the `Pitchnote_API_36` emulator.
  - The emulator resolves a Google TTS speech recognizer and can launch the system recognizer in airplane mode with `PREFER_OFFLINE=true`, but that does not prove real microphone accuracy.
  - Android voice support must not be called field-ready until offline recognition is verified in airplane mode with real microphone input on a physical Android device.
- Current non-domain verification on 2026-06-18 after free-tier quota, billing, live-sharing, and native checks:
  - `npm run release:check` passed.
  - `npm run test` passed: 36 tests across 5 files.
  - `npm run smoke:voice` passed: 48 checks.
  - `npm run lint` passed with no output.
  - `npm run format:check` passed.
  - `npm run store:check` passed.
  - `npm run native:doctor` passed with 0 warnings.
  - `npm run billing:check` passed against Stripe test-mode config.
  - `npm run store:verify-reviewer` passed for `reviewer@pitchnote.ie` with `personal / active`, 25 squad rows, and 3 match rows.
  - Supabase billing function URLs are reachable: checkout/portal/cancel CORS preflight returns `200`, and an unsigned webhook request returns `400` as expected.
  - `npm run team-scope:check:live` passed after fixing the verifier's generated team-code collision.
  - `npm run account:delete:check:live` passed on 2026-06-18 after applying `supabase/migrations/20260617000100_account_deletion_rpc_auth_guard.sql` through the Supabase SQL Editor.
  - `npm run team-scope:check:live` now reaches Supabase but fails because live `matches` does not accept `onConflict=id,user_id`; apply `supabase/migrations/20260617000200_team_scoped_data_and_rls.sql` and `supabase/migrations/20260617000300_team_scoped_policy_reset.sql`, then rerun it.
  - `supabase/migrations/20260618_free_match_quota.sql` and `npm run free-quota:check:live` are now present. Apply the team-scoped migrations first, then apply the free-quota SQL and rerun the free-quota verifier.
  - `npm run store:check:live` still fails because `whois pitchnote.ie` returns `Not found` and the domain resolves as `NXDOMAIN`.
  - Current web build was prepared and synced into the iOS wrapper.
  - `npm run native:ios:sync` passed.
  - Unsigned iOS simulator Debug build passed with `xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug -sdk iphonesimulator -derivedDataPath /private/tmp/pitchnote-ios-derived CODE_SIGNING_ALLOWED=NO build`.
  - Signed Debug build for paired iPhone 12 mini passed with Apple Development signing.
  - Synced Debug build installed on the paired iPhone with `xcrun devicectl device install app`.
  - `xcrun devicectl list devices` currently shows paired iPhone 12 mini available and another iPhone unavailable.
  - Automated `devicectl` launch still times out waiting for CoreDeviceService; manually launch the app on-device or use Xcode Run for the microphone/speech pass.
  - `npm run native:android:build` passed on 2026-06-18 after the Gradle helper discovered local JDK 21 and `/Users/ultanbreslin/Library/Android/sdk` without manual shell exports.
  - `/Users/ultanbreslin/Library/Android/sdk/platform-tools/adb devices` reports no attached Android devices.

## Next Work

Recommended order from here:

1. Apply release-required Supabase SQL with `npm run supabase:migration:release-required` when `SUPABASE_DB_URL` is set, or paste the three SQL files in order, then run `npm run team-scope:check:live` and `npm run free-quota:check:live`.
2. Register or activate `pitchnote.ie`, configure DNS/hosting for `pitchnote.ie` and `www.pitchnote.ie`, then rerun `npm run store:check:live`.
3. Once DNS resolves, run `npm run release:check:live` to combine local release gates, live URL checks, billing config, team-scoped RLS verification, live account-deletion verification, and free-quota verification.
4. Finish and verify the Stripe-first paywall implementation:
   - Free can use Match, Squad, Settings, cloud sync, and 2 saved matches
   - Free sees locked states for Player Stats, Team Stats, Timeline, Insights, Targets, older History, Club controls, and Live sharing
   - Personal/Club/Club Pro unlock the expected tiers
   - native store mode still shows no prices, Stripe checkout, upgrade CTAs, or external payment links
   - native account deletion still cancels existing web billing server-side before deleting the account
5. Add `support@pitchnote.ie` to App Store Connect and Google Play store metadata when those records are created.
6. Run `npm run store:verify-reviewer` after any reviewer password or seed change.
7. Verify the seeded reviewer account on the deployed store-mode URLs, then verify queued offline match/squad mutations drain on the deployed preview/production app.
8. Create a fresh free account from the store-mode app and verify sign-in, offline match logging, on-device voice logging, 2-match cap, sync restore, and account deletion on real devices.
9. Continue iOS physical-device and TestFlight work:
   - run `npm run native:ios:open`
   - manually launch the installed Debug build or use Xcode Run
   - verify microphone and speech permission prompts on-device
   - keep bundle ID as `ie.pitchnote.app`
   - create/register the App Store Connect app record for the same bundle ID
   - archive/upload a TestFlight build
10. Rerun `npm run native:doctor` and resolve any local native-tooling blockers it reports.
11. Continue Android physical-device and Play release work:

- package name `ie.pitchnote.app`
- launch URL `https://www.pitchnote.ie/?store_build=android`
- debug build passes with `npm run native:android:build`
- connect a real Android phone and install `android/app/build/outputs/apk/debug/app-debug.apk`
- generate the real App Bundle (`.aab`) from Android Studio or Gradle once signing is configured

11. Complete App Store Connect and Play Console forms:

- privacy policy URL: `https://www.pitchnote.ie/privacy`
- support URL: `https://www.pitchnote.ie/support`
- account deletion URL: `https://www.pitchnote.ie/account/delete`
- data/privacy answers must mention Supabase account/cloud sync, local device storage, on-device live voice logging, optional OpenAI assistant transcription/answers, and Stripe web billing outside native store builds

12. Confirm store-mode screens do not show prices, Stripe checkout, upgrade CTAs, or external payment links before submission.
13. Continue code cleanup separately from release-critical work:

- remove verified-dead CSS in `Match.svelte`, `Landing.svelte`, `Upgrade.svelte`, `LpFooter.svelte`, and related screens
- reduce current ESLint warnings, especially unused variables in large components
- investigate the `:global(html:has(.lp))` LightningCSS warning
- code-split large app screens, especially `Match.svelte`, after native release blockers are cleared

14. Add Periodic Background Sync for lightweight match/team refresh only after the current sync flow is verified.
15. Consider push notifications after sync reliability is proven.
16. Consider share target later if importing shared notes, files, or match data becomes useful.

Do not add OS notes-app registration unless the product genuinely needs to receive notes from the operating system. It is probably not a good fit for PitchNote.
Do not add placeholder signing files, local keystores, build artifacts, or fake store credentials.

## Resume Prompt

In a new chat, use:

```text
Read docs/session-handoff.md, docs/store-release.md, docs/reviewer-testing.md, and docs/voice-accuracy-testing.md. Main is the approved integration/deployment target, but local `main` is ahead of `origin/main` and the worktree has substantial uncommitted changes, so inspect `git status --short` first. Do not push release/PWA work to Voice-Changes. Current direction is Stripe-first web billing with native iOS/Android as free companion clients. Free is capped at 2 saved matches; Personal unlocks analytics/unlimited history; Club unlocks team management; Club Pro unlocks live sharing. Native builds must not show Stripe checkout, prices, external payment CTAs, or web billing links. iOS and Android now use Capacitor so live voice logging can use on-device speech recognition. Team-scoped data/RLS work is present and `npm run team-scope:check:live` passed on 2026-06-17. Reviewer seeding/verification passed on 2026-06-17; account-deletion live verification passed on 2026-06-18 after the SQL Editor auth-guard migration. The current hard blocker is domain ownership/DNS: `whois pitchnote.ie` returns `Not found` and the domain resolves as `NXDOMAIN`, so `npm run store:check:live` fails until the domain is registered or activated and DNS/hosting is configured. Voice logging supports Point, Goal, Wide, Free Won, Turnover Lost, and Yellow Card with jersey-number/name/STT-alternative matching; 45s, sideline balls, and black/red cards are tap-only. Native Settings billing hardening is done and code/docs use support@pitchnote.ie. Reviewer seed/verify tooling exists, sync/outbox regression tests and lint/format baselines exist, root Svelte layout slots were migrated, and Capacitor/native config scripts exist. Full Xcode is installed/selected, `ios/` has been generated, current web assets were synced into iOS, signed Debug build for the paired iPhone 12 mini passed, and the synced Debug build installed on-device through `devicectl`; automated `devicectl` launch times out, so manually launch or use Xcode Run for iPhone microphone/speech QA. Android debug build now passes with helper-discovered JDK 21 and `/Users/ultanbreslin/Library/Android/sdk`; earlier emulator install and launch passed, but `/Users/ultanbreslin/Library/Android/sdk/platform-tools/adb devices` currently shows no attached Android device, so real physical-device offline microphone testing remains required. Run `npm run release:check` before release-critical work and `npm run release:check:live` after DNS resolves.
```
