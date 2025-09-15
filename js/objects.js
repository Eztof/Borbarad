import { supabase, uploadImage } from './supabaseClient.js';
import { section, modal, formRow, empty, avatar, dateBadge, avDateInputs } from './components.js';
import { byStr, htmlesc, readDatePickerAv, formatAvDate } from './utils.js';

let sortField = 'name';
let sortDir = 1;

/* ============ Tag Helpers ============ */
let TAG_CACHE = null;

async function loadAllTags(){
  if (TAG_CACHE) return TAG_CACHE;
  try{
    const { data } = await supabase.from('tags').select('name').order('name',{ascending:true});
    TAG_CACHE = (data||[]).map(x => String(x.name||'').trim()).filter(Boolean);
  }catch(e){ TAG_CACHE = []; }
  return TAG_CACHE;
}

function normalizeTag(s){ return String(s||'').trim().replace(/\s+/g,' '); }
function parseTags(raw){ return String(raw||'').split(',').map(normalizeTag).filter(Boolean); }

async function mountTagSuggest(inputEl){
  await loadAllTags();
  const wrap = document.createElement('div'); wrap.className='suggest-wrap';
  const sug  = document.createElement('div'); sug.className='suggest'; sug.style.display='none';
  inputEl.parentElement.insertBefore(wrap, inputEl); wrap.appendChild(inputEl); wrap.appendChild(sug);

  const currentTerm = ()=>{
    const val = inputEl.value || '';
    const parts = val.split(',');
    return normalizeTag(parts[parts.length-1] || '');
  };

  const existingSet = ()=> new Set(parseTags(inputEl.value));

  const close = ()=>{ sug.style.display='none'; sug.innerHTML=''; };

  const openWith = (list)=>{
    if (!list.length){ close(); return; }
    sug.innerHTML = list.slice(0,8).map(t=>`<div class="suggest-item" data-v="${htmlesc(t)}">${htmlesc(t)}</div>`).join('');
    sug.style.display = 'block';
    sug.querySelectorAll('.suggest-item').forEach(div=>{
      div.onclick = ()=>{
        const v = div.getAttribute('data-v');
        const parts = inputEl.value.split(',');
        parts[parts.length-1] = ` ${v}`;
        inputEl.value = parts.join(',').replace(/^ /,'').replace(/ ,/,', ');
        inputEl.dispatchEvent(new Event('input'));
        close(); inputEl.focus();
      };
    });
  };

  inputEl.addEventListener('input', ()=>{
    const q = currentTerm().toLowerCase();
    const ex = existingSet();
    if (!q){ close(); return; }
    const res = TAG_CACHE.filter(t => t.toLowerCase().includes(q) && !ex.has(t));
    openWith(res);
  });

  inputEl.addEventListener('keydown', (e)=>{ if (e.key==='Escape') close(); });
  document.addEventListener('click', (e)=>{ if (!wrap.contains(e.target)) close(); });
}

/* ============ DB / Liste ============ */
async function listObjects(){
  const { data, error } = await supabase
    .from('objects')
    .select('*')
    .order('name', { ascending:true });
  if (error){ console.error(error); return []; }
  return data;
}

/* ============ Tabelle für Desktop ============ */
function row(o){
  return `<tr data-id="${o.id}" class="obj-row">
    <td style="display:flex;align-items:center;gap:10px">${avatar(o.image_url, o.name, 36)} <strong>${htmlesc(o.name)}</strong></td>
    <td class="small">${htmlesc(o.tags||'')}</td>
    <td>${o.first_seen ? dateBadge(o.first_seen) : '<span class="small">–</span>'}</td>
    <td>${o.last_seen ? dateBadge(o.last_seen) : '<span class="small">–</span>'}</td>
    <td class="small">${htmlesc(o.location||'')}</td>
  </tr>`;
}

/* ============ Card-Ansicht für Mobile ============ */
function mobileCard(o) {
  return `
    <div class="mobile-card" data-id="${o.id}">
      <div class="mobile-card-header">
        <div style="display:flex;align-items:center;gap:10px">
          ${avatar(o.image_url, o.name, 40)}
          <strong>${htmlesc(o.name)}</strong>
        </div>
      </div>
      <div class="mobile-card-footer">
        <button class="btn secondary mobile-card-btn">Details</button>
      </div>
    </div>
  `;
}

function sortItems(items){ return items.sort((a,b)=> sortDir * byStr(sortField)(a,b)); }

/* ============ Verlauf aufnehmen (best effort) ============ */
async function recordHistoryObject(object_id, action, snapshot){
  try{
    await supabase.from('objects_history').insert({
      object_id,
      action,
      data: snapshot
    });
  }catch(e){
    console.warn('objects_history skip:', e.message);
  }
}

/* ============ Seite rendern ============ */
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
      <div id="desktop-view" class="card">
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
      <div id="mobile-view" class="mobile-cards-container">
        ${items.map(mobileCard).join('')}
      </div>
      ${!items.length ? empty('Noch keine Objekte angelegt.') : ''}
    </div>
  `;

  // Mobile/Desktop View Toggle
  const desktopView = document.getElementById('desktop-view');
  const mobileView = document.getElementById('mobile-view');
  const tbody = document.getElementById('obj-tbody');

  function updateView() {
    if (window.innerWidth <= 768) {
      desktopView.style.display = 'none';
      mobileView.style.display = 'block';
    } else {
      desktopView.style.display = 'block';
      mobileView.style.display = 'none';
    }
  }

  // Initial view setzen
  updateView();
  window.addEventListener('resize', updateView);

  // Suche (funktioniert für beide Views)
  const q = document.getElementById('obj-q');
  q.addEventListener('input', ()=>{
    const v = q.value.toLowerCase();
    const filtered = items.filter(o=> `${o.name} ${(o.tags||'')}`.toLowerCase().includes(v));
    
    // Desktop View aktualisieren
    tbody.innerHTML = filtered.map(row).join('');
    
    // Mobile View aktualisieren
    mobileView.innerHTML = filtered.map(mobileCard).join('');
  });

  // Sortier-Header (nur Desktop)
  document.querySelectorAll('th[data-sf]').forEach(th=>{
    th.style.cursor='pointer';
    th.onclick = ()=>{
      const f = th.dataset.sf;
      sortField===f ? (sortDir*=-1) : (sortField=f, sortDir=1);
      items = sortItems(items);
      tbody.innerHTML = items.map(row).join('');
      mobileView.innerHTML = items.map(mobileCard).join('');
    };
  });

  // Detail / Edit öffnen (Desktop)
  tbody.addEventListener('click', (e)=>{
    const tr = e.target.closest('tr.obj-row');
    if (!tr) return;
    const id = tr.dataset.id;
    const o = items.find(x=>x.id===id);
    if (o) showObject(o);
  });

  // Detail / Edit öffnen (Mobile)
  mobileView.addEventListener('click', (e) => {
    const card = e.target.closest('.mobile-card');
    if (!card) return;
    
    if (e.target.classList.contains('mobile-card-btn')) {
      const id = card.dataset.id;
      const o = items.find(x=>x.id===id);
      if (o) showObject(o);
    }
  });

  // + Objekt
  const addBtn = document.getElementById('add-obj');
  if (addBtn) addBtn.onclick = ()=> showAddObject();

  // Deep-Link: #/objects?edit=<id>
  const hash = location.hash || '';
  const qm = hash.indexOf('?')>=0 ? new URLSearchParams(hash.split('?')[1]) : null;
  const editId = qm?.get('edit');
  if (editId){
    const o = items.find(x=> x.id === editId);
    if (o) showEditObject(o);
    const base = hash.split('?')[0];
    history.replaceState(null, '', base);
  }
}

/* ============ Detail-Modal ============ */
function showObject(o){
  const root = modal(`
    <div class="grid">
      <div>
        <div style="display:flex;gap:12px;align-items:center">${avatar(o.image_url, o.name, 56)}
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
      <button class="btn secondary" id="obj-history">Verlauf</button>
      <button class="btn" id="obj-edit">Bearbeiten</button>
      <button class="btn secondary" id="obj-close">Schließen</button>
    </div>
  `);
  root.querySelector('#obj-close').onclick = ()=> root.innerHTML='';
  root.querySelector('#obj-edit').onclick = ()=> { root.innerHTML=''; showEditObject(o); };
  root.querySelector('#obj-history').onclick = ()=> showHistoryObject(o.id);
}

/* ============ Neu anlegen ============ */
function showAddObject(){
  const root = modal(`
    <h3>Neues Objekt</h3>
    ${formRow('Name', '<input class="input" id="o-name" />')}
    ${formRow('Tags (Komma-getrennt)', '<input class="input" id="o-tags" placeholder="z.B. borbaradianer, schlüssel, artefakt" />')}
    ${formRow('Bild', '<input class="input" id="o-image" type="file" accept="image/*" />')}
    ${formRow('Beschreibung', '<textarea class="input" id="o-desc" rows="5"></textarea>')}
    <div class="row">
      ${avDateInputs('o-first')}
      ${avDateInputs('o-last')}
    </div>
    ${formRow('Ort', '<input class="input" id="o-loc" />')}
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
      <button class="btn secondary" id="o-cancel">Abbrechen</button>
      <button class="btn" id="o-save">Speichern</button>
    </div>
  `);

  mountTagSuggest(root.querySelector('#o-tags'));

  root.querySelector('#o-cancel').onclick = ()=> root.innerHTML='';
  root.querySelector('#o-save').onclick = async ()=>{
    try{
      const file = document.getElementById('o-image').files[0];
      const image_url = file ? await uploadImage(file, 'objects') : null;
      const payload = {
        name: document.getElementById('o-name').value.trim(),
        tags: parseTags(document.getElementById('o-tags').value).join(', '),
        image_url,
        description: document.getElementById('o-desc').value,
        first_seen: readDatePickerAv('o-first'),
        last_seen: readDatePickerAv('o-last'),
        location: document.getElementById('o-loc').value.trim(),
        is_active: false
      };
      if (!payload.name){ alert('Name fehlt'); return; }
      const { data:dup } = await supabase.from('objects').select('id').eq('name', payload.name).maybeSingle();
      if (dup){ alert('Name bereits vergeben.'); return; }
      const { data, error } = await supabase.from('objects').insert(payload).select('id').single();
      if (error) throw error;
      await upsertNewTags(parseTags(payload.tags));
      await recordHistoryObject(data.id, 'create', payload);
      root.innerHTML='';
      await renderObjects(); // Seite neu laden
    }catch(err){ alert(err.message); }
  };
}

/* ============ Bearbeiten ============ */
function showEditObject(o){
  const root = modal(`
    <h3>Objekt bearbeiten</h3>
    ${formRow('Name', `<input class="input" id="e-name" value="${htmlesc(o.name)}" />`)}
    ${formRow('Tags (Komma-getrennt)', `<input class="input" id="e-tags" value="${htmlesc(o.tags||'')}" />`)}
    ${formRow('Bild (neu hochladen, optional)', '<input class="input" id="e-image" type="file" accept="image/*" />')}
    ${formRow('Beschreibung', `<textarea class="input" id="e-desc" rows="5">${htmlesc(o.description||'')}</textarea>`)}
    ${avDateInputs('e-first', o.first_seen)}
    ${formRow('Status', `<label class="small"><input type="checkbox" id="e-active" ${o.is_active?'checked':''}/> Aktiv (ständig in Kontakt)</label>`)}
    <div id="e-last-wrap" style="${o.is_active ? 'display:none' : ''}">
      ${avDateInputs('e-last', o.last_seen)}
    </div>
    ${formRow('Ort', `<input class="input" id="e-loc" value="${htmlesc(o.location||'')}" />`)}
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
      <button class="btn secondary" id="e-cancel">Abbrechen</button>
      <button class="btn" id="e-save">Speichern</button>
    </div>
  `);

  mountTagSuggest(root.querySelector('#e-tags'));

  const cb = root.querySelector('#e-active');
  const wrapLast = root.querySelector('#e-last-wrap');
  cb.addEventListener('change', ()=>{ wrapLast.style.display = cb.checked ? 'none' : ''; });

  root.querySelector('#e-cancel').onclick = ()=> root.innerHTML='';
  root.querySelector('#e-save').onclick = async ()=>{
    try{
      const name = document.getElementById('e-name').value.trim();
      if (!name){ alert('Name fehlt'); return; }
      if (name !== o.name){
        const { data:dup } = await supabase.from('objects').select('id').eq('name', name).maybeSingle();
        if (dup){ alert('Name bereits vergeben.'); return; }
      }
      const file = document.getElementById('e-image').files[0];
      const image_url = file ? await uploadImage(file, 'objects') : o.image_url;
      const updated = {
        name,
        tags: parseTags(document.getElementById('e-tags').value).join(', '),
        image_url,
        description: document.getElementById('e-desc').value,
        first_seen: readDatePickerAv('e-first'),
        location: document.getElementById('e-loc').value.trim(),
        is_active: document.getElementById('e-active').checked
      };
      updated.last_seen = updated.is_active ? null : readDatePickerAv('e-last');
      const { error } = await supabase.from('objects').update(updated).eq('id', o.id);
      if (error) throw error;
      await upsertNewTags(parseTags(updated.tags));
      await recordHistoryObject(o.id, 'update', updated);
      root.innerHTML='';
      await renderObjects(); // Seite neu laden
    }catch(err){ alert(err.message); }
  };
}

/* ============ Verlauf anzeigen – hübsch, ohne JSON-Dump ============ */
function renderObjectHistorySnapshot(d){
  if (!d || typeof d !== 'object') return '';
  const keys = Object.keys(d);
  if (keys.length === 1 && 'image_url' in d){
    const url = d.image_url || '';
    const thumb = url ? `<div style="margin-top:6px"><img src="${url}" alt="Bild" style="max-width:180px;max-height:120px;border-radius:8px;border:1px solid #4b2a33;object-fit:cover"/></div>` : '';
    return `<div><strong>Bild aktualisiert</strong>${thumb}</div>`;
  }
  const parts = [];
  if ('name' in d) parts.push(`<div><strong>Name:</strong> ${htmlesc(d.name||'')}</div>`);
  if ('tags' in d) parts.push(`<div><strong>Tags:</strong> ${htmlesc(d.tags||'')}</div>`);
  if ('is_active' in d) parts.push(`<div><strong>Status:</strong> ${d.is_active ? 'Aktiv' : 'Inaktiv'}</div>`);
  if ('first_seen' in d) parts.push(`<div><strong>Erstes Auftauchen:</strong> ${d.first_seen ? formatAvDate(d.first_seen) : '—'}</div>`);
  if ('last_seen'  in d) parts.push(`<div><strong>Letztes Auftauchen:</strong> ${d.last_seen ? formatAvDate(d.last_seen) : '—'}</div>`);
  if ('location'   in d) parts.push(`<div><strong>Ort:</strong> ${htmlesc(d.location||'')}</div>`);
  if ('description' in d) parts.push(`<div class="small" style="white-space:pre-wrap;margin-top:6px">${htmlesc(d.description||'')}</div>`);
  if ('image_url' in d && keys.length > 1){
    const url = d.image_url || '';
    const thumb = url ? `<div style="margin-top:6px"><img src="${url}" alt="Bild" style="max-width:180px;max-height:120px;border-radius:8px;border:1px solid #4b2a33;object-fit:cover"/></div>` : '';
    parts.push(`<div><strong>Bild aktualisiert</strong>${thumb}</div>`);
  }
  return parts.join('');
}

async function showHistoryObject(object_id){
  try{
    const { data, error } = await supabase
      .from('objects_history')
      .select('*')
      .eq('object_id', object_id)
      .order('created_at', { ascending:false });
    if (error) throw error;
    const items = (data||[]).map(rec=>{
      const when = new Date(rec.created_at).toLocaleString('de-DE');
      const who  = rec.changed_by_name || 'Unbekannt';
      const snap = renderObjectHistorySnapshot(rec.data || {});
      return `
        <div class="card">
          <div class="small" style="margin-bottom:6px">${when} – ${htmlesc(who)} (${htmlesc(rec.action||'update')})</div>
          ${snap || '<div class="small">—</div>'}
        </div>`;
    }).join('') || '<div class="empty">Noch kein Verlauf.</div>';
    const root = modal(`
      <h3 style="margin:0 0 8px 0">Verlauf (Objekt)</h3>
      <div style="display:grid;gap:10px;max-height:60vh;overflow:auto">${items}</div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
        <button class="btn secondary" id="vh-close-obj">Schließen</button>
      </div>
    `);
    root.querySelector('#vh-close-obj').onclick = ()=> root.innerHTML='';
  }catch(err){
    alert(err.message);
  }
}

/* ============ Tags-Table updaten ============ */
async function upsertNewTags(tagsArr){
  if (!tagsArr?.length) return;
  await loadAllTags();
  const existing = new Set(TAG_CACHE.map(t=>t.toLowerCase()));
  const toAdd = tagsArr.filter(t => !existing.has(t.toLowerCase())).map(name=>({ name }));
  if (!toAdd.length) return;
  try{
    const { error } = await supabase.from('tags').insert(toAdd);
    if (!error){ TAG_CACHE.push(...toAdd.map(x=>x.name)); }
  }catch(e){ console.warn('tags upsert', e.message); }
}