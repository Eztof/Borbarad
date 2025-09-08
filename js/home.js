import { supabase } from './supabaseClient.js';
import { state, setCampaignDate } from './state.js';
import { section, empty, formRow } from './components.js';
import { formatAvDate, datePickerAv, readDatePickerAv } from './utils.js';

/* ---------- Helden laden ---------- */
async function fetchHeroes(){
  const { data, error } = await supabase
    .from('heroes')
    .select('id,name,ap_total,lp_current,lp_max')
    .order('name', { ascending: true });
  if (error){ console.error(error); return []; }
  return data;
}

/* ---------- Heldenkarte ---------- */
function heroCard(h){
  const lpMax = Number(h.lp_max ?? 0);
  const lpCur = Math.max(0, Math.min(lpMax, Number(h.lp_current ?? 0)));
  const pct = lpMax > 0 ? Math.round((lpCur / lpMax) * 100) : 0;
  const warn = pct <= 33 ? ' warn' : '';
  return `
    <div class="hero-card">
      <div class="hero-name">${h.name}</div>
      <div class="kv"><span class="small">AP</span><strong>${Number(h.ap_total ?? 0)}</strong></div>
      <div class="kv"><span class="small">LP</span><span class="small">${lpCur} / ${lpMax}</span></div>
      <div class="bar${warn}" aria-label="LP-Balken" title="${lpCur}/${lpMax}">
        <div class="fill" style="width:${pct}%"></div>
        <div class="mark">${pct}%</div>
      </div>
    </div>
  `;
}

/* ---------- Kampagnendatum speichern ---------- */
async function saveCampaignDateAndPropagate(){
  const newDate = readDatePickerAv('home-date');

  // 1) Im lokalen State speichern
  setCampaignDate(newDate);

  // 2) Optional in DB persistieren (falls Tabelle existiert)
  try{
    // Erwartet eine Tabelle campaign_state(id text primary key, av_date jsonb)
    await supabase.from('campaign_state')
      .upsert({ id: 'singleton', av_date: newDate }, { onConflict: 'id' });
  }catch(e){
    console.warn('campaign_state upsert:', e.message);
  }

  // 3) Alle aktiven NSCs auf neues Datum setzen
  try{
    const { error } = await supabase
      .from('nscs')
      .update({ last_encounter: newDate })
      .eq('is_active', true);
    if (error) console.warn('nscs propagate last_encounter:', error.message);
  }catch(e){
    console.warn('nscs propagate last_encounter (catch):', e.message);
  }
}

/* ---------- Seite rendern ---------- */
export async function renderHome(){
  const app = document.getElementById('app');
  const d = state.campaignDate;
  const heroes = await fetchHeroes();

  app.innerHTML = `
    <div class="card">
      ${section('Start')}
      <div class="card">
        <div class="label">Aktuelles Kampagnen-Datum (Aventurisch)</div>
        <div class="row">
          <div class="card" style="margin:0">${datePickerAv('home-date', d)}</div>
          <div>
            <div class="small" style="margin-bottom:8px">Vorschau</div>
            <h2 style="margin:6px 0">${formatAvDate(d)}</h2>
            <button class="btn" id="btn-save-date" style="margin-top:8px">Speichern</button>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <h3 style="margin:6px 0">Helden</h3>
      ${heroes.length ? `<div class="hero-list">${heroes.map(heroCard).join('')}</div>` : empty('Noch keine Helden angelegt.')}
    </div>
  `;

  // Button: Speichern
  document.getElementById('btn-save-date').onclick = async ()=>{
    await saveCampaignDateAndPropagate();
    // Nach dem Speichern die Seite neu rendern (zeigt aktualisierte Vorschau etc.)
    renderHome();
  };
}
