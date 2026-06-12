# Session Handoff

Last updated: 2026-06-12

## Project State

- Repository: `Hurling-stats-industrial`
- Local workspace: `/Users/ultanbreslin/Downloads/Hurling-stats-industrial 16.30.38`
- Keep `main` untouched because it is connected to Vercel.
- Continue long-term work on `app-development`.
- The local checkout may still show `Voice-Changes`, but the safe GitHub branch for this work is `app-development`.

## Preview URL

GitHub Pages preview:

`https://bressie10.github.io/Hurling-stats-industrial/`

Use this URL for PWABuilder checks.

## Already Done

- Voice command work and parser improvements were kept off `main`.
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

## Important Files

- `.github/workflows/deploy-app-development-pages.yml`
- `svelte.config.js`
- `src/app.html`
- `src/service-worker.js`
- `static/manifest.json`
- `static/pwabuilder-sw.js`
- `scripts/generate-pwa-screenshots.mjs`

## Known Verification

- `npm run build` passes with `GITHUB_PAGES=true`.
- `npm run smoke:voice` passed.
- GitHub Pages preview is live.
- Manifest, logos, screenshots, `service-worker.js`, and `pwabuilder-sw.js` returned `200` on the live preview.

## Next Work

Recommended long-term order:

1. Add Background Sync for queued offline stat logging.
2. Add Periodic Background Sync for refreshing lightweight match/team data where supported.
3. Consider push notifications after the sync flow is reliable.
4. Consider share target later if importing shared notes, files, or match data becomes useful.

Do not add OS notes-app registration unless the product genuinely needs to receive notes from the operating system. It is probably not a good fit for GAAstat.

## Resume Prompt

In a new chat, use:

```text
Read docs/session-handoff.md and continue from the app-development branch. Do not touch main because it is connected to Vercel.
```
