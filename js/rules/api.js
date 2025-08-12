import { supabase } from "../supabaseClient.js";

// ---- Stammdaten lesen ----
export async function allSpecies() {
  const { data, error } = await supabase.from("species").select("*").order("name");
  if (error) throw error; return data;
}
export async function racesBySpecies(species_id) {
  let q = supabase.from("races").select("*").order("name");
  if (species_id) q = q.eq("species_id", species_id);
  const { data, error } = await q;
  if (error) throw error; return data;
}
export async function allCultures() {
  const { data, error } = await supabase.from("cultures").select("*").order("name");
  if (error) throw error; return data;
}
export async function allProfessions() {
  const { data, error } = await supabase.from("professions").select("*").order("name");
  if (error) throw error; return data;
}
export async function allTalents() {
  const { data, error } = await supabase.from("talents").select("*").order("category").order("name");
  if (error) throw error; return data;
}
export async function allTraits() {
  const { data, error } = await supabase.from("traits").select("*").order("trait_type").order("name");
  if (error) throw error; return data;
}
export async function allSpecialAbilities() {
  const { data, error } = await supabase.from("special_abilities").select("*").order("sa_type").order("name");
  if (error) throw error; return data;
}

// ---- Startmodifikatoren ----
export async function cultureTalentMods(culture_id) {
  if (!culture_id) return [];
  const { data, error } = await supabase
    .from("culture_talent_mods")
    .select("talent_id, mod, talents!inner(name, category)")
    .eq("culture_id", culture_id)
    .order("mod", { ascending: false });
  if (error) throw error;
  return data.map(r => ({ talent_id: r.talent_id, mod: r.mod, name: r.talents.name, category: r.talents.category }));
}
export async function professionTalentMods(profession_id) {
  if (!profession_id) return [];
  const { data, error } = await supabase
    .from("profession_talent_mods")
    .select("talent_id, mod, talents!inner(name, category)")
    .eq("profession_id", profession_id)
    .order("mod", { ascending: false });
  if (error) throw error;
  return data.map(r => ({ talent_id: r.talent_id, mod: r.mod, name: r.talents.name, category: r.talents.category }));
}
