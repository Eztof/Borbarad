// js/diary.js
import { supabase } from './supabaseClient.js';
import { state } from './state.js';
import { section, modal, formRow, empty } from './components.js';
import { htmlesc, formatAvDate, datePickerAv, readDatePickerAv } from './utils.js';

/* ===================== RTE (einfach, stabil) ===================== */
function exec(cmd, value = null){ document.execCommand(cmd, false, value); }
function makeButton(label, cmd, value=null, title=''){
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn secondary';
  b.textContent = label;
  if (title) b.title = title;
  b.addEventListener('click', ()=> exec(cmd, value));
  return b;
}

function buildRTE(container, initialHTML=''){
  const toolbar = document.createElement('div');
  toolbar.className = 'rte-toolbar';

  // Buttons
  toolbar.appendChild(makeButton('B', 'bold', null, 'Fett'));
  toolbar.appendChild(makeButton('I', 'italic', null, 'Kursiv'));
  toolbar.appendChild(makeButton('U', 'underline', null, 'Unterstrichen'));
  toolbar.appendChild(makeButton('H2', 'formatBlock', 'H2', 'Zwischenüberschrift'));
  toolbar.appendChild(makeButton('•', 'insertUnorderedList', null, 'Aufzählung'));
  toolbar.appendChild(makeButton('1.', 'insertOrderedList', null, 'Nummerierung'));
  toolbar.appendChild(makeButton('—', 'removeFormat', null, 'Formatierung entfernen'));

  const editor = document.createElement('div');
  editor.className = 'rte-editor';
  editor.contentEditable = 'true';
  editor.innerHTML = initialHTML || '';

  container.appendChild(toolbar);
  container.appendChild(editor);

  return {
    getHTML: ()=> editor.innerHTML,
    setHTML: (html)=> { editor.innerHTML = html || ''; },
    el: editor
  };
}

/* ===================== Daten laden & speichern ===================== */
async function fetchDiary(){
  const { data, error } = await supabase
    .from('diary')
    .select('id, user_id, title, content, av_date, tags, signature, created_at, updated_at')
    .order('created_at', { ascending: false });
  if (error){ console.error(error); return []; }
  return data || [];
}

async function insertDiary(payload){
  const { data, error } = await supabase.from('diary').insert(payload).select('id').single();
  if (error) throw error;
  return data;
}

async function updateDiary(id, payload){
  const { error } = await supabase.from('diary').update(payload).eq('id', id);
  if (error) throw error;
}

async function deleteDiary(id){
  const { error } = await supabase.from('diary').delete().eq('id', id);
  if (error) throw error;
}

/* ===================== UI – List/Row ===================== */

function chipTag(t){ return `<span class="chip diary">${htmlesc(t)}</span>`; }

function diaryRow(entry){
  const tags = (entry.tags||'').split(',').map(s=>s.trim()).filter(Boolean);
  const av = entry.av_date ? `<span class="tag">${formatAvDate(entry.av_date)}</span>` : '';
  return `
    <tr data-id="${entry.id}" class="diary-row">
      <td><strong>${htmlesc(entry.title||'Unbenannt')}</strong></td>
      <td>${av}</td>
      <td>${tags.map(chipTag).join(' ')}</td>
      <td style="text-align:right;white-space:nowrap">
        <button class="btn" data-view="${entry.id}">Lesen</button>
        ${state.user?.id === entry.user_id ? `<button class="btn secondary" data-edit="${entry.id}" style="margin-left:6px">Bearbeiten</button>` : ''}
        ${state.user?.id === entry.user_id ? `<button class="btn warn" data-del="${entry.id}" style="margin-left:6px">Löschen</button>` : ''}
      </td>
    </tr>
  `;
}

/* ===================== Render Hauptseite ===================== */

export async function renderDiary(){
  const app = document.getElementById('app');
  const items = await fetchDiary();

  app.innerHTML = `
    <div class="card">
      ${section('Tagebuch', `<button class="btn" id="btn-new">+ Eintrag</button>`)}
      ${items.length ? `
        <div class="card">
          <table class="table">
            <thead>
              <tr>
                <th>Titel</th>
                <th>Datum (BF)</th>
                <th>Tags</th>
                <th style="text-align:right">Aktionen</th>
              </tr>
            </thead>
            <tbody id="diary-tbody">
              ${items.map(diaryRow).join('')}
            </tbody>
          </table>
        </div>
      ` : empty('Noch keine Tagebuch-Einträge.')}
    </div>
  `;

  // Neuer Eintrag
  const newBtn = document.getElementById('btn-new');
  if (newBtn) newBtn.onclick = ()=> showNewEntry();

  // Actions
  const tbody = document.getElementById('diary-tbody');
  if (!tbody) return;

  tbody.addEventListener('click', (e)=>{
    const idView = e.target.closest('button[data-view]')?.getAttribute('data-view');
    const idEdit = e.target.closest('button[data-edit]')?.getAttribute('data-edit');
    const idDel  = e.target.closest('button[data-del]')?.getAttribute('data-del');
    if (idView){
      const entry = items.find(x=> x.id === idView);
      if (entry) showViewEntry(entry);
    } else if (idEdit){
      const entry = items.find(x=> x.id === idEdit);
      if (entry) showEditEntry(entry);
    } else if (idDel){
      const entry = items.find(x=> x.id === idDel);
      if (entry) confirmDeleteEntry(entry);
    }
  });
}

/* ===================== Modals ===================== */

function showNewEntry(){
  const root = modal(`
    <h3>Neuer Tagebuch-Eintrag</h3>
    ${formRow('Titel', '<input class="input" id="d-title" />')}
    <div class="row">
      <div class="card" style="margin:0">
        <div class="label">Datum (aventurisch)</div>
        ${datePickerAv('d-date', state.campaignDate)}
      </div>
      ${formRow('Tags (Komma-getrennt)', '<input class="input" id="d-tags" placeholder="z.B. reise, kampf, brief" />')}
    </div>
    ${formRow('Signatur (optional)', '<input class="input" id="d-sign" placeholder="gez. ..." />')}
    <div id="rte-wrap"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
      <button class="btn secondary" id="d-cancel">Abbrechen</button>
      <button class="btn" id="d-save">Speichern</button>
    </div>
  `);

  const rte = buildRTE(root.querySelector('#rte-wrap'), '');

  root.querySelector('#d-cancel').onclick = ()=> root.innerHTML='';
  root.querySelector('#d-save').onclick = async ()=>{
    try{
      const title = document.getElementById('d-title').value.trim();
      if (!title){ alert('Titel fehlt.'); return; }
      const payload = {
        title,
        content: rte.getHTML(),
        av_date: readDatePickerAv('d-date'),
        tags: String(document.getElementById('d-tags').value || '').trim(),
        signature: String(document.getElementById('d-sign').value || '').trim(),
        user_id: state.user?.id || null,
        author_name: state.user?.user_metadata?.username || state.user?.email || 'Unbekannt'
      };
      await insertDiary(payload);
      root.innerHTML='';
      renderDiary();
    }catch(err){
      console.error('Diary insert failed:', err);
      alert(err.message);
    }
  };
}

function showEditEntry(entry){
  const root = modal(`
    <h3>Eintrag bearbeiten</h3>
    ${formRow('Titel', `<input class="input" id="e-title" value="${htmlesc(entry.title||'')}" />`)}
    <div class="row">
      <div class="card" style="margin:0">
        <div class="label">Datum (aventurisch)</div>
        ${datePickerAv('e-date', entry.av_date || state.campaignDate)}
      </div>
      ${formRow('Tags (Komma-getrennt)', `<input class="input" id="e-tags" value="${htmlesc(entry.tags||'')}" />`)}
    </div>
    ${formRow('Signatur (optional)', `<input class="input" id="e-sign" value="${htmlesc(entry.signature||'')}" />`)}
    <div id="rte-wrap"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
      <button class="btn secondary" id="e-cancel">Abbrechen</button>
      <button class="btn" id="e-save">Speichern</button>
    </div>
  `);

  const rte = buildRTE(root.querySelector('#rte-wrap'), entry.content || '');

  root.querySelector('#e-cancel').onclick = ()=> root.innerHTML='';
  root.querySelector('#e-save').onclick = async ()=>{
    try{
      const payload = {
        title: document.getElementById('e-title').value.trim(),
        content: rte.getHTML(),
        av_date: readDatePickerAv('e-date'),
        tags: String(document.getElementById('e-tags').value || '').trim(),
        signature: String(document.getElementById('e-sign').value || '').trim()
      };
      if (!payload.title){ alert('Titel fehlt.'); return; }
      await updateDiary(entry.id, payload);
      root.innerHTML='';
      renderDiary();
    }catch(err){
      console.error('Diary update failed:', err);
      alert(err.message);
    }
  };
}

function showViewEntry(entry){
  const root = modal(`
    <div class="daylist">
      <h3 style="margin:0 0 6px 0">${htmlesc(entry.title||'')}</h3>
      ${entry.av_date ? `<div class="small" style="margin-bottom:8px">${formatAvDate(entry.av_date)}</div>` : ''}
      <div class="rte-view">${entry.content || ''}</div>
      ${entry.signature ? `<div class="rte-signature">— ${htmlesc(entry.signature)}</div>` : ''}
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
        ${state.user?.id === entry.user_id ? `<button class="btn" id="v-edit">Bearbeiten</button>` : ''}
        ${state.user?.id === entry.user_id ? `<button class="btn warn" id="v-del">Löschen</button>` : ''}
        <button class="btn secondary" id="v-close">Schließen</button>
      </div>
    </div>
  `);

  root.querySelector('#v-close').onclick = ()=> root.innerHTML='';
  const be = root.querySelector('#v-edit');
  const bd = root.querySelector('#v-del');
  if (be) be.onclick = ()=> { root.innerHTML=''; showEditEntry(entry); };
  if (bd) bd.onclick = ()=> { root.innerHTML=''; confirmDeleteEntry(entry); };
}

function confirmDeleteEntry(entry){
  const root = modal(`
    <h3>Löschen bestätigen</h3>
    <p class="small">Möchtest du den Eintrag <strong>${htmlesc(entry.title||'')}</strong> wirklich löschen?</p>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
      <button class="btn secondary" id="x-cancel">Abbrechen</button>
      <button class="btn warn" id="x-ok">Löschen</button>
    </div>
  `);
  root.querySelector('#x-cancel').onclick = ()=> root.innerHTML='';
  root.querySelector('#x-ok').onclick = async ()=>{
    try{
      await deleteDiary(entry.id);
      root.innerHTML='';
      renderDiary();
    }catch(err){
      console.error('Diary delete failed:', err);
      alert(err.message);
    }
  };
}
