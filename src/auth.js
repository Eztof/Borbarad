// Auth-bezogene Mini-Funktionen
import { supabase } from "./supabase.js";

/** @param {string} email @param {string} password */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

/** Registrierung + Profil (username) anlegen */
export async function signUp({ email, password, username }) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;

  // Direkt nach SignUp: Profil schreiben (id == user.id)
  const user = data.user;
  if (!user) throw new Error("Kein Benutzer nach SignUp.");

  const { error: perr } = await supabase
    .from("profiles")
    .insert({ id: user.id, username });

  if (perr) throw perr;
  return user;
}

/** Aktuelle Session holen */
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

/** Logout */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/** Username für Nav laden */
export async function getMyProfile() {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/** Auth State Callback setzen */
export function onAuthChanged(cb) {
  return supabase.auth.onAuthStateChange((_event, session) => cb(session));
}
