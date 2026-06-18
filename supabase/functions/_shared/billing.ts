export const STRIPE_API_VERSION = '2026-02-25.clover'
export const DEFAULT_APP_URL = 'https://www.pitchnote.ie'

export type BillingPlan = 'personal' | 'club' | 'club_pro'

export const BILLING_PLANS: BillingPlan[] = ['personal', 'club', 'club_pro']

export const PLAN_DETAILS: Record<
  BillingPlan,
  {
    priceEnv: string
    fallbackTestPriceId: string
    seatLimit: number
  }
> = {
  personal: {
    priceEnv: 'STRIPE_PERSONAL_PRICE_ID',
    fallbackTestPriceId: 'price_1Thz9rEJeWwTp7TFSriSk63s',
    seatLimit: 1,
  },
  club: {
    priceEnv: 'STRIPE_CLUB_PRICE_ID',
    fallbackTestPriceId: 'price_1Thz9sEJeWwTp7TFiRJgny3y',
    seatLimit: 999,
  },
  club_pro: {
    priceEnv: 'STRIPE_CLUB_PRO_PRICE_ID',
    fallbackTestPriceId: 'price_1Thz9tEJeWwTp7TFhZ8VLZGg',
    seatLimit: 999,
  },
}

export function parseBillingPlan(value: unknown): BillingPlan | null {
  return typeof value === 'string' && BILLING_PLANS.includes(value as BillingPlan)
    ? (value as BillingPlan)
    : null
}

function isTestStripeKey(key: string | undefined): boolean {
  return !!key && key.includes('_test_')
}

function isLocalhost(hostname: string): boolean {
  return ['localhost', '127.0.0.1', '[::1]'].includes(hostname)
}

export function getAppBaseUrl(): string {
  const configured = Deno.env.get('APP_URL') || DEFAULT_APP_URL
  let url: URL
  try {
    url = new URL(configured)
  } catch {
    throw new Error('APP_URL must be an absolute URL')
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('APP_URL must use http or https')
  }
  if (url.protocol === 'http:' && !isLocalhost(url.hostname)) {
    throw new Error('APP_URL must use https outside localhost')
  }
  url.pathname = ''
  url.search = ''
  url.hash = ''
  return url.toString().replace(/\/$/, '')
}

export function getSameOriginReturnUrl(value: unknown): string {
  const appUrl = getAppBaseUrl()
  if (typeof value !== 'string' || !value.trim()) return appUrl

  try {
    const trustedOrigin = new URL(appUrl).origin
    const candidate = new URL(value, appUrl)
    if (candidate.origin !== trustedOrigin) return appUrl
    return candidate.toString()
  } catch {
    return appUrl
  }
}

function getPriceId(plan: BillingPlan): string {
  const detail = PLAN_DETAILS[plan]
  const envPriceId = Deno.env.get(detail.priceEnv)
  if (envPriceId) return envPriceId

  if (isTestStripeKey(Deno.env.get('STRIPE_SECRET_KEY'))) {
    return detail.fallbackTestPriceId
  }

  throw new Error(`${detail.priceEnv} is required for Stripe billing`)
}

export function getPriceIds(): Record<BillingPlan, string> {
  return {
    personal: getPriceId('personal'),
    club: getPriceId('club'),
    club_pro: getPriceId('club_pro'),
  }
}

export function getPlanByPriceId(): Record<string, BillingPlan> {
  const priceIds = getPriceIds()
  return Object.fromEntries(BILLING_PLANS.map((plan) => [priceIds[plan], plan])) as Record<
    string,
    BillingPlan
  >
}

export function getSeatLimit(plan: BillingPlan): number {
  return PLAN_DETAILS[plan].seatLimit
}

export function getCustomerId(
  customer: string | { id?: string } | null | undefined,
): string | null {
  if (!customer) return null
  return typeof customer === 'string' ? customer : (customer.id ?? null)
}

export function getSubscriptionPriceId(subscription: {
  items?: { data?: Array<{ price?: { id?: string } }> }
}): string | null {
  return subscription.items?.data?.[0]?.price?.id ?? null
}

export function getSubscriptionPeriodEnd(subscription: {
  current_period_end?: number | null
  items?: { data?: Array<{ current_period_end?: number | null }> }
}): string | null {
  const periodEnd =
    subscription.items?.data?.[0]?.current_period_end ?? subscription.current_period_end
  return periodEnd ? new Date(periodEnd * 1000).toISOString() : null
}

export function getInvoiceSubscriptionId(invoice: {
  subscription?: string | { id?: string } | null
  parent?: {
    subscription_details?: { subscription?: string | { id?: string } | null } | null
  } | null
}): string | null {
  const subscription = invoice.subscription ?? invoice.parent?.subscription_details?.subscription
  if (!subscription) return null
  return typeof subscription === 'string' ? subscription : (subscription.id ?? null)
}
