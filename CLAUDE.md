# CLAUDE.md — Hurling Stats App

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

A Progressive Web App (PWA) built for Doora Barefield GAA to track hurling match statistics
in real time from the sideline. Coaches log stats during matches, view player and team
analytics, and sync data to the cloud via Supabase. Designed to work fully offline at GAA
grounds with no internet.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Svelte + Vite |
| Language | JavaScript (no TypeScript) |
| Local storage | IndexedDB via `idb` library |
| Cloud sync | Supabase (PostgreSQL + Auth) |
| Charts | Chart.js |
| Styling | Scoped CSS inside Svelte components |
| PWA | Service worker (to be added) |
| Package manager | npm |

---

## File & Folder Structure
```
hurling-stats/
├── public/
│   └── favicon.svg
├── src/
│   ├── assets/
│   │   └── doora-barefield.png       # Club crest — used in nav + setup screen
│   ├── lib/
│   │   ├── db.js                     # All IndexedDB operations
│   │   ├── supabase.js               # Supabase client (URL + anon key)
│   │   ├── auth-store.js             # Svelte writable store for auth state
│   │   ├── settings-store.js         # Svelte writable store for app settings
│   │   ├── sync.js                   # Supabase sync logic (push/pull)
│   │   ├── Auth.svelte               # Login / signup screen
│   │   ├── Match.svelte              # Live match logging (main screen)
│   │   ├── PlayerStats.svelte        # Individual player stats + charts
│   │   ├── TeamStats.svelte          # Team stats + pitch map
│   │   ├── History.svelte            # Previous matches archive
│   │   ├── Timeline.svelte           # Chronological match event feed
│   │   ├── Squad.svelte              # Squad management
│   │   ├── StatTargets.svelte        # Team performance targets
│   │   └── Settings.svelte           # App settings + data export
│   ├── app.css                       # Global reset + base styles
│   ├── App.svelte                    # Root component — nav + routing + auth gate
│   └── main.js                       # Vite entry point
├── index.html                        # HTML shell — viewport meta tag is here
├── vite.config.js
├── svelte.config.js
├── package.json
└── CLAUDE.md                         # This file
```

---

## Key Commands
```bash
# Start dev server
cd ~/hurling-stats && npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## Database

### IndexedDB (local, on-device)

Managed via `src/lib/db.js` using the `idb` library.

| Store | Key | Purpose |
|---|---|---|
| `matches` | `id` (number or `'draft'`) | All saved matches + active draft |
| `squad` | `id` | Saved squad players |

**Important:** `loadMatches()` filters out `isDraft: true` records — only returns real saved matches.

Draft match is saved with `id: 'draft'` and `isDraft: true`. It is auto-resumed on app load and cleared when a match is saved via `finishMatch()`.

### Supabase (cloud sync)

Project URL: `https://kszidkfsvszhglufpcwq.supabase.co`

| Table | Purpose |
|---|---|
| `matches` | Cloud copy of all saved matches, per user |
| `squad` | Cloud copy of squad, per user |
| `profiles` | User profile (team name, age group) |

All tables have Row Level Security (RLS) enabled. Every row has a `user_id` column tied to `auth.users`. Coaches only ever see their own data.

---

## Auth Flow

1. User signs up or logs in via `Auth.svelte`
2. On login, `App.svelte` detects the new `user.id` via `auth-store.js`
3. `clearAllData()` wipes local IndexedDB
4. `syncFromSupabase()` pulls that user's data from Supabase into IndexedDB
5. `dataReady = true` — app renders
6. On sign out: `clearAllData()` wipes local data so the next coach starts clean

**Never skip the clearAllData step** — skipping it causes one coach to see another coach's data.

---

## Patterns & Conventions

### Routing
No router library. `App.svelte` uses a single `activePage` string variable and `{#if}` / `{:else if}` blocks to switch between pages.

### State
- Local component state: Svelte `let` variables
- Shared global state: Svelte `writable` stores (`auth-store.js`, `settings-store.js`)
- Persistent state: IndexedDB via `db.js`

### Player identity
Players are identified by **name**, not jersey number. Numbers change week to week. The `getPlayerIdInMatch()` function in `PlayerStats.svelte` looks up a player's ID within a specific match by matching on name. Always use name as the stable identifier.

### Stats storage
Stats are stored as `stats[playerId][statName] = count` — a nested object keyed by player ID then stat name. Custom stats are stored in the same structure alongside default stats.

### Events (pitch map)
Each logged stat produces an event object:
```javascript
{ playerId, stat, period, time, x, y, end }
```
`x` and `y` are percentages (0–100) of pitch width/height. `end` is `'db'` or `'opposition'`. Both can be `null` if the coach skipped location logging.

### Colours
- Primary maroon: `#6B1B2B`
- Hover/dark maroon: `#551522`
- Success green: `#2d7a2d`
- Pitch green: `#2d7a2d`
- All component styles are scoped — no global CSS classes except reset in `app.css`

### Auto-save (draft)
`saveDraft()` is called on every stat tap, sub, score change, and timer tick. It writes the full match state to IndexedDB as `id: 'draft'`. On app load, if a draft exists it auto-resumes and starts the timer automatically — no prompt.

---

## Things To Never Break

- **`clearAllData()` on login** — removing this causes data bleed between coach accounts
- **`loadMatches()` filtering `isDraft`** — without this, the draft match appears in history and stats
- **RLS policies in Supabase** — never disable these or coaches can see each other's data
- **Player identity by name** — if you switch back to ID-based lookup, cross-match stat aggregation breaks
- **`dataReady` gate in `App.svelte`** — components must not mount until sync is complete or they load stale data
- **`saveDraft()` on every state change** — removing any of these calls means match data can be lost if the app closes

---

## Roadmap

### Done
- [x] Match page — live logging, quick mode, player rows mode
- [x] Timer with auto-resume after app close
- [x] Pitch coordinate picker (DB end vs opposition end)
- [x] Opposition score tracker
- [x] Substitution tracker with log
- [x] Custom stats (per match)
- [x] Squad management page (saved between matches)
- [x] Player Stats — aggregate stats, trend chart, per-match table, compare mode
- [x] Team Stats — pitch map with stat + period filters, top performers
- [x] Previous Matches — archive, search, filter, detail view, delete
- [x] Match Timeline — chronological event feed with SVG icons
- [x] Settings — team name, age group, default stats, data export
- [x] Team Targets — set goals per stat, track progress, trend
- [x] Supabase auth + sync — multi-account, per-coach data isolation
- [x] Draft auto-save — match survives app close / device off

### Still To Build
- [ ] PWA offline install (service worker + manifest)
- [ ] PDF match report export
- [ ] Dark mode
- [ ] Supabase real-time sync (auto-push on stat tap, not manual)

### Key Goals
- Works fully offline at any GAA ground — no internet required during a match
- Multiple coaches, multiple teams — fully isolated data per account
- Fast enough to use one-handed on a phone while watching a match
- Data never lost — auto-save draft + Supabase cloud backup
