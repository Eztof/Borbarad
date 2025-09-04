import { supabase } from './supabaseClient.js';
import { state } from './state.js';
import { section, modal, formRow, empty, dateBadge, avDateInputs } from './components.js';
import { formatAvDate, readDatePickerAv, avToDayNumber } from './utils.js';

async function listDiary(){
  const { data, error } = await supabase
    .from('diary')
    .select('*');
  if (error){ console.error(error); return []; }
  // Sortiere nach aventurischem Datum absteigend
  return (data||[]).sort((a,b)=> avToDayNumber(b.av_date) - avToDayNumber(a.av_date));
}

function row(e){
  const snippet = (e.body||'').trim().slice(0,140).replace(/\s+\S*$/,'');
  return `<tr data-id="${e.id}" class="diary-row">
    <td>${dateBadge(e.av_date)}</td>
    <td><strong>${e.title||'Ohne Titel'}</strong></td>
    <td class="small">${snippet}${e.body && e.body.length>snippet.length?'…':''}</td>
  </tr>`;
}

export async function renderDiary(){
  const app = document.getElementById('app');
  const items = await listDiary();

  app.innerHTML = `
    <div class="card">
      ${section('Tagebuch', `<button class="btn" id="add-entry">+ Eintrag</button>`)}
      ${items.length ? `
        <div class="card">
          <table class="table">
            <thead><tr><th>Datum</th><th>Titel</th><th>Vorschau</th></tr></thead>
            <tbody id="diary-tbody">${items.map(row).join('')}</tbody>
          </table>
        </div>
      ` : empty('Noch keine Einträge.')}
    </div>
  `;

  const tbody = document.getElementById('diary-tbody');
  if (tbody){
    tbody.addEventListener('click', (e)=>{
      const tr = e.target.closest('tr.diary-row');
      if (!tr) return;
      const it = items.find(x=>x.id===tr.dataset.id);
      if (it) showEntry(it);
    });
  }

  document.getElementById('add-entry').onclick = ()=> showAddEntry();
}

function showEntry(e){
  const root = modal(`
    <h3 style="margin:0 0 6px 0">${e.title||'Ohne Titel'}</h3>
    <div class="small" style="margin-bottom:10px">${formatAvDate(e.av_date)}</div>
    <div style="white-space:pre-wrap">${(e.body||'')}</div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
      <button class="btn secondary" id="d-close">Schließen</button>
    </div>
  `);
  root.querySelector('#d-close').onclick = ()=> root.innerHTML='';
}

function showAddEntry(){
  const root = modal(`
    <h3>Neuer Tagebuch-Eintrag</h3>
    ${formRow('Titel', '<input class="input" id="d-title" />')}
    ${avDateInputs('d-date', state.campaignDate)}
    ${formRow('Text', '<textarea class="input" id="d-body" rows="8"></textarea>')}
    ${formRow('Tags (optional)', '<input class="input" id="d-tags" />')}
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
      <button class="btn secondary" id="d-cancel">Abbrechen</button>
      <button class="btn" id="d-save">Speichern</button>
    </div>
  `);
  root.querySelector('#d-cancel').onclick = ()=> root.innerHTML='';
  root.querySelector('#d-save').onclick = async ()=>{
    const payload = {
      title: document.getElementById('d-title').value.trim() || 'Ohne Titel',
      av_date: readDatePickerAv('d-date'),
      body: document.getElementById('d-body').value,
      tags: document.getElementById('d-tags').value.trim() || null
    };
    const { error } = await supabase.from('diary').insert(payload);
    if (error){ alert(error.message); return; }
    root.innerHTML='';
    location.hash = '#/diary';
  };
}
