# GAAstat

Offline-first hurling match stats app for coaches and analysts. It logs match events on the sideline, stores data locally in IndexedDB, syncs to Supabase when online, and includes reports, player/team analytics, live sharing, and Sideline AI voice capture.

## Core Features

- Live match logging for points, goals, wides, tackles, blocks, turnovers, frees, puckouts, opposition scores, substitutions, notes, and pitch locations.
- Phone-first sideline UX with quick log mode, player rows mode, undo, live score/timer, and a mobile action rail.
- Offline-first storage with a durable sync outbox for Supabase backup.
- Squad management with list and pitch lineup views.
- Match history, PDF reports, timeline, player stats, team stats, and stat targets.
- Club/team support, team codes, live match sharing, Stripe subscriptions, and PWA install support.
- Sideline AI voice command logging using server-side OpenAI transcription, deterministic confirmed write parsing, and smart read-only match answers.

## Environment Variables

Create `.env` locally and configure the same keys in Vercel/Supabase deploy environments:

```sh
PUBLIC_SUPABASE_URL=https://syikhsgovqogzkmmhuis.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
OPENAI_API_KEY=your_openai_server_key
SIDELINE_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe
SIDELINE_ANSWER_MODEL=gpt-4o-mini
```

Do not expose an OpenAI key as a public env var. Voice transcription and smart answers use `OPENAI_API_KEY` server-side only and require the user's Supabase session token.

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
- `sync_outbox` mutations are drained to Supabase when online.
- Draft matches are device-local until the match is saved.
- Signing out attempts to flush the outbox before local data is cleared.

## Deploy Notes

- The app is configured for SvelteKit with the Vercel adapter.
- Supabase migrations live in `supabase/migrations`.
- Supabase Edge Functions handle Stripe checkout, portal, cancellation, and webhooks.
- Sideline AI command transcription is proxied through `src/routes/api/voice/transcribe` and open-ended match questions through `src/routes/api/voice/answer` so browser clients never receive the server API key.
- Sideline AI uses short authenticated transcription clips plus deterministic confirmed write parsing. Read-only questions can use the live match context for smart answers and coaching recommendations; the older OpenAI Realtime routes have been removed to keep match-day cost predictable.

## GitHub Pages Preview And PWABuilder

The `app-development` branch deploys a static PWA preview to GitHub Pages:

```txt
https://bressie10.github.io/Hurling-stats-industrial/
```

Use that URL in <https://www.pwabuilder.com/> after the GitHub Pages workflow finishes. GitHub Pages only hosts static files, so it is suitable for PWABuilder manifest/service-worker checks and install packaging. Server routes such as `/api/voice/transcribe` and `/api/voice/answer` do not run on GitHub Pages; use Vercel or another server-capable host for full Sideline AI voice functionality.

For the Pages build, set repository variable/secret `PUBLIC_SUPABASE_ANON_KEY` if you want the hosted preview to connect to the real Supabase project. The workflow falls back to a dummy value so PWABuilder can still inspect the PWA shell.
