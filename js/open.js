import { supabase } from './supabaseClient.js';
import { section, empty, modal, formRow } from './components.js';
import { htmlesc } from './utils.js';
import { setEditRequest } from './state.js';

// Hilfen: fehlende Felder ermitteln
function missingForNSC(n){
  const m = [];
  if (!n.tags) m.push('Tags');
  if (!n.image_url) m.push('Bild');
  if (!n.biography) m.push('Biographie');
  if (!n.whereabouts) m.push('Verbleib');
  return m;
}
function missingForObject(o){
  const m = [];
  if (!o.tags) m.push('Tags');
  if (!o.image_url) m.push('Bild');
  if (!o.description) m.push('Beschreibung');
  if (!o.location) m.push('Ort');
  return m;
}

async function fetchData(){
  const [nscsRes, objsRes] = await Promise.all([
    supabase.from('nscs').select('id,name,tags,image_url,biography,whereabouts').order('name', { ascending:true }),
    supabase.from('objects').select('id,name,tags,image_url,description,location').order('name', { ascending:true })
  ]);
  const nscs = (nscsRes.data||[]).map(n=>({ ...n, missing: missingForNSC(n) })).filter(n=> n.missing.length);
  const objs = (objsRes.data||[]).map(o=>({ ...o, missing: missingForObject(o) })).filter(o=> o.missing.length);
  return { nscs, objs };
}

function tableRows(items, type){
  return items.map(it=>`
    <tr>
      <td>${htmlesc(it.name)}</td>
      <td>${it.missing.map(t=>`<span class="tag warn">${t}</span>`).join(' ')}</td>
      <td style="text-align:right">
        <button class="btn" data-edit="${type}:${it.id}">Bearbeiten</button>
        <button class="btn secondary" data-rename="${type}:${it.id}" style="margin-left:6px">Umbenennen</button>
      </td>
    </tr>
  `).join('');
}

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
      .from(table)
      .select('id')
      .eq('name', newName)
      .maybeSingle();
    if (dup && dup.id !== id){ alert('Name bereits vergeben.'); return; }

    const { error } = await supabase.from(table).update({ name: newName }).eq('id', id);
    if (error){ alert(error.message); return; }
    root.innerHTML='';
    // Seite neu laden
    renderOpen();
  };
}

export async function renderOpen(){
  const app = document.getElementById('app');
  const { nscs, objs } = await fetchData();

  app.innerHTML = `
    <div class="card">
      ${section('Offene Punkte')}
      ${(!nscs.length && !objs.length) ? empty('Es ist nichts offen 🎉') : `
      <div class="card">
        <h3 style="margin:6px 0">NSCs</h3>
        ${nscs.length ? `
          <table class="table">
            <thead><tr><th style="width:38%">Name</th><th>Offen</th><th style="width:220px;text-align:right">Aktionen</th></tr></thead>
            <tbody id="open-nscs">${tableRows(nscs,'nsc')}</tbody>
          </table>
        ` : '<div class="small">Keine offenen NSCs.</div>'}
      </div>

      <div class="card" style="margin-top:10px">
        <h3 style="margin:6px 0">Objekte</h3>
        ${objs.length ? `
          <table class="table">
            <thead><tr><th style="width:38%">Name</th><th>Offen</th><th style="width:220px;text-align:right">Aktionen</th></tr></thead>
            <tbody id="open-objs">${tableRows(objs,'object')}</tbody>
          </table>
        ` : '<div class="small">Keine offenen Objekte.</div>'}
      </div>
      `}
    </div>
  `;

  // Buttons verdrahten
  app.querySelectorAll('[data-edit]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const [type,id] = btn.getAttribute('data-edit').split(':');
      setEditRequest({ type, id });
      location.hash = (type==='nsc') ? '#/nscs' : '#/objects';
    });
  });

  app.querySelectorAll('[data-rename]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const [type,id] = btn.getAttribute('data-rename').split(':');
      const tr = btn.closest('tr');
      const curName = tr?.querySelector('td')?.textContent?.trim() || '';
      handleRename(type, id, curName);
    });
  });
}
