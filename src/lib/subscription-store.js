import { writable, derived } from 'svelte/store'
import { supabase } from './supabase.js'

export const subscriptionStore = writable({
  plan: 'free',         // 'free' | 'personal' | 'club'
  status: 'active',     // 'active' | 'trialing' | 'past_due' | 'cancelled'
  clubId: null,
  clubCode: null,
  clubName: null,
  seatLimit: 1,
  currentPeriodEnd: null,
  loading: true
})

export const isPro = derived(subscriptionStore, $s =>
  ($s.plan === 'personal' || $s.plan === 'club') &&
  ($s.status === 'active' || $s.status === 'trialing')
)

function generateClubCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

// Called on first login if no profile exists yet — creates profile, club, subscription
export async function ensureProfile(userId) {
  const { data: existing } = await supabase
    .from('profiles').select('id').eq('id', userId).maybeSingle()
  if (existing) return

  const intentStr = localStorage.getItem('signup_intent')
  const intent = intentStr ? JSON.parse(intentStr) : { type: 'personal' }
  localStorage.removeItem('signup_intent')

  if (intent.type === 'club') {
    // Create club
    const code = generateClubCode()
    const { data: club, error: clubErr } = await supabase
      .from('clubs')
      .insert({ name: intent.clubName, code, owner_id: userId })
      .select()
      .single()
    if (clubErr) { console.error('Failed to create club:', clubErr); return }

    // Create subscription for club
    await supabase.from('subscriptions').insert({
      user_id: userId,
      club_id: club.id,
      plan: 'free',
      status: 'active',
      seat_limit: 6
    })

    // Owner joins their own club
    await supabase.from('club_members').insert({
      club_id: club.id,
      user_id: userId,
      role: 'owner'
    })

    // Create profile
    await supabase.from('profiles').insert({ id: userId, club_id: club.id })

  } else if (intent.type === 'join') {
    const code = (intent.clubCode || '').toUpperCase().trim()
    const { data: club } = await supabase
      .from('clubs').select('id').eq('code', code).maybeSingle()

    if (club) {
      // Check seat limit
      const { data: sub } = await supabase
        .from('subscriptions').select('seat_limit').eq('club_id', club.id).maybeSingle()
      const { count } = await supabase
        .from('club_members').select('id', { count: 'exact', head: true }).eq('club_id', club.id)
      const limit = sub?.seat_limit ?? 6

      if ((count ?? 0) < limit) {
        await supabase.from('club_members').insert({
          club_id: club.id,
          user_id: userId,
          role: 'member'
        })
        await supabase.from('profiles').insert({ id: userId, club_id: club.id })
        return
      }
    }
    // Fallback — join failed, create personal free profile
    await supabase.from('profiles').insert({ id: userId })
    await supabase.from('subscriptions').insert({
      user_id: userId, plan: 'free', status: 'active', seat_limit: 1
    })

  } else {
    // Personal
    await supabase.from('profiles').insert({ id: userId })
    await supabase.from('subscriptions').insert({
      user_id: userId, plan: 'free', status: 'active', seat_limit: 1
    })
  }
}

export async function loadSubscription(userId) {
  try {
    // Get profile (to find club_id if member)
    const { data: profile } = await supabase
      .from('profiles').select('club_id').eq('id', userId).maybeSingle()

    let sub = null
    let clubCode = null
    let clubName = null

    // Personal subscription first
    const { data: personalSub } = await supabase
      .from('subscriptions').select('*').eq('user_id', userId).maybeSingle()

    if (personalSub) {
      sub = personalSub
      // If sub has a club_id, fetch club details
      if (sub.club_id) {
        const { data: club } = await supabase
          .from('clubs').select('name, code').eq('id', sub.club_id).maybeSingle()
        clubCode = club?.code ?? null
        clubName = club?.name ?? null
      }
    } else if (profile?.club_id) {
      // Club member — find the club's subscription (owned by someone else)
      const { data: clubSub } = await supabase
        .from('subscriptions').select('*').eq('club_id', profile.club_id).maybeSingle()
      if (clubSub) {
        sub = clubSub
        const { data: club } = await supabase
          .from('clubs').select('name, code').eq('id', profile.club_id).maybeSingle()
        clubCode = club?.code ?? null
        clubName = club?.name ?? null
      }
    }

    if (sub) {
      subscriptionStore.set({
        plan: sub.plan || 'free',
        status: sub.status || 'active',
        clubId: sub.club_id ?? null,
        clubCode,
        clubName,
        seatLimit: sub.seat_limit ?? 1,
        currentPeriodEnd: sub.current_period_end ?? null,
        loading: false
      })
    } else {
      subscriptionStore.set({
        plan: 'free', status: 'active', clubId: null,
        clubCode: null, clubName: null, seatLimit: 1,
        currentPeriodEnd: null, loading: false
      })
    }
  } catch (e) {
    console.warn('Failed to load subscription:', e)
    subscriptionStore.set({
      plan: 'free', status: 'active', clubId: null,
      clubCode: null, clubName: null, seatLimit: 1,
      currentPeriodEnd: null, loading: false
    })
  }
}
