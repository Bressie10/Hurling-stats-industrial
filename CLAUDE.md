# CLAUDE.md — GAAstat

PWA for GAA coaches to track hurling match stats in real time. Coaches log stats during matches, view analytics, and sync to Supabase. Works fully offline at GAA grounds.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | SvelteKit + adapter-vercel |
| Language | JavaScript (no TypeScript) |
| Local storage | IndexedDB via `idb` |
| Cloud sync | Supabase (PostgreSQL + Auth) |
| Charts | Chart.js |
| Styling | Scoped CSS inside Svelte components |
| PWA | `sw.js` + `manifest.json` in `static/` |
| Deployment | Vercel |

**Svelte 5 legacy mode:** Uses `let`, `$:`, `on:click` — NOT runes (`$state`, `$derived`, `$effect`). Do not mix rune syntax.

**SvelteKit:** All routes set `export const ssr = false` (CSR-only). Static assets in `static/` (not `public/`). Navigation via `goto()` from `$app/navigation`.

---

## File Structure

```
src/
├── app.html / app.css
├── lib/
│   ├── db.js              # IndexedDB ops
│   ├── supabase.js        # Supabase client (env vars)
│   ├── auth-store.js      # Auth writable store
│   ├── settings-store.js  # App settings store (incl. rememberLastTeam)
│   ├── subscription-store.js  # Club/team membership, join/leave
│   ├── sync.js            # Supabase push/pull
│   ├── Match.svelte        # Live match logging
│   ├── Squad.svelte        # Squad management (list + pitch views)
│   ├── PlayerStats.svelte  # Player stats + charts
│   ├── TeamStats.svelte    # Team stats + pitch map
│   ├── History.svelte      # Match archive + PDF export
│   ├── Timeline.svelte     # Match event feed
│   ├── Settings.svelte     # Settings + join/leave team
│   ├── Landing.svelte      # Marketing landing page (unauthenticated)
│   ├── LpNav.svelte        # Shared public nav
│   └── LpFooter.svelte     # Shared public footer
└── routes/
    ├── +layout.svelte      # Root layout (auth gate, nav, global state)
    ├── +page.svelte        # / → Landing or app redirect
    ├── contact|docs|install|pricing|privacy|terms/+page.svelte
    └── app/
        ├── +layout.svelte
        └── history|live|match|player|settings|squad|targets|team|timeline/+page.svelte
static/
├── doora-barefield.png  # Club crest — use this path, not /src/assets/
├── gaastat-icon.svg     # App icon (LpNav logo)
├── gaastat-logo.svg
├── manifest.json
└── sw.js
```

---

## Key Commands

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run preview  # Preview build
```

**Env vars** (`.env` for dev, Vercel dashboard for prod):
```
PUBLIC_SUPABASE_URL=https://syikhsgovqogzkmmhuis.supabase.co
PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

---

## Database

### IndexedDB (`src/lib/db.js`)

| Store | Key | Notes |
|---|---|---|
| `matches` | `id` (number or `'draft'`) | `loadMatches()` filters out `isDraft: true` |
| `squad` | `id` | |

Draft: saved as `id: 'draft'`, `isDraft: true`. Auto-resumed on load, cleared by `finishMatch()`.

### Supabase Tables

| Table | Purpose |
|---|---|
| `matches` / `squad` | Cloud copies per user |
| `profiles` | Team name, age group |
| `club_members` | Roles: `owner` \| `admin` \| `coach` |
| `team_members` | `(club_id, team_id, user_id, role)` — many-to-many |
| `teams` | Sub-teams within club (up to 4), each with join code |
| `subscriptions` | Plan, status, Stripe IDs; `custom_features` JSONB for per-club overrides |

All tables have RLS. `custom_features` keys: `isPro`, `isClub`, `isClubPro` (bool), `maxTeams` (int).

**Two-tier roles:**
- Club: `owner` (implicit all-team access) | `admin` | `coach`
- Team: `coach` | `player` (multiple teams via multiple `team_members` rows)
- `activeTeamId` persisted to `localStorage('active-team-id')`

**Active team flow:** On login, if multiple teams and no `activeTeamId` and `!rememberLastTeam` → show `TeamPicker`. `leaveTeam()` clears localStorage if it was the active team.

---

## Auth Flow

All unauthenticated visitors (web + PWA) see `Landing.svelte` with sign-in embedded in hero. `Auth.svelte` exists but is unused.

1. User signs in via `Landing.svelte`
2. `clearAllData()` wipes local IndexedDB — **never skip this**
3. `syncFromSupabase()` pulls user's data
4. `dataReady = true` — app renders
5. On sign out: `clearAllData()` again

---

## Patterns & Conventions

### Svelte 5 legacy reactivity gotcha
**Template function calls do not track reactive dependencies.** Any derived value driving the template MUST be a `$:` declaration — not a plain function called inline. Example: `$: slotMap = ...` in `Squad.svelte` (not `getPlayerForSlot()` in template).

### Player identity
Players identified by **name**, not jersey number. Numbers change week to week. Always use name as stable identifier.

### Data structures

```javascript
// Stats
stats[playerId][statName] = count

// Event (pitch map)
{ playerId, stat, period, time, x, y, end }  // x/y: 0-100%, end: 'db'|'opposition'

// Puckout
{ outcome, ourPlayer, oppPlayer, section, time, period }
// outcome: 'won'|'lost'. On lost: oppPlayer=who won it, ourPlayer=who was marking

// Opposition score
{ type, oppPlayerNum, marker, time, period }  // type: 'goal'|'point'
```

### Puckout zones
Format: `'<col>-<row>'` e.g. `'midfield-top'`. Cols: `short`, `own-half`, `midfield`, `opp-half`, `long`. Rows: `top`, `bottom`. Use `formatZoneLabel(key)` for display.

### Theming
Never hardcode primary colours. Use CSS custom properties:
- `var(--primary)` — default `#5A8A00`, overridable per-club
- `var(--primary-hover)`, `var(--primary-rgb)`, `var(--primary-text)`
- Backgrounds: `--bg`, `--surface`, `--surface-2`, `--surface-3`
- Borders: `--border`, `--input-border`, `--divider`, `--divider-faint`
- Text: `--text`, `--text-2`, `--text-muted`, `--text-faint`
- Semantic colours (success `#2d7a2d`, error `#e53935`) kept as hex — they don't change

App is **light-only**. Dark mode removed. Do not add `[data-theme="dark"]` back.

### Draft auto-save
`saveDraft()` called on every stat tap, sub, score change, puckout log, timer tick. Draft auto-resumes silently on load — no "Resume or Discard?" prompt. Saves `screen: 'stats'|'match'` so stats panel is also restored.

### Timer
Uses `timerStartedAt = Date.now()` (wall-clock). On restore: `elapsed = floor((Date.now() - timerStartedAt) / 1000)`. Never revert to a pure counter.

### Squad page
- Positions use full GAA names: `'Goalkeeper'`, `'Right Corner Back'`, etc. — never old abbreviations (`GK`, `FB`).
- `PITCH_ROWS = [[13,14,15],[10,11,12],[8,9],[5,6,7],[2,3,4],[1]]`
- A player occupies a slot iff `number >= 1 && number <= 15 && position !== 'Sub'` (`isInPitchSlot(p)`)
- Always use `nextAvailableNumber()` for free jersey numbers — never `players.length + 1`
- `$: slotMap` MUST stay a reactive declaration

### Lineup
`Match.svelte` auto-populates `lineup` (slot → player ID) from squad jersey numbers when match starts. Saved with match for PDF export. No interactive lineup builder on setup screen.

### Match screen
`screen` variable: `'setup'` | `'match'` | `'stats'`. Quick View Stats (Stats button) keeps timer running. Accordions: puckouts, conceded, players, subs.

---

## Branding

App name is **GAAstat** everywhere — in fallback strings, meta tags, legal pages, and marketing copy. Default `settingsStore.teamName` fallback is `'GAAstat'`. Club colour picker has been removed from Settings — `clubPrimaryColor` still exists in the store and is applied at runtime via `+layout.svelte`, but there is no UI to change it.

---

## Things To Never Break

- `clearAllData()` on login — prevents data bleed between coaches
- `loadMatches()` filtering `isDraft` — prevents draft appearing in history
- RLS in Supabase — never disable
- Player identity by name — switching to ID breaks cross-match aggregation
- `dataReady` gate — components must not mount before sync completes
- `saveDraft()` on every state change — removing any call risks data loss
- Silent auto-resume draft — no "Resume or Discard?" screen
- `timerStartedAt` wall-clock — don't revert to counter
- Logo path `doora-barefield.png` — static-root path only, never `/src/assets/`
- `export const ssr = false` / `prerender = false` on all routes
- `PUBLIC_SUPABASE_URL` + `PUBLIC_SUPABASE_ANON_KEY` in env — never hardcode
- `stopLive()` in `Match.svelte` — called inside `doFinishMatch()` **after** `saveMatch()` + `clearDraftMatch()` succeed, never before the confirm modal. Moving it back to `finishMatch()` would end the live session even if the user cancels.
- `ourPlayer` + `oppPlayer` on puckouts — both needed for marking breakdowns
- `$: slotMap` in Squad.svelte — must stay reactive declaration
- `nextAvailableNumber()` — never `players.length + 1`
- CSS custom properties for all colours — never hardcode `--primary` hex

---

## Landing Page (`Landing.svelte`)

Dark-themed marketing site (~1550 lines). CSS vars scoped to `.lp {}` — don't bleed into app.

**Sections:** Nav → Hero (with sign-in card `#signin`) → Marquee → Features → Pitch map (`#pitch`) → Offline → Stats showcase → Analytics (`#analytics`) → Timeline → Pricing (`#pricing`) → CTA → Footer

**Auth modes:** `'login'` | `'choose'` | `'personal'` | `'club'` | `'join'`

**Payment-during-signup:** Personal Pro stores `pending_checkout_plan: 'personal'` in localStorage; Club stores `'club'` or `'club_pro'`. `+layout.svelte` detects this on first login and redirects to Stripe Checkout.

**Button pattern:**
```javascript
function goToSignup(m) {
  setMode(m)
  document.getElementById('signin')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}
```

### CRITICAL CSS Gotcha — Scroll Reveal in Landing.svelte
**Do NOT add `opacity: 0` to `.reveal` in `Landing.svelte`.** Svelte compiles `.reveal.in` to `.reveal.in.svelte-xyz`, but the JS-added `in` class lacks the Svelte scope attribute, so opacity never restores and content stays invisible. Use `transform: translateY(24px)` only (no opacity). Public pages (`DocsPage`, etc.) DO use `opacity: 0` — that's fine because their styles are component-scoped.

1.5s fallback: `setTimeout(() => revealEls.forEach(el => el.classList.add('in')), 1500)`

---

## Public Site (8 pages)

Routes: `/contact`, `/docs`, `/install`, `/pricing`, `/privacy`, `/terms` + `/` and `/app/*`.

All share `LpNav.svelte` (CSS-only hover dropdowns, no JS) + `LpFooter.svelte`. LP design tokens in `app.css` scoped to `.lp {}`:
```
--lp-bg: #05080F  --lp-surface: #0C1422  --lp-border: #1e3a5f
--lp-lime: #BAFF29  --lp-amber: #FFB800  --lp-red: #FF3A3A
--lp-text: #E4EDF8  --lp-text2: #8CA3BF  --lp-text3: #4A6280
--lp-font-head: 'Bebas Neue'  --lp-font-sub: 'Barlow Condensed'  --lp-font-body: 'Outfit'
```

LpNav dropdowns: CSS `:hover` on `.dd-trigger`. Three groups: **Product**, **Resources**, **Company**. First item is standalone **Home** link.

---

## Stripe & Payments

Four Supabase Edge Functions (all `--no-verify-jwt`):
- `create-checkout-session` — creates Stripe Checkout URL
- `stripe-webhook` — syncs plan/status to DB
- `cancel-subscription` — cancels at period end
- `create-portal-session` — opens Stripe Customer Portal

**Subscription columns:** `plan`, `status`, `cancel_at_period_end`, `current_period_end`, `stripe_customer_id`, `stripe_subscription_id`. One row per user (`user_id` UNIQUE).

**Plans:** `free` | `personal` (€7.99/mo) | `club` (€15/mo) | `club_pro` (€25/mo)

**Deploy functions:**
```bash
supabase link --project-ref syikhsgovqogzkmmhuis
supabase functions deploy create-checkout-session --no-verify-jwt
supabase functions deploy stripe-webhook --no-verify-jwt
supabase functions deploy cancel-subscription --no-verify-jwt
supabase functions deploy create-portal-session --no-verify-jwt
```

**Secrets:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

**Going live:** Switch Stripe to live mode → create products/prices → update price IDs in `create-checkout-session` and `stripe-webhook` → update secrets → redeploy.

---

## Database Notes

### `live_sessions` foreign key
`live_sessions.host_user_id` references `auth.users(id) ON DELETE CASCADE`. This was added manually — without it, deleting a user who has ever hosted a live session throws a FK violation. If you add new tables that reference `auth.users`, always add `ON DELETE CASCADE`.

### `delete_own_account` RPC
Called from `Settings.svelte → doDeleteAccount()`. It's a PostgreSQL function in Supabase that deletes the user's data and their `auth.users` entry. If it doesn't exist or is missing permissions, account deletion will fail with a database error.

---

## Still To Build

- [ ] PWA service worker: inject hashed CSS/JS asset URLs at build time (currently pre-caches fixed URLs)

---

## Key Goals
- Works fully offline at any GAA ground
- Multiple coaches, multiple teams — fully isolated data per account
- Fast enough one-handed on a phone during a match
- Data never lost — auto-save draft + Supabase cloud backup
