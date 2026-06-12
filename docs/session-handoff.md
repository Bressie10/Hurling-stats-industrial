# Session Handoff

Last updated: 2026-06-12

## Project State

- Repository: `Hurling-stats-industrial`
- Local workspace: `/Users/ultanbreslin/Downloads/Hurling-stats-industrial 16.30.38`
- `main` is now the approved integration/deployment target and is connected to Vercel.
- Do not push this work to `Voice-Changes`; that branch is no longer the safe target.
- `app-development` is still the current GitHub Pages preview branch unless the workflow is changed.

## Preview URL

GitHub Pages preview:

`https://bressie10.github.io/Hurling-stats-industrial/`

Use this URL for PWABuilder checks.

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
- Store release preparation was started:
  - native store mode hides web checkout and web purchase prompts
  - public privacy, terms, support, and account deletion routes were added
  - `docs/store-release.md` tracks the App Store / Google Play release checklist

## Important Files

- `.github/workflows/deploy-app-development-pages.yml`
- `svelte.config.js`
- `src/app.html`
- `src/service-worker.js`
- `src/lib/sync.js`
- `src/lib/sync-payloads.js`
- `src/lib/config.js`
- `src/lib/LegalPage.svelte`
- `docs/store-release.md`
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

## Next Work

Recommended long-term order:

1. Verify queued offline match/squad mutations drain on the deployed preview/production app.
2. Build native wrappers using `docs/store-release.md`; do not add placeholder signing or assetlinks files.
3. Create seeded store reviewer account and complete App Store / Play Console privacy forms.
4. Add Periodic Background Sync for refreshing lightweight match/team data where supported.
5. Consider push notifications after the sync flow is reliable.
6. Consider share target later if importing shared notes, files, or match data becomes useful.

Do not add OS notes-app registration unless the product genuinely needs to receive notes from the operating system. It is probably not a good fit for GAAstat.

## Resume Prompt

In a new chat, use:

```text
Read docs/session-handoff.md. Main is now the approved integration/deployment target; do not push this work to Voice-Changes. If the local implementation is still on app-development, merge or replay it to main when ready to deploy.
```
