# PitchNote

Offline-first hurling match stats app for coaches and analysts. It logs match events on the sideline, stores data locally in IndexedDB, syncs to Supabase when online, and includes reports, player/team analytics, live sharing, on-device voice logging, and optional Sideline AI support.

## Core Features

- Live match logging for points, goals, wides, tackles, blocks, turnovers, frees, puckouts, opposition scores, substitutions, notes, and pitch locations.
- Phone-first sideline UX with quick log mode, player rows mode, undo, live score/timer, and a mobile action rail.
- Offline-first storage with a durable sync outbox for Supabase backup, plus Background Sync where the browser supports it.
- Squad management with list and pitch lineup views.
- Match history, PDF reports, timeline, player stats, team stats, and stat targets.
- Club/team support, team codes, live match sharing, Stripe subscriptions, and PWA install support.
- Native on-device voice logging for supported match stats using jersey-number, roster-name, action, and STT-alternative matching, plus optional Sideline AI smart read-only match answers.

## Environment Variables

Create `.env` locally and configure the same keys in Vercel/Supabase deploy environments:

```sh
PUBLIC_SUPABASE_URL=https://syikhsgovqogzkmmhuis.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_DB_URL=your_supabase_database_url_for_local_migration_helpers
OPENAI_API_KEY=your_openai_server_key
SIDELINE_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe
SIDELINE_ANSWER_MODEL=gpt-4o-mini
STRIPE_SECRET_KEY=your_stripe_test_or_live_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_signing_secret
STRIPE_PORTAL_CONFIGURATION_ID=your_stripe_customer_portal_configuration_id
STRIPE_WEBHOOK_ENDPOINT_ID=your_stripe_webhook_endpoint_id_for_local_verification
STRIPE_PERSONAL_PRICE_ID=price_...
STRIPE_CLUB_PRICE_ID=price_...
STRIPE_CLUB_PRO_PRICE_ID=price_...
APP_URL=https://www.pitchnote.ie
ALLOWED_CORS_ORIGINS=
PUBLIC_STORE_BUILD=web
PUBLIC_API_BASE_URL=
PUBLIC_ENABLE_VOICE_TEST=0
```

Do not expose an OpenAI key as a public env var. Live match voice logging uses native on-device speech recognition and does not need OpenAI. Optional Sideline AI transcription/answer routes use `OPENAI_API_KEY` server-side only and require the user's Supabase session token.

`SUPABASE_SERVICE_ROLE_KEY` is for local admin verification scripts and Supabase Edge Functions only; never expose it to browser/public builds. `SUPABASE_DB_URL` is only needed when applying SQL migrations locally with `psql`.

Stripe price IDs, portal configuration, and webhook endpoint IDs come from the active Stripe mode. Do not hard-code price IDs in Edge Function source; update Supabase function secrets and rerun `npm run billing:check`.

`ALLOWED_CORS_ORIGINS` is optional comma-separated extra browser origins for Supabase billing functions. The functions already allow `APP_URL`, Capacitor native origins, and localhost development origins.

`PUBLIC_API_BASE_URL` is normally blank for the web app. Set it to `https://www.pitchnote.ie` only for a packaged native/static shell that still needs to call the production `/api/voice/*` endpoints.

`PUBLIC_ENABLE_VOICE_TEST=1` exposes the internal `/app/voice-test` field-testing harness in dev or deliberately flagged builds. Leave it unset/`0` for production and store-submission builds.

## Development

Use Node 22 LTS for local development. The Vercel adapter currently supports
Node 20/22/24, and this repo pins the expected local version in `.nvmrc`.

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
- Local data is scoped by the active team where available. Personal data uses the `personal` scope; team data carries `teamScope`/`teamId` locally and `team_id` in Supabase.
- `sync_outbox` mutations are drained to Supabase when online. Supported browsers also register one-shot Background Sync after local writes; unsupported browsers keep using app start, online, foreground, and manual Sync drains.
- GPS uses separate local stores and `gps_sync_queue` so high-volume raw telemetry does not enter the generic stats outbox. See `docs/gps-architecture.md`.
- Draft matches are device-local until the match is saved.
- Signing out attempts to flush the outbox before local data is cleared.

## Deploy Notes

- The app is configured for SvelteKit with the Vercel adapter.
- Supabase migrations live in `supabase/migrations`.
- Supabase Edge Functions handle Stripe checkout, portal, cancellation, and webhooks.
- Native live voice logging uses on-device speech recognition plus deterministic parser matching, then feeds the same match event function as tap logging. It supports Point, Goal, Wide, Free Won, Turnover Lost, and Yellow Card in the current v1 parser; 45s, sideline balls, and black/red cards remain tap-only.
- Voice-logged Point/Goal/Wide events can offer an optional post-log pitch location action when pitch-coordinate tracking is enabled, without blocking the initial log.
- Team-scoped sync uses `team_id` columns on cloud `matches` and `squad` rows plus local `teamScope` metadata; see `supabase/migrations/20260617000200_team_scoped_data_and_rls.sql` and the follow-up policy reset in `supabase/migrations/20260617000300_team_scoped_policy_reset.sql`.
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
- Run `npm run release:check` before release-critical local work. Before submission, apply the required Supabase SQL with `npm run supabase:migration:release-required` when `SUPABASE_DB_URL` is set, or paste those SQL files into Supabase in the same order, register/activate `pitchnote.ie`, configure DNS/hosting, and run `npm run release:check:live`; this chains the live domain, billing, team-scope RLS, account-deletion, and free-quota checks.
- Use `npm run voice:analyze -- path/to/voice-samples.csv` after `/app/voice-test` field sessions to verify the configured voice accuracy bar.

See `docs/store-release.md` for the native release checklist.

## GitHub Pages Preview And PWABuilder

The `app-development` branch deploys a static PWA preview to GitHub Pages:

```txt
https://bressie10.github.io/Hurling-stats-industrial/
```

Use that URL in <https://www.pwabuilder.com/> after the GitHub Pages workflow finishes. GitHub Pages only hosts static files, so it is suitable for PWABuilder manifest/service-worker checks and install packaging. Server routes such as `/api/voice/transcribe` and `/api/voice/answer` do not run on GitHub Pages; use Vercel or another server-capable host for optional Sideline AI functionality.

For the Pages build, set repository variable/secret `PUBLIC_SUPABASE_ANON_KEY` if you want the hosted preview to connect to the real Supabase project. The workflow falls back to a dummy value so PWABuilder can still inspect the PWA shell.
