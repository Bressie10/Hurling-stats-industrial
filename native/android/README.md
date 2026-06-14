# Android Store Wrapper

Use a Capacitor Android wrapper for the first Google Play release so live voice logging can use the native on-device speech recognizer.

## Fixed Values

- Package name: `ie.pitchnote.app`
- Launch URL: `https://www.pitchnote.ie/?store_build=android`
- Web host: `www.pitchnote.ie`
- Wrapper type: Capacitor Android

## Build Order

1. Confirm production is deployed from `main`.
2. Install local prerequisites:
   - JDK 17.
   - Android Studio / Android SDK command-line tools.
3. Run `npm run native:doctor` and resolve Android blockers.
4. Generate the Capacitor Android project if `android/` does not already exist:

   ```sh
   npm run native:android:init
   ```

5. After web changes, run `npm run native:android:sync`.
6. Build a debug wrapper locally with `npm run native:android:build`, or create a signed release/App Bundle from Android Studio.
7. Test on a real Android device and confirm on-device voice logging works with airplane mode enabled after the language model is available.
8. Complete the Play Console Data Safety form.

Do not commit local keystores, `.aab`, or `.apk` artifacts. Root `.gitignore` excludes native signing keys and build outputs.

## Required Review URLs

- Privacy: `https://www.pitchnote.ie/privacy`
- Support: `https://www.pitchnote.ie/support`
- Account deletion: `https://www.pitchnote.ie/account/delete`
