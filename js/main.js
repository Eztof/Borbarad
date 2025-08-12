import { $, h, clear } from "./dom.js";
import { startRouter, onRoute, go } from "./router.js";
import { renderAuth } from "./auth/authUI.js";
import { renderHeroesList } from "./heroes/listView.js";
import { renderHeroForm } from "./heroes/formView.js";
import { getSession, signOut } from "./auth/session.js";
import { supabase } from "./supabaseClient.js";
import { renderAdmin } from "./admin/adminUI.js";

const app = $("#app");
const nav = $("#nav");

async function isAdmin() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return false;
  const { data: prof } = await supabase.from("profiles").select("is_admin").eq("id", data.user.id).single();
  return !!(prof && prof.is_admin);
}

function renderNav(session) {
  clear(nav);
  if (!session) {
    nav.append(link("/auth", "Anmelden"));
  } else {
    nav.append(link("/heroes", "Helden"));
    isAdmin().then(ok => { if (ok) nav.append(link("/admin", "Admin")); });
    nav.append(a(async () => { await signOut(); go("/auth"); }, "Abmelden"));
  }

  function link(path, label) {
    const el = a(() => go(path), label);
    if (location.hash === `#${path}`) el.classList.add("active");
    return el;
  }
  function a(onClick, label) {
    const el = h("a", { href: "javascript:void(0)" }, label);
    el.addEventListener("click", (e) => { e.preventDefault(); onClick(); });
    return el;
  }
}

async function route(path) {
  const session = await getSession();
  renderNav(session);

  const isAuthRoute = path.startsWith("/auth");
  if (!session && !isAuthRoute) return go("/auth");
  if (!path || path === "/") path = "/heroes";

  if (path === "/auth") return renderAuth(app);
  if (path === "/heroes") return renderHeroesList(app);
  if (path === "/heroes/new") return renderHeroForm(app, null);
  if (path === "/admin") return renderAdmin(app);

  const match = path.match(/^\/heroes\/([0-9a-fA-F-]{36})$/);
  if (match) return renderHeroForm(app, match[1]);

  clear(app).append(h("div", { class: "panel" }, h("h2", {}, "Seite nicht gefunden")));
}

onRoute(route);
startRouter();
if (!location.hash) go("/heroes");
