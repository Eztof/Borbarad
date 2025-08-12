import { h, clear } from "../dom.js";
import { listHeroes, deleteHero } from "./api.js";
import { go } from "../router.js";

export async function renderHeroesList(root) {
  clear(root);
  root.append(
    h("div", { class: "panel" },
      h("h2", {}, "Heldenverwaltung"),
      h("div", { class: "actions" },
        h("button", { onClick: () => go("/heroes/new") }, "Neuen Helden anlegen"),
        h("button", { class: "ghost", onClick: () => go("/heroes") }, "Aktualisieren")
      ),
      h("div", { id: "listContainer" }, "Lade Helden…")
    )
  );

  try {
    const heroes = await listHeroes();
    const list = h("div", { class: "list" },
      ...heroes.map(hero => card(hero))
    );
    const listContainer = root.querySelector("#listContainer");
    clear(listContainer).append(list);
    if (heroes.length === 0) listContainer.append(h("div", { class: "notice" }, "Noch keine Helden angelegt."));
  } catch (err) {
    console.error(err);
    root.querySelector("#listContainer").replaceChildren(h("div", { class: "error" }, "Fehler beim Laden."));
  }

  function card(hero) {
    const img = h("img", { src: hero.portrait_url || "https://placehold.co/72x72?text=🎲", alt: "" });
    const meta = h("div", {},
      h("div", { style: "font-weight:700" }, hero.name),
      h("div", { class: "notice" }, `${hero.species || "—"} • ${hero.profession || "—"} • Stufe ${hero.level}`)
    );

    const actions = h("div", { class: "actions" },
      h("button", { onClick: () => go(`/heroes/${hero.id}`) }, "Öffnen"),
      h("button", {
        class: "danger", onClick: async () => {
          if (!confirm(`„${hero.name}“ endgültig löschen?`)) return;
          try { await deleteHero(hero.id); location.reload(); } catch (e) { alert("Löschen fehlgeschlagen."); }
        }
      }, "Löschen")
    );

    return h("div", { class: "card" }, img, meta, actions);
  }
}
