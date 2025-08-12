import { h, clear } from "../dom.js";
import { supabase } from "../supabaseClient.js";
import { usernameToEmail } from "./usernameEmail.js";
import { go } from "../router.js";

// Server-Funktion: check Username frei?
async function isUsernameAvailable(username) {
  const { data, error } = await supabase.rpc("username_available", { u: username });
  if (error) throw error;
  return !!data;
}

function errorBox(msg) {
  return h("div", { class: "error" }, msg);
}

export function renderAuth(root) {
  clear(root);

  const state = { mode: "login", error: "" };

  const switcher = h("div", { class: "actions" },
    h("button", { class: state.mode === "login" ? "" : "ghost", onClick: () => setMode("login") }, "Anmelden"),
    h("button", { class: state.mode === "register" ? "" : "ghost", onClick: () => setMode("register") }, "Registrieren")
  );

  const errorEl = h("div");

  const username = h("input", { type: "text", placeholder: "Nutzername", autocomplete: "username" });
  const password = h("input", { type: "password", placeholder: "Passwort", autocomplete: "current-password", minlength: 6 });

  const form = h("form", { class: "form", onSubmit: onSubmit },
    h("div", { class: "input" }, h("label", {}, "Nutzername"), username),
    h("div", { class: "input" }, h("label", {}, "Passwort"), password),
    h("div", { class: "actions" },
      h("button", { type: "submit" }, () => state.mode === "login" ? "Anmelden" : "Konto anlegen")
    ),
    h("div", { class: "notice" }, "Hinweis: E-Mail-Bestätigung muss in Supabase deaktiviert sein (wir nutzen eine interne Fake-Adresse).")
  );

  root.append(
    h("div", { class: "panel" },
      h("h2", {}, "Borbarad – Anmeldung"),
      switcher, errorEl, form
    )
  );

  function setMode(mode) {
    state.mode = mode;
    switcher.querySelectorAll("button").forEach((b, i) => {
      b.className = i === (mode === "login" ? 0 : 1) ? "" : "ghost";
    });
    errorEl.innerHTML = "";
  }

  async function onSubmit(e) {
    e.preventDefault();
    errorEl.innerHTML = "";
    const u = username.value.trim();
    const p = password.value;

    if (!u || !p) return errorEl.append(errorBox("Bitte Nutzername und Passwort ausfüllen."));
    if (p.length < 6) return errorEl.append(errorBox("Passwort muss mindestens 6 Zeichen haben."));

    const email = usernameToEmail(u);

    if (state.mode === "register") {
      try {
        const free = await isUsernameAvailable(u);
        if (!free) return errorEl.append(errorBox("Dieser Nutzername ist bereits vergeben."));
        // Account anlegen
        const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({ email, password: p });
        if (signUpErr) throw signUpErr;
        const user = signUpData.user;
        if (!user) throw new Error("Registrierung fehlgeschlagen (E-Mail-Bestätigung aktiv?).");

        // Profil schreiben
        const { error: profErr } = await supabase.from("profiles").insert({ id: user.id, username: u });
        if (profErr) throw profErr;

        // Direkt einloggen (falls Session noch nicht aktiv)
        await supabase.auth.signInWithPassword({ email, password: p });

        go("/heroes");
      } catch (err) {
        console.error(err);
        errorEl.append(errorBox(err.message || "Unbekannter Fehler bei der Registrierung."));
      }
    } else {
      try {
        const { error } = await supabase.auth.signInWithPassword({ email, password: p });
        if (error) throw error;
        go("/heroes");
      } catch (err) {
        console.error(err);
        errorEl.append(errorBox("Login fehlgeschlagen. Nutzername/Passwort prüfen."));
      }
    }
  }
}
