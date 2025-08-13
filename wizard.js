// wizard.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://namppdktopqdghxilerb.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hbXBwZGt0b3BxZGdoeGlsZXJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwMTUzMzQsImV4cCI6MjA3MDU5MTMzNH0.k7QRTUi5Nvo1ABnrWT5jssDw5itBwhtmWwK28Sh4qYM";

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const sel = (q) => document.querySelector(q);
const s1info = sel("#s1info");
const userBox = sel("#userBox");

let heroId = null;
let hero = null;

const chips = ["#st1","#st2","#st3","#st4","#st5","#st6","#st7"].map(sel);
const views = ["#view1","#view2","#view3","#view4","#view5","#view6","#view7"].map(sel);

function gotoStep(n){
  chips.forEach((c,i)=>c.classList.toggle("active", i===n-1));
  views.forEach((v,i)=>v.hidden = (i !== n-1));
}

async function loadUser() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) {
    userBox.textContent = "Nicht angemeldet";
  } else {
    userBox.textContent = user.email || "Angemeldet";
  }
}

function kpi(el, entries){
  el.innerHTML = entries.map(([k,v,cls])=>`<div class="${cls||''}"><strong>${k}:</strong> ${v}</div>`).join("");
}

async function refreshBudget() {
  if (!heroId) return;
  const { data, error } = await sb.from("v_hero_budget").select("*").eq("id", heroId).maybeSingle();
  if (error) return;
  const box = sel("#budgetBox");
  if (box) {
    const bal = data.gp_balance;
    kpi(box, [
      ["GP gesamt", data.gp_total],
      ["GP ausgegeben", data.gp_spent],
      ["GP erhalten (Nachteile)", data.gp_gained],
      ["GP-Saldo", bal, bal===0 ? "ok" : (bal<0?"warn":"err")],
      ["AP gesamt", data.ap_total],
    ]);
  }
}

async function fetchHero(){
  if (!heroId) return;
  const { data, error } = await sb.from("heroes").select("*").eq("id", heroId).maybeSingle();
  if (!error) hero = data;
  await refreshBudget();
}

async function listSpecies(){
  const { data } = await sb.from("species").select("id,name,gp_cost,src_page");
  const s = sel("#speciesSel");
  s.innerHTML = `<option value="">— wählen —</option>` + data.map(x=>`<option value="${x.id}">${x.name} (${x.gp_cost} GP)</option>`).join("");
}

async function listCultures(){
  const { data } = await sb.from("cultures").select("id,name,gp_cost,src_page");
  const s = sel("#cultureSel");
  s.innerHTML = `<option value="">— wählen —</option>` + data.map(x=>`<option value="${x.id}">${x.name} (${x.gp_cost} GP)</option>`).join("");
}

async function listProfessions(){
  const { data } = await sb.from("professions").select("id,name,gp_cost,so_min,so_max,min_mu,min_kl,min_intu,min_ch,min_ff,min_ge,min_ko,min_kk,src_page");
  const s = sel("#professionSel");
  s.innerHTML = `<option value="">— wählen —</option>` + data.map(x=>`<option value="${x.id}">${x.name} (${x.gp_cost} GP)</option>`).join("");
}

async function listTraits(){
  const { data } = await sb.from("traits").select("id,name,kind,gp_cost,tag");
  const s = sel("#traitSel");
  s.innerHTML = `<option value="">— wählen —</option>` + data.map(x=>{
    const tag = x.tag ? ` [${x.tag}]` : "";
    return `<option value="${x.id}">${x.name} — ${x.kind} ${x.gp_cost??0} GP${tag}</option>`;
  }).join("");
}

function sumAttr(){
  const vals = ["mu","kl","intu","ch","ff","ge","ko","kk"].map(id => +sel("#"+id).value||0);
  return vals.reduce((a,b)=>a+b,0);
}

function renderAttrKpi(){
  const total = sumAttr();
  const rest = 100 - total;
  const so = +sel("#so").value||0;
  const box = sel("#attrKpi");
  kpi(box, [
    ["Eigenschaftspunkte", total, (total<=100?"ok":"err")],
    ["verfügbar", rest, (rest>=0?"ok":"err")],
    ["SO (aktuell)", so]
  ]);
}

function renderSpeciesKpi(row){
  const el = sel("#speciesKpi");
  if (!row){ el.innerHTML=""; return; }
  kpi(el, [["GP", row.gp_cost], ["Quelle", row.src_page||"-","muted"]]);
}
function renderCultureKpi(row){
  const el = sel("#cultureKpi");
  if (!row){ el.innerHTML=""; return; }
  kpi(el, [["GP", row.gp_cost], ["Quelle", row.src_page||"-","muted"]]);
}

async function attachEvents(){
  sel("#startBtn").onclick = async ()=>{
    const name = sel("#nameInput").value.trim();
    const { data, error } = await sb.rpc("hero_begin", { p_name: name });
    if (error){ s1info.textContent = error.message; return; }
    heroId = data;
    s1info.textContent = "Entwurf angelegt: "+heroId;
    await listSpecies();
    gotoStep(2);
  };

  sel("#speciesSel").onchange = async (e)=>{
    const id = e.target.value || null;
    if (!heroId || !id) return;
    const { data, error } = await sb.rpc("hero_set_species", { h_id: heroId, p_species: id });
    const { data: row } = await sb.from("species").select("*").eq("id", id).maybeSingle();
    renderSpeciesKpi(row);
  };
  sel("#s2next").onclick = async ()=>{
    await listCultures();
    gotoStep(3);
  };

  sel("#cultureSel").onchange = async (e)=>{
    const id = e.target.value || null;
    if (!heroId || !id) return;
    await sb.rpc("hero_set_culture", { h_id: heroId, p_culture: id });
    const { data: row } = await sb.from("cultures").select("*").eq("id", id).maybeSingle();
    renderCultureKpi(row);
  };
  sel("#s3next").onclick = async ()=>{
    await listProfessions();
    gotoStep(4);
  };

  sel("#professionSel").onchange = async (e)=>{
    const id = e.target.value || null;
    if (!heroId || !id) return;
    await sb.rpc("hero_set_profession", { h_id: heroId, p_prof: id });
    // Info zu Mindestwerten
    const { data: p } = await sb.from("professions").select("*").eq("id", id).maybeSingle();
    const parts = [];
    const push = (n,v)=>{ if (v!=null) parts.push(`${n} ≥ ${v}`); };
    push("MU",p.min_mu);push("KL",p.min_kl);push("IN",p.min_intu);push("CH",p.min_ch);
    push("FF",p.min_ff);push("GE",p.min_ge);push("KO",p.min_ko);push("KK",p.min_kk);
    let so = "";
    if (p.so_min!=null || p.so_max!=null) so = `SO ${p.so_min??"-"} – ${p.so_max??"-"}`;
    sel("#profReq").innerHTML = `Voraussetzungen: ${parts.join(", ") || "–"} | ${so}`;
  };
  sel("#s4next").onclick = ()=>{ gotoStep(5); };

  ["#mu","#kl","#intu","#ch","#ff","#ge","#ko","#kk","#so"].forEach(id=>{
    sel(id).addEventListener("input", renderAttrKpi);
  });
  sel("#s5next").onclick = async ()=>{
    const payload = {
      h_id: heroId,
      p_mu:+sel("#mu").value, p_kl:+sel("#kl").value, p_intu:+sel("#intu").value, p_ch:+sel("#ch").value,
      p_ff:+sel("#ff").value, p_ge:+sel("#ge").value, p_ko:+sel("#ko").value, p_kk:+sel("#kk").value,
      p_so:+sel("#so").value
    };
    const { data, error } = await sb.rpc("hero_set_attributes", payload);
    if (error){ alert(error.message); return; }
    const chk = await sb.rpc("hero_check_profession_requirements", { h_id: heroId });
    if (!chk.data?.ok){ alert(chk.data?.error || "Mindestwerte nicht erfüllt"); }
    await listTraits();
    await refreshBudget();
    gotoStep(6);
  };

  sel("#addTrait").onclick = async ()=>{
    const id = sel("#traitSel").value;
    if (!id) return;
    const { data, error } = await sb.rpc("hero_add_trait", { h_id: heroId, p_trait: id });
    if (error){ alert(error.message); return; }
    if (data && data.ok===false){ alert(data.error || data.msg || "Fehler"); }
    await drawTraitList();
    await refreshBudget();
  };

  sel("#s6next").onclick = async ()=>{
    await refreshBudget();
    gotoStep(7);
  };

  sel("#finalBtn").onclick = async ()=>{
    const { data, error } = await sb.rpc("hero_finalize_generation", { h_id: heroId });
    if (error){ sel("#finalMsg").innerHTML = `<div class="err">${error.message}</div>`; return; }
    if (data && data.ok){ sel("#finalMsg").innerHTML = `<div class="ok">Finalisiert! AP, LE/AU/MR & Kampfbasen gesetzt.</div>`; }
    else { sel("#finalMsg").innerHTML = `<div class="err">${data?.error||"Fehler"}</div>`; }
    await refreshBudget();
  };
}

async function drawTraitList(){
  if (!heroId) return;
  const { data, error } = await sb.from("hero_traits")
    .select("trait_id, traits(name,gp_cost,kind,tag)")
    .eq("hero_id", heroId);
  const box = sel("#traitList");
  if (error){ box.textContent = error.message; return; }
  box.innerHTML = data.map(row=>{
    const t = row.traits;
    const tag = t.tag ? ` [${t.tag}]` : "";
    return `<div>- ${t.name} — ${t.kind} ${t.gp_cost??0} GP${tag} <button data-id="${row.trait_id}" class="rm">entfernen</button></div>`;
  }).join("");
  box.querySelectorAll("button.rm").forEach(btn=>{
    btn.onclick = async ()=>{
      const id = btn.getAttribute("data-id");
      await sb.rpc("hero_remove_trait", { h_id: heroId, p_trait: id });
      await drawTraitList();
      await refreshBudget();
    };
  });

  // KPI
  const { data: bud } = await sb.from("v_hero_budget").select("*").eq("id", heroId).maybeSingle();
  const k = sel("#traitKpi");
  if (bud){
    kpi(k, [["GP-Saldo", bud.gp_balance, bud.gp_balance===0?"ok":(bud.gp_balance<0?"warn":"err")]]);
  }
}

(async function main(){
  await loadUser();
  await attachEvents();
  renderAttrKpi();
  gotoStep(1);
})();
