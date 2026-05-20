import { writable } from 'svelte/store'
import { supabase } from './supabase.js'
import { clearAllData } from './db.js'
import { flushOutbox } from './sync.js'

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

// Drain pending mutations *before* wiping local state. flushOutbox returns a
// promise tracking the in-flight drain (not a fire-and-forget) so we actually
// wait for the cloud upserts to land. The 10s cap stops a flaky network from
// trapping the coach on the sign-out screen; anything still queued after that
// is lost on the wipe, which is the privacy contract of sign-out.
export async function signOut() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const uid = session?.user?.id
    if (uid) {
      await Promise.race([
        flushOutbox(uid),
        new Promise(resolve => setTimeout(() => resolve(false), 10000))
      ])
    }
  } catch (e) {
    console.warn('Pre-signout drain failed:', e)
  }
  await clearAllData()
  await supabase.auth.signOut()
}
