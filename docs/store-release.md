# Store Release Checklist

Last updated: 2026-06-12

This checklist is for Apple App Store and Google Play release work. PWABuilder optional manifest warnings are not the release target.

## Current Release Strategy

- Canonical production URL: `https://www.gaastat.com/`
- Deployment branch: `main`. Do not push release or PWA deployment work to `Voice-Changes`.
- First native store release should be consumption-only:
  - users can sign in, create free accounts, log matches, sync, and use features their account already has
  - native store builds must not show Stripe checkout, upgrade buttons, external payment calls to action, or Stripe portal management
- Store-safe runtime mode is controlled by:
  - `PUBLIC_STORE_BUILD=ios`
  - `PUBLIC_STORE_BUILD=android`
  - launch query fallback: `https://www.gaastat.com/?store_build=ios` or `https://www.gaastat.com/?store_build=android`
- The query fallback persists in `localStorage` under `gaastat-store-build` so later navigation remains store-safe.

## Public URLs Required For Review

- Privacy policy: `https://www.gaastat.com/privacy`
- Terms: `https://www.gaastat.com/terms`
- Support: `https://www.gaastat.com/support`
- Account deletion: `https://www.gaastat.com/account/delete`

Before submission, confirm that `contact@gaastatsapp.com` is monitored. If the final support mailbox is different, update `src/lib/LegalPage.svelte`, `src/lib/LpFooter.svelte`, and any store metadata.

## Android / Google Play

- Package name: `com.gaastat.app`
- Recommended package type: Trusted Web Activity
- Launch URL: `https://www.gaastat.com/?store_build=android`
- Required before Play testing:
  - Google Play developer account
  - app signing key or Play App Signing certificate fingerprint
  - `/.well-known/assetlinks.json` generated with the final package name and SHA-256 fingerprint
  - Android App Bundle (`.aab`)
  - Data Safety form matching Supabase, local storage, Stripe web billing, and OpenAI voice processing
  - account deletion URL entered in Play Console
- Do not add a placeholder `assetlinks.json`; the wrong certificate fingerprint will fail TWA verification.

## iOS / App Store

- Bundle ID: `com.gaastat.app`
- Recommended shell: Capacitor iOS wrapper
- Initial URL: `https://www.gaastat.com/?store_build=ios`
- Required before TestFlight:
  - Apple Developer account
  - Bundle ID and signing team
  - app icons and launch screen generated in Xcode
  - microphone usage description for Sideline AI voice capture
  - privacy policy URL in App Store Connect
  - App Privacy answers matching account data, match/squad data, audio transcription, cloud sync, and support diagnostics
  - reviewer account with seeded data

## Native Review Test Scenarios

- Sign in with seeded reviewer account.
- Create a free account from the native build.
- Log a match online, close/reopen, and confirm the match remains.
- Log a match while offline, reconnect, tap Sync, and confirm cloud restore on another session.
- Confirm locked Pro/Club features show entitlement-only messaging and no purchase buttons.
- Confirm `/pricing` in store mode does not show prices, upgrade CTAs, Stripe checkout, or external payment links.
- Confirm Settings account deletion is visible and works.
- Confirm microphone permission and Sideline AI voice capture on real iOS and Android devices.
- Confirm legal/support/delete pages are reachable from the footer.
