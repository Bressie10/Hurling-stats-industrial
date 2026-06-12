# Fix verified bugs in GAAstat (SvelteKit hurling stats PWA)

You are fixing a list of **verified, code-reviewed bugs** in this repo. Every finding below has been confirmed against the actual code with file and line references (lines may have shifted slightly — locate by the quoted code, not the line number alone). Do not re-litigate whether they are bugs; fix them.

## Ground rules — read before touching anything

1. **Read `CLAUDE.md` at the repo root first.** It lists project invariants under "Things To Never Break". Do not violate them.
2. **JavaScript only, no TypeScript.** Scoped CSS inside Svelte components.
3. **Svelte 5 mixed modes:** `Match.svelte`, `History.svelte`, `Insights.svelte`, `SidelineAI.svelte` and most newer files use **runes** (`$state`, `$derived`, `$effect`, `onclick`). Some older components use legacy mode (`let`, `$:`, `on:click`). **Match the mode of the file you're editing — never mix syntaxes in one file.**
4. **Minimal, surgical diffs.** Fix the listed bugs only. No drive-by refactors, no formatting churn, no dependency changes.
5. The app must keep working **fully offline**. Every state mutation in the live match screen must still call `saveDraft()`.
6. After each phase, run `npm run build` and confirm it succeeds. There is no test suite — state clearly in your summary what you verified and how.
7. Work in the order below. If a fix turns out to be riskier than described, fix what's safe and flag the rest in your summary rather than improvising a large change.

---

## PHASE 1 — Match-day breakers (live match screen)

### 1.1 Quick View Stats screen crashes (ReferenceError)
`src/lib/Match.svelte` (~line 2161): the stats screen's conceded accordion references `htConcededByMarker`, which does not exist. The real derived value is `allConcededByMarker` (defined ~line 811, used correctly ~line 1678).
**Fix:** rename both references (`{#if htConcededByMarker.length > 0}` and `{#each htConcededByMarker as row}`) to `allConcededByMarker`.

### 1.2 Tapping the active period pill wipes the match clock
`src/lib/Match.svelte` (~line 1345):
```svelte
<button class="period-btn" class:active={period === p}
  onclick={() => { period = p; resetTimer() }}
>{p}</button>
```
**Fix:** only reset the timer when the period actually changes: `onclick={() => { if (p !== period) { period = p; resetTimer() } }}`.

### 1.3 Decrement (−) button desyncs stats from events
`src/lib/Match.svelte` (~line 355): `decrement(playerId, stat)` decrements `stats` and the scoreboard but never removes the matching entry from `events`, leaving phantom events in the timeline, pitch maps, PDF and period breakdowns. The correct logic already exists in `removeStatEvent()` (~line 884) in the same file, which removes the last matching event AND adjusts stats/score.
**Fix:** make the `−` buttons (player rows mode, ~lines 1393/1415 calling `decrement`) go through the same logic as `removeStatEvent` so stats, scoreboard, and `events` stay consistent. Keep `saveDraft()` + `scheduleAutoSync()` calls. Preserve behavior when no matching event exists (legacy drafts): still decrement the stat count, just skip event removal.

### 1.4 Hardcoded "DB" in match header
`src/lib/Match.svelte` (~line 1304): `<div class="match-title">DB <span class="vs">vs</span> {opposition}</div>`.
**Fix:** use the team name from the settings store like the scoreboard below it does (`$settingsStore.teamName`, fallback `'GAAstat'`).

### 1.5 Failed save restarts a paused timer
`src/lib/Match.svelte`, in `doFinishMatch()` (~line 459): the `catch` block calls `startTimer()` unconditionally, even if the timer was already paused before the save attempt.
**Fix:** capture whether the timer was running at the top of `doFinishMatch()` (before `pauseTimer()`), and in the catch block only call `startTimer()` if it had been running.

### 1.6 Pitch-picker backdrop tap logs a stat instead of cancelling
`src/lib/Match.svelte` (~line 1481): the location-picker modal backdrop `onclick` calls `confirmLogWithCoords(null, null, null)` — committing the stat. Every other modal's backdrop cancels.
**Fix:** make the backdrop cancel the pending log (clear `pendingLog` / close the modal without logging). Keep the explicit "Skip — log without location" button as the way to log without coordinates.

### 1.7 Go Live double-tap creates duplicate sessions
`src/lib/Match.svelte`, `startLive()` (~line 21): no re-entrancy guard; two quick taps insert two `live_sessions` rows and leak the first channel.
**Fix:** add a guard at the top (`if (isLive || startingLive) return`) using a small in-flight flag, cleared in a `finally`.

---

## PHASE 2 — Security & deploy infrastructure

### 2.1 Service worker cache version never busts in production (CRITICAL)
`vite.config.js` (~line 15) rewrites `__CACHE_VERSION__` in `dist/sw.js`, but `adapter-vercel` outputs to `.vercel/output/static/` — `dist/` never exists, the rewrite silently no-ops, and the deployed `sw.js` contains the literal placeholder. Cache name never changes → users are served stale HTML/JS forever after every deploy.
**Fix:** in the `writeBundle`/`closeBundle` hook, rewrite `sw.js` in the path(s) that actually exist after build — check `.vercel/output/static/sw.js` (and keep `dist/sw.js` handling for safety). Better: iterate a list of candidate output paths and replace the placeholder in whichever exist. Verify after `npm run build` that `.vercel/output/static/sw.js` contains a real timestamp, not `__CACHE_VERSION__`. Do NOT otherwise change the service worker strategy.

### 2.2 Delete dead, unauthenticated OpenAI Realtime routes (CRITICAL)
- `src/routes/api/realtime/session/+server.js` and `src/routes/api/realtime/call/+server.js` mint OpenAI Realtime client secrets to **any anonymous caller**. They are dead code: their only consumer, `src/lib/realtime-assistant.js` (~1,050 lines), is not imported by any component.
**Fix:** delete both route files (the whole `src/routes/api/realtime/` directory) and delete `src/lib/realtime-assistant.js`. Grep for any remaining imports/references first and confirm none exist.

### 2.3 Lock down `/api/voice/transcribe`
`src/routes/api/voice/transcribe/+server.js`: no auth; accepts up to 8MB audio from anyone; lets the caller force the expensive model via a `highAccuracy` form field the real client never sends.
**Fix:**
- Require a Supabase JWT: read the `Authorization: Bearer <token>` header, validate it server-side by calling Supabase's auth user endpoint (`GET {PUBLIC_SUPABASE_URL}/auth/v1/user` with the token and the anon key as `apikey` header, via `fetch`) and return 401 if invalid. Use env vars, never hardcode the URL/key.
- Remove the client-controlled `highAccuracy` field; choose the model purely from server env (`SIDELINE_TRANSCRIPTION_MODEL` etc., keeping existing env names where present).
- Update the caller in `src/lib/SidelineAI.svelte` to send the current session's access token (get it from the supabase client: `(await supabase.auth.getSession()).data.session?.access_token`) in the Authorization header.

### 2.4 RLS privilege escalation (write a migration; do not edit old migrations)
Create a new file `supabase/migrations/20260611_fix_rls_holes.sql` containing:
- **`club_members` self-insert escalation:** current policy (`20260408_two_tier_roles.sql` ~line 141) allows any role/club. Replace it: drop policy `"club_members: insert own"` and recreate with `with check (user_id = auth.uid() and role = 'coach')`.
- **`team_members` open self-insert:** current policy (~line 60) lets anyone join any team without the code. Replace the policy with a `security definer` RPC `join_team_with_code(p_code text)` that looks up the team by join code, inserts `(club_id, team_id, user_id, 'coach')` for `auth.uid()`, and returns the team row; drop the open `"team_members: self insert"` policy. Grant execute to `authenticated`.
- **Join-code leakage:** `clubs`/`teams` blanket authenticated SELECT policies expose all join codes. Replace with: members can read their own club's rows; plus a `security definer` RPC `find_club_by_code(p_code text)` / use the join RPC above for teams, so codes are only matched, never listed.
Then update the client join flows that currently select by code directly (`src/lib/subscription-store.js` `joinTeam` and any club-join logic in `Landing.svelte`/`Settings.svelte`) to call the new RPCs via `supabase.rpc(...)`. Keep error messages user-friendly ("Invalid code"). State in your summary that the migration must be applied to Supabase manually.

### 2.5 Paywall hardcoded on
`src/lib/subscription-store.js` (~lines 25-29): `isPro`, `isClub`, `isClubPro` are all `derived(subscriptionStore, () => true)`. The file already has an `isActiveStatus` helper and plan/`customFeatures` plumbing.
**Fix:** restore real derivations: active `personal` plan (or `custom_features.isPro`) → `isPro`; active `club`/`club_pro` (or overrides) → `isClub`; active `club_pro` (or override) → `isClubPro`; higher tiers imply lower (`club_pro` ⇒ `isClub`, any paid ⇒ `isPro`). Use `isActiveStatus` for status checks. Also fix `src/routes/app/history/+page.svelte` which passes `proAccess={true}` — derive it from `$isPro` (import the store).

---

## PHASE 3 — Data loss & wrong numbers

### 3.1 Coach review notes never sync (destroyed on next login)
`src/lib/Insights.svelte` `saveReview()` writes `coachSummary` and `workOns` onto the match, but `src/lib/sync.js`:
- `matchToData()` (~line 170) field whitelist omits both → never pushed to Supabase.
- the pull merge (~lines 219-237) rebuilds matches from a whitelist that also omits them → wiped on pull.
**Fix:** add `coachSummary` and `workOns` to both whitelists (push payload and pull merge).

### 3.2 Cross-period sorting uses raw `time` (clock resets each half)
Events store `time` as seconds **within a period**, so sorting by raw `time` interleaves halves wrongly. Fix in three places using the same approach `Timeline.svelte` already uses (order by period first, then time). Derive a period index from the match's period list (`match.matchPeriods` or the order periods appear in events — `Timeline.svelte` shows the existing convention; reuse it):
- `src/lib/History.svelte` `scoringTimeline` (~line 633) — also recompute the running score in the corrected order.
- `src/lib/History.svelte` `fullEventLog` (~line 716).
- `src/lib/match-insights.js` `buildScoringRun()` (~line 219) — sort merged scores by `(periodIndex, time)` instead of `time` only.

### 3.3 LiveViewer phantom goals
`src/lib/LiveViewer.svelte` (~line 201) renders a player's scoreline as `Math.floor(p.pts/3)-p.pts%3`, inventing goals from points. The real counts (`s['Goal']`, `s['Point']`) are available where `pts` is computed (~line 56).
**Fix:** carry `goals` and `points` through on the player object and render `{goals}-{String(points).padStart(2,'0')}` (only when `pts > 0`, as now).

### 3.4 Deleted matches resurrect (pull races the delete outbox)
`src/routes/+layout.svelte` (~lines 152-153) runs `scheduleAutoSync(u.id)` and `syncFromSupabase(u.id)` concurrently on same-user login; the pull re-imports a match whose `delete_match` mutation is still queued.
**Fix (minimal, no tombstone system):** before merging pulled matches in `src/lib/sync.js` `pullFromCloud`, read pending outbox mutations and skip importing any cloud match whose id has a pending `delete_match` (compare ids as strings). Additionally, in `+layout.svelte`, await the outbox drain before starting the pull on the same-user path (sequential, not concurrent) — keep both wrapped so an offline failure doesn't block `dataReady`.

### 3.5 Match id type mismatch creates duplicates
`src/lib/sync.js`: push coerces `id: String(...)` (~line 114) but the pull (~line 219) writes `row.id` (a string) into IndexedDB, while locally created matches use numeric `Date.now()` ids → same match under two keys.
**Fix:** in the pull merge, when a local match exists for `String(row.id)`, write the merged record back under the **local** record's existing id/key. For cloud-only rows, convert `row.id` to a number when it's a purely numeric string before `put`. Keep the existing `String()` comparisons for lookups.

### 3.6 Empty-roster squad sync wipes cloud squad
`src/lib/sync.js` `upsert_squad` (~lines 132-164): when the payload roster is empty, the upsert is skipped but the reconcile-delete still removes every cloud player.
**Fix:** if the pushed roster is empty, skip the reconcile-delete as well (a legitimate "clear squad" should be an explicit action, not a side effect). Do not attempt a full per-player merge system — just close this destructive edge.

### 3.7 localStorage bleeds between accounts on shared devices
On sign-out (`src/lib/auth-store.js` `signOut()`), clear: `localStorage.removeItem('active-team-id')` and `localStorage.removeItem('doora-team-targets')`. (Leave `doora-settings` alone only if removing it breaks the theme before login — check how `settings-store.js` initializes; if safe, clear it too.) `doora-team-targets` is written by `src/lib/StatTargets.svelte` and feeds the PDF "targets met" row, so it must not survive account switches.

### 3.8 Unguarded JSON.parse can brick login
`src/lib/subscription-store.js` `ensureProfile` (~line 48): `JSON.parse(localStorage.getItem('signup_intent'))` throws on corrupt data and the exception propagates into the layout's auth handler, stranding the user on the loading screen.
**Fix:** wrap in try/catch falling back to `{ type: 'personal' }` (mirror the guarded pattern in `settings-store.js`). Also wrap the whole auth-handler body in `src/routes/+layout.svelte` (the `user.subscribe` async callback, ~lines 136-213) in a try/catch that logs the error and still sets `dataReady = true` so a single failure can never permanently strand the UI.

---

## PHASE 4 — Voice assistant correctness (Sideline AI)

### 4.1 Opposition puckouts logged inverted
`src/lib/sideline-command-parser.js` `parsePuckout` (~line 268): "they/their won the puckout" is parsed as outcome `won` (ours). 
**Fix:** detect an opposition subject (`they`, `them`, `their`, `opposition`, `opp`) in the puckout phrase and invert the outcome (`they won` → `lost`, `they lost` → `won`). Add/adjust the confirmation summary so it reads naturally ("Puckout lost (won by opposition)").

### 4.2 Spoken quantities silently dropped
Same file (~lines 198-211): "two points for 11" logs a single point with no warning.
**Fix (minimal):** detect a leading count > 1 on a stat phrase and either expand into N repeated commands (preferred if the structure supports multiple results) or return a clear error/confirmation noting only counts of 1 are supported. Do not silently drop the quantity.

### 4.3 Voice undo confirms against stale state
`src/lib/SidelineAI.svelte` (~lines 190-216) + `src/lib/Match.svelte` (~lines 996-1015): the pending "undo" summary is built from the last event at request time, but confirm executes `undoLastStat()` against the last event at confirm time — a manual tap in between deletes the wrong event.
**Fix:** snapshot the target event (player id + stat + time) when the pending undo is created; on confirm, verify the last event still matches the snapshot — if it doesn't, cancel with a spoken/shown message ("Match changed — say undo again") instead of undoing.

### 4.4 Mic leak / session resurrection during connect
`src/lib/SidelineAI.svelte` (~lines 139-159): no cancellation check after `await navigator.mediaDevices.getUserMedia(...)`; if `stop()` or `onDestroy` ran during the await, the resolved stream is reassigned and the session resurrects with a live mic.
**Fix:** use a session generation counter (increment in `start()` and in `stop()`); after the `await`, if the generation changed, stop all tracks of the just-acquired stream and return.

### 4.5 Typed-command path has no error handling
`src/lib/SidelineAI.svelte` `submitTypedCommand()` / `runExample()` (~lines 403-417) call the parser with no try/catch; `parseSidelineCommand('0 point')` throws (`STAT_ALIASES['0']` undefined → `.toLowerCase()` on undefined in `sideline-command-parser.js` ~lines 202-210).
**Fix:** (a) in the parser, guard the alias lookup so an unrecognized stat returns the normal "unknown stat" error result instead of throwing; (b) wrap the typed/example submission paths in try/catch surfacing a friendly error in the existing UI error/status area.

### 4.6 Insights `?match=` deep-link bugs
`src/lib/Insights.svelte` (~lines 32-42), runes mode:
- The URL-param `$effect` re-asserts `selectedMatchId = requested` whenever the user picks a different match, locking the dropdown.
- If `requested` isn't in `matches`, this effect and the fallback effect fight forever → `effect_update_depth_exceeded` crash.
**Fix:** apply the URL param **once** (track a `appliedUrlParam` flag or apply it in initialization rather than a reactive effect), and only if the id exists in `matches`. After that, the dropdown owns the selection. Ensure no two effects can both write `selectedMatchId` in a cycle.

---

## PHASE 5 — Smaller fixes

- **Sub times shown as raw seconds:** `src/lib/History.svelte` (~line 845) `{sub.time}` and `src/lib/LiveViewer.svelte` (~line 216) `{ev.time ?? '–'}'` — format with the existing `formatTime()` helpers in each file (LiveViewer has one at ~line 37).
- **Live broadcast every second:** `src/lib/Match.svelte` — `saveDraft()` runs on a 1s timer tick and ends with `broadcastLive()`, causing ~1 Supabase row UPDATE per second while live. Decouple: broadcast on actual state changes (stat/score/sub/puckout) immediately, and throttle timer-only broadcasts to at most one every 15 seconds. Keep local `saveDraft()` cadence unchanged.
- **PlayerStats chart leak:** `src/lib/PlayerStats.svelte` — add `onDestroy(() => chartInstance?.destroy())`.
- **PlayerStats misses configurable stats:** (~lines 39-48) hardcodes 8 stat keys. Instead, when aggregating, union the hardcoded defaults with all stat keys actually present in each match's `stats` values (and `m.customStats`), so configurable default stats are counted.
- **PlayerStats name matching case-sensitive:** normalize comparisons with `.trim().toLowerCase()` for matching (display keeps original casing).
- **PWA manifest:** `static/manifest.json` — icons reference `gaastat-icon.png` which does not exist in `static/`; point both icon entries at `static/gaastat-icon.svg` (`"type": "image/svg+xml"`, `"sizes": "any"`). Also change `"name"` from "Doora Barefield GAA" to "GAAstat" and fix the description (CLAUDE.md: app name is GAAstat everywhere). Do not change `short_name` (already "GAAstat").
- **Settings team-limit mismatch:** `src/lib/Settings.svelte` (~line 35) guards `teams.length >= 20` while the UI caps at 4 — align the guard with the documented 4-team cap (respect `custom_features.maxTeams` if the code already reads it).
- **`getRecentEvents` undefined coords:** `src/lib/match-tools.js` (~line 144) — change `!== null` checks to `!= null` so `undefined` x/y is excluded.
- **`getPuckoutSummary().bestZone` by raw wins:** `src/lib/match-tools.js` (~line 121) — rank by win rate with a minimum of 2 attempts, matching `match-insights.js` (~line 114).
- **Layout sync button stuck:** `src/routes/+layout.svelte` `handleSync` (~line 215) — wrap in try/finally so `syncing` always resets.
- **auth getSession unhandled rejection:** `src/lib/auth-store.js` (~lines 9-12) — add `.catch` / `.finally(() => authLoading.set(false))`.

---

## Finally

1. Run `npm run build` and confirm: build succeeds AND `.vercel/output/static/sw.js` contains a real cache version (not `__CACHE_VERSION__`).
2. Update `CLAUDE.md` only where your fixes change documented behavior (e.g. new RPC-based join flow, transcribe auth requirement). Also correct two known stale statements: `Match.svelte` is runes mode (not legacy), and note that `coachSummary`/`workOns` now sync.
3. Produce a summary listing every fix applied, every file touched, anything you deliberately skipped and why, and the manual steps required (applying the SQL migration, redeploying).
