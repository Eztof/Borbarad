import { h, clear } from "../dom.js";
import { getHero, createHero, updateHero, blankAttributes } from "./api.js";
import { uploadPortrait } from "../storage/portraits.js";
import { go } from "../router.js";
import { supabase } from "../supabaseClient.js";

import {
  allSpecies, racesBySpecies, allCultures, allProfessions, allTalents,
  allTraits, allSpecialAbilities, cultureTalentMods, professionTalentMods
} from "../rules/api.js";

import { loadPurchasedTalents, setPurchasedTalent, calcTotals } from "./talents.js";
import { loadHeroTraits, upsertHeroTrait, loadHeroSAs, setHeroSA } from "./heroMeta.js";
import { checkPrereq } from "../rules/validate.js";

// Ableitungen nach Basisregelwerk (LE/Au/INI/MR etc.)
// Quelle: BR „Abgeleitete Grundwerte berechnen“ (siehe README & PDF)
function derived(attrs) {
  const MU=+attrs.MU||0, KL=+attrs.KL||0, IN=+attrs.IN||0, CH=+attrs.CH||0,
        FF=+attrs.FF||0, GE=+attrs.GE||0, KO=+attrs.KO||0, KK=+attrs.KK||0;
  const round = (x) => Math.round(x); // im Buch werden /5 teils kaufm. gerundet
  return {
    LE: Math.floor((KO+KO+KK)/2),
    AU: Math.floor((MU+KO+GE)/2),
    WS: Math.floor(KO/2),
    ATb: Math.floor((MU+GE+KK)/5),
    PAb: Math.floor((IN+GE+KK)/5),
    FKb: Math.floor((IN+FF+KK)/5),
    INIb: Math.floor((MU+MU+IN+GE)/5),
    MR: Math.floor((MU+KL+KO)/5),
    AE: Math.floor((MU+IN+CH)/2)
  };
}

export async function renderHeroForm(root, id = null) {
  clear(root);
  const user = (await supabase.auth.getUser()).data.user;
  let hero = id ? await getHero(id) : {
    owner: user.id, name: "", level: 1,
    species_id: null, race_id: null, culture_id: null, profession_id: null,
    attributes: blankAttributes(), notes: "", portrait_url: null
  };
  const isNew = !id;

  // ===== Stammdaten laden =====
  const [species, cultures, professions, talents, heroTalentsMap, heroTraits, heroSAs] = await Promise.all([
    allSpecies(), allCultures(), allProfessions(), allTalents(),
    id ? loadPurchasedTalents(id) : new Map(),
    id ? loadHeroTraits(id) : { byId: new Map(), byName: new Map() },
    id ? loadHeroSAs(id) : { byId: new Set(), byName: new Set() }
  ]);
  let races = hero.species_id ? await racesBySpecies(hero.species_id) : [];
  let cultureMods = hero.culture_id ? await cultureTalentMods(hero.culture_id) : [];
  let professionMods = hero.profession_id ? await professionTalentMods(hero.profession_id) : [];

  // ===== UI: Kopf & Grunddaten =====
  const title = isNew ? "Neuen Helden anlegen" : `Helden bearbeiten: ${hero.name}`;

  const name = input("Name", "text", hero.name);
  const level = input("Stufe", "number", hero.level); level.input.min = 1;

  const speciesSel = select("Spezies", species, hero.species_id, v => v.name);
  const raceSel    = select("Rasse", races, hero.race_id, v => v.name);
  const cultureSel = select("Kultur", cultures, hero.culture_id, v => v.name);
  const professionSel = select("Profession", professions, hero.profession_id, v => v.name);

  speciesSel.input.addEventListener("change", async () => {
    const sid = speciesSel.input.value || null;
    races = sid ? await racesBySpecies(sid) : [];
    fillOptions(raceSel.input, races, null, v => v.name);
  });

  cultureSel.input.addEventListener("change", async () => {
    cultureMods = await cultureTalentMods(cultureSel.input.value || null);
    renderTalentRows();
  });

  professionSel.input.addEventListener("change", async () => {
    professionMods = await professionTalentMods(professionSel.input.value || null);
    renderTalentRows();
    renderPrereqInfo();
  });

  // ===== Attribute (einfach editierbar) =====
  const attrInputs = {};
  const attrKeys = ["MU","KL","IN","CH","FF","GE","KO","KK"];
  const attrGrid = h("div", { class: "panel" },
    h("h3", {}, "Eigenschaften"),
    h("div", { class: "row" },
      ...attrKeys.slice(0,2).map(k => attrField(k)),
    ),
    h("div", { class: "row" },
      ...attrKeys.slice(2,4).map(k => attrField(k)),
    ),
    h("div", { class: "row" },
      ...attrKeys.slice(4,6).map(k => attrField(k)),
    ),
    h("div", { class: "row" },
      ...attrKeys.slice(6,8).map(k => attrField(k)),
    ),
  );
  function attrField(key) {
    const el = h("input", { type: "number", value: hero.attributes[key] ?? 12, min: 1, oninput: () => {
      hero.attributes[key] = parseInt(el.value || "0", 10);
      renderDerived();
      renderPrereqInfo();
    }});
    attrInputs[key] = el;
    return h("div", { class: "input" }, h("label", {}, key), el);
  }

  // ===== Kampftalente =====
  const purchasedMap = heroTalentsMap;
  const talentPanel = h("div", { class: "panel" }, h("h3", {}, "Kampftalente"));
  function renderTalentRows() {
    const camp = talents.filter(t => t.category === "kampf");
    const baseMods = [...cultureMods, ...professionMods].map(m => ({ talent_id: m.talent_id, mod: m.mod }));
    const totals = calcTotals({ baseMods, purchasedMap });

    const list = h("div", { class: "list" },
      ...camp.map(t => {
        const bought = purchasedMap.get(t.id) || 0;
        const base = (totals.get(t.id) || 0) - bought;
        const num = h("input", { type: "number", min: 0, value: bought, oninput: async (e) => {
          const v = parseInt(e.target.value || "0", 10);
          purchasedMap.set(t.id, v);
          totalEl.textContent = String(base + v);
          if (hero.id) await setPurchasedTalent(hero.id, t.id, v);
        }});
        const totalEl = h("span", {}, String(base + bought));
        return h("div", { class: "card" },
          h("div", { style: "font-weight:700" }, t.name),
          h("div", {}, `Basis (Kultur+Profession): ${base >= 0 ? "+"+base : base}`),
          h("div", {}, "Dazugekauft:"), num,
          h("div", { style: "margin-left:auto" }, "Gesamt:"), totalEl
        );
      })
    );
    talentPanel.replaceChildren(h("h3", {}, "Kampftalente"), list);
  }
  renderTalentRows();

  // ===== Vor-/Nachteile & Sonderfertigkeiten =====
  const [traits, sas] = await Promise.all([allTraits(), allSpecialAbilities()]);
  const { byId: heroTraitById, byName: heroTraitByName } = heroTraits;
  const { byId: heroSAById, byName: heroSAByName } = heroSAs;

  const traitPanel = h("div", { class: "panel" }, h("h3", {}, "Vor- & Nachteile"));
  renderTraitList();

  const saPanel = h("div", { class: "panel" }, h("h3", {}, "Sonderfertigkeiten"));
  renderSAList();

  function renderTraitList() {
    const list = h("div", { class: "list" },
      ...traits.map(tr => {
        const startLevel = heroTraitById.get(tr.id) || 0;
        const levelInput = h("input", { type: "number", min: 0, value: startLevel, style: "width:80px" });
        const status = h("span", { class: "notice" }, "");
        const saveBtn = h("button", { class: "ok", onClick: async () => {
          const lvl = parseInt(levelInput.value || "0", 10);
          // Voraussetzungen prüfen (wenn vorhanden)
          const ctx = {
            attributes: hero.attributes,
            traits: heroTraitByName,
            sas: heroSAByName
          };
          const { ok, fails } = checkPrereq(tr.prereq, ctx);
          if (!ok) { status.textContent = "Fehlt: " + fails.join(", "); return; }
          await upsertHeroTrait(hero.id, tr.id, lvl);
          heroTraitById.set(tr.id, lvl);
          heroTraitByName.set(tr.name, lvl);
          status.textContent = "Gespeichert";
        }}, "Setzen");
        const row = h("div", { class: "card" },
          h("div", { style:"font-weight:700" }, `${tr.name} (${tr.trait_type})`),
          h("div", {}, "Stufe:"), levelInput,
          h("div", { style: "margin-left:auto" }, status),
          saveBtn
        );
        return row;
      })
    );
    traitPanel.replaceChildren(h("h3", {}, "Vor- & Nachteile"), list);
  }

  function renderSAList() {
    const list = h("div", { class: "list" },
      ...sas.map(sa => {
        const checked = heroSAById.has(sa.id);
        const box = h("input", { type: "checkbox", checked });
        const info = h("span", { class: "notice" }, "");
        box.addEventListener("change", async () => {
          const ctx = { attributes: hero.attributes, traits: heroTraitByName, sas: heroSAByName };
          const { ok, fails } = checkPrereq(sa.prereq, ctx);
          if (!ok && box.checked) {
            info.textContent = "Fehlt: " + fails.join(", ");
            box.checked = false;
            return;
          }
          await setHeroSA(hero.id, sa.id, box.checked);
          if (box.checked) heroSAByName.add(sa.name); else heroSAByName.delete(sa.name);
          info.textContent = "Gespeichert";
        });
        return h("div", { class: "card" },
          h("label", {}, box, " ", sa.name, " (", sa.sa_type, ")"),
          h("div", { style: "margin-left:auto" }, info)
        );
      })
    );
    saPanel.replaceChildren(h("h3", {}, "Sonderfertigkeiten"), list);
  }

  // ===== Ableitungen =====
  const derivedPanel = h("div", { class: "panel" }, h("h3", {}, "Abgeleitete Grundwerte (auto)"));
  function renderDerived() {
    const d = derived(hero.attributes);
    const grid = h("div", { class: "row" },
      info("LE", d.LE), info("Au", d.AU)
    );
    const grid2 = h("div", { class: "row" },
      info("WS", d.WS), info("MR", d.MR)
    );
    const grid3 = h("div", { class: "row" },
      info("AT-Basis", d.ATb), info("PA-Basis", d.PAb)
    );
    const grid4 = h("div", { class: "row" },
      info("FK-Basis", d.FKb), info("INI-Basis", d.INIb)
    );
    derivedPanel.replaceChildren(h("h3", {}, "Abgeleitete Grundwerte (auto)"), grid, grid2, grid3, grid4);
  }
  function info(label, value) {
    return h("div", { class: "input" }, h("label", {}, label), h("div", {}, String(value)));
  }
  renderDerived();

  // ===== Profession-Prereqs anzeigen =====
  const prereqPanel = h("div", { class: "panel" });
  function renderPrereqInfo() {
    const prof = professions.find(p => p.id === professionSel.input.value);
    const ctx = { attributes: hero.attributes, traits: heroTraitByName, sas: heroSAByName };
    const res = checkPrereq(prof?.prereq, ctx);
    prereqPanel.replaceChildren(
      h("h3", {}, "Voraussetzungen (Profession)"),
      h("div", { class: res.ok ? "success" : "error" },
        res.ok ? "Alle Voraussetzungen erfüllt." : "Fehlt: " + res.fails.join(", ")
      )
    );
  }
  renderPrereqInfo();

  // ===== Bild/Notizen =====
  const portrait = h("input", { type: "file", accept: "image/*" });
  const notes = h("textarea", { rows: 6 }, hero.notes || "");

  // ===== Formular =====
  const errorEl = h("div");
  const form = h("form", { class: "form", onSubmit: onSubmit },
    h("h2", {}, title),
    errorEl,
    h("div", { class: "row" }, name.el, level.el),
    h("div", { class: "row" }, speciesSel.el, raceSel.el),
    h("div", { class: "row" }, cultureSel.el, professionSel.el),

    attrGrid,
    derivedPanel,
    prereqPanel,
    talentPanel,
    traitPanel,
    saPanel,

    h("div", { class: "input" }, h("label", {}, "Portrait (optional)"), portrait),
    h("div", { class: "input" }, h("label", {}, "Notizen"), notes),
    h("div", { class: "actions" },
      h("button", { type: "submit", class: "ok" }, isNew ? "Anlegen" : "Speichern"),
      h("button", { type: "button", class: "ghost", onClick: () => go("/heroes") }, "Zurück")
    )
  );

  root.append(h("div", { class: "panel" }, form));

  // ===== Helpers =====
  function input(label, type, value = "") {
    const el = h("input", { type, value });
    return { el: h("div", { class: "input" }, h("label", {}, label), el), input: el };
  }
  function select(label, list, value, labeler) {
    const el = h("select");
    fillOptions(el, list, value, labeler);
    return { el: h("div", { class: "input" }, h("label", {}, label), el), input: el };
  }
  function fillOptions(el, list, selectedId, labeler) {
    el.replaceChildren();
    el.append(h("option", { value: "" }, "—"));
    for (const item of list) {
      const opt = h("option", { value: item.id }, labeler(item));
      if (item.id === selectedId) opt.selected = true;
      el.append(opt);
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    errorEl.innerHTML = "";

    const values = {
      name: name.input.value.trim(),
      level: parseInt(level.input.value, 10) || 1,
      attributes: hero.attributes,
      notes: notes.value,
      owner: hero.owner,
      species_id: speciesSel.input.value || null,
      race_id: raceSel.input.value || null,
      culture_id: cultureSel.input.value || null,
      profession_id: professionSel.input.value || null
    };

    try {
      let saved = hero;
      if (isNew) saved = await createHero(values);
      else       saved = await updateHero(hero.id, values);

      if (portrait.files && portrait.files[0]) {
        const url = await uploadPortrait(portrait.files[0], user.id, saved.id);
        await updateHero(saved.id, { portrait_url: url });
      }
      go("/heroes");
    } catch (err) {
      console.error(err);
      errorEl.append(h("div", { class: "error" }, err.message || "Speichern fehlgeschlagen."));
    }
  }
}
