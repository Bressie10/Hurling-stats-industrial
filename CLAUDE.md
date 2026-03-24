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

### Dark mode
CSS custom properties defined in `app.css` under `:root` (light) and `[data-theme="dark"]`. Never hardcode `white`, `#f8f8f8`, `#1a1a1a`, `#555`, `#888`, `#aaa` in component styles — use the variables instead:
- Backgrounds: `var(--bg)`, `var(--surface)`, `var(--surface-2)`, `var(--surface-3)`
- Borders: `var(--border)`, `var(--input-border)`, `var(--divider)`, `var(--divider-faint)`
- Text: `var(--text)`, `var(--text-2)`, `var(--text-muted)`, `var(--text-faint)`
- Brand maroon `#6B1B2B` and semantic colours (green/red) are kept as hex — they don't change between themes

### Auto-save (draft)
`saveDraft()` is called on every stat tap, sub, score change, and timer tick. It writes the full match state to IndexedDB as `id: 'draft'`. IndexedDB persists across tab/browser close, reload, navigation, and offline — data is only cleared by explicit user action.

On app load, if a draft exists `Match.svelte` sets `screen = 'recover'` and shows a professional recovery card. The card displays the opposition, date/venue, live score, event count, and time elapsed. The coach must explicitly tap **Resume Match** (starts timer) or **Discard & Start New** (clears draft, goes to setup). The timer does NOT auto-start — the coach is always in control.

### Logo paths
All logo references use the public-folder relative path `doora-barefield.png` (not `/src/assets/doora-barefield.png`). This applies to `Auth.svelte`, `App.svelte`, and the recovery card in `Match.svelte`.

---

## Things To Never Break

- **`clearAllData()` on login** — removing this causes data bleed between coach accounts
- **`loadMatches()` filtering `isDraft`** — without this, the draft match appears in history and stats
- **RLS policies in Supabase** — never disable these or coaches can see each other's data
- **Player identity by name** — if you switch back to ID-based lookup, cross-match stat aggregation breaks
- **`dataReady` gate in `App.svelte`** — components must not mount until sync is complete or they load stale data
- **`saveDraft()` on every state change** — removing any of these calls means match data can be lost if the app closes
- **`screen = 'recover'` on draft load** — do not change this back to auto-resume; the recovery card gives the coach explicit control and prevents accidental data loss
- **Logo path `doora-barefield.png`** — always use this public-folder path, never `/src/assets/doora-barefield.png`

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
- [x] Professional draft recovery card — coach explicitly resumes or discards (no auto-resume, no browser popup)
- [x] Logo path standardised — all references use `doora-barefield.png` (public folder)

### Done (continued)
- [x] PWA offline install — `manifest.json` + `sw.js` (cache-first for assets, network-first for Supabase), registered in `index.html`
- [x] PDF match report export — `window.print()` + `@media print` CSS in `History.svelte`; nav and UI chrome hidden, print-only header shown
- [x] Dark mode — CSS custom properties in `app.css` (`:root` light defaults, `[data-theme="dark"]` overrides), toggle in Settings.svelte, `data-theme` attribute driven by `settingsStore.darkMode` in `App.svelte`; all components updated
- [x] Auto-sync to Supabase — `scheduleAutoSync()` debounced 10s after stat logged, undo, sub, or decrement; NOT called on timer ticks

### Still To Build
- [ ] PWA service worker needs CSS/JS asset URLs injected at build time (currently pre-caches fixed URLs; a proper build step would hash-bust correctly)

### Key Goals
- Works fully offline at any GAA ground — no internet required during a match
- Multiple coaches, multiple teams — fully isolated data per account
- Fast enough to use one-handed on a phone while watching a match
- Data never lost — auto-save draft + Supabase cloud backup
