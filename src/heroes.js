// CRUD für Helden
import { supabase } from "./supabase.js";

/** @returns {Promise<Array>} */
export async function listHeroes() {
  const { data, error } = await supabase
    .from("heroes")
    .select("id,name,profession,species,level,portrait_url")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** @param {string} id */
export async function getHero(id) {
  const { data, error } = await supabase
    .from("heroes")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

/** @param {{name:string,species?:string,profession?:string,level?:number,attrs?:any,portrait_url?:string}} hero */
export async function createHero(hero) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet.");
  const payload = {
    owner: user.id,
    name: hero.name,
    species: hero.species ?? null,
    profession: hero.profession ?? null,
    level: hero.level ?? 1,
    attrs: hero.attrs ?? null,
    portrait_url: hero.portrait_url ?? null
  };
  const { data, error } = await supabase.from("heroes").insert(payload).select("*").single();
  if (error) throw error;
  return data;
}

/** @param {string} id @param {any} patch */
export async function updateHero(id, patch) {
  const { data, error } = await supabase.from("heroes").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  return data;
}

/** @param {string} id */
export async function deleteHero(id) {
  const { error } = await supabase.from("heroes").delete().eq("id", id);
  if (error) throw error;
}
