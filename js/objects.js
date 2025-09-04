import { supabase, uploadImage } from './supabaseClient.js';
import { state } from './state.js';
import { section, modal, formRow, empty, avatar, dateBadge, avDateInputs } from './components.js';
import { byStr, htmlesc, readDatePickerAv, formatAvDate } from './utils.js';

let sortField = 'name';
let sortDir = 1;

async function listObjects(){
  const { data, error } = await supabase
    .from('objects')
    .select('*')
    .order('name', { ascending:true });
  if (error){ console.error(error); return []; }
  return data;
}

function row(o){
  return `<tr data-id="${o.id}" class="obj-row">
    <td style="display:flex;align-items:center;gap:10px">${avatar(o.image_url, o.name)} <strong>${htmlesc(o.name)}</strong></td>
    <td class="small">${htmlesc(o.tags||'')}</td>
    <td>${o.first_seen ? dateBadge(o.first_seen) : '<span class="small">–</span>'}</td>
    <td>${o.last_seen ? dateBadge(o.last_seen) : '<span class="small">–</span>'}</td>
    <td class="small">${htmlesc(o.location||'')}</td>
  </tr>`;
}

export async function renderObjects(){
  const app = document.getElementById('app');
  let items = await listObjects();

  app.innerHTML = `
    <div class="card">
      ${section('Objekte', `
        <div style="display:flex;gap:8px">
          <input class="input" placeholder="Suche… (Name/Tags)" id="obj-q" style="width:260px"/>
          <button class="btn" id="add-obj">+ Objekt</button>
        </div>
      `)}

      <div class="card">
        <table class="table">
          <thead>
            <tr>
              <th data-sf="name">Name</th>
              <th data-sf="tags">Tags</th>
              <th>Erstes Auftauchen</th>
              <th>Letztes Auftauchen</th>
              <th>Ort</th>
            </tr>
          </thead>
          <tbody id="obj-tbody">
            ${items.map(row).join('')}
          </tbody>
        </table>
      </div>

      ${!items.length ? empty('Noch keine Objekte angelegt.') : ''}
    </div>
  `;

  const tbody = document.getElementById('obj-tbody');

  const q = document.getElementById('obj-q');
  q.addEventListener('input', ()=>{
    const v = q.value.toLowerCase();
    const filtered = items.filter(o=> `${o.name} ${(o.tags||'')}`.toLowerCase().includes(v));
    tbody.innerHTML = filtered.map(row).join('');
  });

  document.querySelectorAll('th[data-sf]').forEach(th=>{
    th.style.cursor='pointer';
    th.onclick = ()=>{
      const f=th.dataset.sf;
      sortField===f ? (sortDir*=-1) : (sortField=f, sortDir=1);
      items.sort((a,b)=> sortDir * byStr(sortField)(a,b));
      tbody.innerHTML = items.map(row).join('');
    };
  });

  tbody.addEventListener('click', (e)=>{
    const tr = e.target.closest('tr.obj-row');
    if (!tr) return;
    const id = tr.dataset.id;
    const o = items.find(x=>x.id===id);
    if (o) showObject(o);
  });

  // + Objekt
  const addBtn = document.getElementById('add-obj');
  if (addBtn) addBtn.onclick = ()=> showAddObject();
}

function showObject(o){
  const root = modal(`
    <div class="grid">
      <div>
        <div style="display:flex;gap:12px;align-items:center">${avatar(o.image_url, o.name)}
          <div>
            <h3 style="margin:0">${htmlesc(o.name)}</h3>
            <div class="small">${htmlesc(o.tags||'')}</div>
          </div>
        </div>
        <p style="margin-top:12px;white-space:pre-wrap">${htmlesc(o.description||'')}</p>
      </div>
      <div>
        <div class="card">
          <div class="label">Erstes Auftauchen</div>
          <div>${o.first_seen ? formatAvDate(o.first_seen) : '–'}</div>
        </div>
        <div class="card" style="margin-top:10px">
          <div class="label">Letztes Auftauchen</div>
          <div>${o.last_seen ? formatAvDate(o.last_seen) : '–'}</div>
        </div>
        <div class="card" style="margin-top:10px">
          <div class="label">Ort</div>
          <div>${htmlesc(o.location||'')}</div>
        </div>
      </div>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
      <button class="btn secondary" id="obj-close">Schließen</button>
    </div>
  `);
  root.querySelector('#obj-close').onclick = ()=> root.innerHTML='';
}

function showAddObject(){
  const root = modal(`
    <h3>Neues Objekt</h3>
    ${formRow('Name', '<input class="input" id="o-name" />')}
    ${formRow('Tags (Komma-getrennt)', '<input class="input" id="o-tags" />')}
    ${formRow('Bild', '<input class="input" id="o-image" type="file" accept="image/*" />')}
    ${formRow('Beschreibung', '<textarea class="input" id="o-desc" rows="5"></textarea>')}
    <div class="row">
      ${avDateInputs('o-first', state.campaignDate)}
      ${avDateInputs('o-last', state.campaignDate)}
    </div>
    ${formRow('Ort', '<input class="input" id="o-loc" />')}
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
      <button class="btn secondary" id="o-cancel">Abbrechen</button>
      <button class="btn" id="o-save">Speichern</button>
    </div>
  `);
  root.querySelector('#o-cancel').onclick = ()=> root.innerHTML='';
  root.querySelector('#o-save').onclick = async ()=>{
    try{
      const file = document.getElementById('o-image').files[0];
      const image_url = file ? await uploadImage(file, 'objects') : null;
      const payload = {
        name: document.getElementById('o-name').value.trim(),
        tags: document.getElementById('o-tags').value.trim(),
        image_url,
        description: document.getElementById('o-desc').value,
        first_seen: readDatePickerAv('o-first'),
        last_seen: readDatePickerAv('o-last'),
        location: document.getElementById('o-loc').value.trim()
      };
      if (!payload.name){ alert('Name fehlt'); return; }
      const { error } = await supabase.from('objects').insert(payload);
      if (error) throw error;
      root.innerHTML='';
      location.hash = '#/objects';
    }catch(err){ alert(err.message); }
  };
}
