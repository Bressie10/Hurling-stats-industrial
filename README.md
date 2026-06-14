# PitchNote

Offline-first hurling match stats app for coaches and analysts. It logs match events on the sideline, stores data locally in IndexedDB, syncs to Supabase when online, and includes reports, player/team analytics, live sharing, on-device voice logging, and optional Sideline AI support.

## Core Features

- Live match logging for points, goals, wides, tackles, blocks, turnovers, frees, puckouts, opposition scores, substitutions, notes, and pitch locations.
- Phone-first sideline UX with quick log mode, player rows mode, undo, live score/timer, and a mobile action rail.
- Offline-first storage with a durable sync outbox for Supabase backup, plus Background Sync where the browser supports it.
- Squad management with list and pitch lineup views.
- Match history, PDF reports, timeline, player stats, team stats, and stat targets.
- Club/team support, team codes, live match sharing, Stripe subscriptions, and PWA install support.
- Native on-device voice logging using roster/action fuzzy matching, plus optional Sideline AI smart read-only match answers.

## Environment Variables

Create `.env` locally and configure the same keys in Vercel/Supabase deploy environments:

```sh
PUBLIC_SUPABASE_URL=https://syikhsgovqogzkmmhuis.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
OPENAI_API_KEY=your_openai_server_key
SIDELINE_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe
SIDELINE_ANSWER_MODEL=gpt-4o-mini
STRIPE_SECRET_KEY=your_stripe_test_or_live_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_signing_secret
STRIPE_PORTAL_CONFIGURATION_ID=your_stripe_customer_portal_configuration_id
APP_URL=https://www.pitchnote.ie
PUBLIC_STORE_BUILD=web
PUBLIC_API_BASE_URL=
```

Do not expose an OpenAI key as a public env var. Live match voice logging uses native on-device speech recognition and does not need OpenAI. Optional Sideline AI transcription/answer routes use `OPENAI_API_KEY` server-side only and require the user's Supabase session token.

`PUBLIC_API_BASE_URL` is normally blank for the web app. Set it to `https://www.pitchnote.ie` only for a packaged native/static shell that still needs to call the production `/api/voice/*` endpoints.

## Development

```sh
npm install
npm run dev
```

Build production output:

```sh
npm run build
```

## Data And Sync

- IndexedDB stores squad, matches, drafts, device state, and queued sync mutations.
- `sync_outbox` mutations are drained to Supabase when online. Supported browsers also register one-shot Background Sync after local writes; unsupported browsers keep using app start, online, foreground, and manual Sync drains.
- Draft matches are device-local until the match is saved.
- Signing out attempts to flush the outbox before local data is cleared.

## Deploy Notes

- The app is configured for SvelteKit with the Vercel adapter.
- Supabase migrations live in `supabase/migrations`.
- Supabase Edge Functions handle Stripe checkout, portal, cancellation, and webhooks.
- Native live voice logging uses on-device speech recognition plus roster/action fuzzy matching, then feeds the same match event function as tap logging.
- Optional Sideline AI transcription is isolated behind `src/routes/api/voice/transcribe`, and open-ended match questions through `src/routes/api/voice/answer`, so browser clients never receive the server API key. The older OpenAI Realtime routes have been removed to keep match-day cost predictable.

## Branch And Deployment Targets

- `main` is the approved integration/deployment target and is connected to Vercel.
- Do not push new sync/PWA deployment work to `Voice-Changes`.
- `app-development` currently deploys the static GitHub Pages preview used for PWABuilder checks unless the workflow is changed.

## Store Release Mode

Native App Store / Google Play builds should use store-safe mode so the app is entitlement-only and does not show Stripe checkout or web purchase prompts:

- iOS launch URL: `https://www.pitchnote.ie/?store_build=ios`
- Android launch URL: `https://www.pitchnote.ie/?store_build=android`
- Build-time alternative: set `PUBLIC_STORE_BUILD=ios` or `PUBLIC_STORE_BUILD=android`.
- Native wrapper templates live in `native/`.
- Run `npm run store:check` before wrapper work and `npm run store:check:live` before submission.

See `docs/store-release.md` for the native release checklist.

## GitHub Pages Preview And PWABuilder

The `app-development` branch deploys a static PWA preview to GitHub Pages:

```txt
https://bressie10.github.io/Hurling-stats-industrial/
```

Use that URL in <https://www.pwabuilder.com/> after the GitHub Pages workflow finishes. GitHub Pages only hosts static files, so it is suitable for PWABuilder manifest/service-worker checks and install packaging. Server routes such as `/api/voice/transcribe` and `/api/voice/answer` do not run on GitHub Pages; use Vercel or another server-capable host for optional Sideline AI functionality.

For the Pages build, set repository variable/secret `PUBLIC_SUPABASE_ANON_KEY` if you want the hosted preview to connect to the real Supabase project. The workflow falls back to a dummy value so PWABuilder can still inspect the PWA shell.
