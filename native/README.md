# Native Store Release

This directory holds native release configuration and templates. It is not a separate source branch.

## Branch Strategy

- `main` remains the production source of truth.
- Do not create long-lived `ios`, `android`, `apple-store`, or `play-store` branches.
- Use short feature branches for wrapper work, merge to `main`, then tag store submissions.
- Suggested release tags: `store-v1.0.0`, `ios-v1.0.0`, `android-v1.0.0`.

## Platform Launch URLs

- iOS: `https://www.gaastat.com/?store_build=ios`
- Android: `https://www.gaastat.com/?store_build=android`

The web app persists this mode in local storage so navigation remains store-safe after launch.

## Current Release Shape

The first native release is consumption-only/free-account:

- users can sign in
- users can create free accounts
- users can log matches
- users can sync data
- users can use entitlements already attached to their account
- native builds must not show Stripe checkout, Stripe portal links, prices, upgrade buttons, or external purchase CTAs

## Files

- `native/shared/release.json`: single source for store IDs, URLs, and review links
- `native/android/twa-manifest.template.json`: Android TWA release reference
- `native/ios/capacitor.config.template.json`: iOS Capacitor release reference

Run `npm run store:check` before native wrapper work and before store submission.
