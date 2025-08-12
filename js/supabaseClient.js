// Minimaler, zentraler Supabase-Client (v2)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = 'https://wrgqynesfjivmtinsivc.supabase.co'
// ⚠️ Das ist dein PUBLIC Anon Key – passt für Client-Apps:
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndyZ3F5bmVzZmppdm10aW5zaXZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwMTE1MzEsImV4cCI6MjA3MDU4NzUzMX0.-EjOfGF4rVBrSby5aSXXqtDfWK3ZAa2aB_W3Tnr4Gzs'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  global: { headers: { 'x-application-name': 'borbarad-web' } }
})
