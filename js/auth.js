// js/auth.js
import { supabase, usernameToEmail } from './supabaseClient.js'

// Profile wird NACH erfolgreichem Login/SignUp angelegt/aktualisiert (dann ist Session sicher da)
async function upsertOwnProfile({ id, username }) {
  const { error } = await supabase.from('profiles').upsert({ id, username }, { onConflict: 'id' })
  if (error) throw error
}

export async function signUpUsernamePassword({ username, password }) {
  const email = usernameToEmail(username)
  // SignUp
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error

  // Falls Email-Confirm AN ist, gibt es evtl. noch keine Session -> dann Nutzer um Login bitten
  const user = data.user
  const hasSession = !!data.session

  if (!hasSession) {
    // Kein Insert in profiles hier (würde an RLS scheitern). Wir geben nur den User zurück.
    return { user, needsLogin: true }
  }

  // Session existiert -> Profil anlegen
  await upsertOwnProfile({ id: user.id, username })
  return { user, needsLogin: false }
}

export async function signInUsernamePassword({ username, password }) {
  const email = usernameToEmail(username)
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  // Nach erfolgreichem Login sicher Profil anlegen/aktualisieren (idempotent)
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
