# Store Release Checklist

Last updated: 2026-06-14

This checklist is for Apple App Store and Google Play release work. PWABuilder optional manifest warnings are not the release target.

## Current Release Strategy

- Canonical production URL: `https://www.pitchnote.ie/`
- Deployment branch: `main`. Do not push release or PWA deployment work to `Voice-Changes`.
- Native wrapper configuration lives in `native/`, with generated Capacitor projects under `ios/` and `android/`.
- Use `native/shared/release.json` as the single source for app IDs, launch URLs, review URLs, and platform choices.
- Use `npm run native:config:check` and `npm run native:doctor` before generating or signing native projects.
- Reviewer account setup and test steps live in `docs/reviewer-testing.md`.
- Payment strategy for launch is Stripe-first on the web, with native apps acting as free companion clients:
  - paid signup and plan management stay on `https://www.pitchnote.ie/`
  - native users can sign in, create free accounts, log matches, sync, and use features their account already has
  - free accounts keep 2 saved matches; Personal Pro and higher unlock unlimited history and analytics
  - native store builds must not show Stripe checkout, upgrade buttons, external payment calls to action, or Stripe portal management
- Store-safe runtime mode is controlled by:
  - `PUBLIC_STORE_BUILD=ios`
  - `PUBLIC_STORE_BUILD=android`
  - launch query fallback: `https://www.pitchnote.ie/?store_build=ios` or `https://www.pitchnote.ie/?store_build=android`
- The query fallback persists in `localStorage` under `pitchnote-store-build` so later navigation remains store-safe.
- `PUBLIC_API_BASE_URL` is normally blank. If a native/static shell packages local assets later, set `PUBLIC_API_BASE_URL=https://www.pitchnote.ie` so optional server features call the production endpoints. Live voice logging does not call cloud speech APIs.
- Run `npm run store:check` locally before native wrapper work. Run `npm run store:check:live` before store submission.
- Run `npm run test`, `npm run lint`, and `npm run format:check` before release-critical pushes.
- Run `npm run billing:check` after Stripe product, price, portal, or webhook changes.
- `npm run store:check` includes the Settings native-store guard so Stripe cancellation remains web-only in native builds.
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
  - local JDK 17
  - Android Studio / Android SDK command-line tools
  - Google Play developer account
  - app signing key or Play App Signing certificate fingerprint
  - Android App Bundle (`.aab`)
  - Data Safety form matching Supabase, local storage, Stripe web billing, on-device live voice logging, and optional Sideline AI processing
  - account deletion URL entered in Play Console
- Do not commit local keystores, `.aab`, or `.apk` artifacts.

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
- Required before TestFlight:
  - Apple Developer account
  - Bundle ID and signing team
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
- Confirm Player Stats, Team Stats, Timeline, Insights, Targets, and older History are locked for Free accounts.
- Log a match online, close/reopen, and confirm the match remains.
- Log a match while offline, reconnect, tap Sync, and confirm cloud restore on another session.
- Confirm locked Pro/Club/Club Pro features show entitlement-only messaging and no purchase buttons.
- Confirm `/pricing` in store mode does not show prices, upgrade CTAs, Stripe checkout, or external payment links.
- Confirm Settings account deletion is visible and works.
- Confirm Settings account deletion in native store mode does not open Stripe, link to Stripe, or show web billing controls.
- Confirm microphone permission and on-device live voice logging on real iOS and Android devices.
- Confirm legal/support/delete pages are reachable from the footer.
