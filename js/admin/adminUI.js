import { h, clear } from "../dom.js";
import { supabase } from "../supabaseClient.js";
import { go } from "../router.js";

export async function renderAdmin(root) {
  clear(root);

  const tableSel = h("select", {},
    h("option", { value: "talents" }, "talents"),
    h("option", { value: "professions" }, "professions"),
    h("option", { value: "profession_talent_mods" }, "profession_talent_mods"),
    h("option", { value: "culture_talent_mods" }, "culture_talent_mods"),
    h("option", { value: "species" }, "species"),
    h("option", { value: "races" }, "races"),
    h("option", { value: "cultures" }, "cultures"),
    h("option", { value: "traits" }, "traits"),
    h("option", { value: "special_abilities" }, "special_abilities"),
  );
  const ta = h("textarea", { rows: 14, placeholder: "JSON-Array hier einfügen…" });
  const out = h("div");

  const examples = h("div", { class: "actions" },
    btn("Beispiel: Talente (Kampf)", () => setJSON([
      { name: "Dolche", category: "kampf" },
      { name: "Ringen", category: "kampf" },
      { name: "Wurfmesser", category: "kampf" }
    ])),
    btn("Beispiel: Profession Einbrecher", () => {
      tableSel.value = "professions";
      setJSON([
        { name: "Einbrecher", gp_cost: 3, notes: "BR S.74",
          prereq: { all: [ { attr:"MU", ">=":12 }, { attr:"FF", ">=":13 }, { attr:"GE", ">=":12 } ] } }
      ]);
    }),
    btn("Beispiel: Prof.-Mods (Einbrecher)", async () => {
      tableSel.value = "profession_talent_mods";
      const { data: prof } = await supabase.from("professions").select("id").eq("name","Einbrecher").single();
      const { data: dol }  = await supabase.from("talents").select("id").eq("name","Dolche").single();
      const { data: rng }  = await supabase.from("talents").select("id").eq("name","Ringen").single();
      const { data: wfm }  = await supabase.from("talents").select("id").eq("name","Wurfmesser").single();
      setJSON([
        { profession_id: prof?.id, talent_id: dol?.id, mod: 3 },
        { profession_id: prof?.id, talent_id: rng?.id, mod: 1 },
        { profession_id: prof?.id, talent_id: wfm?.id, mod: 1 }
      ]);
    }),
    btn("Beispiel: Vor-/Nachteile", () => {
      tableSel.value = "traits";
      setJSON([
        { name:"Goldgier", trait_type:"nachteil" },
        { name:"Neugier", trait_type:"nachteil" },
        { name:"Glück", trait_type:"vorteil" }
      ]);
    }),
    btn("Beispiel: Sonderfertigkeiten", () => {
      tableSel.value = "special_abilities";
      setJSON([
        { name:"Aufmerksamkeit", sa_type:"allgemein",
          prereq:{ any:[ { attr:"MU", ">=":12 }, { trait:"Glück", ">=":1 } ] } }
      ]);
    }),
    btn("Beispiel: Kultur-Mods", async () => {
      tableSel.value = "culture_talent_mods";
      const { data: cul }  = await supabase.from("cultures").select("id").eq("name","Mittelländische Städte").single();
      const { data: dol }  = await supabase.from("talents").select("id").eq("name","Dolche").single();
      setJSON([{ culture_id: cul?.id, talent_id: dol?.id, mod: 1 }]);
    })
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
      const { error } = await supabase.from(table).upsert(payload);
      if (error) throw error;
      out.replaceChildren(h("div", { class: "success" }, `Import in "${table}" ok.`));
    } catch (e) {
      out.replaceChildren(h("div", { class: "error" }, e.message));
    }
  }
  function setJSON(obj){ ta.value = JSON.stringify(obj, null, 2); }
  function btn(lbl, onClick){ return h("button", { class:"ghost", onClick }, lbl); }
}
