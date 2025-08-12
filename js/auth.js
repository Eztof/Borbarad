// js/auth.js
import { supabase, authWithClient, usernameToEmail } from './supabaseClient.js'

// Profile upserten, NACHDEM sicher eine Session da ist
async function upsertOwnProfile({ id, username }) {
  const { error } = await supabase.from('profiles').upsert({ id, username }, { onConflict: 'id' })
  if (error) throw error
}

export async function signUpUsernamePassword({ username, password, remember }) {
  const email = usernameToEmail(username)

  // Signup mit Client entsprechend "remember"
  const { data, error } = await authWithClient(remember, (client) =>
    client.auth.signUp({ email, password })
  )
  if (error) throw error

  const user = data.user
  const hasSession = !!data.session

  if (!hasSession) {
    // E-Mail-Confirm aktiv → Erst beim Login Profil anlegen
    return { user, needsLogin: true }
  }

  await upsertOwnProfile({ id: user.id, username })
  return { user, needsLogin: false }
}

export async function signInUsernamePassword({ username, password, remember }) {
  const email = usernameToEmail(username)

  // Login mit passendem Client (session/local)
  const { data, error } = await authWithClient(remember, (client) =>
    client.auth.signInWithPassword({ email, password })
  )
  if (error) throw error

  await upsertOwnProfile({ id: data.user.id, username })
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
