// Supabase Client – zentral
const SUPABASE_URL = "https://vemhlzosryqisymkkoif.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlbWhsem9zcnlxaXN5bWtrb2lmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwMDk2NDUsImV4cCI6MjA3MDU4NTY0NX0.TaKpijcKhBfEq8r_RAxJAi6QF8JaSx352YXyshV8GzU";

// @ts-check
export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  global: {
    headers: { "x-client-info": "borbarad-web/0.1" }
  }
});
