# iOS Store Wrapper

Use a Capacitor iOS wrapper for the first App Store release.

## Fixed Values

- Bundle ID: `com.gaastat.app`
- Initial URL: `https://www.gaastat.com/?store_build=ios`
- Wrapper type: Capacitor iOS

## Build Order

Completed locally:

- Full Xcode 26.5 is installed and selected.
- `npm run native:ios:add` generated `ios/`.
- `npm run native:ios:sync` copied a fresh store-mode web build into the wrapper.
- GAAstat icon and splash assets replaced the default Capacitor assets.
- `NSMicrophoneUsageDescription` is present in `ios/App/App/Info.plist`.
- Unsigned simulator build succeeds.

Next build order:

1. Confirm production is deployed from `main`.
2. Run `npm run native:config:check`.
3. Run `npm run native:doctor` and confirm only Android blockers remain.
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

The current template loads the production app URL. If iOS is later changed to package local web assets, build with:

```sh
PUBLIC_STORE_BUILD=ios PUBLIC_API_BASE_URL=https://www.gaastat.com npm run build
```

`PUBLIC_API_BASE_URL` keeps Sideline AI voice calls pointed at the production server endpoints instead of a local relative `/api` path.
