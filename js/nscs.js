import { supabase, uploadImage } from './supabaseClient.js';
import { state } from './state.js';
import { section, modal, formRow, empty, avatar, dateBadge, avDateInputs } from './components.js';
import { byStr, htmlesc, readDatePickerAv, formatAvDate } from './utils.js';

let sortField = 'name';
let sortDir = 1; // 1 asc, -1 desc

/* --------------------------------
   Helpers
----------------------------------*/
async function listNSCs(){
  const { data, error } = await supabase
    .from('nscs')
    .select('*')
    .order('name', { ascending:true });
  if (error){ console.error(error); return []; }
  return data;
}

function lastDisplay(n){
  return n?.is_active ? state.campaignDate : n?.last_encounter;
}

function row(n){
  const last = lastDisplay(n);
  return `<tr data-id="${n.id}" class="nsc-row">
    <td style="display:flex;align-items:center;gap:10px">${avatar(n.image_url, n.name)} <strong>${htmlesc(n.name)}</strong></td>
    <td class="small">${htmlesc(n.tags||'')}</td>
    <td>${n.first_encounter ? dateBadge(n.first_encounter) : '<span class="small">–</span>'}</td>
    <td>${last ? dateBadge(last) : '<span class="small">–</span>'}</td>
    <td class="small">${htmlesc(n.whereabouts||'')}</td>
  </tr>`;
}

function sortItems(items){
  return items.sort((a,b)=> sortDir * byStr(sortField)(a,b));
}

/* --------------------------------
   Render List
----------------------------------*/
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

/* --------------------------------
   Detail-Modal
----------------------------------*/
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
          <div>${(lastDisplay(n)) ? formatAvDate(lastDisplay(n)) : '–'}</div>
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
  root.querySelector('#nsc-edit').onclick = ()=> showEditNSC(n, root);
  root.querySelector('#nsc-history').onclick = ()=> showHistoryNSC(n.id);
}

/* --------------------------------
   Add + History logging
----------------------------------*/
function showAddNSC(){
  const root = modal(`
    <h3>Neuen NSC anlegen</h3>
    ${formRow('Name', '<input class="input" id="n-name" />')}
    ${formRow('Tags (Komma-getrennt)', '<input class="input" id="n-tags" />')}
    ${formRow('Bild', '<input class="input" id="n-image" type="file" accept="image/*" />')}
    ${formRow('Biographie', '<textarea class="input" id="n-bio" rows="5"></textarea>')}
    ${avDateInputs('n-first', state.campaignDate, 'Datum Erstbegegnung')}
    ${formRow('Status', '<label class="small"><input type="checkbox" id="n-active" checked /> Aktiv (ständig in Kontakt)</label>')}
    <div id="n-last-wrap" style="display:none">
      ${avDateInputs('n-last', state.campaignDate, 'Datum letzte Begegnung')}
    </div>
    ${formRow('Verbleib', '<input class="input" id="n-where" />')}
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
      <button class="btn secondary" id="n-cancel">Abbrechen</button>
      <button class="btn" id="n-save">Speichern</button>
    </div>
  `);
  const activeCb = root.querySelector('#n-active');
  const lastWrap = root.querySelector('#n-last-wrap');
  activeCb.onchange = ()=>{ lastWrap.style.display = activeCb.checked ? 'none' : 'block'; };

  root.querySelector('#n-cancel').onclick = ()=> root.innerHTML='';
  root.querySelector('#n-save').onclick = async ()=>{
    try{
      const file = document.getElementById('n-image').files[0];
      const image_url = file ? await uploadImage(file, 'nscs') : null;
      const is_active = document.getElementById('n-active').checked;
      const payload = {
        name: document.getElementById('n-name').value.trim(),
        tags: document.getElementById('n-tags').value.trim(),
        image_url,
        biography: document.getElementById('n-bio').value,
        first_encounter: readDatePickerAv('n-first'),
        last_encounter: is_active ? state.campaignDate : readDatePickerAv('n-last'),
        is_active,
        whereabouts: document.getElementById('n-where').value.trim()
      };
      if (!payload.name){ alert('Name fehlt'); return; }

      // Insert + returning (für History)
      const { data: inserted, error } = await supabase
        .from('nscs')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;

      // History
      const username = state.user?.user_metadata?.username || state.user?.email || 'Unbekannt';
      await supabase.from('nscs_history').insert({
        nsc_id: inserted.id,
        action: 'insert',
        changed_by: state.user?.id || null,
        changed_by_name: username,
        data: inserted
      });

      root.innerHTML='';
      location.hash = '#/nscs';
    }catch(err){ alert(err.message); }
  };
}

/* --------------------------------
   Edit + History logging
----------------------------------*/
function showEditNSC(n, hostModal){
  // Edit-Form
  const root = modal(`
    <h3>NSC bearbeiten</h3>
    ${formRow('Name', `<input class="input" id="e-name" value="${htmlesc(n.name)}" />`)}
    ${formRow('Tags (Komma-getrennt)', `<input class="input" id="e-tags" value="${htmlesc(n.tags||'')}" />`)}
    ${formRow('Bild (neu hochladen, optional)', '<input class="input" id="e-image" type="file" accept="image/*" />')}
    ${formRow('Biographie', `<textarea class="input" id="e-bio" rows="5">${htmlesc(n.biography||'')}</textarea>`)}
    ${avDateInputs('e-first', n.first_encounter, 'Datum Erstbegegnung')}
    ${formRow('Status', `<label class="small"><input type="checkbox" id="e-active" ${n.is_active?'checked':''}/> Aktiv (ständig in Kontakt)</label>`)}
    <div id="e-last-wrap" style="${n.is_active ? 'display:none' : 'display:block'}">
      ${avDateInputs('e-last', n.last_encounter || state.campaignDate, 'Datum letzte Begegnung')}
    </div>
    ${formRow('Verbleib', `<input class="input" id="e-where" value="${htmlesc(n.whereabouts||'')}" />`)}
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
      const newUrl = file ? await uploadImage(file, 'nscs') : null;
      const is_active = document.getElementById('e-active').checked;
      const payload = {
        name: document.getElementById('e-name').value.trim(),
        tags: document.getElementById('e-tags').value.trim(),
        image_url: newUrl || n.image_url,
        biography: document.getElementById('e-bio').value,
        first_encounter: readDatePickerAv('e-first'),
        last_encounter: is_active ? state.campaignDate : readDatePickerAv('e-last'),
        is_active,
        whereabouts: document.getElementById('e-where').value.trim()
      };
      if (!payload.name){ alert('Name fehlt'); return; }

      const { data: updated, error } = await supabase
        .from('nscs')
        .update(payload)
        .eq('id', n.id)
        .select()
        .single();
      if (error) throw error;

      const username = state.user?.user_metadata?.username || state.user?.email || 'Unbekannt';
      await supabase.from('nscs_history').insert({
        nsc_id: n.id,
        action: 'update',
        changed_by: state.user?.id || null,
        changed_by_name: username,
        data: updated
      });

      root.innerHTML='';
      if (hostModal) hostModal.innerHTML=''; // Detail-Modal schließen
      location.hash = '#/nscs';
    }catch(err){ alert(err.message); }
  };
}

/* --------------------------------
   Verlauf anzeigen
----------------------------------*/
function renderSnapshotList(d){
  const parts = [];
  if ('name' in d) parts.push(`<div><strong>Name:</strong> ${htmlesc(d.name||'')}</div>`);
  if ('tags' in d) parts.push(`<div><strong>Tags:</strong> ${htmlesc(d.tags||'')}</div>`);
  if ('is_active' in d) parts.push(`<div><strong>Status:</strong> ${d.is_active?'Aktiv':'Inaktiv'}</div>`);
  if ('first_encounter' in d) parts.push(`<div><strong>Erstbegegnung:</strong> ${d.first_encounter?formatAvDate(d.first_encounter):'—'}</div>`);
  if ('last_encounter' in d) parts.push(`<div><strong>Letzte Begegnung:</strong> ${d.last_encounter?formatAvDate(d.last_encounter):'—'}</div>`);
  if ('whereabouts' in d) parts.push(`<div><strong>Verbleib:</strong> ${htmlesc(d.whereabouts||'')}</div>`);
  if ('biography' in d) parts.push(`<div class="small" style="white-space:pre-wrap;margin-top:6px">${htmlesc(d.biography||'')}</div>`);
  return parts.join('');
}

async function showHistoryNSC(nsc_id){
  const { data, error } = await supabase
    .from('nscs_history')
    .select('*')
    .eq('nsc_id', nsc_id)
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
    <h3 style="margin:0 0 8px 0">Verlauf (NSC)</h3>
    <div style="display:grid;gap:10px;max-height:60vh;overflow:auto">${items}</div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
      <button class="btn secondary" id="vh-close">Schließen</button>
    </div>
  `);
  root.querySelector('#vh-close').onclick = ()=> root.innerHTML='';
}
