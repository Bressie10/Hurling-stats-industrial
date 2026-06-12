# iOS Store Wrapper

Use a Capacitor iOS wrapper for the first App Store release.

## Fixed Values

- Bundle ID: `com.gaastat.app`
- Initial URL: `https://www.gaastat.com/?store_build=ios`
- Wrapper type: Capacitor iOS

## Build Order

1. Confirm production is deployed from `main`.
2. Create the Capacitor project using `native/ios/capacitor.config.template.json` as the release reference.
3. Run `npm run build` before `cap sync` so `.svelte-kit/output/client` exists.
4. Add the iOS platform with Capacitor.
5. Configure the Apple Developer Team, signing, app icons, and launch screen in Xcode.
6. Add `NSMicrophoneUsageDescription`:

   ```text
   GAAstat uses the microphone when you choose to record Sideline AI voice commands for match logging and match questions.
   ```

7. Test on a real iPhone through TestFlight before App Store submission.
8. Complete App Store Connect privacy answers and reviewer credentials.

The first release should stay consumption-only/free-account inside the native app. Do not add web checkout links, Stripe portals, or external purchase CTAs inside the iOS build.

## Static Packaging Note

The current template loads the production app URL. If iOS is later changed to package local web assets, build with:

```sh
PUBLIC_STORE_BUILD=ios PUBLIC_API_BASE_URL=https://www.gaastat.com npm run build
```

`PUBLIC_API_BASE_URL` keeps Sideline AI voice calls pointed at the production server endpoints instead of a local relative `/api` path.
