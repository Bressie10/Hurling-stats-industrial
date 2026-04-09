import { writable, derived } from 'svelte/store'
import { supabase } from './supabase.js'

const ACTIVE_TEAM_KEY = 'active-team-id'

export const subscriptionStore = writable({
  plan: 'free',
  status: 'active',
  cancelAtPeriodEnd: false,
  clubId: null,
  clubName: null,
  clubRole: null,        // 'owner' | 'admin' | 'coach' | null
  isOwner: false,        // true when clubRole is 'owner' or 'admin'
  teams: [],             // [{ id, name, code }] — all teams this user can access
  activeTeamId: null,    // currently selected team
  activeTeamName: null,
  activeTeamCode: null,
  currentPeriodEnd: null,
  customFeatures: {},    // per-subscription overrides set in Supabase dashboard
  loading: true
})

const isActiveStatus = s => s.status === 'active' || s.status === 'trialing'

export const isPro = derived(subscriptionStore, $s =>
  $s.customFeatures?.isPro === true ||
  (($s.plan === 'personal' || $s.plan === 'club' || $s.plan === 'club_pro') && isActiveStatus($s))
)

export const isClub = derived(subscriptionStore, $s =>
  $s.customFeatures?.isClub === true ||
  (($s.plan === 'club' || $s.plan === 'club_pro') && isActiveStatus($s))
)

export const isClubPro = derived(subscriptionStore, $s =>
  $s.customFeatures?.isClubPro === true ||
  ($s.plan === 'club_pro' && isActiveStatus($s))
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
      // Club-level membership (role: coach)
      await supabase.from('club_members').insert({
        club_id: team.club_id, user_id: userId, role: 'coach'
      })
      // Team-level membership
      await supabase.from('team_members').insert({
        club_id: team.club_id, team_id: team.id, user_id: userId, role: 'coach'
      })
      await supabase.from('profiles').insert({
        id: userId, club_id: team.club_id
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
  try {
    const { data: profile } = await supabase
      .from('profiles').select('club_id').eq('id', userId).maybeSingle()
    const { data: member } = await supabase
      .from('club_members').select('role, club_id').eq('user_id', userId).maybeSingle()

    const clubId = profile?.club_id ?? member?.club_id ?? null
    const clubRole = member?.role ?? null
    const isOwner = clubRole === 'owner' || clubRole === 'admin'

    let sub = null
    let clubName = null
    let teams = []

    const { data: personalSub } = await supabase
      .from('subscriptions').select('*').eq('user_id', userId).maybeSingle()
    if (personalSub) {
      sub = personalSub
    }
    if (!sub && clubId) {
      const { data: clubSub } = await supabase
        .rpc('get_club_subscription', { p_club_id: clubId })
      if (clubSub && clubSub.length > 0) sub = clubSub[0]
    }

    if (clubId) {
      const { data: club } = await supabase
        .from('clubs').select('name').eq('id', clubId).maybeSingle()
      clubName = club?.name ?? null
    }

    // Load teams: owners see all club teams; coaches see only their assigned teams
    if (isOwner && clubId) {
      const { data: allTeams } = await supabase
        .from('teams').select('id, name, code').eq('club_id', clubId).order('created_at')
      teams = allTeams ?? []
    } else {
      const { data: myTeams } = await supabase
        .from('team_members')
        .select('team_id, role, teams(id, name, code)')
        .eq('user_id', userId)
      teams = (myTeams ?? []).map(row => row.teams).filter(Boolean)
    }

    // Restore active team from localStorage — validate it's still in the teams list
    const storedTeamId = localStorage.getItem(ACTIVE_TEAM_KEY)
    const validStored = teams.find(t => t.id === storedTeamId)
    const activeTeam = validStored ?? (teams.length === 1 ? teams[0] : null)

    subscriptionStore.set({
      plan: sub?.plan ?? 'free',
      status: sub?.status ?? 'active',
      cancelAtPeriodEnd: sub?.cancel_at_period_end ?? false,
      clubId, clubName, clubRole, isOwner,
      teams,
      activeTeamId: activeTeam?.id ?? null,
      activeTeamName: activeTeam?.name ?? null,
      activeTeamCode: activeTeam?.code ?? null,
      currentPeriodEnd: sub?.current_period_end ?? null,
      customFeatures: sub?.custom_features ?? {},
      loading: false
    })
  } catch (e) {
    console.warn('Failed to load subscription:', e)
    subscriptionStore.set({
      plan: 'free', status: 'active', cancelAtPeriodEnd: false,
      clubId: null, clubName: null, clubRole: null, isOwner: false,
      teams: [], activeTeamId: null, activeTeamName: null, activeTeamCode: null,
      currentPeriodEnd: null, customFeatures: {}, loading: false
    })
  }
}

// Set the active team and persist to localStorage
export function setActiveTeam(team) {
  if (!team) return
  localStorage.setItem(ACTIVE_TEAM_KEY, team.id)
  subscriptionStore.update(s => ({
    ...s,
    activeTeamId: team.id,
    activeTeamName: team.name,
    activeTeamCode: team.code
  }))
}

// Join an additional team by code — works for existing users
export async function joinTeam(teamCode, userId) {
  const code = (teamCode || '').trim()
  if (!code) throw new Error('Enter a team code')

  const { data: team } = await supabase
    .from('teams').select('id, club_id').eq('code', code).maybeSingle()
  if (!team) throw new Error('Team not found — check the code and try again')

  // Ensure user has a club-level membership (handles cross-club joining too)
  const { data: existingMember } = await supabase
    .from('club_members')
    .select('id')
    .eq('club_id', team.club_id)
    .eq('user_id', userId)
    .maybeSingle()

  if (!existingMember) {
    const { error: clubErr } = await supabase.from('club_members').insert({
      club_id: team.club_id, user_id: userId, role: 'coach'
    })
    if (clubErr) throw clubErr

    // Update profile club_id if not set
    await supabase.from('profiles').upsert({ id: userId, club_id: team.club_id })
  }

  // Join the team — UNIQUE constraint means re-joining is silently ignored
  const { error } = await supabase.from('team_members').insert({
    club_id: team.club_id, team_id: team.id, user_id: userId, role: 'coach'
  })
  if (error && error.code !== '23505') throw error  // 23505 = duplicate, already joined

  await loadSubscription(userId)
}

// Leave a team
export async function leaveTeam(teamId, userId) {
  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('team_id', teamId)
    .eq('user_id', userId)
  if (error) throw error

  // If this was the active team, clear it
  const stored = localStorage.getItem(ACTIVE_TEAM_KEY)
  if (stored === teamId) localStorage.removeItem(ACTIVE_TEAM_KEY)

  await loadSubscription(userId)
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
