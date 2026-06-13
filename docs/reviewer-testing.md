# Reviewer Account And Store-Mode Testing

Last updated: 2026-06-13

Use this before Apple App Store or Google Play submission. The goal is to give reviewers a real account with enough data to verify the app immediately, without exposing web purchase flows inside native builds.

## Reviewer Account

- Recommended email: `reviewer@gaastat.com`
- Recommended entitlement: `personal`
- Support email for store metadata: `support@gaastat.com`

Do not commit reviewer passwords or Supabase service-role keys. Keep them in a local `.env` or pass them as one-off shell environment variables.

## Seed Command

Dry run first:

```sh
npm run store:seed-reviewer -- --dry-run
```

Real seed:

```sh
REVIEWER_EMAIL=reviewer@gaastat.com \
REVIEWER_PASSWORD='replace-with-a-strong-password' \
SUPABASE_SERVICE_ROLE_KEY='replace-with-service-role-key' \
npm run store:seed-reviewer
```

The script reads `PUBLIC_SUPABASE_URL` from `.env`, `.env.local`, or the shell environment. It creates or updates the Supabase Auth user, confirms the email, sets the password, creates the profile/subscription row, and seeds cloud `squad` and `matches` rows.

By default, it replaces the reviewer's cloud squad rows and upserts three deterministic seeded matches. Use `--preserve-existing` if you do not want it to delete existing squad rows for that reviewer account.

## Verify Command

After the real seed, verify the account through the same public Supabase auth and RLS path used by the app:

```sh
npm run store:verify-reviewer
```

This signs in with `REVIEWER_EMAIL` and `REVIEWER_PASSWORD`, confirms the subscription row is active, and confirms at least 25 squad rows and 3 match rows are visible to the reviewer user. It does not print the password.

If the command passes but the browser says "Invalid login credentials", check that the login email is exactly `reviewer@gaastat.com` and that the pasted password has no leading or trailing spaces. A private/incognito window is the fastest way to avoid a stale saved password.

## Seeded Data

The seeded account contains:

- 25 squad players with jersey numbers and positions
- 3 completed matches
- player stats, custom stats, pitch coordinates, puckouts, opposition scoring details, substitutions, notes, and work-ons
- a `personal` active entitlement so analytics screens are unlocked without showing native purchase flows

## Manual Verification

Open the store-mode URLs and sign in as the reviewer:

```text
https://www.gaastat.com/?store_build=ios
https://www.gaastat.com/?store_build=android
```

Check:

- History shows the three seeded matches.
- A separate fresh Free account shows only the 2-match free history allowance and locked Pro analytics routes.
- Squad shows the 25 seeded players.
- Player Stats has selectable players and charts.
- Team Stats shows score, shooting, tackle, turnover, puckout, and pitch-map data.
- Timeline shows events, puckouts, and substitutions.
- Insights shows match and season summaries.
- Settings account deletion is visible.
- Pricing/locked feature surfaces do not show Stripe checkout, prices, external purchase links, or web billing controls in store mode.
- Sideline AI microphone permission can be requested on a real device.

## Store Reviewer Notes

Use a concise note like this in App Store Connect and Play Console:

```text
Reviewer account:
Email: reviewer@gaastat.com
Password: [enter the current password]

This native build is store-safe. It supports signed-in access, free account use, match logging, cloud sync, and existing account entitlements. Free accounts include 2 saved matches. Plan purchases and plan management are not offered inside the app.
```
