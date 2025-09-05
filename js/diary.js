import { supabase } from './supabaseClient.js';
import { state } from './state.js';
import { section, modal, formRow, empty, avDateInputs } from './components.js';
import { formatAvDate, readDatePickerAv, htmlesc } from './utils.js';

/* ========= Tag Helpers ========= */
let TAG_CACHE = null;
function normalizeTag(t){ return String(t||'').toLowerCase().trim().replace(/\s+/g,' '); }
function parseTags(text){ return Array.from(new Set(String(text||'').split(',').map(normalizeTag).filter(Boolean))); }
function joinTags(arr){ return arr.join(', '); }

async function loadAllTags(){
  if (TAG_CACHE) return TAG_CACHE;
  const { data } = await supabase.from('tags').select('name').order('name',{ascending:true});
  TAG_CACHE = (data||[]).map(r=>r.name);
  return TAG_CACHE;
}
async function upsertTagsToGlobal(tagsArr){
  if (!tagsArr?.length) return;
  const rows = tagsArr.map(name => ({ name }));
  await supabase.from('tags').upsert(rows, { onConflict: 'name' });
  TAG_CACHE = null;
  await loadAllTags();
}
async function attachTagAutocomplete(inputEl){
  await loadAllTags();
  const wrap = document.createElement('div');
  wrap.className = 'suggest-wrap';
  inputEl.parentNode.insertBefore(wrap, inputEl);
  wrap.appendChild(inputEl);
  const sug = document.createElement('div');
  sug.className = 'suggest';
  sug.style.display = 'none';
  wrap.appendChild(sug);

  function currentToken(){
    const val = inputEl.value;
    const parts = val.split(',');
    const last = parts[parts.length-1] ?? '';
    return normalizeTag(last);
  }
  function existingSet(){ return new Set(parseTags(inputEl.value)); }
  function close(){ sug.style.display='none'; sug.innerHTML=''; }
  function openWith(list){
    if (!list.length){ close(); return; }
    sug.innerHTML = list.slice(0,8).map(t=>`<div class="suggest-item" data-v="${htmlesc(t)}">${htmlesc(t)}</div>`).join('');
    sug.style.display = 'block';
    sug.querySelectorAll('.suggest-item').forEach(it=>{
      it.onclick = ()=>{
        const cur = existingSet();
        cur.add(it.getAttribute('data-v'));
        inputEl.value = joinTags(Array.from(cur)) + ', ';
        close(); inputEl.focus();
      };
    });
  }

  inputEl.addEventListener('input', ()=>{
    const token = currentToken();
    const exist = existingSet();
    if (!token){ close(); return; }
    const list = TAG_CACHE.filter(t => t.includes(token) && !exist.has(t));
    openWith(list);
  });
  inputEl.addEventListener('keydown', (e)=>{
    if (e.key === 'Escape'){ close(); }
    if (e.key === 'Enter'){
      if (sug.style.display === 'block'){
        const first = sug.querySelector('.suggest-item');
        if (first){ first.click(); e.preventDefault(); }
      }
    }
  });
  document.addEventListener('click', (e)=>{ if (!wrap.contains(e.target)) close(); });
}

/* ========= Daten ========= */
async function fetchDiary(){
  const { data, error } = await supabase
    .from('diary')
    .select('id, created_at, updated_at, user_id, author_name, title, av_date, tags, signature')
    .order('created_at', { ascending: false });
  if (error){ console.error(error); return []; }
  return data;
}
async function getDiaryById(id){
  const { data, error } = await supabase
    .from('diary')
    .select('*')
    .eq('id', id)
    .single();
  if (error){ throw error; }
  return data;
}

/* ========= RTE ========= */
function applyCmd(cmd, val=null){ document.execCommand(cmd, false, val); }
function buildRte(initialHtml=''){
  const toolbar = document.createElement('div');
  toolbar.className = 'rte-toolbar';
  toolbar.innerHTML = `
    <button type="button" class="btn secondary" data-cmd="bold"><b>B</b></button>
    <button type="button" class="btn secondary" data-cmd="italic"><i>I</i></button>
    <button type="button" class="btn secondary" data-cmd="underline"><u>U</u></button>
    <select id="rte-size">
      <option value="">Schriftgröße</option>
      <option value="2">Klein</option>
      <option value="3">Normal</option>
      <option value="4">Groß</option>
      <option value="5">Sehr groß</option>
      <option value="6">Riesig</option>
    </select>
    <select id="rte-font">
      <option value="">Schriftart</option>
      <option value="system-ui, Segoe UI, Roboto, Arial">System</option>
      <option value="Georgia, Times, serif">Serif</option>
      <option value="Arial, Helvetica, sans-serif">Sans</option>
      <option value="Courier New, Consolas, monospace">Monospace</option>
    </select>
    <button type="button" class="btn secondary" id="rte-clear">Format entfernen</button>
    <button type="button" class="btn secondary" id="rte-ul">• Liste</button>
    <button type="button" class="btn secondary" id="rte-ol">1. Liste</button>
  `;
  const editor = document.createElement('div');
  editor.className = 'rte-editor';
  editor.setAttribute('contenteditable','true');
  editor.innerHTML = initialHtml || '';

  // bind
  toolbar.querySelectorAll('button[data-cmd]').forEach(btn=>{
    btn.addEventListener('click', ()=> applyCmd(btn.dataset.cmd));
  });
  toolbar.querySelector('#rte-size').addEventListener('change', (e)=>{
    const v = e.target.value;
    if (v) applyCmd('fontSize', v);
  });
  toolbar.querySelector('#rte-font').addEventListener('change', (e)=>{
    const v = e.target.value;
    if (v) applyCmd('fontName', v);
  });
  toolbar.querySelector('#rte-clear').addEventListener('click', ()=>{
    applyCmd('removeFormat');
  });
  toolbar.querySelector('#rte-ul').addEventListener('click', ()=> applyCmd('insertUnorderedList'));
  toolbar.querySelector('#rte-ol').addEventListener('click', ()=> applyCmd('insertOrderedList'));

  return { toolbar, editor, getHtml:()=>editor.innerHTML, setHtml:(h)=> editor.innerHTML=h };
}

/* ========= UI ========= */
function row(d){
  const created = new Date(d.created_at).toLocaleString('de-DE');
  const updated = d.updated_at ? new Date(d.updated_at).toLocaleString('de-DE') : null;
  const whenStr = updated && updated !== created ? `${created} (aktualisiert: ${updated})` : created;
  return `<tr data-id="${d.id}" class="diary-row">
    <td>
      <div class="diary-title">${htmlesc(d.title)}</div>
      <div class="diary-meta">von ${htmlesc(d.author_name||'Unbekannt')} • ${whenStr}</div>
    </td>
    <td>${formatAvDate(d.av_date)}</td>
    <td class="small">${htmlesc(d.tags||'')}</td>
  </tr>`;
}

export async function renderDiary(){
  const app = document.getElementById('app');
  let items = await fetchDiary();

  app.innerHTML = `
    <div class="card">
      ${section('Tagebuch', `
        <div style="display:flex;gap:8px">
          <input class="input" placeholder="Suchen… (Titel/Tags/Autor)" id="diary-q" style="width:280px"/>
          <button class="btn" id="diary-add">+ Eintrag</button>
        </div>
      `)}

      ${items.length ? `
        <div class="card">
          <table class="table">
            <thead><tr><th>Eintrag</th><th>Datum (Aventurisch)</th><th>Tags</th></tr></thead>
            <tbody id="diary-tbody">${items.map(row).join('')}</tbody>
          </table>
        </div>
      ` : empty('Noch keine Tagebuch-Einträge.')}
    </div>
  `;

  const q = document.getElementById('diary-q');
  const tbody = document.getElementById('diary-tbody');
  if (q && tbody){
    q.addEventListener('input', ()=>{
      const v = q.value.toLowerCase();
      const filtered = items.filter(d =>
        (d.title||'').toLowerCase().includes(v) ||
        (d.tags||'').toLowerCase().includes(v) ||
        (d.author_name||'').toLowerCase().includes(v)
      );
      tbody.innerHTML = filtered.map(row).join('');
    });

    tbody.addEventListener('click', async (e)=>{
      const tr = e.target.closest('tr.diary-row');
      if (!tr) return;
      const id = tr.dataset.id;
      const entry = await getDiaryById(id);
      showDiaryEntry(entry);
    });
  }

  document.getElementById('diary-add').onclick = ()=> showAddEditor();
}

/* ========= Anzeigen / Lesen ========= */
function showDiaryEntry(entry){
  const isAuthor = state.user?.id && entry.user_id === state.user.id;
  const created = new Date(entry.created_at).toLocaleString('de-DE');
  const updated = entry.updated_at ? new Date(entry.updated_at).toLocaleString('de-DE') : null;

  const root = modal(`
    <div>
      <h3 style="margin:0 0 6px 0">${htmlesc(entry.title)}</h3>
      <div class="small" style="margin-bottom:10px">von ${htmlesc(entry.author_name||'Unbekannt')} • ${created}${updated?` • aktualisiert: ${updated}`:''} • ${formatAvDate(entry.av_date)}</div>
      <div class="card">
        <div class="rte-view" id="rte-view"></div>
        ${entry.signature ? `<div class="rte-signature">— ${htmlesc(entry.signature)}</div>` : ''}
      </div>
      ${entry.tags ? `<div class="tags" style="margin-top:8px">${entry.tags.split(',').map(t=>`<span class="tag">${htmlesc(t.trim())}</span>`).join('')}</div>`:''}
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
        ${isAuthor ? '<button class="btn warn" id="dlt">Löschen</button><button class="btn" id="edt">Bearbeiten</button>' : ''}
        <button class="btn secondary" id="cls">Schließen</button>
      </div>
    </div>
  `);
  // HTML-Inhalt direkt setzen (Trusted User – interne Nutzung)
  root.querySelector('#rte-view').innerHTML = entry.body_html || '';

  root.querySelector('#cls').onclick = ()=> root.innerHTML='';
  if (isAuthor){
    root.querySelector('#edt').onclick = ()=> { root.innerHTML=''; showEditEditor(entry); };
    root.querySelector('#dlt').onclick = async ()=>{
      if (!confirm('Eintrag wirklich löschen?')) return;
      const { error } = await supabase.from('diary').delete().eq('id', entry.id);
      if (error){ alert(error.message); return; }
      root.innerHTML='';
      location.hash = '#/diary';
    };
  }
}

/* ========= Neuer Eintrag ========= */
function showAddEditor(){
  const root = modal(`
    <h3>Neuer Tagebuch-Eintrag</h3>
    ${formRow('Titel', '<input class="input" id="di-title" />')}
    ${avDateInputs('di-date', state.campaignDate, 'Datum (Aventurisch)')}
    ${formRow('Tags (Komma-getrennt)', '<input class="input" id="di-tags" placeholder="z.B. reise, kampf, artefakt" />')}
    ${formRow('Signatur (optional)', '<input class="input" id="di-sign" placeholder="z.B. Gez. Alrik" />')}

    <div class="rte-toolbar" id="rte-toolbar"></div>
    <div class="rte-editor" id="rte-editor" contenteditable="true"></div>

    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
      <button class="btn secondary" id="di-cancel">Abbrechen</button>
      <button class="btn" id="di-save">Speichern</button>
    </div>
  `);

  // Tag-Autocomplete
  attachTagAutocomplete(root.querySelector('#di-tags'));

  // RTE
  const { toolbar, editor, getHtml } = buildRTEHost(root);

  root.querySelector('#di-cancel').onclick = ()=> root.innerHTML='';
  root.querySelector('#di-save').onclick = async ()=>{
    try{
      const title = root.querySelector('#di-title').value.trim();
      if (!title){ alert('Titel fehlt'); return; }
      const av_date = readDatePickerAv('di-date');
      const signature = root.querySelector('#di-sign').value.trim();
      const tagsArr = parseTags(root.querySelector('#di-tags').value);
      const tags = joinTags(tagsArr);
      const body_html = getHtml().trim();

      const author_name = state.user?.user_metadata?.username || state.user?.email || 'Unbekannt';

      const { error } = await supabase.from('diary').insert({
        title, body_html, av_date, signature,
        tags, user_id: state.user?.id || null, author_name,
        updated_at: new Date().toISOString()
      });
      if (error) throw error;

      await upsertTagsToGlobal(tagsArr);

      root.innerHTML='';
      location.hash = '#/diary';
    }catch(err){ alert(err.message); }
  };
}

/* ========= Eintrag bearbeiten ========= */
function showEditEditor(entry){
  const root = modal(`
    <h3>Tagebuch-Eintrag bearbeiten</h3>
    ${formRow('Titel', `<input class="input" id="di-title" value="${htmlesc(entry.title)}" />`)}
    ${avDateInputs('di-date', entry.av_date, 'Datum (Aventurisch)')}
    ${formRow('Tags (Komma-getrennt)', `<input class="input" id="di-tags" value="${htmlesc(entry.tags||'')}" />`)}
    ${formRow('Signatur (optional)', `<input class="input" id="di-sign" value="${htmlesc(entry.signature||'')}" />`)}

    <div class="rte-toolbar" id="rte-toolbar"></div>
    <div class="rte-editor" id="rte-editor" contenteditable="true"></div>

    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
      <button class="btn secondary" id="di-cancel">Abbrechen</button>
      <button class="btn" id="di-save">Speichern</button>
    </div>
  `);

  attachTagAutocomplete(root.querySelector('#di-tags'));

  const { toolbar, editor, getHtml, setHtml } = buildRTEHost(root);
  setHtml(entry.body_html || '');

  root.querySelector('#di-cancel').onclick = ()=> root.innerHTML='';
  root.querySelector('#di-save').onclick = async ()=>{
    try{
      const title = root.querySelector('#di-title').value.trim();
      if (!title){ alert('Titel fehlt'); return; }
      const av_date = readDatePickerAv('di-date');
      const signature = root.querySelector('#di-sign').value.trim();
      const tagsArr = parseTags(root.querySelector('#di-tags').value);
      const tags = joinTags(tagsArr);
      const body_html = getHtml().trim();

      const { error } = await supabase.from('diary').update({
        title, body_html, av_date, signature, tags,
        updated_at: new Date().toISOString()
      }).eq('id', entry.id);
      if (error) throw error;

      await upsertTagsToGlobal(tagsArr);

      root.innerHTML='';
      location.hash = '#/diary';
    }catch(err){ alert(err.message); }
  };
}

/* ========= Hilfsfunktion: RTE in Modal einbauen ========= */
function buildRTEHost(root){
  const toolbarHost = root.querySelector('#rte-toolbar');
  const editorHost = root.querySelector('#rte-editor');
  const { toolbar, editor, getHtml, setHtml } = buildRte(editorHost.innerHTML || '');
  toolbarHost.replaceWith(toolbar);
  editorHost.replaceWith(editor);
  return { toolbar, editor, getHtml, setHtml };
}
