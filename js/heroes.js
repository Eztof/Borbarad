import { supabase } from './supabaseClient.js';
import { section, modal, formRow, empty } from './components.js';
import { htmlesc } from './utils.js';

async function listHeroes(){
  const { data, error } = await supabase
    .from('heroes')
    .select('id,name,species,profession,notes,ap_total,lp_current,lp_max')
    .order('created_at', { ascending:false });
  if (error){ console.error(error); return []; }
  return data;
}

function heroRow(h){
  return `<tr>
    <td><strong>${htmlesc(h.name)}</strong></td>
    <td>${htmlesc(h.species||'')}</td>
    <td>${htmlesc(h.profession||'')}</td>
    <td class="small">${htmlesc(h.notes||'')}</td>
    <td>${Number(h.ap_total ?? 0)}</td>
    <td>${Number(h.lp_current ?? 0)} / ${Number(h.lp_max ?? 0)}</td>
  </tr>`;
}

export async function renderHeroes(){
  const app = document.getElementById('app');
  const items = await listHeroes();
  app.innerHTML = `
    <div class="card">
      ${section('Helden', `<button class="btn" id="add-hero">+ Held</button>`)}
      ${items.length?`
        <div class="card">
          <table class="table">
            <thead><tr><th>Name</th><th>Spezies</th><th>Profession</th><th>Notizen</th><th>AP</th><th>LP</th></tr></thead>
            <tbody>${items.map(heroRow).join('')}</tbody>
          </table>
        </div>
      `: empty('Noch keine Helden angelegt.')}
    </div>
  `;
  document.getElementById('add-hero').onclick = ()=> showAddHero();
}

function showAddHero(){
  const root = modal(`
    <h3>Neuen Helden anlegen</h3>
    ${formRow('Name', '<input class="input" id="h-name" />')}
    <div class="row">
      ${formRow('Spezies', '<input class="input" id="h-species" />')}
      ${formRow('Profession', '<input class="input" id="h-profession" />')}
    </div>
    ${formRow('AP (gesamt)', '<input class="input" id="h-ap" type="number" min="0" value="0" />')}
    <div class="row">
      ${formRow('LP aktuell', '<input class="input" id="h-lpcur" type="number" min="0" value="30" />')}
      ${formRow('LP maximal', '<input class="input" id="h-lpmax" type="number" min="1" value="30" />')}
    </div>
    ${formRow('Notizen', '<textarea class="input" id="h-notes" rows="4"></textarea>')}
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
      <button class="btn secondary" id="h-cancel">Abbrechen</button>
      <button class="btn" id="h-save">Speichern</button>
    </div>
  `);
  root.querySelector('#h-cancel').onclick = ()=> root.innerHTML='';
  root.querySelector('#h-save').onclick = async ()=>{
    const payload = {
      name: document.getElementById('h-name').value.trim(),
      species: document.getElementById('h-species').value.trim(),
      profession: document.getElementById('h-profession').value.trim(),
      notes: document.getElementById('h-notes').value.trim(),
      ap_total: Number(document.getElementById('h-ap').value || 0),
      lp_current: Number(document.getElementById('h-lpcur').value || 0),
      lp_max: Number(document.getElementById('h-lpmax').value || 0)
    };
    if (!payload.name){ alert('Name fehlt'); return; }
    if (payload.lp_max < payload.lp_current){ alert('LP aktuell darf LP max nicht übersteigen.'); return; }
    const { error } = await supabase.from('heroes').insert(payload);
    if (error){ alert(error.message); return; }
    root.innerHTML='';
    location.hash = '#/heroes';
  };
}
