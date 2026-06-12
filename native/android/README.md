# Android Store Wrapper

Use a Trusted Web Activity for the first Google Play release.

## Fixed Values

- Package name: `com.gaastat.app`
- Launch URL: `https://www.gaastat.com/?store_build=android`
- Web host: `www.gaastat.com`
- Wrapper type: Trusted Web Activity

## Build Order

1. Confirm production is deployed from `main`.
2. Generate the TWA project with Bubblewrap using `native/android/twa-manifest.template.json` as the release reference.
3. Build a real Android App Bundle (`.aab`).
4. Get the final Play App Signing SHA-256 fingerprint.
5. Add `/.well-known/assetlinks.json` to the web app using the real package name and SHA-256 fingerprint.
6. Rebuild/redeploy production, then verify the TWA opens without a browser address bar.
7. Complete the Play Console Data Safety form.

Do not commit a placeholder `assetlinks.json`. A wrong fingerprint will fail Digital Asset Links verification and can make the release harder to diagnose.

## Required Review URLs

- Privacy: `https://www.gaastat.com/privacy`
- Support: `https://www.gaastat.com/support`
- Account deletion: `https://www.gaastat.com/account/delete`
