// --- Deine Supabase-Daten (öffentlicher anon key – für Client gedacht) ---
const SUPABASE_URL = "https://ispzedqdckejulyrkmpe.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzcHplZHFkY2tlanVseXJrbXBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5OTUzMTcsImV4cCI6MjA3MDU3MTMxN30.eUfnXflN7u0SV6uEEMK_4Bp8zFbjfM19i0vvqog7WWs";

// Supabase Client initialisieren
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const els = {
  form: document.getElementById("message-form"),
  input: document.getElementById("message-input"),
  list: document.getElementById("messages"),
  status: document.getElementById("status"),
};

// Hilfsfunktionen
const fmt = (iso) =>
  new Date(iso).toLocaleString(undefined, {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit"
  });

function setStatus(msg) { els.status.textContent = msg || ""; }

// Liste neu laden
async function loadMessages() {
  setStatus("Lade Nachrichten…");
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .order("inserted_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error(error);
    setStatus("Fehler beim Laden: " + error.message);
    return;
  }

  els.list.innerHTML = "";
  data.forEach((row) => addMessageToList(row));
  setStatus(`Fertig • ${data.length} Einträge`);
}

function addMessageToList(row, { prepend = false } = {}) {
  const li = document.createElement("li");
  li.innerHTML = `
    <div>${escapeHtml(row.content)}</div>
    <time datetime="${row.inserted_at}">${fmt(row.inserted_at)}</time>
  `;
  if (prepend) els.list.prepend(li);
  else els.list.appendChild(li);
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

// Formular-Handler
els.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const content = els.input.value.trim();
  if (!content) return;

  els.input.disabled = true;
  setStatus("Sende…");

  const { data, error } = await supabase
    .from("messages")
    .insert({ content })
    .select()
    .single();

  els.input.disabled = false;
  els.input.value = "";

  if (error) {
    console.error(error);
    setStatus("Fehler: " + error.message);
    return;
  }

  addMessageToList(data, { prepend: true });
  setStatus("Gesendet!");
});

// Realtime-Subscription: neue Inserts live anzeigen
supabase
  .channel("public:messages")
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "messages" },
    (payload) => {
      addMessageToList(payload.new, { prepend: true });
    }
  )
  .subscribe((status) => {
    if (status === "SUBSCRIBED") setStatus("Realtime verbunden");
  });

// initial
loadMessages();
