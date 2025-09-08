import { supabase, uploadImage } from './supabaseClient.js';
import { state } from './state.js';
import { section, modal, formRow, empty, avatar, dateBadge, avDateInputs } from './components.js';
import { byStr, htmlesc, readDatePickerAv, formatAvDate } from './utils.js';

let sortField = 'name';
let sortDir = 1; // 1 asc, -1 desc

/* ============ Tag Helpers (global gespeicherte Tags) ============ */
let TAG_CACHE = null; // Array<string>

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

/** Komma-Tagfeld mit Suggest aus globaler Tagliste */
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
async function listNSCs(){
  const { data, error } = await supabase
    .from('nscs')
    .select('*')
    .order('name', { ascending:true });
  if (error){ console.error(error); return []; }
  return data;
}

/* ============ Tabelle ============ */
function row(n){
  return `<tr data-id="${n.id}" class="nsc-row">
    <td style="display:flex;align-items:center;gap:10px">${avatar(n.image_url, n.name, 36)} <strong>${htmlesc(n.name)}</strong></td>
    <td class="small">${htmlesc(n.tags||'')}</td>
    <td>${n.first_encounter ? dateBadge(n.first_encounter) : '<span class="small">–</span>'}</td>
    <td>${n.is_active ? dateBadge(state.campaignDate) : (n.last_encounter ? dateBadge(n.last_encounter) : '<span class="small">–</span>')}</td>
    <td class="small">${htmlesc(n.whereabouts||'')}</td>
  </tr>`;
}
function sortItems(items){ return items.sort((a,b)=> sortDir * byStr(sortField)(a,b)); }

/* ============ Verlauf aufnehmen (best effort) ============ */
async function recordHistoryNSC(nsc_id, action, snapshot){
  try{
    await supabase.from('nscs_history').insert({
      nsc_id,
      action,
      data: snapshot
    });
  }catch(e){
    console.warn('nscs_history skip:', e.message);
  }
}

/* ============ Seite rendern ============ */
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
              <th>Erste Begegnung</th>
              <th>Letzte Begegnung</th>
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

  // Detail / Edit öffnen
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

  // Deep-Link: #/nscs?edit=<id>
  const hash = location.hash || '';
  const qm = hash.indexOf('?')>=0 ? new URLSearchParams(hash.split('?')[1]) : null;
  const editId = qm?.get('edit');
  if (editId){
    const n = items.find(x=> x.id === editId);
    if (n) showEditNSC(n);
    const base = hash.split('?')[0];
    history.replaceState(null, '', base);
  }
}

/* ============ Detail-Modal ============ */
function showNSC(n){
  const root = modal(`
    <div class="grid">
      <div>
        <div style="display:flex;gap:12px;align-items:center">${avatar(n.image_url, n.name, 56)}
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
          <div>${n.is_active ? formatAvDate(state.campaignDate) : (n.last_encounter ? formatAvDate(n.last_encounter) : '–')}</div>
          ${n.is_active ? `<div class="small" style="margin-top:6px">Status: Aktiv – nutzt aktuelles Kampagnen-Datum</div>` : ''}
        </div>
        <div class="card" style="margin-top:10px">
          <div class="label">Verbleib</div>
          <div>${htmlesc(n.whereabouts||'')}</div>
        </div>
      </div>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
      <button class="btn secondary" id="nsc-history">Verlauf</button>
      <button class="btn" id="nsc-edit">Bearbeiten</button>
      <button class="btn secondary" id="nsc-close">Schließen</button>
    </div>
  `);
  root.querySelector('#nsc-close').onclick = ()=> root.innerHTML='';
  root.querySelector('#nsc-edit').onclick = ()=> { root.innerHTML=''; showEditNSC(n); };
  root.querySelector('#nsc-history').onclick = ()=> showHistoryNSC(n.id);
}

/* ============ Neu anlegen (jetzt mit "Aktiv") ============ */
function showAddNSC(){
  const root = modal(`
    <h3>Neuen NSC anlegen</h3>
    ${formRow('Name', '<input class="input" id="n-name" />')}
    ${formRow('Tags (Komma-getrennt)', '<input class="input" id="n-tags" placeholder="z.B. borbaradianer, hof, magier" />')}
    ${formRow('Bild', '<input class="input" id="n-image" type="file" accept="image/*" />')}
    ${formRow('Biographie', '<textarea class="input" id="n-bio" rows="5"></textarea>')}
    <div class="row">
      ${avDateInputs('n-first', state.campaignDate)}
      <div id="n-last-wrap">
        ${avDateInputs('n-last', state.campaignDate)}
      </div>
    </div>
    ${formRow('Status', `<label class="small"><input type="checkbox" id="n-active" checked /> Aktiv (ständig in Kontakt)</label>`)}
    ${formRow('Verbleib', '<input class="input" id="n-where" />')}
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
      <button class="btn secondary" id="n-cancel">Abbrechen</button>
      <button class="btn" id="n-save">Speichern</button>
    </div>
  `);

  // Tag-Suggest
  mountTagSuggest(root.querySelector('#n-tags'));

  // Aktiv-Toggle (blendet "Letzte Begegnung" aus, wenn aktiv)
  const cbActive = root.querySelector('#n-active');
  const wrapLast = root.querySelector('#n-last-wrap');
  const syncLastVisibility = ()=>{ wrapLast.style.display = cbActive.checked ? 'none' : ''; };
  syncLastVisibility();
  cbActive.addEventListener('change', syncLastVisibility);

  root.querySelector('#n-cancel').onclick = ()=> root.innerHTML='';
  root.querySelector('#n-save').onclick = async ()=>{
    try{
      const file = document.getElementById('n-image').files[0];
      const image_url = file ? await uploadImage(file, 'nscs') : null;
      const is_active = document.getElementById('n-active').checked;

      const payload = {
        name: document.getElementById('n-name').value.trim(),
        tags: parseTags(document.getElementById('n-tags').value).join(', '),
        image_url,
        biography: document.getElementById('n-bio').value,
        first_encounter: readDatePickerAv('n-first'),
        // Wenn aktiv: initial direkt auf aktuelles Kampagnen-Datum setzen
        last_encounter: is_active ? state.campaignDate : readDatePickerAv('n-last'),
        whereabouts: document.getElementById('n-where').value.trim(),
        is_active
      };
      if (!payload.name){ alert('Name fehlt'); return; }

      // Duplikat?
      const { data:dup } = await supabase.from('nscs').select('id').eq('name', payload.name).maybeSingle();
      if (dup){ alert('Name bereits vergeben.'); return; }

      const { error } = await supabase.from('nscs').insert(payload);
      if (error) throw error;

      // Tags-Table updaten
      await upsertNewTags(parseTags(payload.tags));

      await recordHistoryNSC(null, 'create', payload);
      root.innerHTML='';
      location.hash = '#/nscs';
    }catch(err){ alert(err.message); }
  };
}

/* ============ Bearbeiten ============ */
function showEditNSC(n){
  const root = modal(`
    <h3>NSC bearbeiten</h3>
    ${formRow('Name', `<input class="input" id="e-name" value="${htmlesc(n.name)}" />`)}
    ${formRow('Tags (Komma-getrennt)', `<input class="input" id="e-tags" value="${htmlesc(n.tags||'')}" />`)}
    ${formRow('Bild (neu hochladen, optional)', '<input class="input" id="e-image" type="file" accept="image/*" />')}
    ${formRow('Biographie', `<textarea class="input" id="e-bio" rows="5">${htmlesc(n.biography||'')}</textarea>`)}
    ${avDateInputs('e-first', n.first_encounter || state.campaignDate)}
    ${formRow('Status', `<label class="small"><input type="checkbox" id="e-active" ${n.is_active?'checked':''}/> Aktiv (ständig in Kontakt)</label>`)}
    <div id="e-last-wrap" style="${n.is_active ? 'display:none' : ''}">
      ${avDateInputs('e-last', n.last_encounter || state.campaignDate)}
    </div>
    ${formRow('Verbleib', `<input class="input" id="e-where" value="${htmlesc(n.whereabouts||'')}" />`)}
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
      <button class="btn secondary" id="e-cancel">Abbrechen</button>
      <button class="btn" id="e-save">Speichern</button>
    </div>
  `);

  mountTagSuggest(root.querySelector('#e-tags'));

  // Aktiv-Toggle
  const cb = root.querySelector('#e-active');
  const wrapLast = root.querySelector('#e-last-wrap');
  cb.addEventListener('change', ()=>{ wrapLast.style.display = cb.checked ? 'none' : ''; });

  root.querySelector('#e-cancel').onclick = ()=> root.innerHTML='';
  root.querySelector('#e-save').onclick = async ()=>{
    try{
      const name = document.getElementById('e-name').value.trim();
      if (!name){ alert('Name fehlt'); return; }

      if (name !== n.name){
        const { data:dup } = await supabase.from('nscs').select('id').eq('name', name).maybeSingle();
        if (dup){ alert('Name bereits vergeben.'); return; }
      }

      const file = document.getElementById('e-image').files[0];
      const image_url = file ? await uploadImage(file, 'nscs') : n.image_url;

      const updated = {
        name,
        tags: parseTags(document.getElementById('e-tags').value).join(', '),
        image_url,
        biography: document.getElementById('e-bio').value,
        first_encounter: readDatePickerAv('e-first'),
        whereabouts: document.getElementById('e-where').value.trim(),
        is_active: document.getElementById('e-active').checked
      };
      updated.last_encounter = updated.is_active ? state.campaignDate : readDatePickerAv('e-last');

      const { error } = await supabase.from('nscs').update(updated).eq('id', n.id);
      if (error) throw error;

      await upsertNewTags(parseTags(updated.tags));
      await recordHistoryNSC(n.id, 'update', updated);

      root.innerHTML='';
      location.hash = '#/nscs';
    }catch(err){ alert(err.message); }
  };
}

/* ============ Verlauf anzeigen – kompakt ============ */
function renderNscHistorySnapshot(d){
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
  if ('first_encounter' in d) parts.push(`<div><strong>Erstbegegnung:</strong> ${d.first_encounter ? formatAvDate(d.first_encounter) : '—'}</div>`);
  if ('last_encounter' in d)  parts.push(`<div><strong>Letzte Begegnung:</strong> ${d.last_encounter ? formatAvDate(d.last_encounter) : '—'}</div>`);
  if ('whereabouts' in d)     parts.push(`<div><strong>Verbleib:</strong> ${htmlesc(d.whereabouts||'')}</div>`);
  if ('biography' in d)       parts.push(`<div class="small" style="white-space:pre-wrap;margin-top:6px">${htmlesc(d.biography||'')}</div>`);
  if ('image_url' in d && keys.length > 1){
    const url = d.image_url || '';
    const thumb = url ? `<div style="margin-top:6px"><img src="${url}" alt="Bild" style="max-width:180px;max-height:120px;border-radius:8px;border:1px solid #4b2a33;object-fit:cover"/></div>` : '';
    parts.push(`<div><strong>Bild aktualisiert</strong>${thumb}</div>`);
  }
  return parts.join('');
}

async function showHistoryNSC(nsc_id){
  try{
    const { data, error } = await supabase
      .from('nscs_history')
      .select('*')
      .eq('nsc_id', nsc_id)
      .order('created_at', { ascending:false });
    if (error) throw error;

    const items = (data||[]).map(rec=>{
      const when = new Date(rec.created_at).toLocaleString('de-DE');
      const who  = rec.changed_by_name || 'Unbekannt';
      const snap = renderNscHistorySnapshot(rec.data || {});
      return `
        <div class="card">
          <div class="small" style="margin-bottom:6px">${when} – ${htmlesc(who)} (${htmlesc(rec.action||'update')})</div>
          ${snap || '<div class="small">—</div>'}
        </div>`;
    }).join('') || '<div class="empty">Noch kein Verlauf.</div>';

    const root = modal(`
      <h3 style="margin:0 0 8px 0">Verlauf (NSC)</h3>
      <div style="display:grid;gap:10px;max-height:60vh;overflow:auto">${items}</div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
        <button class="btn secondary" id="vh-close">Schließen</button>
      </div>
    `);
    root.querySelector('#vh-close').onclick = ()=> root.innerHTML='';
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
