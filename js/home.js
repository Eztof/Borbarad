import { state, setCampaignDate } from './state.js';
import { section, empty } from './components.js';
import { formatAvDate, datePickerAv, readDatePickerAv } from './utils.js';
import { supabase } from './supabaseClient.js';

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

async function fetchHeroes(){
  const { data, error } = await supabase
    .from('heroes')
    .select('id,name,ap_total,lp_current,lp_max')
    .order('name', { ascending: true });
  if (error){ console.error(error); return []; }
  return data;
}

export async function renderHome(){
  const app = document.getElementById('app');
  const d = state.campaignDate;
  const heroes = await fetchHeroes();

  app.innerHTML = `
    <div class="card">
      ${section('Start')}
      <p class="small">Aktuelles Kampagnen-Datum</p>
      <h2 style="margin:6px 0">${formatAvDate(d)}</h2>
      <div class="card" style="margin-top:10px">
        ${datePickerAv('home-date', d)}
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px">
          <button class="btn" id="save-date">Speichern</button>
        </div>
      </div>
    </div>

    <div class="card">
      <h3 style="margin:6px 0">Helden</h3>
      ${heroes.length ? `<div class="hero-list">${heroes.map(heroCard).join('')}</div>` : empty('Noch keine Helden angelegt.')}
    </div>
  `;

  document.getElementById('save-date').onclick = ()=>{
    const av = readDatePickerAv('home-date');
    setCampaignDate(av);
    renderHome();
  };
}
