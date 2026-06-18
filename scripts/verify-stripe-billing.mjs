import { existsSync, readFileSync } from 'node:fs'

const REQUIRED_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
]

const PLANS = [
  {
    key: 'personal',
    label: 'Personal Pro',
    env: 'STRIPE_PERSONAL_PRICE_ID',
    fallbackTestPriceId: 'price_1Thz9rEJeWwTp7TFSriSk63s',
    amount: 799,
    lookupKey: 'pitchnote_personal_monthly',
  },
  {
    key: 'club',
    label: 'Club',
    env: 'STRIPE_CLUB_PRICE_ID',
    fallbackTestPriceId: 'price_1Thz9sEJeWwTp7TFiRJgny3y',
    amount: 1500,
    lookupKey: 'pitchnote_club_monthly',
  },
  {
    key: 'club_pro',
    label: 'Club Pro',
    env: 'STRIPE_CLUB_PRO_PRICE_ID',
    fallbackTestPriceId: 'price_1Thz9tEJeWwTp7TFhZ8VLZGg',
    amount: 2500,
    lookupKey: 'pitchnote_club_pro_monthly',
  },
]

function readEnvFile(path) {
  if (!existsSync(path)) return {}
  const env = {}
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (!match) continue
    env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '')
  }
  return env
}

const env = {
  ...readEnvFile('.env'),
  ...readEnvFile('.env.local'),
  ...process.env,
}

function requireEnv(name) {
  const value = env[name]
  if (!value) throw new Error(`${name} is missing`)
  return value
}

const stripeKey = requireEnv('STRIPE_SECRET_KEY')
const isTestMode = stripeKey.includes('_test_')

async function stripeGet(path) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${stripeKey}` },
  })
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}: ${text.slice(0, 300)}`)
  }
  return JSON.parse(text)
}

function getPlanPriceId(plan) {
  const priceId = env[plan.env]
  if (priceId) return priceId
  if (isTestMode) return plan.fallbackTestPriceId
  throw new Error(`${plan.env} is required outside Stripe test mode`)
}

function check(condition, message) {
  if (!condition) throw new Error(message)
}

function requireConfiguredEnv(name) {
  const value = requireEnv(name)
  if (/^(TODO|PLACEHOLDER|REPLACE_ME)$/i.test(value)) {
    throw new Error(`${name} contains a placeholder value`)
  }
  return value
}

console.log(`Stripe mode: ${isTestMode ? 'test' : 'live or restricted'}`)

for (const plan of PLANS) {
  const priceId = getPlanPriceId(plan)
  const price = await stripeGet(`prices/${priceId}?expand[]=product`)
  check(price.active, `${plan.label} price is inactive`)
  check(price.currency === 'eur', `${plan.label} price currency is ${price.currency}, expected eur`)
  check(
    price.unit_amount === plan.amount,
    `${plan.label} price amount is ${price.unit_amount}, expected ${plan.amount}`,
  )
  check(price.recurring?.interval === 'month', `${plan.label} price interval is not monthly`)
  check(
    price.lookup_key === plan.lookupKey,
    `${plan.label} lookup key is ${price.lookup_key}, expected ${plan.lookupKey}`,
  )
  check(price.product?.active, `${plan.label} product is inactive`)
  check(
    (price.product?.name ?? '').includes(plan.label),
    `${plan.label} product name does not include plan label`,
  )
  console.log(
    `${plan.key}: ${price.id} ${price.unit_amount} ${price.currency}/${price.recurring.interval}`,
  )
}

const portalId = requireConfiguredEnv('STRIPE_PORTAL_CONFIGURATION_ID')
const portal = await stripeGet(`billing_portal/configurations/${portalId}`)
check(portal.active, 'Customer Portal configuration is inactive')
check(
  portal.features?.payment_method_update?.enabled,
  'Customer Portal cannot update payment methods',
)
check(portal.features?.subscription_cancel?.enabled, 'Customer Portal cannot cancel subscriptions')
check(portal.features?.invoice_history?.enabled, 'Customer Portal invoice history is disabled')
console.log(`portal: ${portal.id} active`)

const webhookId = requireConfiguredEnv('STRIPE_WEBHOOK_ENDPOINT_ID')
const webhook = await stripeGet(`webhook_endpoints/${webhookId}`)
check(webhook.status === 'enabled', `Webhook endpoint status is ${webhook.status}`)
for (const event of REQUIRED_EVENTS) {
  check(webhook.enabled_events.includes(event), `Webhook endpoint is missing ${event}`)
}
console.log(`webhook: ${webhook.id} enabled`)

check(!!env.STRIPE_WEBHOOK_SECRET, 'STRIPE_WEBHOOK_SECRET is missing')
console.log('webhook secret: present')
