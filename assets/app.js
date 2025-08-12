// ===== Supabase Client (mit Remember-Option) =====
const SUPABASE_URL = "https://ispzedqdckejulyrkmpe.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzcHplZHFkY2tlanVseXJrbXBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5OTUzMTcsImV4cCI6MjA3MDU3MTMxN30.eUfnXflN7u0SV6uEEMK_4Bp8zFbjfM19i0vvqog7WWs";

let supabase = null;
function makeClient(remember) {
  return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: !!remember,
      autoRefreshToken: true,
      storage: remember ? window.localStorage : window.sessionStorage
    }
  });
}
// Standard: remember=true
supabase = makeClient(true);

// ===== Helpers =====
const el = (id) => document.getElementById(id);
const fmt = (iso) => new Date(iso).toLocaleString(undefined, { year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit" });
const escapeHtml = (s) => String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
const pseudoDomain = "borbarad.local";
const toEmail = (username) => `${username}@${pseudoDomain}`;

// ===== Gate UI =====
const gate = el("gate");
const app = el("app");
const whoami = el("whoami");
const loginForm = el("login-form");
const registerForm = el("register-form");
const loginStatus = el("login-status");
const registerStatus = el("register-status");

el("btn-to-register").addEventListener("click", ()=>{ loginForm.classList.add("hidden"); registerForm.classList.remove("hidden"); loginStatus.textContent=""; });
el("btn-to-login").addEventListener("click", ()=>{ registerForm.classList.add("hidden"); loginForm.classList.remove("hidden"); registerStatus.textContent=""; });

// ===== Registrierung mit Nutzername + Passwort =====
registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  registerStatus.textContent = "Lege Konto an…";

  const username = el("reg-username").value.trim();
  const password = el("reg-password").value;
  const remember = el("remember-reg").checked;

  // Client mit gewünschter Persistenz erzeugen
  supabase = makeClient(remember);

  // Pseudo-E-Mail aus Nutzername erzeugen
  const email = toEmail(username);

  // 1) Account anlegen (Email/Passwort, aber E-Mail ist nur formal)
  const { data: signUpRes, error: signUpErr } = await supabase.auth.signUp({
    email, password,
    options: { emailRedirectTo: undefined } // wir nutzen keine echte E-Mail
  });
  if (signUpErr) { registerStatus.textContent = "Fehler: " + signUpErr.message; return; }

  // 2) Profil mit eindeutigem Nutzernamen
  const userId = signUpRes.user?.id;
  if (userId) {
    const { error: profErr } = await supabase.from("profiles").insert({ id: userId, username });
    if (profErr) { registerStatus.textContent = "Profil-Fehler: " + profErr.message; return; }
  }

  registerStatus.textContent = "Konto erstellt. Du bist jetzt eingeloggt.";
  await afterLogin();
});

// ===== Login nur mit Nutzername + Passwort =====
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginStatus.textContent = "Melde an…";

  const username = el("login-username").value.trim();
  const password = el("login-password").value;
  const remember = el("remember").checked;

  // Client mit gewünschter Persistenz erzeugen
  supabase = makeClient(remember);

  const email = toEmail(username);
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) { loginStatus.textContent = "Login fehlgeschlagen: " + error.message; return; }

  await afterLogin();
});

async function afterLogin() {
  // Session prüfen
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  // Username aus profiles holen
  const uid = session.user.id;
  const { data: profile } = await supabase.from("profiles").select("username").eq("id", uid).maybeSingle();
  whoami.textContent = profile?.username || "unbekannt";

  // Gate ausblenden, App anzeigen
  gate.classList.add("hidden");
  app.classList.remove("hidden");

  // App initialisieren
  initMessages();
  initStorage();
}

// Logout
el("logout-btn").addEventListener("click", async () => {
  await supabase.auth.signOut();
  // Aufräumen & zurück zum Gate
  app.classList.add("hidden");
  gate.classList.remove("hidden");
  loginForm.classList.remove("hidden");
  registerForm.classList.add("hidden");
  loginStatus.textContent = "";
  registerStatus.textContent = "";
});

// ===== Nachrichten =====
let msgEls;
function initMessages() {
  msgEls = {
    form: document.getElementById("message-form"),
    input: document.getElementById("message-input"),
    list: document.getElementById("messages"),
    status: document.getElementById("status"),
  };

  msgEls.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const content = msgEls.input.value.trim();
    if (!content) return;
    msgEls.input.disabled = true;
    const { data, error } = await supabase.from("messages").insert({ content }).select().single();
    msgEls.input.disabled = false; msgEls.input.value = "";
    if (error) { setMsgStatus("Fehler: " + error.message); return; }
    addMessageToList(data, { prepend: true }); setMsgStatus("Gesendet!");
  });

  loadMessages();

  supabase.channel("public:messages")
    .on("postgres_changes", { event:"INSERT", schema:"public", table:"messages" },
      (payload) => addMessageToList(payload.new, { prepend: true }))
    .subscribe();
}

function setMsgStatus(msg){ msgEls.status.textContent = msg || ""; }

function addMessageToList(row, { prepend = false } = {}) {
  const li = document.createElement("li");
  li.innerHTML = `
    <div>${escapeHtml(row.content || "")}</div>
    <time datetime="${row.inserted_at}">${fmt(row.inserted_at)}</time>
  `;
  if (prepend) msgEls.list.prepend(li); else msgEls.list.appendChild(li);
}

async function loadMessages() {
  setMsgStatus("Lade Nachrichten…");
  const { data, error } = await supabase.from("messages").select("*").order("inserted_at",{ascending:false}).limit(50);
  if (error) { setMsgStatus("Fehler: " + error.message); return; }
  msgEls.list.innerHTML = ""; data.forEach((row)=>addMessageToList(row));
  setMsgStatus(`Fertig • ${data.length} Einträge`);
}

// ===== Storage (Bilder) =====
let upEls;
function initStorage() {
  upEls = {
    form: document.getElementById("upload-form"),
    input: document.getElementById("file-input"),
    status: document.getElementById("upload-status"),
    gallery: document.getElementById("gallery"),
  };
  upEls.form.addEventListener("submit", onUpload);
  loadGallery();
}

function setUploadStatus(msg){ upEls.status.textContent = msg || ""; }
function uniqueFilePath(file){ const ext=(file.name.split(".").pop()||"").toLowerCase(); return `${crypto.randomUUID?.()||Date.now()}.${ext}`; }
function addToGallery({ url, name, createdAt }) {
  const fig=document.createElement("figure");
  fig.innerHTML=`<img src="${url}" alt=""><figcaption>${escapeHtml(name)}<br><time>${fmt(createdAt)}</time></figcaption>`;
  upEls.gallery.prepend(fig);
}

async function loadGallery(){
  setUploadStatus("Lade Galerie…");
  const { data, error } = await supabase.storage.from("images").list("", { limit:1000, sortBy:{column:"created_at", order:"desc"} });
  if (error) return setUploadStatus("Fehler: " + error.message);
  upEls.gallery.innerHTML = "";
  for (const obj of data){
    const { data: pub } = supabase.storage.from("images").getPublicUrl(obj.name);
    addToGallery({ url: pub.publicUrl, name: obj.name, createdAt: obj.created_at });
  }
  setUploadStatus(`Galerie geladen • ${data.length} Bild(er)`);
}

async function onUpload(e){
  e.preventDefault();
  const file = upEls.input.files?.[0];
  if (!file) return setUploadStatus("Bitte Bild wählen");
  if (!file.type.startsWith("image/")) return setUploadStatus("Nur Bilder erlaubt");
  const path = uniqueFilePath(file);
  setUploadStatus("Lade hoch…");
  const { data, error } = await supabase.storage.from("images").upload(path, file, { contentType:file.type });
  if (error) return setUploadStatus("Fehler: " + error.message);
  const { data: pub } = supabase.storage.from("images").getPublicUrl(data.path);
  addToGallery({ url: pub.publicUrl, name: data.path, createdAt: new Date().toISOString() });
  upEls.input.value=""; setUploadStatus("Upload erfolgreich!");
}
