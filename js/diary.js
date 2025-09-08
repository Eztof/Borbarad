// js/diary.js
import { supabase } from './supabaseClient.js';
import { state } from './state.js';
import { section, modal, formRow, empty } from './components.js';
import { formatAvDate, avDateInputs, readDatePickerAv, htmlesc } from './utils.js';

/* =========================
   Mini-Rich-Text-Editor
   ========================= */
function buildRte(container, initialHtml = '') {
  const toolbar = document.createElement('div');
  toolbar.className = 'rte-toolbar';
  toolbar.innerHTML = `
    <button class="btn secondary" data-cmd="bold"><b>B</b></button>
    <button class="btn secondary" data-cmd="italic"><i>I</i></button>
    <button class="btn secondary" data-cmd="underline"><u>U</u></button>
    <button class="btn secondary" data-cmd="formatBlock" data-val="h2">H2</button>
    <button class="btn secondary" data-cmd="insertUnorderedList">• Liste</button>
    <button class="btn secondary" data-cmd="insertOrderedList">1. Liste</button>
    <button class="btn secondary" data-cmd="formatBlock" data-val="blockquote">Zitat</button>
    <button class="btn secondary" data-link>Link</button>
    <button class="btn secondary" data-undo>↶</button>
    <button class="btn secondary" data-redo>↷</button>
    <button class="btn warn" data-clear>Leeren</button>
  `;

  const editor = document.createElement('div');
  editor.className = 'rte-editor';
  editor.contentEditable = 'true';
  editor.innerHTML = initialHtml || '';

  container.appendChild(toolbar);
  container.appendChild(editor);

  function exec(cmd, val) {
    document.execCommand(cmd, false, val || null);
    editor.focus();
  }

  toolbar.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.cmd) {
      const cmd = b.dataset.cmd;
      const val = b.dataset.val || null;
      exec(cmd, val);
    } else if (b.hasAttribute('data-link')) {
      const url = prompt('URL eingeben:');
      if (url) exec('createLink', url);
    } else if (b.hasAttribute('data-undo')) {
      exec('undo');
    } else if (b.hasAttribute('data-redo')) {
      exec('redo');
    } else if (b.hasAttribute('data-clear')) {
      editor.innerHTML = '';
    }
  });

  return {
    root: container,
    getHtml: () => editor.innerHTML.trim(),
    setHtml: (html) => { editor.innerHTML = html || ''; }
  };
}

/* =========================
   Daten-Laden
   ========================= */
async function fetchDiary() {
  // Übersicht: ohne Autor/Zeit in der Anzeige – trotzdem laden wir sie,
  // damit Edit/Delete-Berechtigungen funktionieren.
  const { data, error } = await supabase
    .from('diary')
    .select('id, title, av_date, tags, author_name, user_id, created_at, updated_at, signature')
    .order('created_at', { ascending: false });
  if (error) {
    console.error(error);
    return [];
  }
  return data || [];
}

async function fetchEntry(id) {
  const { data, error } = await supabase
    .from('diary')
    .select('id, title, av_date, tags, content_html, signature, author_name, user_id, created_at, updated_at')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/* =========================
   UI-Helfer
   ========================= */
function row(entry) {
  return `
    <tr data-id="${entry.id}">
      <td><strong>${htmlesc(entry.title || '')}</strong></td>
      <td>${entry.av_date ? formatAvDate(entry.av_date) : '—'}</td>
      <td class="small">${htmlesc(entry.tags || '')}</td>
      <td style="text-align:right;white-space:nowrap">
        <button class="btn secondary" data-view="${entry.id}">Lesen</button>
        <button class="btn" data-edit="${entry.id}" style="margin-left:6px">Bearbeiten</button>
        ${canDelete(entry) ? `<button class="btn warn" data-del="${entry.id}" style="margin-left:6px">Löschen</button>` : ''}
      </td>
    </tr>
  `;
}

function canDelete(entry) {
  const uid = state.user?.id;
  return uid && entry?.user_id && uid === entry.user_id;
}

/* =========================
   Render-Hauptfunktion
   ========================= */
export async function renderDiary() {
  const app = document.getElementById('app');
  const entries = await fetchDiary();

  app.innerHTML = `
    <div class="card">
      ${section('Tagebuch', `<button class="btn" id="btn-new">Neuer Eintrag</button>`)}
      <div class="card">
        ${entries.length ? `
          <table class="table">
            <thead>
              <tr>
                <th>Titel</th>
                <th>Datum</th>
                <th>Tags</th>
                <th style="width:260px;text-align:right">Aktionen</th>
              </tr>
            </thead>
            <tbody id="diary-tbody">
              ${entries.map(row).join('')}
            </tbody>
          </table>
        ` : empty('Noch keine Tagebucheinträge.')}
      </div>
    </div>
  `;

  document.getElementById('btn-new').onclick = () => showCreateModal();

  const tbody = document.getElementById('diary-tbody');
  if (tbody) {
    tbody.addEventListener('click', async (e) => {
      const viewBtn = e.target.closest('[data-view]');
      const editBtn = e.target.closest('[data-edit]');
      const delBtn  = e.target.closest('[data-del]');
      if (viewBtn) {
        const id = viewBtn.getAttribute('data-view');
        const entry = await fetchEntry(id);
        showViewModal(entry);
      } else if (editBtn) {
        const id = editBtn.getAttribute('data-edit');
        const entry = await fetchEntry(id);
        showEditModal(entry);
      } else if (delBtn) {
        const id = delBtn.getAttribute('data-del');
        const entry = entries.find(x => x.id === id);
        if (!canDelete(entry)) { alert('Nur der Verfasser kann löschen.'); return; }
        if (!confirm('Eintrag wirklich löschen?')) return;
        const { error } = await supabase.from('diary').delete().eq('id', id);
        if (error) { alert(error.message); return; }
        renderDiary();
      }
    });
  }
}

/* =========================
   Modals: Anzeigen / Erstellen / Bearbeiten
   ========================= */
function showViewModal(entry) {
  const when = entry.av_date ? formatAvDate(entry.av_date) : '—';
  const root = modal(`
    <div class="rte-view">
      <h3 style="margin:0 0 6px 0">${htmlesc(entry.title || '')}</h3>
      <div class="small" style="margin-bottom:8px">${when}${entry.tags ? ' • ' + htmlesc(entry.tags) : ''}</div>
      <div class="card" style="margin-bottom:8px">
        <div>${entry.content_html || '<em class="small">— kein Inhalt —</em>'}</div>
      </div>
      ${entry.signature ? `<div class="rte-signature">— ${htmlesc(entry.signature)} —</div>` : ''}
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
      <button class="btn" id="dv-edit">Bearbeiten</button>
      <button class="btn secondary" id="dv-close">Schließen</button>
    </div>
  `);
  root.querySelector('#dv-close').onclick = () => root.innerHTML = '';
  root.querySelector('#dv-edit').onclick = () => { root.innerHTML = ''; showEditModal(entry); };
}

function showCreateModal() {
  const d = state.campaignDate || { day:1, month:1, year:1027 };
  const root = modal(`
    <h3>Neuer Tagebuch-Eintrag</h3>
    ${formRow('Titel', `<input class="input" id="di-title" />`)}
    ${avDateInputs('di-date', d)}
    ${formRow('Tags (optional, komma-getrennt)', `<input class="input" id="di-tags" placeholder="z.B. borbaradianer, reise, kampf" />`)}
    ${formRow('Signatur (optional)', `<input class="input" id="di-sign" placeholder="z.B. Euer treuer Magus X." />`)}
    <div class="label" style="margin-top:8px">Inhalt</div>
    <div id="rte-new"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
      <button class="btn secondary" id="di-cancel">Abbrechen</button>
      <button class="btn" id="di-save">Speichern</button>
    </div>
  `);

  const rte = buildRte(root.querySelector('#rte-new'), '');

  root.querySelector('#di-cancel').onclick = () => root.innerHTML = '';
  root.querySelector('#di-save').onclick = async () => {
    const title = document.getElementById('di-title').value.trim();
    if (!title) { alert('Bitte Titel angeben.'); return; }
    const payload = {
      title,
      av_date: readDatePickerAv('di-date'),
      tags: (document.getElementById('di-tags').value || '').trim(),
      signature: (document.getElementById('di-sign').value || '').trim(),
      content_html: rte.getHtml(),
      author_name: state.user?.user_metadata?.username || state.user?.email || 'Unbekannt'
    };
    const { error } = await supabase.from('diary').insert(payload);
    if (error) { console.error('Diary insert failed:', { error, payload }); alert(error.message); return; }
    root.innerHTML = '';
    renderDiary();
  };
}

function showEditModal(entry) {
  const root = modal(`
    <h3>Tagebuch-Eintrag bearbeiten</h3>
    ${formRow('Titel', `<input class="input" id="de-title" value="${htmlesc(entry.title || '')}" />`)}
    ${avDateInputs('de-date', entry.av_date)}
    ${formRow('Tags (optional, komma-getrennt)', `<input class="input" id="de-tags" value="${htmlesc(entry.tags || '')}" />`)}
    ${formRow('Signatur (optional)', `<input class="input" id="de-sign" value="${htmlesc(entry.signature || '')}" />`)}
    <div class="label" style="margin-top:8px">Inhalt</div>
    <div id="rte-edit"></div>
    <div style="display:flex;gap:8px;justify-content:space-between;margin-top:12px">
      <div>
        ${canDelete(entry) ? `<button class="btn warn" id="de-del">Löschen</button>` : ''}
      </div>
      <div>
        <button class="btn secondary" id="de-cancel">Abbrechen</button>
        <button class="btn" id="de-save">Speichern</button>
      </div>
    </div>
  `);

  const rte = buildRte(root.querySelector('#rte-edit'), entry.content_html || '');

  root.querySelector('#de-cancel').onclick = () => root.innerHTML = '';
  if (canDelete(entry)) {
    root.querySelector('#de-del').onclick = async () => {
      if (!confirm('Eintrag wirklich löschen?')) return;
      const { error } = await supabase.from('diary').delete().eq('id', entry.id);
      if (error) { alert(error.message); return; }
      root.innerHTML = '';
      renderDiary();
    };
  }
  root.querySelector('#de-save').onclick = async () => {
    const title = document.getElementById('de-title').value.trim();
    if (!title) { alert('Bitte Titel angeben.'); return; }
    const payload = {
      title,
      av_date: readDatePickerAv('de-date'),
      tags: (document.getElementById('de-tags').value || '').trim(),
      signature: (document.getElementById('de-sign').value || '').trim(),
      content_html: rte.getHtml()
    };
    const { error } = await supabase.from('diary').update(payload).eq('id', entry.id);
    if (error) { alert(error.message); return; }
    root.innerHTML = '';
    renderDiary();
  };
}
