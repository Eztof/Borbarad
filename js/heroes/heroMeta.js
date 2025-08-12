import { supabase } from "../supabaseClient.js";

export async function loadHeroTraits(hero_id) {
  if (!hero_id) return new Map();
  const { data, error } = await supabase.from("hero_traits").select("trait_id, level, traits!inner(name, trait_type)").eq("hero_id", hero_id);
  if (error) throw error;
  const byId = new Map(data.map(r => [r.trait_id, r.level || 0]));
  const byName = new Map(data.map(r => [r.traits.name, r.level || 0]));
  return { byId, byName };
}
export async function upsertHeroTrait(hero_id, trait_id, level) {
  const { error } = await supabase.from("hero_traits").upsert({ hero_id, trait_id, level });
  if (error) throw error;
}
export async function removeHeroTrait(hero_id, trait_id) {
  const { error } = await supabase.from("hero_traits").delete().eq("hero_id", trait_id ? undefined : null).eq("hero_id", hero_id).eq("trait_id", trait_id);
  if (error) throw error;
}

export async function loadHeroSAs(hero_id) {
  if (!hero_id) return new Set();
  const { data, error } = await supabase.from("hero_special_abilities").select("sa_id, special_abilities!inner(name)").eq("hero_id", hero_id);
  if (error) throw error;
  const byId = new Set(data.map(r => r.sa_id));
  const byName = new Set(data.map(r => r.special_abilities.name));
  return { byId, byName };
}
export async function setHeroSA(hero_id, sa_id, present) {
  if (present) {
    const { error } = await supabase.from("hero_special_abilities").upsert({ hero_id, sa_id });
    if (error) throw error;
  } else {
    const { error } = await supabase.from("hero_special_abilities").delete().eq("hero_id", hero_id).eq("sa_id", sa_id);
    if (error) throw error;
  }
}
