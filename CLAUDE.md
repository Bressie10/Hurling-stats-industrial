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
| Framework | Svelte 5 + Vite |
| Language | JavaScript (no TypeScript) |
| Local storage | IndexedDB via `idb` library |
| Cloud sync | Supabase (PostgreSQL + Auth) |
| Charts | Chart.js |
| Styling | Scoped CSS inside Svelte components |
| PWA | Service worker (`sw.js` + `manifest.json`) |
| Package manager | npm |

**Svelte version note:** The app runs Svelte 5 but uses the legacy API (`let`, `$:`, `on:click`, etc.) throughout — not runes (`$state`, `$derived`, `$effect`). Do not mix rune syntax into existing components.

---

## File & Folder Structure
```
hurling-stats/
├── public/
│   ├── favicon.svg
│   ├── manifest.json             # PWA manifest
│   └── sw.js                     # Service worker (cache-first assets, network-first Supabase)
├── src/
│   ├── assets/
│   │   └── doora-barefield.png       # Club crest — used in nav + setup screen
│   ├── lib/
│   │   ├── db.js                     # All IndexedDB operations
│   │   ├── supabase.js               # Supabase client (URL + anon key)
│   │   ├── auth-store.js             # Svelte writable store for auth state
│   │   ├── settings-store.js         # Svelte writable store for app settings
│   │   ├── sync.js                   # Supabase sync logic (push/pull)
│   │   ├── Auth.svelte               # Compact sign-in card — shown only when running as PWA (standalone)
│   │   ├── Landing.svelte            # Full marketing landing page — shown to web (non-PWA) visitors; embeds sign-in form in hero
│   │   ├── Match.svelte              # Live match logging (main screen)
│   │   ├── PlayerStats.svelte        # Individual player stats + charts
│   │   ├── TeamStats.svelte          # Team stats + pitch map
│   │   ├── History.svelte            # Previous matches archive
│   │   ├── Timeline.svelte           # Chronological match event feed
│   │   ├── Squad.svelte              # Squad management — list view + pitch view
│   │   ├── StatTargets.svelte        # Team performance targets
│   │   └── Settings.svelte           # App settings + data export
│   ├── app.css                       # Global reset + CSS custom properties (light theme)
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

Project URL: `https://syikhsgovqogzkmmhuis.supabase.co`

| Table | Purpose |
|---|---|
| `matches` | Cloud copy of all saved matches, per user |
| `squad` | Cloud copy of squad, per user |
| `profiles` | User profile (team name, age group) |

All tables have Row Level Security (RLS) enabled. Every row has a `user_id` column tied to `auth.users`. Coaches only ever see their own data.

---

## Auth Flow

### Web vs PWA routing (App.svelte)
`App.svelte` detects standalone (PWA) mode in `onMount` via:
```javascript
isPWA = window.matchMedia('(display-mode: standalone)').matches || !!navigator.standalone
```
- **PWA (installed to home screen):** shows the compact `<Auth />` card
- **Browser (web visit):** shows `<Landing />` — the full marketing/landing page with the sign-in form embedded in the hero section

### Sign-in flow (both paths)
1. User signs up or logs in (via `Landing.svelte` hero form or `Auth.svelte` card)
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

`Match.svelte` uses its own internal `screen` variable (`'setup'` | `'match'` | `'stats'`) to switch between the setup form, live match logging, and the Quick View Stats panel.

### State
- Local component state: Svelte `let` variables
- Shared global state: Svelte `writable` stores (`auth-store.js`, `settings-store.js`)
- Persistent state: IndexedDB via `db.js`

### Svelte 5 legacy reactivity gotcha
The app runs Svelte 5 in legacy mode. **Template function calls do not track reactive dependencies** the way `$:` declarations do. If a function reads a reactive variable (like `players`) and is called from a template expression or `{@const}`, the template will NOT re-render when that variable changes.

**Rule:** Any derived value that drives the template display must be a `$:` reactive declaration, not a plain function called inline. For example, `Squad.svelte` uses `$: slotMap = ...` (not `getPlayerForSlot()` in the template) so pitch slots update when players are assigned.

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

### Puckout storage
Each logged puckout produces an object:
```javascript
{ outcome, ourPlayer, oppPlayer, section, time, period }
```
- `outcome`: `'won'` | `'lost'`
- `ourPlayer`: DB player name (string) or `null`
- `oppPlayer`: opposition player number as a string (e.g. `'5'`) or `null`
- `section`: zone key string (e.g. `'midfield-top'`) or `null` — from the 10-zone pitch map (5 cols × 2 rows)

When `outcome === 'lost'`, `oppPlayer` records which opposition player won the puckout and `ourPlayer` records who was marking them. This enables the marking matchup breakdown (e.g. "Player 1 was marking #5").

### Opposition score storage
Each logged opposition score produces an object:
```javascript
{ type, oppPlayerNum, marker, time, period }
```
- `type`: `'goal'` | `'point'`
- `oppPlayerNum`: opposition player jersey number as a string or `null`
- `marker`: DB player name who was marking or `null`

### Puckout zone keys
Zone keys follow the format `'<col>-<row>'`, e.g. `'midfield-top'`. Columns: `short`, `own-half`, `midfield`, `opp-half`, `long`. Rows: `top`, `bottom`. Use `formatZoneLabel(key)` to produce a display string.

### Theming / Colours
All brand colours are CSS custom properties — never hardcode them:
- `var(--primary)` — club primary colour (default lime green `#5A8A00`; overridable per-club in Settings)
- `var(--primary-hover)` — darkened primary for hover states
- `var(--primary-rgb)` — RGB triplet for use in `rgba(var(--primary-rgb), 0.1)` alpha variants
- `var(--primary-text)` — contrasting text colour on primary backgrounds (white or dark, auto-computed)
- Backgrounds: `var(--bg)`, `var(--surface)`, `var(--surface-2)`, `var(--surface-3)`
- Borders: `var(--border)`, `var(--input-border)`, `var(--divider)`, `var(--divider-faint)`
- Text: `var(--text)`, `var(--text-2)`, `var(--text-muted)`, `var(--text-faint)`
- Semantic colours (success green `#2d7a2d`, error red `#e53935`) and pitch green (`#1e6b1e`, `#2d7a2d`) are kept as hex — they are not brand colours and don't change

`App.svelte` applies the club's custom colour at runtime via `document.documentElement.style.setProperty('--primary', ...)` and also keeps `document.title` and `apple-mobile-web-app-title` in sync with `settingsStore.teamName`.

Dark mode has been **removed** — the app is light-only. Do not add `[data-theme="dark"]` back.

### Club colour presets (Settings.svelte)
8 GAA county presets are defined in `PRESET_COLORS`. Coaches can also pick a fully custom colour via a native `<input type="color">`. The selected colour is stored in `settingsStore.clubPrimaryColor` (a hex string or `null` for the default).

### Auto-save (draft)
`saveDraft()` is called on every stat tap, sub, score change, puckout log, and timer tick. It writes the full match state to IndexedDB as `id: 'draft'`. IndexedDB persists across tab/browser close, reload, navigation, and offline — data is only cleared by explicit user action.

On app load, if a draft exists `Match.svelte` **auto-resumes it immediately** — there is no "Resume or Discard?" screen. The draft is restored silently and the coach lands directly on the match screen (or stats screen if that was active when the app closed).

The draft saves `screen: 'stats' | 'match'` so the Quick View Stats panel is also restored on reload.

### Timer persistence (wall-clock)
The timer uses `timerStartedAt = Date.now()` (epoch ms) rather than a pure counter. On app restore, elapsed time since close is calculated: `elapsed = floor((Date.now() - timerStartedAt) / 1000)`. This means the timer is always accurate even if the device was off for 20 minutes.

### Logo paths
All logo references use the public-folder relative path `doora-barefield.png` (not `/src/assets/doora-barefield.png`). This applies to `Auth.svelte` and `App.svelte`.

---

## Squad Page (Squad.svelte)

Two views toggled by a pill toggle in the header: **List** and **Pitch**.

### List view
Standard editable table of all squad players (name, jersey number, position dropdown). Starters and Subs shown in separate sections. "Add Player" dashed button at the bottom. Full-width Save button.

### Pitch view
Visual GAA pitch with 15 position slots laid out in the correct formation:

```
PITCH_ROWS = [[13,14,15],[10,11,12],[8,9],[5,6,7],[2,3,4],[1]]
```

A player "occupies a slot" if and only if `number >= 1 && number <= 15 && position !== 'Sub'`. This is the canonical check used everywhere — `isInPitchSlot(p)`.

**Reactive slot map:** The pitch display is driven by `$: slotMap` (a plain object keyed by slot number → player). This MUST remain a `$:` declaration. Using a function call in the template would break reactivity in Svelte 5 legacy mode and the pitch would not update after assignments.

**Assigning a player to a slot:**
- Tap any slot → bottom-sheet modal opens
- Modal lists all named players; players already in slots are tagged with their current position
- Selecting a player runs `assignPlayerToSlot(playerId)`:
  - If the slot already has a player, the displaced player is swapped to the incoming player's old position/number (or made a Sub if incoming was a Sub)
  - `nextAvailableNumber()` is used wherever a free jersey number is needed — it finds the lowest positive integer not already in use

**Adding players from pitch view:**
- Each slot modal has a "New player" row at the bottom → expands inline to a name input → "Add & assign" creates and places in one step
- The subs panel has an "Add player to squad" button → opens the new-player form as a Sub
- Sub chips have a × remove button

**Number management:**
- Always use `nextAvailableNumber()` when assigning a free number — never `players.length + 1` (breaks after deletions)
- Jersey numbers 1–15 are "pitch slots"; anything higher is treated as a Sub regardless of `position` field

### Lineup saved with matches
`Match.svelte` silently auto-populates a `lineup` object (slot number → player ID) from squad jersey numbers when a match starts. This is saved with the match and used by `History.svelte` for the PDF export. There is no interactive lineup builder on the Match setup screen — it lives entirely on the Squad page.

---

## Quick View Stats (Match.svelte)

Accessed via the Stats button in the match action bar at any time during the match. Sets `screen = 'stats'`. The timer keeps running — nothing is paused or frozen.

The stats panel is a series of **collapsible accordions** (`openSections` object, toggled via `toggleSection(k)`):

| Accordion | Key | Shows |
|---|---|---|
| Puckouts | `puckouts` | W/L/%, zone heatmap, tap-to-filter zones, by our player (with matchup lines), opposition winners (with who they beat) |
| Scores Conceded | `conceded` | Goals/points totals, by our marker, by opposition player number |
| Player Stats | `players` | Full stats table for all players with any stats |
| Substitutions | `subs` | Sub log with times |

Each accordion header shows a summary badge (wins/losses/%, goals/points, count) so the coach can scan without opening.

Each section shows a **standout callout** (`.standout-row`) — a left-bordered highlight row naming the top/most-dangerous performer in that section.

**Marking matchup lines**: In the puckouts breakdown, each player row shows `Won vs #7` / `Lost to #5` in green/red. Each opposition winner row shows `Marking: Player 1`. This is derived from `ourPlayer` + `oppPlayer` on each puckout object.

**Zone heatmap**: The 10-zone SVG pitch is colour-coded by win rate (green ≥67%, amber 40–66%, red <40%). Tap a zone to filter the breakdown table to that zone only.

All data shown is **live current data** — not a snapshot. The panel always reflects the full match so far.

---

## Things To Never Break

- **`clearAllData()` on login** — removing this causes data bleed between coach accounts
- **`loadMatches()` filtering `isDraft`** — without this, the draft match appears in history and stats
- **RLS policies in Supabase** — never disable these or coaches can see each other's data
- **Player identity by name** — if you switch back to ID-based lookup, cross-match stat aggregation breaks
- **`dataReady` gate in `App.svelte`** — components must not mount until sync is complete or they load stale data
- **`saveDraft()` on every state change** — removing any of these calls means match data can be lost if the app closes
- **Auto-resume draft** — do not add a "Resume or Discard?" screen back; the draft should restore silently
- **`timerStartedAt` wall-clock pattern** — do not revert to a pure counter; the wall-clock approach is what keeps the timer accurate after app close
- **Logo path `doora-barefield.png`** — always use this public-folder path, never `/src/assets/doora-barefield.png`
- **`ourPlayer` + `oppPlayer` on puckouts** — both fields are needed for the marking matchup breakdown; do not remove either
- **`$: slotMap` in Squad.svelte** — must stay a reactive declaration; converting to a plain function call in the template breaks pitch view updates in Svelte 5
- **`nextAvailableNumber()` for free jersey numbers** — never use `players.length + 1`; it produces duplicates after deletions
- **CSS custom properties for all colours** — never hardcode `#6B1B2B` or any primary colour hex; use `var(--primary)` and `rgba(var(--primary-rgb), ...)` so club colour overrides apply everywhere

---

## Roadmap

### Done
- [x] Match page — live logging, quick mode, player rows mode
- [x] Timer with wall-clock persistence (accurate after app close/device off)
- [x] Pitch coordinate picker (DB end vs opposition end)
- [x] Opposition score tracker — log opp player number + which DB player was marking
- [x] Substitution tracker with log
- [x] Custom stats (per match)
- [x] Squad management page (saved between matches)
- [x] Player Stats — aggregate stats, trend chart, per-match table, compare mode
- [x] Team Stats — pitch map with stat + period filters, top performers
- [x] Previous Matches — archive, search, filter, detail view, delete
- [x] Match Timeline — chronological event feed with SVG icons, puckout filter pill
- [x] Settings — team name, age group, default stats, data export
- [x] Team Targets — set goals per stat, track progress, trend
- [x] Supabase auth + sync — multi-account, per-coach data isolation
- [x] Draft auto-save — match survives app close / device off, auto-resumes silently
- [x] Logo path standardised — all references use `doora-barefield.png` (public folder)
- [x] PWA offline install — `manifest.json` + `sw.js` (cache-first for assets, network-first for Supabase), registered in `index.html`
- [x] PDF match report export — `window.print()` + `@media print` CSS in `History.svelte`
- [x] Auto-sync to Supabase — `scheduleAutoSync()` debounced 10s; NOT called on timer ticks
- [x] Puckout tracking — log every puckout as won/lost, our player, opp player number, zone
- [x] Puckout zone picker — 10-zone SVG pitch map (5 cols × 2 rows) in the log modal
- [x] Opposition player tracking on lost puckouts — records which opp player won it and who was marking; shown as matchup lines in stats
- [x] Cancel match button — confirms then discards draft and returns to setup
- [x] Quick View Stats panel — Stats button in action bar, available at any time during the match; collapsible accordions with live data, zone heatmap, marking breakdowns, standout callouts
- [x] Match history puckout section — shows opp player winners, marking matchups, biggest winner standouts
- [x] Match history conceded section — split into by-marker and by-opp-player with standout callouts
- [x] Settings rework — auto-save on every change (no Save button), per-stat tracking toggles to hide unused stats, period count management (add/remove periods beyond H1/H2)
- [x] SVG icons — all emojis replaced with inline SVG icons throughout the entire app for consistent cross-platform rendering (no emoji font dependency)
- [x] Club colour picker — Settings has 8 GAA county presets + custom colour input; primary colour applied globally via CSS custom properties at runtime
- [x] Dynamic team name — `document.title` and nav brand name reflect `settingsStore.teamName`; scoreboard labels and match setup hero also use it
- [x] Dark mode removed — app is light-only; `[data-theme="dark"]` block removed from `app.css`
- [x] Squad pitch view — List/Pitch toggle on Squad page; visual GAA formation with 15 slots; tap to assign players, inline new-player form, removable sub chips, reactive `$: slotMap` driving display
- [x] Lineup auto-populated on match start — `Match.svelte` builds `lineup` from squad jersey numbers silently; saved with match for PDF export; no interactive builder on setup screen
- [x] Landing page integrated into app — `Landing.svelte` is the full dark-themed marketing site shown to web (non-PWA) visitors who aren't signed in; sign-in/signup form is embedded directly in the hero; PWA users get the compact `Auth.svelte` card (detected via `matchMedia('(display-mode: standalone)')`)
- [x] Pricing section on landing page — 5 cards: Free, Personal Pro €7.99/mo, Club €15/mo, Club Pro €25/mo, Custom/Enterprise (contact CTA, amber styling); all plan buttons use `goToSignup(mode)` to set auth mode + smooth-scroll to hero sign-in card
- [x] Google Fonts added to `index.html` — Bebas Neue, Barlow Condensed, Outfit; used by `Landing.svelte` only
- [x] Landing page buttons fully wired — all CTAs use `goToSignup(mode)` helper; nav anchor links have `scroll-padding-top: 80px` offset for fixed nav; contact/enterprise button left as mailto link
- [x] Landing page pitch map mockup — rebuilt to exactly match the real puckout zone heatmap: green pitch (`#2d7a2d`), 5 cols × 2 rows (Short/Own Half/Midfield/Opp Half/Long), white W/L + % labels in every zone, green/amber/red fills by win-rate threshold (≥67%/40–66%/<40%), goal boxes, centre line, dashed midfield line, zone dividers, DB END / OPP END labels
- [x] Landing page analytics mockup — replaced generic bar chart with accurate match logging screen SVG showing live score, H1 timer, player rows with + stat buttons, and puckout/score/sub action bar

- [x] Stripe subscription payments — Personal Pro (€7.99/mo), Club (€15/mo), Club Pro (€25/mo); Stripe Checkout hosted by Supabase Edge Functions; webhook syncs plan/status to DB; Stripe Customer Portal for managing card/invoices/cancellation

### Still To Build
- [ ] PWA service worker needs CSS/JS asset URLs injected at build time (currently pre-caches fixed URLs; a proper build step would hash-bust correctly)

---

## Landing Page (`Landing.svelte`)

### Overview
`Landing.svelte` is a full dark-themed marketing site (~1550 lines) served to non-authenticated browser visitors. It has its own design system (fonts, colours, layout) completely separate from the app's light theme.

### Design tokens
All landing page CSS variables are scoped to the `.lp` root element — they do not bleed into the app:
```css
.lp {
  --lp-bg: #05080F;  --lp-surface: #0C1422;
  --lp-lime: #BAFF29;  --lp-amber: #FFB800;  --lp-red: #FF3A3A;
  --lp-text: #E4EDF8;  --lp-text2: #8CA3BF;  --lp-text3: #4A6280;
  --lp-font-head: 'Bebas Neue';  --lp-font-sub: 'Barlow Condensed';  --lp-font-body: 'Outfit';
}
```

### Sections (in order)
1. **Nav** — fixed top bar with anchor links + "Sign In" CTA → `#signin`
2. **Hero** — 2-col grid: marketing copy left, dark auth card right (`id="signin"`)
3. **Marquee strip** — scrolling feature list
4. **Features** — 3-col grid of feature cards
5. **Pitch map** (`id="pitch"`) — puckout zone heatmap SVG mockup
6. **Offline** (`id="offline"`) — PWA/offline story
7. **Stats showcase** — animated count-up numbers
8. **Analytics** (`id="analytics"`) — match logging screen mockup + player season totals
9. **Timeline** (`id="timeline"`) — match event feed mockup
10. **Pricing** (`id="pricing"`) — 5 plan cards
11. **CTA** — final sign-up push
12. **Footer**

### Auth card in hero
The hero section contains a full sign-in/signup flow (`mode`: `'login'` | `'choose'` | `'personal'` | `'club'` | `'join'`). It shares the same `signIn`/`signUp` functions as `Auth.svelte` but uses dark-themed styles prefixed `auth-dark-*`.

### Button pattern — `goToSignup(mode)`
All CTA and pricing buttons call `goToSignup(mode)` which sets the auth card mode then smooth-scrolls to `#signin`:
```javascript
function goToSignup(m) {
  setMode(m)
  document.getElementById('signin')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}
```
- Free / Personal Pro → `goToSignup('personal')`
- Club / Club Pro → `goToSignup('club')`
- Hero "Get Started Free" → `goToSignup('choose')` (shows account type picker)
- Custom/Enterprise → `mailto:` link (no JS needed)

### Scroll reveal — IMPORTANT CSS GOTCHA
Elements with `.reveal` start at `transform: translateY(24px)` and animate to `translateY(0)` when the `in` class is added by `IntersectionObserver`.

**Do NOT add `opacity: 0` to `.reveal`.** Svelte's scoped CSS compiles `.reveal.in` to `.reveal.in.svelte-xyz`, but the dynamically JS-added `in` class doesn't carry the Svelte scoping attribute, so the opacity rule never matches and content stays permanently invisible. The transform-only approach works because it doesn't require the `.in` class to restore visibility.

A 1.5s fallback timer also force-adds `.in` to all reveals in case the observer doesn't fire:
```javascript
const fallback = setTimeout(() => revealEls.forEach(el => el.classList.add('in')), 1500)
```

### Pitch map mockup
The "Spatial Intelligence" section SVG exactly replicates the real puckout zone heatmap from `Match.svelte`:
- `viewBox="0 0 360 130"`, green background `#2d7a2d`
- 5 columns: Short (x=5,w=70) / Own Half (x=75,w=70) / Midfield (x=145,w=70) / Opp Half (x=215,w=70) / Long (x=285,w=70)
- 2 rows: top (y=8,h=52) / bottom (y=60,h=52), split by horizontal line at y=60
- Zone fills: green overlay ≥67%, amber 40–66%, red <40%
- Each zone shows `NW NL` on line 1 and `N%` on line 2, white text
- Goal boxes at x=5 and x=337, DB END / OPP END labels, zone names along bottom

### Analytics mockup
The analytics section left panel shows an SVG of the actual match logging screen (`viewBox="0 0 300 200"`):
- Top nav bar with team name, H1 timer, STATS button
- Score area showing `0-07 vs 0-05`
- Three player rows (B. Murphy / S. Collins / C. Ryan) each with player name, stat label, count, and `+` button styled with lime green
- Bottom action bar with PUCKOUT / OPP SCORE / SUB buttons

---

## Stripe & Payments

### Architecture
Payments run through four Supabase Edge Functions (all deployed with `--no-verify-jwt`):

| Function | Purpose |
|---|---|
| `create-checkout-session` | Creates a Stripe Checkout session and returns the URL |
| `stripe-webhook` | Receives Stripe events and syncs subscription state to DB |
| `cancel-subscription` | Cancels at period end via Stripe; DB updated by webhook |
| `create-portal-session` | Creates a Stripe Customer Portal session for billing management |

### Webhook events handled
- `checkout.session.completed` — activates plan after payment
- `customer.subscription.updated` — syncs plan, status, period end, `cancel_at_period_end`
- `customer.subscription.deleted` — downgrades to free
- `invoice.payment_succeeded` — refreshes period end on renewal
- `invoice.payment_failed` — marks status as `past_due`

### DB columns (subscriptions table)
| Column | Purpose |
|---|---|
| `plan` | `'free'` \| `'personal'` \| `'club'` \| `'club_pro'` |
| `status` | `'active'` \| `'trialing'` \| `'past_due'` \| `'cancelled'` |
| `cancel_at_period_end` | `true` when user has cancelled but period hasn't ended |
| `current_period_end` | ISO timestamp of next billing date |
| `stripe_customer_id` | Reused on resubscribe to avoid duplicate Stripe customers |
| `stripe_subscription_id` | Used to match webhook events to DB rows |

`user_id` has a UNIQUE constraint — one subscription row per user.

### Supabase secrets required
```
STRIPE_SECRET_KEY       sk_test_... (or sk_live_... in production)
STRIPE_WEBHOOK_SECRET   whsec_...
```

### Going live (test → production)
1. Activate Stripe account (business details + bank account)
2. Switch to live mode in Stripe
3. Create the same 3 products/prices in live mode — copy the new `price_...` IDs
4. Update the 3 price IDs in `supabase/functions/create-checkout-session/index.ts`
5. Update the 3 price IDs in `supabase/functions/stripe-webhook/index.ts` (`PLAN_BY_PRICE`)
6. Run: `supabase secrets set STRIPE_SECRET_KEY=sk_live_...`
7. Create a new live webhook endpoint in Stripe pointing to the same URL, add the same 5 events
8. Run: `supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_live_...`
9. Redeploy all four functions

### Deploying edge functions
Requires the Supabase CLI (`~/Downloads/supabase` or install fresh):
```bash
supabase link --project-ref syikhsgovqogzkmmhuis
supabase functions deploy create-checkout-session --no-verify-jwt
supabase functions deploy stripe-webhook --no-verify-jwt
supabase functions deploy cancel-subscription --no-verify-jwt
supabase functions deploy create-portal-session --no-verify-jwt
```

### Stripe Customer Portal
Activated. The "Manage billing" button in Settings opens the portal for the logged-in user (no email entry required — session is created server-side using their `stripe_customer_id`).

### Sandbox setup status
All of the following are complete and confirmed working in test mode:
- [x] SQL migrations run (`stripe_customer_id`, `stripe_subscription_id`, `cancel_at_period_end`, unique constraint on `user_id`)
- [x] Webhook events registered: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`
- [x] Stripe Customer Portal activated
- [x] All four edge functions deployed with `--no-verify-jwt`
- [x] Supabase secrets set: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

---

## Related Projects

| Project | Location | GitHub |
|---|---|---|
| Landing page | `~/gaa-stats-landing/` | https://github.com/Bressie10/gaa-stats-landing- |

---

### Key Goals
- Works fully offline at any GAA ground — no internet required during a match
- Multiple coaches, multiple teams — fully isolated data per account
- Fast enough to use one-handed on a phone while watching a match
- Data never lost — auto-save draft + Supabase cloud backup
