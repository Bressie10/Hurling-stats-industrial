export const STRIPE_API_VERSION = '2026-02-25.clover'

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

export function getCustomerId(customer: string | { id?: string } | null | undefined): string | null {
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
  const periodEnd = subscription.items?.data?.[0]?.current_period_end ?? subscription.current_period_end
  return periodEnd ? new Date(periodEnd * 1000).toISOString() : null
}

export function getInvoiceSubscriptionId(invoice: {
  subscription?: string | { id?: string } | null
  parent?: { subscription_details?: { subscription?: string | { id?: string } | null } | null } | null
}): string | null {
  const subscription = invoice.subscription ?? invoice.parent?.subscription_details?.subscription
  if (!subscription) return null
  return typeof subscription === 'string' ? subscription : (subscription.id ?? null)
}
