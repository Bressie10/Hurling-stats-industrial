# iOS Store Wrapper

Use a Capacitor iOS wrapper for the first App Store release.

## Fixed Values

- Bundle ID: `ie.pitchnote.app`
- Initial URL: `https://www.pitchnote.ie/?store_build=ios`
- Wrapper type: Capacitor iOS

## Build Order

Completed locally:

- Full Xcode 26.5 is installed and selected.
- `npm run native:ios:add` generated `ios/`.
- `npm run native:ios:sync` copied a fresh store-mode web build into the wrapper.
- PitchNote icon and splash assets replaced the default Capacitor assets.
- `NSMicrophoneUsageDescription` and `NSSpeechRecognitionUsageDescription` are present in `ios/App/App/Info.plist`.
- Unsigned simulator build succeeds.
- Manual launch in the iPhone 17 simulator succeeds.

Next build order:

1. Confirm production is deployed from `main`.
2. Run `npm run native:config:check`.
3. Run `npm run native:doctor` and resolve any local native-tooling blockers it reports.
4. After web changes, sync the current web build into the native project:

   ```sh
   npm run native:ios:sync
   ```

5. Open the generated project:

   ```sh
   npm run native:ios:open
   ```

6. Configure the Apple Developer Team and signing in Xcode.
7. Archive and upload a TestFlight build.
8. Test on a real iPhone through TestFlight before App Store submission.
9. Complete App Store Connect privacy answers and reviewer credentials.

The first release should stay consumption-only/free-account inside the native app. Do not add web checkout links, Stripe portals, or external purchase CTAs inside the iOS build.

## Static Packaging Note

The current template packages local web assets and omits `server.url`. Build and sync with:

```sh
npm run native:ios:sync
```

`PUBLIC_API_BASE_URL` keeps optional server features pointed at the production endpoints instead of a local relative `/api` path. Live voice logging uses on-device speech recognition and does not call a cloud transcription endpoint.
