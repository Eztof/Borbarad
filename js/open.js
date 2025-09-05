import { supabase } from './supabaseClient.js';
import { section, empty, modal, formRow } from './components.js';
import { htmlesc } from './utils.js';

/* ---------- Helper: offene Felder ermitteln (Bild wird ignoriert) ---------- */
function missingForNSC(n){
  const m = [];
  if (!n.tags) m.push('Tags');
  if (!n.biography) m.push('Biographie');
  if (!n.whereabouts) m.push('Verbleib');
  return m;
}
function missingForObject(o){
  const m = [];
  if (!o.tags) m.push('Tags');
  if (!o.description) m.push('Beschreibung');
  if (!o.location) m.push('Ort');
  return m;
}

/* ---------- Daten laden ---------- */
async function fetchData(){
  const [nscsRes, objsRes] = await Promise.all([
    supabase.from('nscs').select('id,name,tags,biography,whereabouts').order('name', { ascending:true }),
    supabase.from('objects').select('id,name,tags,description,location').order('name', { ascending:true })
  ]);
  const nscs = (nscsRes.data||[]).map(n=>({ ...n, missing: missingForNSC(n) })).filter(n=> n.missing.length);
  const objs = (objsRes.data||[]).map(o=>({ ...o, missing: missingForObject(o) })).filter(o=> o.missing.length);
  return { nscs, objs };
}

/* ---------- Tabellen-Zeilen ---------- */
function tableRows(items, type){
  return items.map(it=>`
    <tr>
      <td>${htmlesc(it.name)}</td>
      <td>${it.missing.map(t=>`<span class="tag warn">${htmlesc(t)}</span>`).join(' ')}</td>
      <td style="text-align:right;white-space:nowrap">
        <button class="btn" data-edit="${type}:${it.id}">Bearbeiten</button>
        <button class="btn secondary" data-rename="${type}:${it.id}" style="margin-left:6px">Umbenennen</button>
      </td>
    </tr>
  `).join('');
}

/* ---------- Umbenennen ---------- */
async function handleRename(type, id, curName){
  const root = modal(`
    <h3>Umbenennen – ${htmlesc(curName)}</h3>
    ${formRow('Neuer Name', `<input class="input" id="rn-name" value="${htmlesc(curName)}" />`)}
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
      <button class="btn secondary" id="rn-cancel">Abbrechen</button>
      <button class="btn" id="rn-save">Speichern</button>
    </div>
  `);
  root.querySelector('#rn-cancel').onclick = ()=> root.innerHTML='';
  root.querySelector('#rn-save').onclick = async ()=>{
    const newName = document.getElementById('rn-name').value.trim();
    if (!newName){ alert('Name darf nicht leer sein.'); return; }
    if (newName === curName){ root.innerHTML=''; return; }

    const table = type==='nsc' ? 'nscs' : 'objects';

    // Duplikats-Check
    const { data: dup } = await supabase
      .from(table).select('id').eq('name', newName).maybeSingle();
    if (dup && dup.id !== id){ alert('Name bereits vergeben.'); return; }

    const { error } = await supabase.from(table).update({ name: newName }).eq('id', id);
    if (error){ alert(error.message); return; }
    root.innerHTML='';
    renderOpen(); // Liste aktualisieren
  };
}

/* ---------- Neu anlegen (nur Name) + direkt in Edit springen ---------- */
async function createNSCByName(name){
  const nm = name.trim();
  if (!nm){ alert('Bitte einen Namen eingeben.'); return; }
  const { data: dup } = await supabase.from('nscs').select('id').eq('name', nm).maybeSingle();
  if (dup){ alert('Diesen NSC-Namen gibt es schon.'); return; }

  const { data, error } = await supabase
    .from('nscs')
    .insert({ name: nm, is_active: false })
    .select('id')
    .single();
  if (error){ alert(error.message); return; }

  // direkt zur Bearbeitung
  location.hash = `#/nscs?edit=${data.id}`;
}

async function createObjectByName(name){
  const nm = name.trim();
  if (!nm){ alert('Bitte einen Namen eingeben.'); return; }
  const { data: dup } = await supabase.from('objects').select('id').eq('name', nm).maybeSingle();
  if (dup){ alert('Diesen Objekt-Namen gibt es schon.'); return; }

  const { data, error } = await supabase
    .from('objects')
    .insert({ name: nm, is_active: false })
    .select('id')
    .single();
  if (error){ alert(error.message); return; }

  // direkt zur Bearbeitung
  location.hash = `#/objects?edit=${data.id}`;
}

/* ---------- Renderer ---------- */
export async function renderOpen(){
  const app = document.getElementById('app');
  const { nscs, objs } = await fetchData();

  app.innerHTML = `
    <div class="card">
      ${section('Offene Punkte')}

      <div class="card">
        <h3 style="margin:6px 0">NSCs</h3>

        <div style="display:flex;gap:8px;align-items:center;margin:6px 0 10px 0">
          <input class="input" id="new-nsc-name" placeholder="Neuen NSC-Namen eingeben…" style="max-width:360px">
          <button class="btn" id="btn-add-nsc">Anlegen</button>
        </div>

        ${nscs.length ? `
          <table class="table">
            <thead><tr>
              <th style="width:38%">Name</th>
              <th>Offen</th>
              <th style="width:240px;text-align:right">Aktionen</th>
            </tr></thead>
            <tbody id="open-nscs">${tableRows(nscs,'nsc')}</tbody>
          </table>
        ` : '<div class="small">Keine offenen NSCs.</div>'}
      </div>

      <div class="card" style="margin-top:10px">
        <h3 style="margin:6px 0">Objekte</h3>

        <div style="display:flex;gap:8px;align-items:center;margin:6px 0 10px 0">
          <input class="input" id="new-obj-name" placeholder="Neuen Objekt-Namen eingeben…" style="max-width:360px">
          <button class="btn" id="btn-add-obj">Anlegen</button>
        </div>

        ${objs.length ? `
          <table class="table">
            <thead><tr>
              <th style="width:38%">Name</th>
              <th>Offen</th>
              <th style="width:240px;text-align:right">Aktionen</th>
            </tr></thead>
            <tbody id="open-objs">${tableRows(objs,'object')}</tbody>
          </table>
        ` : '<div class="small">Keine offenen Objekte.</div>'}
      </div>
    </div>
  `;

  // Direkt-Edit
  app.querySelectorAll('[data-edit]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const [type,id] = btn.getAttribute('data-edit').split(':');
      location.hash = (type==='nsc') ? `#/nscs?edit=${id}` : `#/objects?edit=${id}`;
    });
  });

  // Umbenennen
  app.querySelectorAll('[data-rename]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const [type,id] = btn.getAttribute('data-rename').split(':');
      const tr = btn.closest('tr');
      const curName = tr?.querySelector('td')?.textContent?.trim() || '';
      handleRename(type, id, curName);
    });
  });

  // Neu anlegen
  const nscInput = document.getElementById('new-nsc-name');
  const objInput = document.getElementById('new-obj-name');
  document.getElementById('btn-add-nsc').onclick = ()=> createNSCByName(nscInput.value);
  document.getElementById('btn-add-obj').onclick = ()=> createObjectByName(objInput.value);
  nscInput.addEventListener('keydown', (e)=>{ if (e.key==='Enter') createNSCByName(nscInput.value); });
  objInput.addEventListener('keydown', (e)=>{ if (e.key==='Enter') createObjectByName(objInput.value); });
}
