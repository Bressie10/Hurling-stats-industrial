export const FREE_MATCH_LIMIT = 2

export const FEATURES = {
  proAnalytics: 'proAnalytics',
  clubManagement: 'clubManagement',
  liveSharing: 'liveSharing',
}

export const FEATURE_LABELS = {
  [FEATURES.proAnalytics]: 'Pro analytics',
  [FEATURES.clubManagement]: 'Club management',
  [FEATURES.liveSharing]: 'Live match sharing',
}

export const PLAN_COPY = {
  free: {
    name: 'Free',
    price: '€0',
    period: '/month',
    tagline: 'Trial the match-day workflow',
  },
  personal: {
    name: 'Personal Pro',
    price: '€7.99',
    period: '/month',
    tagline: 'Full analytics for one coach',
  },
  club: {
    name: 'Club',
    price: '€15',
    period: '/month',
    tagline: 'Multiple teams, one club',
  },
  club_pro: {
    name: 'Club Pro',
    price: '€25',
    period: '/month',
    tagline: 'Live sharing for serious clubs',
  },
}

export function isActiveSubscription(subscription) {
  return subscription?.status === 'active' || subscription?.status === 'trialing'
}

function hasFeature(subscription, key) {
  return subscription?.customFeatures?.[key] === true
}

export function canUsePro(subscription) {
  return (
    isActiveSubscription(subscription) &&
    (['personal', 'club', 'club_pro'].includes(subscription?.plan) ||
      hasFeature(subscription, 'isPro') ||
      hasFeature(subscription, 'isClub') ||
      hasFeature(subscription, 'isClubPro'))
  )
}

export function canUseClub(subscription) {
  return (
    isActiveSubscription(subscription) &&
    (['club', 'club_pro'].includes(subscription?.plan) ||
      hasFeature(subscription, 'isClub') ||
      hasFeature(subscription, 'isClubPro'))
  )
}

export function canUseClubPro(subscription) {
  return (
    isActiveSubscription(subscription) &&
    (subscription?.plan === 'club_pro' || hasFeature(subscription, 'isClubPro'))
  )
}

export function canUseFeature(subscription, feature) {
  if (feature === FEATURES.proAnalytics) return canUsePro(subscription)
  if (feature === FEATURES.clubManagement) return canUseClub(subscription)
  if (feature === FEATURES.liveSharing) return canUseClubPro(subscription)
  return false
}
