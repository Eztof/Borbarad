import { supabase } from "../supabaseClient.js";
import { PORTRAITS_BUCKET } from "../config.js";

// Upload eines Portraits in Pfad: userId/<heroId>-<timestamp>.<ext>
// Gibt public URL zurück (Bucket ist public)
export async function uploadPortrait(file, userId, heroId) {
  if (!file) return null;
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/${heroId}-${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage.from(PORTRAITS_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (upErr) throw upErr;

  const { data } = supabase.storage.from(PORTRAITS_BUCKET).getPublicUrl(path);
  return data.publicUrl || null;
}
