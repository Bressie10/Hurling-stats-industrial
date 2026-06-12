# Session Handoff

Last updated: 2026-06-12

## Project State

- Repository: `Hurling-stats-industrial`
- Local workspace: `/Users/ultanbreslin/Downloads/Hurling-stats-industrial 16.30.38`
- `main` is now the approved integration/deployment target and is connected to Vercel.
- Do not push this work to `Voice-Changes`; that branch is no longer the safe target.
- `app-development` is still the current GitHub Pages preview branch unless the workflow is changed.
- Local branch may still be `app-development`, but `origin/main` currently includes the latest store-release work.
- Latest production work is pushed to `origin/main`; use `git log origin/main -1` for the exact commit.
- Current stage: web app is in store-readiness hardening before native wrapper generation. Support email is configured as `support@gaastat.com`; external delivery still needs a final test after DNS/routing propagation. Android/iOS wrapper projects have not been generated yet.

## URLs

- Production app: `https://www.gaastat.com/`
- iOS wrapper launch URL: `https://www.gaastat.com/?store_build=ios`
- Android wrapper launch URL: `https://www.gaastat.com/?store_build=android`
- GitHub Pages preview for PWABuilder checks:

`https://bressie10.github.io/Hurling-stats-industrial/`

PWABuilder optional warnings are not the release target. The release target is Apple App Store and Google Play.

## Already Done

- Earlier voice command work and parser improvements were kept off `main`; new approved deployment work can now go to `main`.
- GitHub Pages deployment was set up from `app-development`.
- GitHub Pages asset paths were fixed so logos and icons load correctly.
- PWABuilder manifest polish was added:
  - `lang`
  - `dir`
  - `display_override`
  - screenshots
  - shortcuts
  - launch handling
  - relative app paths for GitHub Pages
- Service worker detection was fixed for PWABuilder using `static/pwabuilder-sw.js`.
- The app registers the service worker explicitly from `src/app.html`.
- Progressive Background Sync was added for the existing IndexedDB outbox:
  - local mutations still drain immediately in the foreground
  - supported browsers register one-shot Background Sync with `gaastat-sync-outbox`
  - the service worker can ask visible clients to drain or directly drain with a short-lived Supabase access token
  - unsupported browsers keep the existing app-start, online, foreground, and manual Sync fallback paths
- Store release readiness mode was implemented and pushed to `main`:
  - `src/lib/config.js` supports `PUBLIC_STORE_BUILD=ios`, `PUBLIC_STORE_BUILD=android`, and the `store_build` launch query param
  - native store mode persists in `localStorage` under `gaastat-store-build`
  - `Upgrade.svelte`, `PricingPage.svelte`, and `History.svelte` hide prices, Stripe checkout, upgrade buttons, and web purchase CTAs in native store mode
  - marketing/docs/install/footer navigation avoids PWA-install and "no app store" copy inside native store mode
  - public privacy, terms, support, and account deletion routes were added
  - `docs/store-release.md` tracks the App Store / Google Play release checklist
  - `README.md` and this handoff document record that `main` is the deployment branch and `Voice-Changes` must not be used
- Native release scaffolding was added:
  - `native/shared/release.json` records app IDs, platform launch URLs, public review URLs, and support email
  - `native/android/twa-manifest.template.json` is the Android TWA release reference
  - `native/ios/capacitor.config.template.json` is the iOS Capacitor release reference
  - `scripts/verify-store-release.mjs` powers `npm run store:check` and `npm run store:check:live`
  - `src/lib/api.js` adds `PUBLIC_API_BASE_URL` support for native/static shells that need production voice endpoints
- Service worker registration path was fixed and pushed to `main`:
  - `src/app.html` no longer registers `./pwabuilder-sw.js` relative to the current route
  - app routes such as `/app/match` now resolve the worker from the manifest location, so registration targets `/pwabuilder-sw.js`
  - service worker registration and legacy `/sw.js` cleanup failures are caught to avoid unhandled promise rejections
  - `scripts/verify-store-release.mjs` now checks this does not regress
- Native Settings hardening and cleanup scan were completed:
  - `src/lib/Settings.svelte` imports the native store-build guard
  - native store builds do not call the Stripe cancellation function during account deletion
  - Settings account deletion copy now states that plan management is not available inside the native build
  - stale unused Settings subscription CSS and an unused subscription import were removed
  - `scripts/verify-store-release.mjs` now includes `Settings.svelte` in the native store-mode checks
  - `src/lib/LiveViewer.svelte` no longer captures initial match data in a Svelte state initializer
  - `src/routes/app/live/+page.svelte` now styles the actual live loading screen selector
- Support email setup was completed in code/docs:
  - Cloudflare Email Routing MX/SPF records are visible for `gaastat.com`
  - user-facing contact links now use `support@gaastat.com`
  - `native/shared/release.json` now uses `support@gaastat.com`
  - the old misspelled domain was removed from user-facing docs

## Important Files

- `.github/workflows/deploy-app-development-pages.yml`
- `svelte.config.js`
- `src/app.html`
- `src/service-worker.js`
- `src/lib/sync.js`
- `src/lib/sync-payloads.js`
- `src/lib/config.js`
- `src/lib/api.js`
- `src/lib/Upgrade.svelte`
- `src/lib/PricingPage.svelte`
- `src/lib/History.svelte`
- `src/lib/Settings.svelte`
- `src/lib/LegalPage.svelte`
- `src/routes/privacy/+page.svelte`
- `src/routes/terms/+page.svelte`
- `src/routes/support/+page.svelte`
- `src/routes/account/delete/+page.svelte`
- `docs/store-release.md`
- `native/shared/release.json`
- `native/android/twa-manifest.template.json`
- `native/ios/capacitor.config.template.json`
- `scripts/verify-store-release.mjs`
- `static/manifest.json`
- `static/pwabuilder-sw.js`
- `scripts/generate-pwa-screenshots.mjs`

## Known Verification

- `npm run build` passes with `GITHUB_PAGES=true`.
- `npm run smoke:voice` passed.
- After Background Sync work, `npm run smoke:voice` passed and `GITHUB_PAGES=true PUBLIC_SUPABASE_URL=https://example.supabase.co PUBLIC_SUPABASE_ANON_KEY=dummy OPENAI_API_KEY=dummy npm run build` passed.
- The generated GitHub Pages worker contains the `gaastat-sync-outbox` handler and is still imported by `pwabuilder-sw.js`.
- GitHub Pages preview is live.
- Manifest, logos, screenshots, `service-worker.js`, and `pwabuilder-sw.js` returned `200` on the live preview.
- Store-release verification on 2026-06-12:
  - `npm run smoke:voice` passed.
  - `git diff --check` passed before commit.
  - `GITHUB_PAGES=true PUBLIC_STORE_BUILD=ios PUBLIC_SUPABASE_URL=https://example.supabase.co PUBLIC_SUPABASE_ANON_KEY=dummy OPENAI_API_KEY=dummy npm run build` passed.
  - `PUBLIC_SUPABASE_URL=https://example.supabase.co PUBLIC_SUPABASE_ANON_KEY=dummy OPENAI_API_KEY=dummy npm run build` passed for Vercel-style production output.
  - `origin/main` was fast-forwarded through `ad5c954`, `d985470`, and `55705c6`.
  - Production URLs returned `200`: `/privacy`, `/terms`, `/support`, `/account/delete`.
- Native scaffold verification on 2026-06-12:
  - `npm run store:check` passed with one expected warning: `assetlinks.json` is absent until the real Play signing SHA-256 is known.
  - `npm run store:check:live` passed against `https://www.gaastat.com/`.
  - `npm run smoke:voice` passed.
  - Vercel-style `npm run build` passed.
- Service worker verification on 2026-06-12:
  - Production `/pwabuilder-sw.js` returns `200`.
  - Production `/app/match` HTML contains the corrected worker registration.
  - `/app/pwabuilder-sw.js` still returns `404`, which is expected; the app should no longer request that route.
- Cleanup verification on 2026-06-12:
  - `npm run store:check` passed with the expected `assetlinks.json` warning.
  - `npm run smoke:voice` passed.
  - `git diff --check` passed.
  - `PUBLIC_SUPABASE_URL=https://example.supabase.co PUBLIC_SUPABASE_ANON_KEY=dummy OPENAI_API_KEY=dummy npm run build` passed.
  - The build still has pre-existing cleanup warnings: deprecated Svelte `<slot>` usage in layouts, unused CSS in large components such as `Match.svelte` and `Landing.svelte`, a LightningCSS warning for `:global(html:has(.lp))`, and a large `Match.svelte` client chunk.

## Next Work

Recommended order from here:

1. Test `support@gaastat.com` from an external email account and confirm delivery to the monitored destination inbox.
2. Add `support@gaastat.com` to App Store Connect and Google Play store metadata when those records are created.
3. Verify queued offline match/squad mutations drain on the deployed preview/production app.
4. Create a seeded reviewer account with realistic match/squad data and verify sign-in, offline match logging, sync restore, account deletion, and Sideline AI microphone permission on real devices.
5. Build the Android wrapper as a Trusted Web Activity:
   - package name `com.gaastat.app`
   - launch URL `https://www.gaastat.com/?store_build=android`
   - generate the real App Bundle (`.aab`)
   - add `/.well-known/assetlinks.json` only after the final signing SHA-256 fingerprint is known
6. Build the iOS wrapper, likely with Capacitor:
   - bundle ID `com.gaastat.app`
   - initial URL `https://www.gaastat.com/?store_build=ios`
   - configure Apple signing, icons, launch screen, and microphone usage description
7. Complete App Store Connect and Play Console forms:
   - privacy policy URL: `https://www.gaastat.com/privacy`
   - support URL: `https://www.gaastat.com/support`
   - account deletion URL: `https://www.gaastat.com/account/delete`
   - data/privacy answers must mention Supabase account/cloud sync, local device storage, OpenAI voice transcription/answers, and Stripe web billing outside native store builds
8. Confirm store-mode screens do not show prices, Stripe checkout, upgrade CTAs, or external payment links before submission.
9. Continue code cleanup separately from release-critical work:
   - migrate Svelte layouts from deprecated `<slot>` to `{@render ...}` when the app shell is otherwise stable
   - remove verified-dead CSS in `Match.svelte`, `Landing.svelte`, `Upgrade.svelte`, `LpFooter.svelte`, and related screens
   - investigate the `:global(html:has(.lp))` LightningCSS warning
   - code-split large app screens, especially `Match.svelte`, after native release blockers are cleared
10. Add Periodic Background Sync for lightweight match/team refresh only after the current sync flow is verified.
11. Consider push notifications after sync reliability is proven.
12. Consider share target later if importing shared notes, files, or match data becomes useful.

Do not add OS notes-app registration unless the product genuinely needs to receive notes from the operating system. It is probably not a good fit for GAAstat.
Do not add placeholder signing files, placeholder `assetlinks.json`, or fake store credentials.

## Resume Prompt

In a new chat, use:

```text
Read docs/session-handoff.md and docs/store-release.md. Main is the approved integration/deployment target. Do not push release/PWA work to Voice-Changes. Current stage is store-readiness hardening before native wrapper generation. Native Settings billing hardening is done and code/docs now use support@gaastat.com. Next confirm external email delivery, verify deployed sync/reviewer flows on devices, then continue Android TWA and iOS Capacitor work using https://www.gaastat.com/?store_build=android and https://www.gaastat.com/?store_build=ios as launch URLs.
```
