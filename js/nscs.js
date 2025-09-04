import { supabase, uploadImage } from './supabaseClient.js';
import { section, modal, formRow, empty, avatar, dateBadge, avDateInputs } from './components.js';
import { byStr, htmlesc, readDatePickerAv, formatAvDate } from './utils.js';

let sortField = 'name';
let sortDir = 1; // 1 asc, -1 desc

async function listNSCs(){
  const { data, error } = await supabase
    .from('nscs')
    .select('*')
    .order('name', { ascending:true });
  if (error){ console.error(error); return []; }
  return data;
}

function row(n){
  return `<tr data-id="${n.id}" class="nsc-row">
    <td style="display:flex;align-items:center;gap:10px">${avatar(n.image_url, n.name)} <strong>${htmlesc(n.name)}</strong></td>
    <td class="small">${htmlesc(n.tags||'')}</td>
    <td>${n.first_encounter ? dateBadge(n.first_encounter) : '<span class="small">–</span>'}</td>
    <td>${n.last_encounter ? dateBadge(n.last_encounter) : '<span class="small">–</span>'}</td>
    <td class="small">${htmlesc(n.whereabouts||'')}</td>
  </tr>`;
}

function sortItems(items){
  return items.sort((a,b)=> sortDir * byStr(sortField)(a,b));
}

export async function renderNSCs(){
  const app = document.getElementById('app');
  let items = await listNSCs();

  app.innerHTML = `
    <div class="card">
      ${section('NSCs', `
        <div style="display:flex;gap:8px">
          <input class="input" placeholder="Suche… (Name/Tags)" id="nsc-q" style="width:260px"/>
          <button class="btn" id="add-nsc">+ NSC</button>
        </div>
      `)}

      <div class="card">
        <table class="table">
          <thead>
            <tr>
              <th data-sf="name">Name</th>
              <th data-sf="tags">Tags</th>
              <th>Erstes Treffen</th>
              <th>Letztes Treffen</th>
              <th>Verbleib</th>
            </tr>
          </thead>
          <tbody id="nsc-tbody">
            ${items.map(row).join('')}
          </tbody>
        </table>
      </div>

      ${!items.length ? empty('Noch keine NSCs angelegt.') : ''}
    </div>
  `;

  const tbody = document.getElementById('nsc-tbody');

  // Suche
  const q = document.getElementById('nsc-q');
  q.addEventListener('input', ()=>{
    const v = q.value.toLowerCase();
    const filtered = items.filter(n=> `${n.name} ${(n.tags||'')}`.toLowerCase().includes(v));
    tbody.innerHTML = filtered.map(row).join('');
  });

  // Sortier-Header
  document.querySelectorAll('th[data-sf]').forEach(th=>{
    th.style.cursor='pointer';
    th.onclick = ()=>{
      const f = th.dataset.sf;
      sortField===f ? (sortDir*=-1) : (sortField=f, sortDir=1);
      items = sortItems(items);
      tbody.innerHTML = items.map(row).join('');
    };
  });

  // Detail öffnen
  tbody.addEventListener('click', (e)=>{
    const tr = e.target.closest('tr.nsc-row');
    if (!tr) return;
    const id = tr.dataset.id;
    const n = items.find(x=>x.id===id);
    if (n) showNSC(n);
  });

  // + NSC
  const addBtn = document.getElementById('add-nsc');
  if (addBtn) addBtn.onclick = ()=> showAddNSC();
}

function showNSC(n){
  const root = modal(`
    <div class="grid">
      <div>
        <div style="display:flex;gap:12px;align-items:center">${avatar(n.image_url, n.name)}
          <div>
            <h3 style="margin:0">${htmlesc(n.name)}</h3>
            <div class="small">${htmlesc(n.tags||'')}</div>
          </div>
        </div>
        <p style="margin-top:12px;white-space:pre-wrap">${htmlesc(n.biography||'')}</p>
      </div>
      <div>
        <div class="card">
          <div class="label">Erste Begegnung</div>
          <div>${n.first_encounter ? formatAvDate(n.first_encounter) : '–'}</div>
        </div>
        <div class="card" style="margin-top:10px">
          <div class="label">Letzte Begegnung</div>
          <div>${n.last_encounter ? formatAvDate(n.last_encounter) : '–'}</div>
        </div>
        <div class="card" style="margin-top:10px">
          <div class="label">Verbleib</div>
          <div>${htmlesc(n.whereabouts||'')}</div>
        </div>
      </div>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
      <button class="btn secondary" id="nsc-close">Schließen</button>
    </div>
  `);
  root.querySelector('#nsc-close').onclick = ()=> root.innerHTML='';
}

function showAddNSC(){
  const root = modal(`
    <h3>Neuen NSC anlegen</h3>
    ${formRow('Name', '<input class="input" id="n-name" />')}
    ${formRow('Tags (Komma-getrennt)', '<input class="input" id="n-tags" />')}
    ${formRow('Bild', '<input class="input" id="n-image" type="file" accept="image/*" />')}
    ${formRow('Biographie', '<textarea class="input" id="n-bio" rows="5"></textarea>')}
    <div class="row">
      ${avDateInputs('n-first')}
      ${avDateInputs('n-last')}
    </div>
    ${formRow('Verbleib', '<input class="input" id="n-where" />')}
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
      <button class="btn secondary" id="n-cancel">Abbrechen</button>
      <button class="btn" id="n-save">Speichern</button>
    </div>
  `);
  root.querySelector('#n-cancel').onclick = ()=> root.innerHTML='';
  root.querySelector('#n-save').onclick = async ()=>{
    try{
      const file = document.getElementById('n-image').files[0];
      const image_url = file ? await uploadImage(file, 'nscs') : null;
      const payload = {
        name: document.getElementById('n-name').value.trim(),
        tags: document.getElementById('n-tags').value.trim(),
        image_url,
        biography: document.getElementById('n-bio').value,
        first_encounter: readDatePickerAv('n-first'),
        last_encounter: readDatePickerAv('n-last'),
        whereabouts: document.getElementById('n-where').value.trim()
      };
      if (!payload.name){ alert('Name fehlt'); return; }
      const { error } = await supabase.from('nscs').insert(payload);
      if (error) throw error;
      root.innerHTML='';
      location.hash = '#/nscs';
    }catch(err){ alert(err.message); }
  };
}
