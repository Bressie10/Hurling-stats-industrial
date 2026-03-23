import { writable } from 'svelte/store'
import { supabase } from './supabase.js'
import { clearAllData } from './db.js'

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

export async function signOut() {
  await clearAllData()
  await supabase.auth.signOut()
}