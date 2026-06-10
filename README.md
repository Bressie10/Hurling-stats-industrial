# GAAstat

Offline-first hurling match stats app for coaches and analysts. It logs match events on the sideline, stores data locally in IndexedDB, syncs to Supabase when online, and includes reports, player/team analytics, live sharing, and Sideline AI voice capture.

## Core Features

- Live match logging for points, goals, wides, tackles, blocks, turnovers, frees, puckouts, opposition scores, substitutions, notes, and pitch locations.
- Phone-first sideline UX with quick log mode, player rows mode, undo, live score/timer, and a mobile action rail.
- Offline-first storage with a durable sync outbox for Supabase backup.
- Squad management with list and pitch lineup views.
- Match history, PDF reports, timeline, player stats, team stats, and stat targets.
- Club/team support, team codes, live match sharing, Stripe subscriptions, and PWA install support.
- Sideline AI voice assistant using OpenAI Realtime through server-side API routes.

## Environment Variables

Create `.env` locally and configure the same keys in Vercel/Supabase deploy environments:

```sh
PUBLIC_SUPABASE_URL=https://syikhsgovqogzkmmhuis.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
OPENAI_API_KEY=your_openai_server_key
```

Do not expose an OpenAI key as a public env var. The Realtime voice routes use `OPENAI_API_KEY` server-side only.

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
- OpenAI Realtime calls are proxied through `src/routes/api/realtime/*` so browser clients never receive the server API key.
