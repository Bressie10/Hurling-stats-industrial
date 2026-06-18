import { describe, expect, it } from 'vitest'
import {
  canUseClub,
  canUseClubPro,
  canUseFeature,
  canUsePro,
  canSaveFinishedMatch,
  FEATURES,
  FREE_MATCH_LIMIT,
} from './entitlements.js'

function subscription(plan, status = 'active', customFeatures = {}) {
  return { plan, status, customFeatures }
}

describe('entitlements', () => {
  it('caps the launch free tier at two saved matches', () => {
    expect(FREE_MATCH_LIMIT).toBe(2)
  })

  it('unlocks Pro analytics for paid plans and custom overrides', () => {
    expect(canUsePro(subscription('free'))).toBe(false)
    expect(canUsePro(subscription('personal'))).toBe(true)
    expect(canUsePro(subscription('club'))).toBe(true)
    expect(canUsePro(subscription('club_pro'))).toBe(true)
    expect(canUsePro(subscription('free', 'active', { isPro: true }))).toBe(true)
  })

  it('keeps Club and Club Pro features on their own tiers', () => {
    expect(canUseClub(subscription('personal'))).toBe(false)
    expect(canUseClub(subscription('club'))).toBe(true)
    expect(canUseClubPro(subscription('club'))).toBe(false)
    expect(canUseClubPro(subscription('club_pro'))).toBe(true)
  })

  it('requires an active or trialing subscription status', () => {
    expect(canUseFeature(subscription('personal', 'past_due'), FEATURES.proAnalytics)).toBe(false)
    expect(canUseFeature(subscription('club', 'cancelled'), FEATURES.clubManagement)).toBe(false)
    expect(canUseFeature(subscription('club_pro', 'trialing'), FEATURES.liveSharing)).toBe(true)
  })

  it('enforces the free saved-match cap before finished match saves', () => {
    expect(canSaveFinishedMatch(subscription('free'), 0)).toBe(true)
    expect(canSaveFinishedMatch(subscription('free'), FREE_MATCH_LIMIT - 1)).toBe(true)
    expect(canSaveFinishedMatch(subscription('free'), FREE_MATCH_LIMIT)).toBe(false)
    expect(canSaveFinishedMatch(subscription('personal'), FREE_MATCH_LIMIT)).toBe(true)
    expect(canSaveFinishedMatch(subscription('free', 'active', { isPro: true }), 20)).toBe(true)
    expect(canSaveFinishedMatch(subscription('personal', 'past_due'), FREE_MATCH_LIMIT)).toBe(false)
  })
})
