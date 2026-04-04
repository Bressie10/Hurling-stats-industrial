import { writable, derived } from 'svelte/store'
import { supabase } from './supabase.js'

export const subscriptionStore = writable({
  plan: 'free',        // 'free' | 'personal' | 'club' | 'club_pro'
  status: 'active',    // 'active' | 'trialing' | 'past_due' | 'cancelled'
  clubId: null,
  clubName: null,
  teamId: null,
  teamName: null,
  teamCode: null,
  isOwner: false,
  currentPeriodEnd: null,
  loading: true
})

export const isPro = derived(subscriptionStore, $s =>
  ($s.plan === 'personal' || $s.plan === 'club' || $s.plan === 'club_pro') &&
  ($s.status === 'active' || $s.status === 'trialing')
)

export const isClub = derived(subscriptionStore, $s =>
  ($s.plan === 'club' || $s.plan === 'club_pro') &&
  ($s.status === 'active' || $s.status === 'trialing')
)

export const isClubPro = derived(subscriptionStore, $s =>
  $s.plan === 'club_pro' &&
  ($s.status === 'active' || $s.status === 'trialing')
)

function generateTeamCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function generateClubCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

// Called on first login — creates profile, club, team memberships
export async function ensureProfile(userId) {
  const { data: existing } = await supabase
    .from('profiles').select('id').eq('id', userId).maybeSingle()
  if (existing) return

  const intentStr = localStorage.getItem('signup_intent')
  const intent = intentStr ? JSON.parse(intentStr) : { type: 'personal' }
  localStorage.removeItem('signup_intent')

  if (intent.type === 'club') {
    const clubCode = generateClubCode()
    const { data: club, error: clubErr } = await supabase
      .from('clubs')
      .insert({ name: intent.clubName, code: clubCode, owner_id: userId })
      .select().single()
    if (clubErr) { console.error('Failed to create club:', clubErr); return }

    await supabase.from('subscriptions').insert({
      user_id: userId, club_id: club.id, plan: 'free', status: 'active', seat_limit: 999
    })
    await supabase.from('club_members').insert({
      club_id: club.id, user_id: userId, role: 'owner'
    })
    await supabase.from('profiles').insert({ id: userId, club_id: club.id })

  } else if (intent.type === 'join') {
    const code = (intent.teamCode || '').trim()
    const { data: team } = await supabase
      .from('teams').select('id, club_id').eq('code', code).maybeSingle()

    if (team) {
      await supabase.from('club_members').insert({
        club_id: team.club_id, team_id: team.id, user_id: userId, role: 'member'
      })
      await supabase.from('profiles').insert({
        id: userId, club_id: team.club_id, team_id: team.id
      })
      return
    }
    // Fallback — invalid code
    await supabase.from('profiles').insert({ id: userId })
    await supabase.from('subscriptions').insert({
      user_id: userId, plan: 'free', status: 'active', seat_limit: 1
    })

  } else {
    await supabase.from('profiles').insert({ id: userId })
    await supabase.from('subscriptions').insert({
      user_id: userId, plan: 'free', status: 'active', seat_limit: 1
    })
  }
}

export async function loadSubscription(userId) {
  console.log('[sub] loadSubscription called for', userId)
  try {
    const { data: profile, error: profileErr } = await supabase
      .from('profiles').select('club_id, team_id').eq('id', userId).maybeSingle()
    console.log('[sub] profile:', profile, profileErr)
    const { data: member, error: memberErr } = await supabase
      .from('club_members').select('role, club_id, team_id').eq('user_id', userId).maybeSingle()
    console.log('[sub] member:', member, memberErr)

    const clubId = profile?.club_id ?? member?.club_id ?? null
    const teamId = profile?.team_id ?? member?.team_id ?? null
    const isOwner = member?.role === 'owner'

    let sub = null
    let clubName = null
    let teamName = null
    let teamCode = null

    const { data: personalSub, error: subErr } = await supabase
      .from('subscriptions').select('*').eq('user_id', userId).maybeSingle()
    console.log('[sub] personalSub:', personalSub, subErr)
    if (personalSub) {
      sub = personalSub
    } else if (clubId) {
      const { data: clubSub } = await supabase
        .from('subscriptions').select('*').eq('club_id', clubId).maybeSingle()
      if (clubSub) sub = clubSub
    }

    if (clubId) {
      const { data: club } = await supabase
        .from('clubs').select('name').eq('id', clubId).maybeSingle()
      clubName = club?.name ?? null
    }

    if (teamId) {
      const { data: team } = await supabase
        .from('teams').select('name, code').eq('id', teamId).maybeSingle()
      teamName = team?.name ?? null
      teamCode = team?.code ?? null
    }

    console.log('[sub] final sub object:', sub)
    subscriptionStore.set({
      plan: sub?.plan ?? 'free',
      status: sub?.status ?? 'active',
      clubId, clubName, teamId, teamName, teamCode, isOwner,
      currentPeriodEnd: sub?.current_period_end ?? null,
      loading: false
    })
  } catch (e) {
    console.warn('Failed to load subscription:', e)
    subscriptionStore.set({
      plan: 'free', status: 'active', clubId: null, clubName: null,
      teamId: null, teamName: null, teamCode: null, isOwner: false,
      currentPeriodEnd: null, loading: false
    })
  }
}

export async function createTeam(clubId, teamName) {
  const code = generateTeamCode()
  const { data, error } = await supabase
    .from('teams')
    .insert({ club_id: clubId, name: teamName.trim(), code })
    .select().single()
  if (error) throw error
  return data
}

export async function deleteTeam(teamId) {
  const { error } = await supabase.from('teams').delete().eq('id', teamId)
  if (error) throw error
}

export async function loadClubTeams(clubId) {
  const { data, error } = await supabase
    .from('teams').select('*').eq('club_id', clubId).order('created_at')
  if (error) throw error
  return data ?? []
}
