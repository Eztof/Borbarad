import { supabase, uploadImage } from './supabaseClient.js';
import { state } from './state.js';
import { section, modal, formRow, empty, avatar, dateBadge, avDateInputs } from './components.js';
import { byStr, htmlesc, readDatePickerAv, formatAvDate } from './utils.js';

let sortField = 'name';
let sortDir = 1;

/* --------------------------------
   Helpers
----------------------------------*/
async function listObjects(){
  const { data, error } = await supabase
    .from('objects')
    .select('*')
    .order('name', { ascending:true });
  if (error){ console.error(error); return []; }
  return data;
}

function lastDisplay(o){
  return o?.is_active ? state.campaignDate : o?.last_seen;
}

function row(o){
  const last = lastDisplay(o);
  return `<tr data-id="${o.id}" class="obj-row">
    <td style="display:flex;align-items:center;gap:10px">${avatar(o.image_url, o.name)} <strong>${htmlesc(o.name)}</strong></td>
    <td class="small">${htmlesc(o.tags||'')}</td>
    <td>${o.first_seen ? dateBadge(o.first_seen) : '<span class="small">–</span>'}</td>
    <td>${last ? dateBadge(last) : '<span class="small">–</span>'}</td>
    <td class="small">${htmlesc(o.location||'')}</td>
  </tr>`;
}

/* --------------------------------
   Render List
----------------------------------*/
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
              <th>Letzter Kontakt</th>
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

  const addBtn = document.getElementById('add-obj');
  if (addBtn) addBtn.onclick = ()=> showAddObject();
}

/* --------------------------------
   Detail
----------------------------------*/
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
          <div class="label">Letzter Kontakt</div>
          <div>${(lastDisplay(o)) ? formatAvDate(lastDisplay(o)) : '–'}</div>
          ${o.is_active ? `<div class="small" style="margin-top:6px">Status: Aktiv – nutzt aktuelles Kampagnen-Datum</div>` : ''}
        </div>
        <div class="card" style="margin-top:10px">
          <div class="label">Ort</div>
          <div>${htmlesc(o.location||'')}</div>
        </div>
      </div>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
      <button class="btn secondary" id="obj-history">Verlauf</button>
      <button class="btn" id="obj-edit">Bearbeiten</button>
      <button class="btn secondary" id="obj-close">Schließen</button>
    </div>
  `);
  root.querySelector('#obj-close').onclick = ()=> root.innerHTML='';
  root.querySelector('#obj-edit').onclick = ()=> showEditObject(o, root);
  root.querySelector('#obj-history').onclick = ()=> showHistoryObject(o.id);
}

/* --------------------------------
   Add + History
----------------------------------*/
function showAddObject(){
  const root = modal(`
    <h3>Neues Objekt</h3>
    ${formRow('Name', '<input class="input" id="o-name" />')}
    ${formRow('Tags (Komma-getrennt)', '<input class="input" id="o-tags" />')}
    ${formRow('Bild', '<input class="input" id="o-image" type="file" accept="image/*" />')}
    ${formRow('Beschreibung', '<textarea class="input" id="o-desc" rows="5"></textarea>')}
    ${avDateInputs('o-first', state.campaignDate, 'Datum Erstkontakt')}
    ${formRow('Status', '<label class="small"><input type="checkbox" id="o-active" checked /> Aktiv (im Besitz / in Nutzung)</label>')}
    <div id="o-last-wrap" style="display:none">
      ${avDateInputs('o-last', state.campaignDate, 'Datum letzter Kontakt')}
    </div>
    ${formRow('Ort', '<input class="input" id="o-loc" />')}
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
      <button class="btn secondary" id="o-cancel">Abbrechen</button>
      <button class="btn" id="o-save">Speichern</button>
    </div>
  `);
  const activeCb = root.querySelector('#o-active');
  const lastWrap = root.querySelector('#o-last-wrap');
  activeCb.onchange = ()=>{ lastWrap.style.display = activeCb.checked ? 'none' : 'block'; };

  root.querySelector('#o-cancel').onclick = ()=> root.innerHTML='';
  root.querySelector('#o-save').onclick = async ()=>{
    try{
      const file = document.getElementById('o-image').files[0];
      const image_url = file ? await uploadImage(file, 'objects') : null;
      const is_active = document.getElementById('o-active').checked;
      const payload = {
        name: document.getElementById('o-name').value.trim(),
        tags: document.getElementById('o-tags').value.trim(),
        image_url,
        description: document.getElementById('o-desc').value,
        first_seen: readDatePickerAv('o-first'),
        last_seen: is_active ? state.campaignDate : readDatePickerAv('o-last'),
        is_active,
        location: document.getElementById('o-loc').value.trim()
      };
      if (!payload.name){ alert('Name fehlt'); return; }

      const { data: inserted, error } = await supabase
        .from('objects')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;

      const username = state.user?.user_metadata?.username || state.user?.email || 'Unbekannt';
      await supabase.from('objects_history').insert({
        object_id: inserted.id,
        action: 'insert',
        changed_by: state.user?.id || null,
        changed_by_name: username,
        data: inserted
      });

      root.innerHTML='';
      location.hash = '#/objects';
    }catch(err){ alert(err.message); }
  };
}

/* --------------------------------
   Edit + History
----------------------------------*/
function showEditObject(o, hostModal){
  const root = modal(`
    <h3>Objekt bearbeiten</h3>
    ${formRow('Name', `<input class="input" id="e-name" value="${htmlesc(o.name)}" />`)}
    ${formRow('Tags (Komma-getrennt)', `<input class="input" id="e-tags" value="${htmlesc(o.tags||'')}" />`)}
    ${formRow('Bild (neu hochladen, optional)', '<input class="input" id="e-image" type="file" accept="image/*" />')}
    ${formRow('Beschreibung', `<textarea class="input" id="e-desc" rows="5">${htmlesc(o.description||'')}</textarea>`)}
    ${avDateInputs('e-first', o.first_seen, 'Datum Erstkontakt')}
    ${formRow('Status', `<label class="small"><input type="checkbox" id="e-active" ${o.is_active?'checked':''}/> Aktiv (im Besitz / in Nutzung)</label>`)}
    <div id="e-last-wrap" style="${o.is_active ? 'display:none' : 'display:block'}">
      ${avDateInputs('e-last', o.last_seen || state.campaignDate, 'Datum letzter Kontakt')}
    </div>
    ${formRow('Ort', `<input class="input" id="e-loc" value="${htmlesc(o.location||'')}" />`)}
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
      <button class="btn secondary" id="e-cancel">Abbrechen</button>
      <button class="btn" id="e-save">Speichern</button>
    </div>
  `);
  const activeCb = root.querySelector('#e-active');
  const lastWrap = root.querySelector('#e-last-wrap');
  activeCb.onchange = ()=>{ lastWrap.style.display = activeCb.checked ? 'none' : 'block'; };

  root.querySelector('#e-cancel').onclick = ()=> root.innerHTML='';
  root.querySelector('#e-save').onclick = async ()=>{
    try{
      const file = document.getElementById('e-image').files[0];
      const newUrl = file ? await uploadImage(file, 'objects') : null;
      const is_active = document.getElementById('e-active').checked;
      const payload = {
        name: document.getElementById('e-name').value.trim(),
        tags: document.getElementById('e-tags').value.trim(),
        image_url: newUrl || o.image_url,
        description: document.getElementById('e-desc').value,
        first_seen: readDatePickerAv('e-first'),
        last_seen: is_active ? state.campaignDate : readDatePickerAv('e-last'),
        is_active,
        location: document.getElementById('e-loc').value.trim()
      };
      if (!payload.name){ alert('Name fehlt'); return; }

      const { data: updated, error } = await supabase
        .from('objects')
        .update(payload)
        .eq('id', o.id)
        .select()
        .single();
      if (error) throw error;

      const username = state.user?.user_metadata?.username || state.user?.email || 'Unbekannt';
      await supabase.from('objects_history').insert({
        object_id: o.id,
        action: 'update',
        changed_by: state.user?.id || null,
        changed_by_name: username,
        data: updated
      });

      root.innerHTML='';
      if (hostModal) hostModal.innerHTML='';
      location.hash = '#/objects';
    }catch(err){ alert(err.message); }
  };
}

/* --------------------------------
   Verlauf
----------------------------------*/
function renderSnapshotList(d){
  const parts = [];
  if ('name' in d) parts.push(`<div><strong>Name:</strong> ${htmlesc(d.name||'')}</div>`);
  if ('tags' in d) parts.push(`<div><strong>Tags:</strong> ${htmlesc(d.tags||'')}</div>`);
  if ('is_active' in d) parts.push(`<div><strong>Status:</strong> ${d.is_active?'Aktiv':'Inaktiv'}</div>`);
  if ('first_seen' in d) parts.push(`<div><strong>Erstkontakt:</strong> ${d.first_seen?formatAvDate(d.first_seen):'—'}</div>`);
  if ('last_seen' in d) parts.push(`<div><strong>Letzter Kontakt:</strong> ${d.last_seen?formatAvDate(d.last_seen):'—'}</div>`);
  if ('location' in d) parts.push(`<div><strong>Ort:</strong> ${htmlesc(d.location||'')}</div>`);
  if ('description' in d) parts.push(`<div class="small" style="white-space:pre-wrap;margin-top:6px">${htmlesc(d.description||'')}</div>`);
  return parts.join('');
}

async function showHistoryObject(object_id){
  const { data, error } = await supabase
    .from('objects_history')
    .select('*')
    .eq('object_id', object_id)
    .order('created_at', { ascending: false });
  if (error){ alert(error.message); return; }

  const items = (data||[]).map(rec=>{
    const when = new Date(rec.created_at).toLocaleString('de-DE');
    const who  = rec.changed_by_name || 'Unbekannt';
    const snap = renderSnapshotList(rec.data || {});
    return `
      <div class="card">
        <div class="small" style="margin-bottom:6px">${when} – ${who} (${rec.action})</div>
        ${snap || '<div class="small">—</div>'}
      </div>
    `;
  }).join('') || '<div class="empty">Noch kein Verlauf.</div>';

  const root = modal(`
    <h3 style="margin:0 0 8px 0">Verlauf (Objekt)</h3>
    <div style="display:grid;gap:10px;max-height:60vh;overflow:auto">${items}</div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
      <button class="btn secondary" id="vh-close">Schließen</button>
    </div>
  `);
  root.querySelector('#vh-close').onclick = ()=> root.innerHTML='';
}
