// --- Supabase Config ---
const SUPABASE_URL = "https://ispzedqdckejulyrkmpe.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzcHplZHFkY2tlanVseXJrbXBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5OTUzMTcsImV4cCI6MjA3MDU3MTMxN30.eUfnXflN7u0SV6uEEMK_4Bp8zFbjfM19i0vvqog7WWs";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Helpers ---
const fmt = (iso) => new Date(iso).toLocaleString(undefined, { year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit" });
const escapeHtml = (s) => String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");

// --- AUTH UI Elements ---
const el = (id) => document.getElementById(id);
const tabs = { login: el("tab-login"), register: el("tab-register") };
const forms = { login: el("login-form"), register: el("register-form") };
const loginStatus = el("login-status");
const registerStatus = el("register-status");
const whoami = el("whoami");
const authedBox = el("authed");
const authHintMsg = el("auth-hint-msg");
const authHintUp = el("auth-hint-up");

// Tab switching
tabs.login.addEventListener("click", () => switchTab("login"));
tabs.register.addEventListener("click", () => switchTab("register"));
function switchTab(name) {
  if (name === "login") {
    tabs.login.classList.add("active"); tabs.register.classList.remove("active");
    forms.login.classList.remove("hidden"); forms.register.classList.add("hidden");
  } else {
    tabs.register.classList.add("active"); tabs.login.classList.remove("active");
    forms.register.classList.remove("hidden"); forms.login.classList.add("hidden");
  }
  loginStatus.textContent = ""; registerStatus.textContent = "";
}

// REGISTER: email + username + password
forms.register.addEventListener("submit", async (e) => {
  e.preventDefault();
  registerStatus.textContent = "Registriere…";

  const username = el("reg-username").value.trim();
  const email = el("reg-email").value.trim();
  const password = el("reg-password").value;

  // 1) signUp (mit Email)
  const { data: signUpRes, error: signUpErr } = await supabase.auth.signUp({
    email, password,
    options: { data: { username } } // optional, speichern wir zusätzlich in user_metadata
  });
  if (signUpErr) { registerStatus.textContent = "Fehler: " + signUpErr.message; return; }

  // 2) Profile anlegen (für Username-Lookup)
  const userId = signUpRes.user?.id;
  if (userId) {
    const { error: profErr } = await supabase.from("profiles").insert({ id: userId, username });
    if (profErr) { registerStatus.textContent = "Profil-Fehler: " + profErr.message; return; }
  }

  registerStatus.textContent = "Registriert! Prüfe ggf. dein E-Mail-Postfach zur Bestätigung.";
  switchTab("login");
});

// LOGIN: identifier = username ODER email
forms.login.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginStatus.textContent = "Logge ein…";

  const identifier = el("login-identifier").value.trim();
  const password = el("login-password").value;

  let emailToUse = identifier;
  if (!identifier.includes("@")) {
    // als Username behandeln -> E-Mail dazu suchen
    const { data: prof, error: findErr } = await supabase
      .from("profiles").select("id").eq("username", identifier).maybeSingle();
    if (findErr) { loginStatus.textContent = "Fehler: " + findErr.message; return; }
    if (!prof) { loginStatus.textContent = "Unbekannter Nutzername."; return; }

    // E-Mail aus auth.users ist nicht direkt lesbar -> Workaround:
    // wir sign-inen per OTP nicht, sondern verlangen E-Mail beim SignUp.
    // Daher muss der Nutzer sich an seine E-Mail erinnern ODER Username->E-Mail außerhalb speichern.
    // Für diese Demo speichern wir die E-Mail NICHT öffentlich. Stattdessen fragen wir Supabase:
    // Es geht nur mit E-Mail – also fordern wir den Nutzer beim SignUp zur E-Mail-Eingabe auf.
    // Lösung: wir halten zusätzlich eine Mapping-Tabelle? Für Demo: wir lassen den Identifier so –
    // wenn es keine @ enthält, versuchen wir ein Sign-In mit "identifier as email" NICHT.
    // => Besser: wir haben beim Register die E-Mail – Hier brauchen wir die E-Mail des Users.
    // Vereinfachung: Wir bitten, beim Login Username ODER E-Mail einzugeben.
    // Wenn Username eingegeben wurde, findet die E-Mail-Adressauflösung nicht clientseitig statt.
    // Also: wir brechen hier ab und sagen dem User, die E-Mail zu benutzen.
    loginStatus.textContent = "Bitte E-Mail zum Login nutzen (Username wird nur zur Suche/Anzeige verwendet).";
    return;
  }

  // klassisches Login per E-Mail + Passwort
  const { error: signErr } = await supabase.auth.signInWithPassword({ email: emailToUse, password });
  if (signErr) { loginStatus.textContent = "Login fehlgeschlagen: " + signErr.message; return; }

  loginStatus.textContent = "Eingeloggt!";
});

// Session-Handling
const { data: initSession } = await supabase.auth.getSession();
setAuthUI(initSession.session);

supabase.auth.onAuthStateChange((_event, session) => {
  setAuthUI(session);
});

function setAuthUI(session) {
  const loggedIn = !!session;
  authedBox.classList.toggle("hidden", !loggedIn);
  el("auth-section").classList.toggle("logged-in", loggedIn);

  // Schreib-/Upload-UI nur bei Login aktiv
  el("message-input").disabled = !loggedIn;
  el("message-form").querySelector("button").disabled = !loggedIn;
  el("file-input").disabled = !loggedIn;
  el("upload-form").querySelector("button").disabled = !loggedIn;
  authHintMsg.classList.toggle("hidden", loggedIn);
  authHintUp.classList.toggle("hidden", loggedIn);

  if (loggedIn) {
    const u = session.user;
    const username = u.user_metadata?.username || u.email || u.id;
    whoami.textContent = username;
  } else {
    whoami.textContent = "";
  }
}

el("logout-btn").addEventListener("click", async () => {
  await supabase.auth.signOut();
});

// --- Nachrichten (wie bisher) ---
const els = {
  form: document.getElementById("message-form"),
  input: document.getElementById("message-input"),
  list: document.getElementById("messages"),
  status: document.getElementById("status"),
};

function setStatus(msg) { els.status.textContent = msg || ""; }

function addMessageToList(row, { prepend = false } = {}) {
  const li = document.createElement("li");
  li.innerHTML = `
    <div>${escapeHtml(row.content || "")}</div>
    ${row.image_url ? `<img src="${row.image_url}" alt="" style="max-width:100%;margin-top:8px;border-radius:8px">` : ""}
    <time datetime="${row.inserted_at}">${fmt(row.inserted_at)}</time>
  `;
  if (prepend) els.list.prepend(li); else els.list.appendChild(li);
}

async function loadMessages() {
  setStatus("Lade Nachrichten…");
  const { data, error } = await supabase.from("messages").select("*").order("inserted_at", { ascending:false }).limit(50);
  if (error) { setStatus("Fehler: " + error.message); return; }
  els.list.innerHTML = ""; data.forEach((row) => addMessageToList(row));
  setStatus(`Fertig • ${data.length} Einträge`);
}

els.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const content = els.input.value.trim();
  if (!content) return;
  els.input.disabled = true;
  const { data, error } = await supabase.from("messages").insert({ content }).select().single();
  els.input.disabled = false; els.input.value = "";
  if (error) { setStatus("Fehler: " + error.message); return; }
  addMessageToList(data, { prepend:true }); setStatus("Gesendet!");
});

supabase.channel("public:messages").on(
  "postgres_changes", { event:"INSERT", schema:"public", table:"messages" },
  (payload) => addMessageToList(payload.new, { prepend:true })
).subscribe();

loadMessages();

// --- Storage (wie vorher) ---
const uploadEls = {
  form: document.getElementById("upload-form"),
  input: document.getElementById("file-input"),
  status: document.getElementById("upload-status"),
  gallery: document.getElementById("gallery"),
};
function setUploadStatus(msg){ uploadEls.status.textContent = msg || ""; }
function uniqueFilePath(file){ const ext=(file.name.split(".").pop()||"").toLowerCase(); return `${crypto.randomUUID?.()||Date.now()}.${ext}`; }
function addToGallery({ url, name, createdAt }) {
  const fig=document.createElement("figure");
  fig.innerHTML = `<img src="${url}" alt=""><figcaption>${escapeHtml(name)}<br><time>${fmt(createdAt)}</time></figcaption>`;
  uploadEls.gallery.prepend(fig);
}
async function loadGallery(){
  setUploadStatus("Lade Galerie…");
  const { data, error } = await supabase.storage.from("images").list("", { limit:1000, sortBy:{ column:"created_at", order:"desc" }});
  if (error) return setUploadStatus("Fehler: " + error.message);
  uploadEls.gallery.innerHTML = "";
  for (const obj of data){
    const { data: pub } = supabase.storage.from("images").getPublicUrl(obj.name);
    addToGallery({ url: pub.publicUrl, name: obj.name, createdAt: obj.created_at });
  }
  setUploadStatus(`Galerie geladen • ${data.length} Bild(er)`);
}
uploadEls.form.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const file = uploadEls.input.files?.[0];
  if (!file) return setUploadStatus("Bitte Bild wählen");
  if (!file.type.startsWith("image/")) return setUploadStatus("Nur Bilder erlaubt");
  const path = uniqueFilePath(file);
  setUploadStatus("Lade hoch…");
  const { data, error } = await supabase.storage.from("images").upload(path, file, { contentType:file.type });
  if (error) return setUploadStatus("Fehler: " + error.message);
  const { data: pub } = supabase.storage.from("images").getPublicUrl(data.path);
  addToGallery({ url: pub.publicUrl, name: data.path, createdAt: new Date().toISOString() });
  uploadEls.input.value = ""; setUploadStatus("Upload erfolgreich!");
});
loadGallery();
