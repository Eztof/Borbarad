import { supabase } from "../supabaseClient.js";

// Session-Utils
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session || null;
}

export async function getUser() {
  const { data } = await supabase.auth.getUser();
  return data.user || null;
}

export async function signOut() {
  await supabase.auth.signOut();
}
