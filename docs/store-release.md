# Store Release Checklist

Last updated: 2026-06-18

This checklist is for Apple App Store and Google Play release work. PWABuilder optional manifest warnings are not the release target.

## Current Release Strategy

- Canonical production URL: `https://www.pitchnote.ie/`. Keep release config pointed at this intended domain even before the domain is purchased; `NXDOMAIN` is expected until DNS/hosting is set up.
- Deployment branch: `main`. Do not push release or PWA deployment work to `Voice-Changes`.
- Native wrapper configuration lives in `native/`, with generated Capacitor projects under `ios/` and `android/`.
- Use `native/shared/release.json` as the single source for app IDs, launch URLs, review URLs, and platform choices.
- Use `npm run native:config:check` and `npm run native:doctor` before generating or signing native projects.
- Reviewer account setup and test steps live in `docs/reviewer-testing.md`.
- Voice accuracy field testing lives in `docs/voice-accuracy-testing.md`.
- Store listing and release-note draft copy lives in `docs/store-listing-draft.md`.
- Payment strategy for launch is Stripe-first on the web, with native apps acting as free companion clients:
  - paid signup and plan management stay on `https://www.pitchnote.ie/`
  - native users can sign in, create free accounts, log matches, sync, and use features their account already has
  - free accounts can save 2 finished matches; the third finished-match save is blocked while drafts remain local, and Personal Pro and higher unlock unlimited history and analytics
  - native store builds must not show Stripe checkout, upgrade buttons, external payment calls to action, or Stripe portal management
  - account deletion still calls the backend cancellation function before deleting the account so web-billed users are not left with future Stripe renewals
- Store-safe runtime mode is controlled by:
  - `PUBLIC_STORE_BUILD=ios`
  - `PUBLIC_STORE_BUILD=android`
  - launch query fallback: `https://www.pitchnote.ie/?store_build=ios` or `https://www.pitchnote.ie/?store_build=android`
- The query fallback persists in `localStorage` under `pitchnote-store-build` so later navigation remains store-safe.
- `PUBLIC_API_BASE_URL` is normally blank for the web app. Native store sync scripts set `PUBLIC_API_BASE_URL=https://www.pitchnote.ie` so packaged local assets can call production server endpoints. Live voice logging does not call cloud speech APIs.
- Run `npm run store:check` locally before native wrapper work. The Capacitor config should package local web assets by default and omit `server.url`.
- Run `npm run release:check` before release-critical local work. It chains unit tests, voice parser smoke, static store checks, native config checks, native doctor, and native store-mode smoke checks.
- Before store submission, run `npm run native:config:check`, `npm run native:ios:sync` or `npm run native:android:sync`, then `npm run store:check`.
- `npm run release:check:live` is required before submission, but as of 2026-06-18 `whois pitchnote.ie` returns `Not found` and `pitchnote.ie` / `www.pitchnote.ie` resolve as `NXDOMAIN`; register or activate the domain, configure DNS/hosting, then rerun the live check.
- Run `npm run test`, `npm run lint`, and `npm run format:check` before release-critical pushes.
- Run `npm run billing:check` after Stripe product, price, portal, or webhook changes.
- Apply and verify the team-scoped data/RLS migrations before relying on multi-team cloud sync or live sharing in production:
  `supabase/migrations/20260617000200_team_scoped_data_and_rls.sql`, then `supabase/migrations/20260617000300_team_scoped_policy_reset.sql`.
- Run `npm run team-scope:check:live` after applying those migrations; it creates temporary Supabase users/rows, verifies team-scoped RLS through authenticated anon clients, and cleans up.
- Run `npm run account:delete:check:live` after account-deletion RPC changes; this creates temporary target/control accounts, verifies `delete_own_account` removes only the authenticated target account graph, confirms anonymous RPC access fails, and cleans up.
- Apply release-required Supabase SQL with `npm run supabase:migration:release-required` when `SUPABASE_DB_URL` is set, or paste the three SQL files into Supabase in this order: `20260617000200_team_scoped_data_and_rls.sql`, `20260617000300_team_scoped_policy_reset.sql`, then `20260618_free_match_quota.sql`.
- Run `npm run free-quota:check:live` after applying the free-quota migration; it verifies a free user is blocked on the third cloud match and a club-entitled coach is not blocked.
- Current Supabase verification: `npm run store:verify-reviewer` and `npm run account:delete:check:live` passed against the configured project on 2026-06-18. Account deletion passed after applying `supabase/migrations/20260617000100_account_deletion_rpc_auth_guard.sql` through the Supabase SQL Editor. The updated `npm run team-scope:check:live` now reaches Supabase but fails because live `matches` does not accept `onConflict=id,user_id`; run `npm run supabase:migration:release-required` or paste the three SQL files in order, then rerun `npm run team-scope:check:live` and `npm run free-quota:check:live`.
- Use `npm run voice:analyze -- path/to/voice-samples.csv` after flagged `/app/voice-test` field sessions. The default pass bar is 50 reviewed samples, 85% correct first try, and no more than 10% re-attempts.
- `npm run store:check` includes the Settings native-store guard so native builds keep checkout/pricing/portal billing UI hidden while account deletion still cancels any existing web subscription server-side before deleting the account.
- Use `npm run store:seed-reviewer` to create or update the seeded store reviewer account once a Supabase service-role key is available locally.
- Use `npm run store:verify-reviewer` after seeding or changing the reviewer password; it signs in through the public Supabase auth/RLS path and checks the seeded squad/match rows without printing the password.

## Public URLs Required For Review

- Privacy policy: `https://www.pitchnote.ie/privacy`
- Terms: `https://www.pitchnote.ie/terms`
- Support: `https://www.pitchnote.ie/support`
- Account deletion: `https://www.pitchnote.ie/account/delete`

Support mailbox: `support@pitchnote.ie`. Configure Cloudflare Email Routing for `pitchnote.ie` and verify external delivery before entering store metadata. `contact@pitchnote.ie` can remain an optional alias if useful.

## Android / Google Play

- Package name: `ie.pitchnote.app`
- Recommended package type: Capacitor Android wrapper
- Launch URL: `https://www.pitchnote.ie/?store_build=android`
- Generated project: `android/`
- Required before Play testing:
  - local JDK 21 or newer
  - Android Studio / Android SDK command-line tools
  - Google Play developer account
  - app signing key or Play App Signing certificate fingerprint
  - Android App Bundle (`.aab`)
  - Data Safety form matching Supabase, local storage, Stripe web billing, on-device live voice logging, and optional Sideline AI processing
  - account deletion URL entered in Play Console
- Do not commit local keystores, `.aab`, or `.apk` artifacts.
- Local debug verification:
  - `npm run native:android:build` passed on 2026-06-18 after the Gradle helper discovered local JDK 21 and `/Users/ultanbreslin/Library/Android/sdk` without manual shell exports.
  - `app-debug.apk` installed and launched on the `Pitchnote_API_36` emulator.
  - Android system recognizer resolved to `com.google.android.tts` and launched in airplane mode with `PREFER_OFFLINE=true`; real microphone/offline-model accuracy still needs a physical Android device test.

## iOS / App Store

- Bundle ID: `ie.pitchnote.app`
- Recommended shell: Capacitor iOS wrapper
- Initial URL: `https://www.pitchnote.ie/?store_build=ios`
- Release reference: `native/ios/capacitor.config.template.json`
- Current status:
  - Full Xcode 26.5 is installed and selected.
  - Capacitor iOS project has been generated under `ios/`.
  - `npm run native:ios:sync` has copied the store-mode production web build into the wrapper.
  - PitchNote app icon and launch splash have replaced the Capacitor defaults.
  - `NSMicrophoneUsageDescription` and `NSSpeechRecognitionUsageDescription` are present for on-device voice logging.
  - Unsigned simulator build succeeds.
  - Manual launch in the iPhone 17 simulator succeeds.
  - A signed Debug build for a paired iPhone 12 mini succeeds with Apple Development signing.
  - The synced Debug build installs on the paired iPhone through `xcrun devicectl device install app`.
  - Automated `devicectl` launch currently times out waiting for CoreDeviceService; launch and voice QA still need a manual device pass.
- Required before TestFlight:
  - App Store Connect app record
  - signed archive uploaded from Xcode
  - privacy policy URL in App Store Connect
  - App Privacy answers matching account data, match/squad data, on-device live voice logging, optional Sideline AI processing, cloud sync, and support diagnostics
  - reviewer account with seeded data

## Native Review Test Scenarios

- Seed and sign in with the reviewer account documented in `docs/reviewer-testing.md`.
- Run `npm run store:verify-reviewer` before manual browser or device checks.
- Run the automated sync/outbox regression tests with `npm run test`.
- Create a free account from the native build.
- Confirm the free account can use Match, Squad, Settings, cloud sync, and up to 2 saved matches.
- Confirm a free account cannot save a third finished match unless an older match is deleted or the account has Pro access.
- Confirm Player Stats, Team Stats, Timeline, Insights, Targets, and older History are locked for Free accounts.
- Log a match online, close/reopen, and confirm the match remains.
- Log a match while offline, reconnect, tap Sync, and confirm cloud restore on another session.
- Confirm locked Pro/Club/Club Pro features show entitlement-only messaging and no purchase buttons.
- Confirm `/pricing` in store mode does not show prices, upgrade CTAs, Stripe checkout, or external payment links.
- Confirm Settings account deletion is visible and works.
- Confirm Settings account deletion in native store mode does not open Stripe, link to Stripe, or show web billing controls, while still cancelling any existing web subscription server-side before deletion.
- Confirm personal data and each active team keep separate local squad, draft, match history, and cloud sync records.
- Confirm team members can read only their own user-owned match/squad cloud rows and only teams/live sessions they can access through team membership or club-admin rights.
- Confirm microphone permission and on-device live voice logging on real iOS and Android devices.
- In a deliberately flagged field-test build (`PUBLIC_ENABLE_VOICE_TEST=1`), confirm `/app/voice-test` captures native STT samples, records STT alternatives/diagnostics/match source in CSV, and passes the Android offline speech model check documented in `docs/voice-accuracy-testing.md`.
- Confirm legal/support/delete pages are reachable from the footer.
