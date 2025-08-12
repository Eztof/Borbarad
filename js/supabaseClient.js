// js/supabaseClient.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = 'https://wrgqynesfjivmtinsivc.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndyZ3F5bmVzZmppdm10aW5zaXZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwMTE1MzEsImV4cCI6MjA3MDU4NzUzMX0.-EjOfGF4rVBrSby5aSXXqtDfWK3ZAa2aB_W3Tnr4Gzs'

// Wir können den Client dynamisch mit sessionStorage (nicht merken) oder localStorage (merken) erstellen.
// Die Wahl speichern wir in localStorage unter 'remember_me'.
const REMEMBER_KEY = 'remember_me'

// Hilfsfunktion: aktuellen Storage wählen
function getChosenStorage() {
  const remember = (localStorage.getItem(REMEMBER_KEY) ?? 'true') === 'true'
  return remember ? window.localStorage : window.sessionStorage
}

// Export: Möglichkeit, das Remember-Flag zu setzen (z. B. nach Login)
export function setRememberMe(remember) {
  localStorage.setItem(REMEMBER_KEY, remember ? 'true' : 'false')
  // Hinweis: Für sauberes Umschalten empfiehlt sich ein Reload,
  // damit der neue Client überall verwendet wird.
  location.reload()
}

// Singleton-Client auf Basis der aktuellen Einstellung
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: getChosenStorage()
  },
  global: { headers: { 'x-application-name': 'borbarad-web' } }
})

// Username -> Pseudo-Mail (Supabase braucht intern eine Mail)
export function usernameToEmail(username) {
  const clean = String(username).trim().toLowerCase()
  // Keine Sonderzeichen in der Local-Part; sehr simpel normalisieren
  const normalized = clean.replace(/[^a-z0-9._-]+/g, '-')
  return `${normalized}@borbarad.local`
}
