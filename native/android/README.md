# Android Store Wrapper

Use a Trusted Web Activity for the first Google Play release.

## Fixed Values

- Package name: `ie.pitchnote.app`
- Launch URL: `https://www.pitchnote.ie/?store_build=android`
- Web host: `www.pitchnote.ie`
- Wrapper type: Trusted Web Activity

## Build Order

1. Confirm production is deployed from `main`.
2. Install local prerequisites:
   - JDK 17, or allow Bubblewrap to install its managed JDK when prompted.
   - Android Studio / Android SDK command-line tools.
3. Run `npm run native:doctor` and resolve Android blockers.
4. Generate the TWA project:

   ```sh
   npm run native:android:init
   ```

5. Review the generated `native/android/twa-project/twa-manifest.json` against `native/android/twa-manifest.template.json`.
6. Build a real Android App Bundle (`.aab`) with `npm run native:android:build`.
7. Get the final Play App Signing SHA-256 fingerprint.
8. Add `/.well-known/assetlinks.json` to the web app using the real package name and SHA-256 fingerprint.
9. Rebuild/redeploy production, then verify the TWA opens without a browser address bar.
10. Complete the Play Console Data Safety form.

Do not commit a placeholder `assetlinks.json`. A wrong fingerprint will fail Digital Asset Links verification and can make the release harder to diagnose.

Do not commit local keystores, `.aab`, or `.apk` artifacts. Root `.gitignore` excludes native signing keys and build outputs.

## Required Review URLs

- Privacy: `https://www.pitchnote.ie/privacy`
- Support: `https://www.pitchnote.ie/support`
- Account deletion: `https://www.pitchnote.ie/account/delete`
