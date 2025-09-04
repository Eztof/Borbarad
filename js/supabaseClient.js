// Initialisiert Supabase (Client-seitig, GitHub Pages tauglich)
export const supabase = window.supabase.createClient(
"https://uzgizoikrricctzznlzr.supabase.co",
"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6Z2l6b2lrcnJpY2N0enpubHpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY5MDc1MTksImV4cCI6MjA3MjQ4MzUxOX0.MJFMo6PrBXq_3xQGqYeyMKZx0JTqouFBW3eqteXgsm8",
{
auth: {
autoRefreshToken: true,
persistSession: true,
detectSessionInUrl: true
}
}
);


// Hilfsfunktionen für Storage (Bilder)
export async function uploadImage(file, folder = "uploads") {
if (!file) return null;
const path = `${folder}/${Date.now()}-${file.name}`;
const { data, error } = await supabase.storage.from("images").upload(path, file, {
cacheControl: "3600",
upsert: false
});
if (error) throw error;
// Public URL
const { data: pub } = supabase.storage.from("images").getPublicUrl(data.path);
return pub.publicUrl;
}