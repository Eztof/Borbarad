import { h, clear } from "../dom.js";
import { getHero, createHero, updateHero, blankAttributes } from "./api.js";
import { uploadPortrait } from "../storage/portraits.js";
import { go } from "../router.js";
import { supabase } from "../supabaseClient.js";

export async function renderHeroForm(root, id = null) {
  clear(root);

  let hero = id ? await getHero(id) : {
    owner: (await supabase.auth.getUser()).data.user.id,
    name: "",
    species: "",
    profession: "",
    level: 1,
    attributes: blankAttributes(),
    notes: "",
    portrait_url: null
  };

  const isNew = !id;
  const title = isNew ? "Neuen Helden anlegen" : `Helden bearbeiten: ${hero.name}`;

  const name = input("Name", "text", hero.name);
  const species = input("Spezies", "text", hero.species);
  const profession = input("Profession", "text", hero.profession);
  const level = input("Stufe", "number", hero.level);
  level.input.min = 1;

  // Attribute
  const attrs = {};
  for (const key of ["MU","KL","IN","CH","FF","GE","KO","KK"]) {
    attrs[key] = input(key, "number", hero.attributes[key] ?? 12);
    attrs[key].input.min = 1;
  }

  const portrait = h("input", { type: "file", accept: "image/*" });
  const notes = h("textarea", { rows: 6 }, hero.notes || "");

  const errorEl = h("div");
  const form = h("form", { class: "form", onSubmit: onSubmit },
    h("h2", {}, title),
    errorEl,
    row(name, species),
    row(profession, level),
    h("div", { class: "panel" },
      h("h3", {}, "Eigenschaften"),
      row(attrs.MU, attrs.KL),
      row(attrs.IN, attrs.CH),
      row(attrs.FF, attrs.GE),
      row(attrs.KO, attrs.KK),
    ),
    h("div", { class: "input" }, h("label", {}, "Portrait (optional)"), portrait),
    h("div", { class: "input" }, h("label", {}, "Notizen"), notes),
    h("div", { class: "actions" },
      h("button", { type: "submit", class: "ok" }, isNew ? "Anlegen" : "Speichern"),
      h("button", { type: "button", class: "ghost", onClick: () => go("/heroes") }, "Zurück")
    )
  );

  root.append(h("div", { class: "panel" }, form));

  function input(label, type, value = "") {
    const el = h("input", { type, value });
    return { el: h("div", { class: "input" }, h("label", {}, label), el), input: el };
  }
  function row(a, b) { return h("div", { class: "row" }, a.el, b.el); }

  async function onSubmit(e) {
    e.preventDefault();
    errorEl.innerHTML = "";

    const values = {
      name: name.input.value.trim(),
      species: species.input.value.trim(),
      profession: profession.input.value.trim(),
      level: parseInt(level.input.value, 10) || 1,
      attributes: {
        MU: parseInt(attrs.MU.input.value, 10) || 12,
        KL: parseInt(attrs.KL.input.value, 10) || 12,
        IN: parseInt(attrs.IN.input.value, 10) || 12,
        CH: parseInt(attrs.CH.input.value, 10) || 12,
        FF: parseInt(attrs.FF.input.value, 10) || 12,
        GE: parseInt(attrs.GE.input.value, 10) || 12,
        KO: parseInt(attrs.KO.input.value, 10) || 12,
        KK: parseInt(attrs.KK.input.value, 10) || 12
      },
      notes: notes.value
    };

    try {
      let saved = hero;
      if (isNew) {
        saved = await createHero({ ...values, owner: hero.owner });
      } else {
        saved = await updateHero(hero.id, values);
      }

      // Portrait hochladen?
      if (portrait.files && portrait.files[0]) {
        const user = (await supabase.auth.getUser()).data.user;
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
