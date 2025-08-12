// js/supabaseClient.js
// Stabiles CDN:
import * as Supabase from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'
const { createClient } = Supabase

const SUPABASE_URL = 'https://wrgqynesfjivmtinsivc.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndyZ3F5bmVzZmppdm10aW5zaXZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwMTE1MzEsImV4cCI6MjA3MDU4NzUzMX0.-EjOfGF4rVBrSby5aSXXqtDfWK3ZAa2aB_W3Tnr4Gzs'

const REMEMBER_KEY = 'remember_me'
const PROJECT_REF = SUPABASE_URL.replace('https://', '').split('.')[0]       // wrgqynesfjivmtinsivc
const AUTH_KEY = `sb-${PROJECT_REF}-auth-token`                               // Supabase v2 Default-Key

function makeClient(storage) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storage
    },
    global: { headers: { 'x-application-name': 'borbarad-web' } }
  })
}

// Zwei Clients: einer für "merken" (localStorage), einer nur für die Sitzung (sessionStorage)
export const clientLocal   = makeClient(window.localStorage)
export const clientSession = makeClient(window.sessionStorage)

// Aktiven Client bestimmen:
// 1) Wenn in einem Storage bereits eine Session liegt → diesen nehmen.
// 2) Sonst anhand der Remember-Präferenz (default: true → localStorage).
function chooseActiveClient() {
  const hasLocal   = !!localStorage.getItem(AUTH_KEY)
  const hasSession = !!sessionStorage.getItem(AUTH_KEY)
  if (hasLocal && !hasSession)  return clientLocal
  if (!hasLocal && hasSession)  return clientSession
  if (hasLocal && hasSession)   return clientLocal // Edge: beide vorhanden → local bevorzugen

  const remember = (localStorage.getItem(REMEMBER_KEY) ?? 'true') === 'true'
  return remember ? clientLocal : clientSession
}

// Dieser Client wird überall im App-Code benutzt (DB, Storage, etc.)
export let supabase = chooseActiveClient()

// Helper: Remember-Präferenz setzen (ohne Reload)
export function setRememberPreference(remember) {
  localStorage.setItem(REMEMBER_KEY, remember ? 'true' : 'false')
  // Wenn aktuell kein User angemeldet ist, können wir den "aktiven" Client direkt tauschen,
  // damit der nächste Login in den gewünschten Storage schreibt.
  supabase = remember ? clientLocal : clientSession
}

// Login/Signup bewusst mit dem gewünschten Client ausführen
export async function authWithClient(remember, fn) {
  // Vor dem Auth-Call den passenden Client wählen
  const client = remember ? clientLocal : clientSession
  // Remember-Flag merken, damit künftige Seitenladen den richtigen Client wählen
  setRememberPreference(remember)
  const result = await fn(client)
  // Nach erfolgreichem Auth den globalen Client auf den benutzten setzen
  supabase = client
  return result
}

// Username → Pseudo-E-Mail (Supabase benötigt intern E-Mail/Phone)
export function usernameToEmail(username) {
  const clean = String(username).trim().toLowerCase()
  const normalized = clean.replace(/[^a-z0-9._-]+/g, '-')
  return `${normalized}@borbarad.local`
}
