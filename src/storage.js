// Datei-Upload für Helden-Portraits
import { supabase } from "./supabase.js";

/** @param {File} file @param {string} heroId */
export async function uploadHeroPortrait(file, heroId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet.");

  const ext = file.name.split(".").pop() || "png";
  const path = `${user.id}/${heroId}/portrait.${ext}`;

  // Upload (überschreiben erlaubt)
  const { error: upErr } = await supabase.storage.from("hero-files").upload(path, file, {
    upsert: true,
    cacheControl: "3600",
    contentType: file.type
  });
  if (upErr) throw upErr;

  // Signierte URL (zeitlich begrenzt) oder publicURL, falls du das willst:
  const { data: signed, error: urlErr } = await supabase.storage
    .from("hero-files")
    .createSignedUrl(path, 60 * 60 * 24); // 24h
  if (urlErr) throw urlErr;

  return { path, url: signed.signedUrl };
}
