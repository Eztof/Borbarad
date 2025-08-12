// App-Bootstrap: Wire-up Auth + UI + Helden-Logik
import { signIn, signUp, getSession, signOut, getMyProfile, onAuthChanged } from "./auth.js";
import { $, $$, show, hide, setText, setHeroForm } from "./ui.js";
import { listHeroes, getHero, createHero, updateHero, deleteHero } from "./heroes.js";
import { uploadHeroPortrait } from "./storage.js";

let currentHero = null;

// ---------- AUTH VIEW ----------
$("#form-signin").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("#si-email").value;
  const password = $("#si-password").value;
  try {
    await signIn(email, password);
  } catch (err) {
    alert("Anmeldung fehlgeschlagen: " + err.message);
  }
});

$("#form-signup").addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = $("#su-username").value.trim();
  const email = $("#su-email").value.trim();
  const password = $("#su-password").value;
  try {
    await signUp({ email, password, username });
    alert("Registrierung erfolgreich. Du bist nun angemeldet.");
  } catch (err) {
    alert("Registrierung fehlgeschlagen: " + err.message);
  }
});

$("#btn-signout").addEventListener("click", async () => {
  await signOut();
});

// ---------- APP VIEW ----------
$("#btn-new-hero").addEventListener("click", () => {
  currentHero = null;
  setHeroForm({ name: "", level: 1 });
  $("#editor-title").textContent = "Neuen Helden erstellen";
  show("#hero-form");
});

$("#hero-portrait").addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = /** @type {HTMLImageElement} */(document.getElementById("hero-portrait-preview"));
    img.src = String(reader.result);
    img.classList.remove("hidden");
  };
  reader.readAsDataURL(file);
});

$("#hero-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    // Daten einsammeln
    const id = $("#hero-id").value || null;
    const name = $("#hero-name").value.trim();
    const species = $("#hero-species").value.trim() || null;
    const profession = $("#hero-profession").value.trim() || null;
    const level = parseInt($("#hero-level").value || "1", 10);
    const attrsText = $("#hero-attrs").value.trim();
    let attrs = null;
    if (attrsText) {
      try { attrs = JSON.parse(attrsText); }
      catch { return alert("Attribute müssen gültiges JSON sein."); }
    }

    // Neu oder Update
    let hero = null;
    if (!id) {
      hero = await createHero({ name, species, profession, level, attrs });
    } else {
      hero = await updateHero(id, { name, species, profession, level, attrs });
    }

    // Portrait optional hochladen
    const file = /** @type {HTMLInputElement} */(document.getElementById("hero-portrait")).files?.[0];
    if (file) {
      const { url } = await uploadHeroPortrait(file, hero.id);
      hero = await updateHero(hero.id, { portrait_url: url });
    }

    await refreshHeroList();
    await openHero(hero.id);
    alert("Gespeichert.");
  } catch (err) {
    alert("Fehler beim Speichern: " + err.message);
  }
});

$("#btn-delete-hero").addEventListener("click", async () => {
  const id = $("#hero-id").value;
  if (!id) return;
  if (!confirm("Helden wirklich löschen?")) return;
  try {
    await deleteHero(id);
    await refreshHeroList();
    $("#hero-form").reset();
    $("#hero-form").classList.add("hidden");
    $("#editor-title").textContent = "Kein Held ausgewählt";
    alert("Gelöscht.");
  } catch (err) {
    alert("Fehler beim Löschen: " + err.message);
  }
});

$("#btn-cancel").addEventListener("click", () => {
  $("#hero-form").reset();
  hide("#hero-form");
  $("#editor-title").textContent = "Kein Held ausgewählt";
});

// ---------- LIST + OPEN ----------
async function refreshHeroList() {
  const ul = $("#hero-list");
  ul.innerHTML = "";
  const heroes = await listHeroes();
  for (const h of heroes) {
    const li = document.createElement("li");
    const btnOpen = document.createElement("button");
    btnOpen.textContent = "Öffnen";
    btnOpen.addEventListener("click", () => openHero(h.id));

    li.innerHTML = `<span>${escapeHtml(h.name)}${h.profession ? " – " + escapeHtml(h.profession) : ""}</span>`;
    li.appendChild(btnOpen);
    ul.appendChild(li);
  }
}

/** @param {string} id */
async function openHero(id) {
  const hero = await getHero(id);
  currentHero = hero;
  setHeroForm(hero);
  $("#editor-title").textContent = `Bearbeite: ${hero.name}`;
  show("#hero-form");
}

function escapeHtml(s) {
  return s?.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])) ?? "";
}

// ---------- AUTH-STATE BOOT ----------
onAuthChanged(async (session) => {
  if (session) {
    hide("#view-auth");
    show("#view-app");
    show("#nav-auth");
    try {
      const profile = await getMyProfile();
      setText("#nav-username", "Hallo, " + (profile?.username ?? "Nutzer"));
    } catch {
      setText("#nav-username", "Hallo!");
    }
    await refreshHeroList();
  } else {
    show("#view-auth");
    hide("#view-app");
    hide("#nav-auth");
  }
});

(async function init() {
  const session = await getSession();
  if (session) {
    hide("#view-auth");
    show("#view-app");
    show("#nav-auth");
    try {
      const profile = await getMyProfile();
      setText("#nav-username", "Hallo, " + (profile?.username ?? "Nutzer"));
    } catch {}
    await refreshHeroList();
  }
})();
