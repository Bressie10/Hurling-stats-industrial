import { writable } from 'svelte/store'
import { supabase } from './supabase.js'
import { clearAllData } from './db.js'
import { syncToSupabase } from './sync.js'

export const user = writable(null)
export const authLoading = writable(true)

supabase.auth.getSession().then(({ data }) => {
  user.set(data.session?.user ?? null)
  authLoading.set(false)
})

supabase.auth.onAuthStateChange((event, session) => {
  user.set(session?.user ?? null)
})

export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  return data
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function resetPassword(email) {
  const redirectTo = `${window.location.origin}/auth/reset`
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
  if (error) throw error
}

export async function updatePassword(password) {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw error
}

// Drain pending mutations *before* wiping local state. Caps the wait so a flaky
// network can't trap the coach on the sign-out screen — anything still queued
// after the timeout would still be in the outbox if we kept it, but we wipe on
// sign-out for privacy, so this is a best-effort flush.
export async function signOut() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const uid = session?.user?.id
    if (uid) {
      await Promise.race([
        syncToSupabase(uid),
        new Promise(resolve => setTimeout(() => resolve(false), 5000))
      ])
    }
  } catch (e) {
    console.warn('Pre-signout drain failed:', e)
  }
  await clearAllData()
  await supabase.auth.signOut()
}
