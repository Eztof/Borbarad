import { supabase } from './supabaseClient.js'

export async function signUp({ email, password, username }) {
  // 1) Auth anlegen
  const { data: authData, error: authError } = await supabase.auth.signUp({ email, password })
  if (authError) throw authError

  // 2) Profil (username) speichern – id = user.id
  const user = authData.user
  const { error: profileError } = await supabase.from('profiles').insert({
    id: user.id, username
  })
  if (profileError) throw profileError

  return user
}

export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data.user
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function getSessionUser() {
  const { data } = await supabase.auth.getUser()
  return data.user ?? null
}

export function onAuthChange(cb) {
  return supabase.auth.onAuthStateChange((_event, session) => cb(session?.user ?? null))
}
