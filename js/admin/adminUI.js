import { h, clear } from "../dom.js";
import { supabase } from "../supabaseClient.js";
import { go } from "../router.js";

/**
 * Admin-Import angepasst an RESET-Schema:
 * Tabellen: talents, traits, special_abilities, species, cultures, professions,
 *           culture_profession, profession_talent_mods, profession_traits,
 *           profession_special_abilities, special_discounts, prerequisites
 * (keine 'races', keine 'culture_talent_mods')
 */

export async function renderAdmin(root) {
  clear(root);

  const tableSel = h("select", {},
    h("option", { value: "talents" }, "talents"),
    h("option", { value: "traits" }, "traits"),
    h("option", { value: "special_abilities" }, "special_abilities"),
    h("option", { value: "species" }, "species"),
    h("option", { value: "cultures" }, "cultures"),
    h("option", { value: "professions" }, "professions"),
    h("option", { value: "culture_profession" }, "culture_profession"),
    h("option", { value: "profession_talent_mods" }, "profession_talent_mods"),
    h("option", { value: "profession_traits" }, "profession_traits"),
    h("option", { value: "profession_special_abilities" }, "profession_special_abilities"),
    h("option", { value: "special_discounts" }, "special_discounts"),
    h("option", { value: "prerequisites" }, "prerequisites"),
  );

  const ta = h("textarea", { rows: 16, placeholder: "JSON-Array hier einfügen…" });
  const out = h("div");

  const examples = h("div", { class: "actions" },
    btn("Beispiel: Talente (Kampf)", () => setJSON([
      { name: "Dolche", group_tag: "Kampf", skt_col: "D", is_combat: true },
      { name: "Raufen", group_tag: "Kampf", skt_col: "D", is_combat: true }
    ])),
    btn("Beispiel: Profession 'Einbrecher'", () => setJSON([
      { name: "Einbrecher", gp_cost: 0, min_mu: 12, min_ff: 13, min_ge: 12, so_min: 2, so_max: 10, notes: "BR S.74" }
    ])),
    btn("Beispiel: profession_talent_mods", () => setJSON([
      { profession_id: "UUID-der-Profession", talent_id: "UUID-des-Talents", delta: 3 }
    ])),
    btn("Beispiel: culture_profession", () => setJSON([
      { culture_id: "UUID-der-Kultur", profession_id: "UUID-der-Profession" }
    ]))
  );

  const imp = h("button", { class: "ok", onClick: doImport }, "Importieren (upsert)");
  const back = h("button", { class: "ghost", onClick: () => go("/heroes") }, "Zurück");

  root.append(h("div", { class: "panel" },
    h("h2", {}, "Admin • Import"),
    h("div", { class: "input" }, h("label", {}, "Tabelle"), tableSel),
    examples,
    h("div", { class: "input" }, h("label", {}, "JSON"), ta),
    h("div", { class: "actions" }, imp, back),
    out
  ));

  async function doImport() {
    try {
      const table = tableSel.value;
      const payload = JSON.parse(ta.value);
      if (!Array.isArray(payload)) throw new Error("JSON muss ein Array sein.");

      // Upsert nach 'name', wenn vorhanden – sonst normales Insert
      const hasName = payload.length && Object.prototype.hasOwnProperty.call(payload[0], "name");

      let resp;
      if (hasName) {
        resp = await supabase.from(table).upsert(payload, { onConflict: "name" }).select();
      } else {
        resp = await supabase.from(table).insert(payload).select();
      }

      if (resp.error) throw resp.error;
      out.replaceChildren(h("div", { class: "success" }, `Import in "${table}" ok. Einträge: ${resp.data?.length ?? 0}`));
    } catch (e) {
      out.replaceChildren(h("div", { class: "error" }, e.message));
    }
  }

  function setJSON(obj) { ta.value = JSON.stringify(obj, null, 2); }
  function btn(lbl, onClick) { return h("button", { class: "ghost", onClick }, lbl); }
}
