import { supabase } from "../supabaseClient.js";
import { allTalents } from "../rules/api.js";

// Cache
let TALENTS = null;
export async function getTalents() { return TALENTS || (TALENTS = await allTalents()); }

export async function loadPurchasedTalents(hero_id) {
  if (!hero_id) return new Map();
  const { data, error } = await supabase.from("hero_talents").select("*").eq("hero_id", hero_id);
  if (error) throw error;
  return new Map(data.map(r => [r.talent_id, r.purchased]));
}
export async function setPurchasedTalent(hero_id, talent_id, value) {
  const { error } = await supabase.from("hero_talents").upsert({ hero_id, talent_id, purchased: value });
  if (error) throw error;
}

// baseMods = [{talent_id, mod}, ...]  (z.B. Kultur + Profession)
export function calcTotals({ baseMods = [], purchasedMap = new Map() }) {
  const totals = new Map();
  for (const { talent_id, mod } of baseMods) totals.set(talent_id, (totals.get(talent_id) || 0) + mod);
  for (const [tid, val] of purchasedMap.entries()) totals.set(tid, (totals.get(tid) || 0) + val);
  return totals;
}
