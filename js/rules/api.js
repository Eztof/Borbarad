import { supabase } from "../supabaseClient.js";

/**
 * Regeln/Stammdaten – API kompatibel zu deinem bisherigen Frontend,
 * angepasst an das RESET-Schema (Option B).
 * - Talente nutzen jetzt group_tag (statt category). Wir mappen category -> group_tag
 *   für Abwärtskompatibilität in Views.
 * - Es gibt aktuell KEINE Tabellen "races" und "culture_talent_mods" im RESET-Schema.
 *   Die entsprechenden Funktionen liefern daher leere Arrays (UI-sicher).
 */

// ---- Stammdaten lesen ----
export async function allSpecies() {
  const { data, error } = await supabase.from("species").select("*").order("name");
  if (error) throw error; return data;
}

// NICHT vorhanden im RESET-Schema -> leeres Array (UI-sicher)
export async function racesBySpecies(/* species_id */) {
  return [];
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
  // group_tag + skt_col sind neu; wir liefern zusätzlich ein Feld category (=group_tag)
  const { data, error } = await supabase
    .from("talents")
    .select("id, name, group_tag, skt_col, is_combat")
    .order("group_tag", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data || []).map(t => ({ ...t, category: t.group_tag }));
}

export async function allTraits() {
  // kind: 'advantage' | 'disadvantage'; trait_type bleibt für Legacy.
  const { data, error } = await supabase
    .from("traits")
    .select("id, name, kind, trait_type, gp_cost, tag, notes")
    .order("kind", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error; return data;
}

export async function allSpecialAbilities() {
  const { data, error } = await supabase
    .from("special_abilities")
    .select("id, name, ap_cost, gp_cost, notes")
    .order("name");
  if (error) throw error; return data;
}

// ---- Mods ----

// NICHT vorhanden im RESET-Schema -> leeres Array (UI-sicher)
export async function cultureTalentMods(/* culture_id */) {
  return [];
}

export async function professionTalentMods(profession_id) {
  if (!profession_id) return [];
  // RESET-Schema: Spalten heißen profession_id, talent_id, delta
  const { data, error } = await supabase
    .from("profession_talent_mods")
    .select("talent_id, delta, talents!inner(name, group_tag)")
    .eq("profession_id", profession_id)
    .order("delta", { ascending: false });
  if (error) throw error;
  return (data || []).map(r => ({
    talent_id: r.talent_id,
    mod: r.delta,               // kompatibel zum alten Namen "mod"
    name: r.talents.name,
    category: r.talents.group_tag
  }));
}
