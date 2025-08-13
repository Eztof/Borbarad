import { supabase } from "../supabaseClient.js";

export async function listHeroes() {
  const { data, error } = await supabase
    .from("heroes")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getHero(id) {
  const { data, error } = await supabase
    .from("heroes")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function createHero(hero) {
  const { data, error } = await supabase.from("heroes").insert(hero).select().single();
  if (error) throw error;
  return data;
}

export async function updateHero(id, values) {
  const { data, error } = await supabase.from("heroes").update(values).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteHero(id) {
  const { error } = await supabase.from("heroes").delete().eq("id", id);
  if (error) throw error;
}

export function blankAttributes() {
  // UI-Defaultwerte – fachlich später aus Spezies/Kultur ableitbar
  return { MU: 12, KL: 12, IN: 12, CH: 12, FF: 12, GE: 12, KO: 12, KK: 12 };
}
