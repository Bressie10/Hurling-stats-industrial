# Stripe Billing

Last updated: 2026-06-17

PitchNote uses Stripe Checkout and Billing on the web. Native iOS and Android builds are companion clients only and must not show Stripe checkout, prices, web billing links, or external payment calls to action.

The Supabase Edge Functions share `STRIPE_API_VERSION = '2026-02-25.clover'` from `supabase/functions/_shared/billing.ts`.

## Plans

| Plan | Stripe lookup key | Amount |
| --- | --- | --- |
| Personal Pro | `pitchnote_personal_monthly` | EUR 7.99/month |
| Club | `pitchnote_club_monthly` | EUR 15/month |
| Club Pro | `pitchnote_club_pro_monthly` | EUR 25/month |

## Required Secrets

Configure these in Supabase Edge Function secrets:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PORTAL_CONFIGURATION_ID`
- `STRIPE_PERSONAL_PRICE_ID`
- `STRIPE_CLUB_PRICE_ID`
- `STRIPE_CLUB_PRO_PRICE_ID`
- `APP_URL=https://www.pitchnote.ie`

The local `.env` can also include `STRIPE_WEBHOOK_ENDPOINT_ID` so `npm run billing:check` can verify the Stripe endpoint configuration.

## Webhook Endpoint

Stripe should send webhooks to:

```text
https://syikhsgovqogzkmmhuis.supabase.co/functions/v1/stripe-webhook
```

Enabled events:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

## Verification

Run:

```sh
npm run billing:check
```

The check verifies the expected monthly EUR prices, PitchNote lookup keys, active Customer Portal config, enabled webhook endpoint events, and local webhook secret presence without printing secret values.
