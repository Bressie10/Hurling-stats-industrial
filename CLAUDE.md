# CLAUDE.md - PitchNote

PWA for hurling coaches to track hurling match stats in real time. Coaches log stats during matches, view analytics, and sync to Supabase. Works fully offline at low-signal grounds.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | SvelteKit + adapter-vercel |
| Language | JavaScript (no TypeScript) |
| Local storage | IndexedDB via `idb` |
| Cloud sync | Supabase (PostgreSQL + Auth) |
| Charts | Chart.js |
| PDF export | jsPDF 4.x + html2canvas 1.4.x |
| Styling | Scoped CSS inside Svelte components |
| PWA | SvelteKit-native `src/service-worker.js` + `manifest.json` in `static/` |
| Deployment | Vercel |

**Svelte 5 mode — mixed:** App surfaces such as `Match.svelte`, `SidelineAI.svelte`, `History.svelte`, `Insights.svelte`, `Settings.svelte`, `Squad.svelte`, `PlayerStats.svelte`, `TeamStats.svelte`, and `Timeline.svelte` use runes (`$state`, `$derived`, `$props`, `$effect`). Some public/older components still use legacy syntax. Preserve each file's existing mode and do not mix rune and legacy syntax within a single file.

**SvelteKit:** All routes set `export const ssr = false` (CSR-only). Static assets in `static/` (not `public/`). Navigation via `goto()` from `$app/navigation`.

---

## File Structure

```
src/
├── app.html / app.css
├── service-worker.js      # SvelteKit SW: precaches hashed build assets via $service-worker
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
├── pitchnote-icon.svg     # App icon source (in-app + favicon)
├── pitchnote-logo.svg
├── icons/               # Generated PNGs (192/512 manifest, 180 apple-touch, 1024 store art)
└── manifest.json
scripts/
└── generate-icons.mjs   # Regenerates static/icons/ from pitchnote-icon.svg (uses sharp)
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
SUPABASE_SERVICE_ROLE_KEY=<service role key for local admin scripts and Edge Functions only>
SUPABASE_DB_URL=<database URL for local psql migration helpers>
OPENAI_API_KEY=<server key>
SIDELINE_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe
SIDELINE_ANSWER_MODEL=gpt-4o-mini
STRIPE_SECRET_KEY=<Stripe secret key>
STRIPE_WEBHOOK_SECRET=<Stripe webhook signing secret>
STRIPE_PORTAL_CONFIGURATION_ID=<Stripe Customer Portal configuration id>
STRIPE_WEBHOOK_ENDPOINT_ID=<Stripe webhook endpoint id for npm run billing:check>
STRIPE_PERSONAL_PRICE_ID=<Stripe Personal price id>
STRIPE_CLUB_PRICE_ID=<Stripe Club price id>
STRIPE_CLUB_PRO_PRICE_ID=<Stripe Club Pro price id>
APP_URL=https://www.pitchnote.ie
ALLOWED_CORS_ORIGINS=<optional comma-separated extra browser origins>
```

---

## Database

### IndexedDB (`src/lib/db.js`)

| Store | Key | Notes |
|---|---|---|
| `matches` | `id` (number, `'draft'`, or `draft:<teamScope>`) | `loadMatches()` filters out `isDraft: true` and applies current team scope |
| `squad` | `id` | Legacy personal squad store |
| `squad_by_team` | `storeKey` (`teamScope:localId`) | Current team-scoped squad store, indexed by `teamScope` |

Draft: personal scope saves as `id: 'draft'`; active-team scope saves as `id: 'draft:<teamScope>'`; both use `isDraft: true`. Auto-resumed on load for the current scope, cleared by `finishMatch()`.

### Supabase Tables

| Table | Purpose |
|---|---|
| `matches` / `squad` | Cloud copies per user, with nullable `team_id` for active-team scoped rows |
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
- `src/lib/team-scope.js` is the source for the active-team localStorage key and personal/team scope normalization.
- `supabase/migrations/20260617_team_scoped_data_and_rls.sql` adds `team_id` to match/squad cloud rows, changes match cloud conflicts to `(id, user_id)`, tightens teams/live session RLS, and validates that user-owned rows are tagged only to teams the user can access. `supabase/migrations/20260617_team_scoped_policy_reset.sql` must run after it to remove stale policy variants and recreate the intended policy set.

**Code-based joins:** Team joins go through the `join_team_with_code(p_code text)` security-definer RPC. Club-code lookup goes through `find_club_by_code(p_code text)`. Do not reintroduce direct client inserts into `club_members` / `team_members` for self-join flows.

**Active team flow:** On login, if multiple teams and no `activeTeamId` and `!rememberLastTeam` → show `TeamPicker`. `leaveTeam()` clears localStorage if it was the active team.

---

## Auth Flow

All unauthenticated visitors (web + PWA) see `Landing.svelte` with sign-in embedded in hero. `Auth.svelte` exists but is unused.

1. User signs in via `Landing.svelte`
2. `+layout.svelte` compares the authenticated user with the IndexedDB `last_user_id` sentinel
3. Same user: `flushOutbox()` drains pending local mutations, then `syncFromSupabase()` merges cloud data
4. Different user: best-effort sync of the previous user's outbox, then `clearAllData()`, then cloud pull for the new user
5. `dataReady = true` — app renders even if offline sync/pull fails
6. On sign out: best-effort `flushOutbox()`, `clearAllData()`, and clear team-specific localStorage keys

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

// Match review fields synced with matches.data
coachSummary: string
workOns: string[]
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
- Positions use full hurling position names: `'Goalkeeper'`, `'Right Corner Back'`, etc. — never old abbreviations (`GK`, `FB`).
- `PITCH_ROWS = [[13,14,15],[10,11,12],[8,9],[5,6,7],[2,3,4],[1]]`
- A player occupies a slot iff `number >= 1 && number <= 15 && position !== 'Sub'` (`isInPitchSlot(p)`)
- Always use `nextAvailableNumber()` for free jersey numbers — never `players.length + 1`
- `$: slotMap` MUST stay a reactive declaration

### Lineup
`Match.svelte` auto-populates `lineup` (slot → player ID) from squad jersey numbers when match starts. Saved with match for PDF export. No interactive lineup builder on setup screen.

### PDF export (`History.svelte`)
`generatePDF()` uses **jsPDF** (A4 portrait, 15mm margins) + **html2canvas** to produce a 4-page report:
- **Page 1:** Logo header → lime `#A8E63D` divider → dark result block → player stats table
- **Page 2:** Puckout summary → by-player table → opp winners → zone breakdown → zone heatmap (html2canvas of `.print-zone-svg`, XMLSerializer fallback)
- **Page 3:** Shots map + all-actions map (html2canvas of `.print-pitch-svg` elements) → scoring timeline
- **Page 4:** Top performers → full event log

The `.print-only` sections in the template must stay — their SVG elements need to be in the DOM for capture. `window.print()` and all `@media print` CSS have been removed. Filename: `ClubName_vs_Opp_YYYY-MM-DD.pdf`.

### Match screen
`screen` variable: `'setup'` | `'match'` | `'stats'`. Quick View Stats (Stats button) keeps timer running. Accordions: puckouts, conceded, players, subs.

### Sideline AI voice
Sideline AI uses short clips sent to `src/routes/api/voice/transcribe`, then deterministic local parsing in `src/lib/sideline-command-parser.js`. The transcribe route uses server-side `OPENAI_API_KEY`, requires the caller's Supabase bearer token, and validates it against Supabase Auth before calling OpenAI. The old OpenAI Realtime routes/client were removed; do not restore them for match logging cost control.

### Native live voice logging
`LiveVoiceLogger.svelte` is the live match logger and stays offline-first: it calls `recognizeOnDeviceSpeech()` and then `parseVoiceLog()`, not `/api/voice/transcribe`. Current v1 live voice stats are Point, Goal, Wide, Free Won, Turnover Lost, and Yellow Card. The parser accepts roster names, unambiguous surnames, initials for duplicate surnames, jersey numbers, number words, fuzzy names, and native STT alternatives. It returns `matchSource`, confidence, low-confidence state, candidates, and `needsLocation` for Point/Goal/Wide when pitch coordinates are enabled. Black/red cards, 45s, and sideline balls remain tap-only.

---

## Branding

App name is **PitchNote** everywhere — in fallback strings, meta tags, legal pages, and marketing copy. Default `settingsStore.teamName` fallback is `'PitchNote'`. Club colour picker has been removed from Settings — `clubPrimaryColor` still exists in the store and is applied at runtime via `+layout.svelte`, but there is no UI to change it.

---

## Things To Never Break

- `clearAllData()` only on real account change or sign-out — same-user login must preserve local drafts/outbox
- `loadMatches()` filtering `isDraft` — prevents draft appearing in history
- RLS in Supabase — never disable
- Player identity by name — switching to ID breaks cross-match aggregation
- `dataReady` gate — components must not mount before sync completes
- `saveDraft()` on every state change — removing any call risks data loss
- Silent auto-resume draft — no "Resume or Discard?" screen
- `timerStartedAt` wall-clock — don't revert to counter
- Logo/icon path `/pitchnote-icon.svg` — static-root path only, never `/src/assets/`
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

**Secrets:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PORTAL_CONFIGURATION_ID`, `STRIPE_PERSONAL_PRICE_ID`, `STRIPE_CLUB_PRICE_ID`, `STRIPE_CLUB_PRO_PRICE_ID`, `APP_URL`, optional `ALLOWED_CORS_ORIGINS`

**Going live:** Switch Stripe to live mode → create products/prices → set the live price IDs, Customer Portal config, webhook signing secret, and `APP_URL` as Supabase Edge Function secrets → run `npm run billing:check` with the matching `STRIPE_WEBHOOK_ENDPOINT_ID` locally → redeploy. Do not hard-code Stripe price IDs in Edge Function source.

---

## Database Notes

### `live_sessions` foreign key
`live_sessions.host_user_id` references `auth.users(id) ON DELETE CASCADE`. This was added manually — without it, deleting a user who has ever hosted a live session throws a FK violation. If you add new tables that reference `auth.users`, always add `ON DELETE CASCADE`.

### `delete_own_account` RPC
Called from `Settings.svelte → doDeleteAccount()`. It's a PostgreSQL function in Supabase that deletes the user's data and their `auth.users` entry. If it doesn't exist or is missing permissions, account deletion will fail with a database error.

---

## PWA

**Service worker:** `src/service-worker.js` (SvelteKit-native, auto-registered in prod — no manual `register()` call). Gets `build`/`files`/`version` from `$service-worker`, so hashed asset URLs are always current and the cache name bumps per deploy. Strategy: network-first for Supabase and navigations (cached `/` shell as offline fallback), cache-first for everything else. `app.html` contains a snippet that unregisters the legacy `/sw.js` worker — keep it until existing installs have migrated.

**Manifest:** `static/manifest.json` — `name`/`short_name` are `"PitchNote"`. Icons are PNGs in `static/icons/` (192 + 512, declared for both `any` and `maskable`; white background, generated via `node scripts/generate-icons.mjs`). Do not revert to SVG-only manifest icons (Play Store/TWA packaging requires PNG) or `"DB Stats"`. `icon-1024.png` is store listing art, not referenced by the manifest. Apple touch icon: `/icons/apple-touch-icon.png` (iOS ignores SVG there).

---

## Key Goals
- Works fully offline at low-signal grounds
- Multiple coaches, multiple teams — fully isolated data per account
- Fast enough one-handed on a phone during a match
- Data never lost — auto-save draft + Supabase cloud backup
