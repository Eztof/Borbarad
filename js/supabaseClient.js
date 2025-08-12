// js/supabaseClient.js
// Wechsel des CDNs: jsDelivr +esm ist auf GitHub Pages sehr stabil.
import * as Supabase from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const { createClient } = Supabase

const SUPABASE_URL = 'https://wrgqynesfjivmtinsivc.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndyZ3F5bmVzZmppdm10aW5zaXZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwMTE1MzEsImV4cCI6MjA3MDU4NzUzMX0.-EjOfGF4rVBrSby5aSXXqtDfWK3ZAa2aB_W3Tnr4Gzs'

// Remember-Flag -> entscheidet, ob Session in localStorage (bleibt) oder sessionStorage (endet mit Tab) liegt
const REMEMBER_KEY = 'remember_me'

function getChosenStorage() {
  const remember = (localStorage.getItem(REMEMBER_KEY) ?? 'true') === 'true'
  return remember ? window.localStorage : window.sessionStorage
}

export function setRememberMe(remember) {
  localStorage.setItem(REMEMBER_KEY, remember ? 'true' : 'false')
  // Reload, damit der Client mit dem neuen Storage neu initialisiert wird
  location.reload()
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: getChosenStorage()
  },
  global: { headers: { 'x-application-name': 'borbarad-web' } }
})

// Username -> Pseudo-E-Mail (Supabase braucht intern eine E-Mail)
export function usernameToEmail(username) {
  const clean = String(username).trim().toLowerCase()
  const normalized = clean.replace(/[^a-z0-9._-]+/g, '-')
  return `${normalized}@borbarad.local`
}
