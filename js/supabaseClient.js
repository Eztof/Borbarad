import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

// Supabase Client als Singleton
export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
