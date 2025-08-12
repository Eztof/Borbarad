// --- Supabase Config ---
const SUPABASE_URL = "https://ispzedqdckejulyrkmpe.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzcHplZHFkY2tlanVseXJrbXBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5OTUzMTcsImV4cCI6MjA3MDU3MTMxN30.eUfnXflN7u0SV6uEEMK_4Bp8zFbjfM19i0vvqog7WWs";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Messages ---
const els = {
  form: document.getElementById("message-form"),
  input: document.getElementById("message-input"),
  list: document.getElementById("messages"),
  status: document.getElementById("status"),
};

const fmt = (iso) =>
  new Date(iso).toLocaleString(undefined, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

function escapeHtml(s) {
  return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function setStatus(msg) { els.status.textContent = msg || ""; }

function addMessageToList(row, { prepend = false } = {}) {
  const li = document.createElement("li");
  li.innerHTML = `
    <div>${escapeHtml(row.content || "")}</div>
    ${row.image_url ? `<img src="${row.image_url}" alt="" style="max-width:100%;margin-top:8px;border-radius:8px">` : ""}
    <time datetime="${row.inserted_at}">${fmt(row.inserted_at)}</time>
  `;
  if (prepend) els.list.prepend(li);
  else els.list.appendChild(li);
}

async function loadMessages() {
  setStatus("Lade Nachrichten…");
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .order("inserted_at", { ascending: false })
    .limit(50);
  if (error) return setStatus("Fehler: " + error.message);
  els.list.innerHTML = "";
  data.forEach((row) => addMessageToList(row));
  setStatus(`Fertig • ${data.length} Einträge`);
}

els.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const content = els.input.value.trim();
  if (!content) return;
  els.input.disabled = true;
  const { data, error } = await supabase.from("messages").insert({ content }).select().single();
  els.input.disabled = false;
  els.input.value = "";
  if (error) return setStatus("Fehler: " + error.message);
  addMessageToList(data, { prepend: true });
  setStatus("Gesendet!");
});

supabase.channel("public:messages").on(
  "postgres_changes",
  { event: "INSERT", schema: "public", table: "messages" },
  (payload) => addMessageToList(payload.new, { prepend: true })
).subscribe();

loadMessages();

// --- Image Upload + Gallery ---
const uploadEls = {
  form: document.getElementById("upload-form"),
  input: document.getElementById("file-input"),
  status: document.getElementById("upload-status"),
  gallery: document.getElementById("gallery"),
};

function setUploadStatus(msg) { uploadEls.status.textContent = msg || ""; }
function uniqueFilePath(file) {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  return `${crypto.randomUUID?.() || Date.now()}.${ext}`;
}
function addToGallery({ url, name, createdAt }) {
  const fig = document.createElement("figure");
  fig.innerHTML = `<img src="${url}" alt=""><figcaption>${escapeHtml(name)}<br><time>${fmt(createdAt)}</time></figcaption>`;
  uploadEls.gallery.prepend(fig);
}

async function loadGallery() {
  setUploadStatus("Lade Galerie…");
  const { data, error } = await supabase.storage.from("images").list("", { limit: 1000, sortBy: { column: "created_at", order: "desc" } });
  if (error) return setUploadStatus("Fehler: " + error.message);
  uploadEls.gallery.innerHTML = "";
  for (const obj of data) {
    const { data: pub } = supabase.storage.from("images").getPublicUrl(obj.name);
    addToGallery({ url: pub.publicUrl, name: obj.name, createdAt: obj.created_at });
  }
  setUploadStatus(`Galerie geladen • ${data.length} Bild(er)`);
}

uploadEls.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const file = uploadEls.input.files?.[0];
  if (!file) return setUploadStatus("Bitte Bild wählen");
  if (!file.type.startsWith("image/")) return setUploadStatus("Nur Bilder erlaubt");
  const path = uniqueFilePath(file);
  setUploadStatus("Lade hoch…");
  const { data, error } = await supabase.storage.from("images").upload(path, file, { contentType: file.type });
  if (error) return setUploadStatus("Fehler: " + error.message);
  const { data: pub } = supabase.storage.from("images").getPublicUrl(data.path);
  addToGallery({ url: pub.publicUrl, name: data.path, createdAt: new Date().toISOString() });
  uploadEls.input.value = "";
  setUploadStatus("Upload erfolgreich!");
});

loadGallery();
