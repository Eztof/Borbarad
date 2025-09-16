// js/nscs.js
import { supabase } from './supabaseClient.js';
import { state } from './state.js';
import { modal, empty, section } from './components.js';
import { htmlesc } from './utils.js';

/* ============ API ============ */
async function listNSCs() {
    const { data, error } = await supabase.from('nscs').select('*').order('name', { ascending: true });
    if (error) {
        console.error(error);
        return [];
    }
    return data;
}

async function getNSCNotes(nscId, userId) {
    const { data, error } = await supabase
        .from('nsc_notes')
        .select('id, title, content, is_private, created_at, updated_at')
        .eq('nsc_id', nscId)
        .or(`user_id.eq.${userId},is_private.eq.false`);
    if (error) {
        console.error("Fehler beim Abrufen der Notizen:", error);
        return [];
    }
    return data || [];
}

async function createNSCNote(nscId, userId, title, content, isPrivate) {
    const { data, error } = await supabase
        .from('nsc_notes')
        .insert([{ nsc_id: nscId, user_id: userId, title: title, content: content, is_private: isPrivate }])
        .select('id');
    if (error) {
        throw error;
    }
    return data[0];
}

async function updateNSCNote(noteId, title, content, isPrivate) {
    const { error } = await supabase
        .from('nsc_notes')
        .update({ title: title, content: content, is_private: isPrivate })
        .eq('id', noteId);
    if (error) {
        throw error;
    }
}

async function deleteNSCNote(noteId) {
    const { error } = await supabase
        .from('nsc_notes')
        .delete()
        .eq('id', noteId);
    if (error) {
        throw error;
    }
}

async function saveProfileSettings(sortField, sortDir, visibleColumns) {
    if (!state.user?.id) return;
    const { error } = await supabase
        .from('profiles')
        .update({
            nsc_table_sort_field: sortField,
            nsc_table_sort_dir: sortDir,
            nsc_table_visible_columns: visibleColumns
        })
        .eq('user_id', state.user.id);
    if (error) {
        console.error("Fehler beim Speichern der Einstellungen:", error);
    }
}

async function loadProfileSettings() {
    if (!state.user?.id) return null;
    const { data, error } = await supabase
        .from('profiles')
        .select('nsc_table_sort_field, nsc_table_sort_dir, nsc_table_visible_columns')
        .eq('user_id', state.user.id)
        .single();
    if (error) {
        console.error("Fehler beim Laden der Einstellungen:", error);
        return null;
    }
    return data;
}

/* ============ UI ============ */
function row(n) {
    const notesCount = n.notes_count || 0;
    const lastEncounter = n.last_encounter ? formatAvDate(n.last_encounter) : '–';
    const firstEncounter = n.first_encounter ? formatAvDate(n.first_encounter) : '–';

    // Sicherheitscheck: Stelle sicher, dass visibleColumns ein Array ist
    const visibleColumns = state.nscTableSettings?.visibleColumns || [];
    
    // Bestimme, welche Spalten angezeigt werden sollen
    const showName = visibleColumns.includes('name');
    const showFirstEncounter = visibleColumns.includes('first_encounter');
    const showLastEncounter = visibleColumns.includes('last_encounter');
    const showNotes = visibleColumns.includes('notes_count');

    let html = `<tr data-id="${n.id}" class="nsc-row">`;
    if (showName) {
        html += `<td style="display:flex;align-items:center;gap:10px">${avatar(n.image_url, n.name, 36)} <strong>${htmlesc(n.name)}</strong></td>`;
    }
    if (showFirstEncounter) {
        html += `<td class="small">${firstEncounter}</td>`;
    }
    if (showLastEncounter) {
        html += `<td class="small">${lastEncounter}</td>`;
    }
    if (showNotes) {
        html += `<td class="small">${notesCount}</td>`;
    }
    html += '</tr>';
    return html;
}

function mobileCard(n) {
    return `
        <div class="mobile-card" data-id="${n.id}" style="cursor: pointer;">
            <div class="mobile-card-header">
                <div style="display:flex;align-items:center;gap:10px">
                    ${avatar(n.image_url, n.name, 40)}
                    <strong>${htmlesc(n.name)}</strong>
                </div>
            </div>
            <div class="mobile-card-body">
                <div class="mobile-card-item">
                    <span class="mobile-card-label">Erste Begegnung:</span>
                    <span class="mobile-card-value">${n.first_encounter ? formatAvDate(n.first_encounter) : '–'}</span>
                </div>
                <div class="mobile-card-item">
                    <span class="mobile-card-label">Letzte Begegnung:</span>
                    <span class="mobile-card-value">${n.is_active ? formatAvDate(state.campaignDate) : (n.last_encounter ? formatAvDate(n.last_encounter) : '–')}</span>
                </div>
                <div class="mobile-card-item">
                    <span class="mobile-card-label">Verbleib:</span>
                    <span class="mobile-card-value">${htmlesc(n.whereabouts || '–')}</span>
                </div>
            </div>
        </div>
    `;
}

function renderSettingsModal(settings) {
    const columns = ['name', 'first_encounter', 'last_encounter', 'notes_count'];
    const columnLabels = {
        name: 'Name',
        first_encounter: 'Erste Begegnung',
        last_encounter: 'Letzte Begegnung',
        notes_count: 'Anzahl Notizen'
    };

    const columnCheckboxes = columns.map(col => `
        <div class="row">
            <input type="checkbox" id="col-${col}" ${settings.visibleColumns.includes(col) ? 'checked' : ''} />
            <label for="col-${col}">${columnLabels[col]}</label>
        </div>
    `).join('');

    const root = modal(`
        <h3>NSC-Tabelle Einstellungen</h3>
        <div class="row">
            <div class="label">Sortierfeld</div>
            <select class="input" id="sort-field">
                <option value="name" ${settings.sortField === 'name' ? 'selected' : ''}>Name</option>
                <option value="first_encounter" ${settings.sortField === 'first_encounter' ? 'selected' : ''}>Erste Begegnung</option>
                <option value="last_encounter" ${settings.sortField === 'last_encounter' ? 'selected' : ''}>Letzte Begegnung</option>
            </select>
        </div>
        <div class="row">
            <div class="label">Sortierreihenfolge</div>
            <select class="input" id="sort-dir">
                <option value="1" ${settings.sortDir === 1 ? 'selected' : ''}>Aufsteigend</option>
                <option value="-1" ${settings.sortDir === -1 ? 'selected' : ''}>Absteigend</option>
            </select>
        </div>
        <div class="row">
            <div class="label">Anzuzeigende Spalten</div>
            ${columnCheckboxes}
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
            <button class="btn secondary" id="cancel-settings">Abbrechen</button>
            <button class="btn" id="save-settings">Speichern</button>
        </div>
    `);

    root.querySelector('#cancel-settings').onclick = () => root.innerHTML = '';
    root.querySelector('#save-settings').onclick = async () => {
        const sortField = document.getElementById('sort-field').value;
        const sortDir = parseInt(document.getElementById('sort-dir').value);
        const visibleColumns = Array.from(document.querySelectorAll('#col-name, #col-first_encounter, #col-last_encounter, #col-notes_count'))
            .filter(cb => cb.checked)
            .map(cb => cb.id.split('-')[1]);

        await saveProfileSettings(sortField, sortDir, visibleColumns);
        // Update the settings in the global state
        state.nscTableSettings = { sortField, sortDir, visibleColumns };
        await renderNSCs(); // Refresh the table
        root.innerHTML = '';
    };
}

/* ============ Verlauf aufnehmen (best effort) ============ */
async function recordHistoryNSC(nsc_id, action, snapshot) {
    try {
        await supabase.from('nscs_history').insert({ nsc_id, action, data: snapshot });
    } catch (e) {
        console.warn('nscs_history skip:', e.message);
    }
}

/* ============ Seite rendern ============ */
export async function renderNSCs() {
    const app = document.getElementById('app');
    let items = await listNSCs();

    // Lade die Benutzereinstellungen
    const profileSettings = await loadProfileSettings();
    
    // Sicherstellen, dass die Einstellungen immer definiert sind
    state.nscTableSettings = {
        sortField: profileSettings?.sortField || 'name',
        sortDir: profileSettings?.sortDir || 1,
        visibleColumns: profileSettings?.visibleColumns || ['name', 'last_encounter', 'notes_count']
    };

    // Sortiere die Liste nach den Einstellungen
    items = items.sort((a, b) => {
        const field = state.nscTableSettings.sortField;
        const dir = state.nscTableSettings.sortDir;

        if (field === 'name') {
            return dir * a.name.localeCompare(b.name);
        } else if (field === 'first_encounter') {
            const avA = new Date(a.first_encounter);
            const avB = new Date(b.first_encounter);
            return dir * (avA - avB);
        } else if (field === 'last_encounter') {
            const avA = new Date(a.last_encounter);
            const avB = new Date(b.last_encounter);
            return dir * (avA - avB);
        }
        return 0;
    });

    // Zähle die Notizen pro NSC
    const noteCounts = {};
    const allNotes = await Promise.all(items.map(async (n) => {
        const notes = await getNSCNotes(n.id, state.user.id);
        noteCounts[n.id] = notes.length;
        return notes;
    }));

    // Füge die Anzahl der Notizen zu jedem NSC hinzu
    items = items.map(n => ({
        ...n,
        notes_count: noteCounts[n.id]
    }));

    app.innerHTML = `
        <div class="card">
            ${section('NSCs', `<div style="display:flex;gap:8px"><input class="input" placeholder="Suche… (Name/Tags)" id="nsc-q" style="width:260px"/><button class="btn" id="add-nsc">+ NSC</button><button class="btn secondary" id="settings-btn">⚙️</button></div>`)}
            <div id="desktop-view" class="card">
                <table class="table">
                    <thead>
                        <tr>
                            ${state.nscTableSettings.visibleColumns.includes('name') ? '<th data-sf="name">Name</th>' : ''}
                            ${state.nscTableSettings.visibleColumns.includes('first_encounter') ? '<th data-sf="first_encounter">Erste Begegnung</th>' : ''}
                            ${state.nscTableSettings.visibleColumns.includes('last_encounter') ? '<th data-sf="last_encounter">Letzte Begegnung</th>' : ''}
                            ${state.nscTableSettings.visibleColumns.includes('notes_count') ? '<th data-sf="notes_count">Notizen</th>' : ''}
                        </tr>
                    </thead>
                    <tbody id="nsc-tbody">
                        ${items.map(row).join('')}
                    </tbody>
                </table>
            </div>
            <div id="mobile-view" class="mobile-cards-container">
                ${items.map(mobileCard).join('')}
            </div>
            ${!items.length ? empty('Noch keine NSCs angelegt.') : ''}
        </div>
    `;

    // Mobile/Desktop View Toggle
    const desktopView = document.getElementById('desktop-view');
    const mobileView = document.getElementById('mobile-view');
    const tbody = document.getElementById('nsc-tbody');

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

    // Suche
    const q = document.getElementById('nsc-q');
    q.addEventListener('input', () => {
        const v = q.value.toLowerCase();
        const filtered = items.filter(n => `${n.name} ${(n.tags || '')}`.toLowerCase().includes(v));
        tbody.innerHTML = filtered.map(row).join('');
        mobileView.innerHTML = filtered.map(mobileCard).join('');
    });

    // Sortier-Header (nur Desktop)
    document.querySelectorAll('th[data-sf]').forEach(th => {
        th.style.cursor = 'pointer';
        th.onclick = () => {
            const f = th.dataset.sf;
            if (f === state.nscTableSettings.sortField) {
                state.nscTableSettings.sortDir *= -1;
            } else {
                state.nscTableSettings.sortField = f;
                state.nscTableSettings.sortDir = 1;
            }
            items = items.sort((a, b) => {
                const dir = state.nscTableSettings.sortDir;
                if (f === 'name') {
                    return dir * a.name.localeCompare(b.name);
                } else if (f === 'first_encounter') {
                    const avA = new Date(a.first_encounter);
                    const avB = new Date(b.first_encounter);
                    return dir * (avA - avB);
                } else if (f === 'last_encounter') {
                    const avA = new Date(a.last_encounter);
                    const avB = new Date(b.last_encounter);
                    return dir * (avA - avB);
                }
                return 0;
            });
            tbody.innerHTML = items.map(row).join('');
        };
    });

    // Detail / Edit öffnen (Desktop)
    tbody.addEventListener('click', (e) => {
        const tr = e.target.closest('tr.nsc-row');
        if (!tr) return;
        const id = tr.dataset.id;
        const n = items.find(x => x.id === id);
        if (n) showNSC(n);
    });

    // Detail / Edit öffnen (Mobile)
    mobileView.addEventListener('click', async (e) => {
        const card = e.target.closest('.mobile-card');
        if (!card) return;
        if (e.target.classList.contains('mobile-card-btn')) {
            const id = card.dataset.id;
            const n = items.find(x => x.id === id);
            if (n) showNSC(n);
        }
    });

    // + NSC
    const addBtn = document.getElementById('add-nsc');
    if (addBtn) addBtn.onclick = () => showAddNSC();

    // Einstellungen Button
    document.getElementById('settings-btn').onclick = () => renderSettingsModal(state.nscTableSettings);

    // Deep-Link: #/nscs?edit=<id>
    const hash = location.hash || '';
    const qm = hash.indexOf('?') >= 0 ? new URLSearchParams(hash.split('?')[1]) : null;
    const editId = qm?.get('edit');
    if (editId) {
        const n = items.find(x => x.id === editId);
        if (n) showEditNSC(n);
        const base = hash.split('?')[0];
        history.replaceState(null, '', base);
    }
}

/* ============ Detail-Modal ============ */
async function showNSC(n) {
    const notes = await getNSCNotes(n.id, state.user.id);
    const root = modal(`
        <div class="grid">
            <div>
                <div style="display:flex;gap:12px;align-items:center">
                    ${avatar(n.image_url, n.name, 56)}
                    <div>
                        <h3 style="margin:0">${htmlesc(n.name)}</h3>
                        <div class="small">${htmlesc(n.tags || '')}</div>
                    </div>
                </div>
                <p style="margin-top:12px;white-space:pre-wrap">${htmlesc(n.biography || '')}</p>
            </div>
            <div>
                <div class="card">
                    <div class="label">Erste Begegnung</div>
                    <div>${n.first_encounter ? formatAvDate(n.first_encounter) : '–'}</div>
                </div>
                <div class="card">
                    <div class="label">Letzte Begegnung</div>
                    <div>${n.is_active ? formatAvDate(state.campaignDate) : (n.last_encounter ? formatAvDate(n.last_encounter) : '–')}</div>
                </div>
                <div class="card">
                    <div class="label">Verbleib</div>
                    <div>${htmlesc(n.whereabouts || '–')}</div>
                </div>
                <div class="card">
                    <div class="label">Notizen (${notes.length})</div>
                    <div id="notes-list" style="max-height:200px;overflow:auto;"></div>
                </div>
                <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
                    <button class="btn secondary" id="nsc-history">Verlauf</button>
                    <button class="btn" id="nsc-edit">Bearbeiten</button>
                    <button class="btn secondary" id="nsc-close">Schließen</button>
                </div>
            </div>
        </div>
    `);

    // Zeige die Notizen
    const notesList = root.querySelector('#notes-list');
    notes.forEach(note => {
        const noteEl = document.createElement('div');
        noteEl.className = 'card';
        noteEl.style.marginBottom = '8px';
        noteEl.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <strong>${htmlesc(note.title)}</strong>
                <div style="font-size:12px;color:var(--muted);">${note.is_private ? 'Privat' : 'Öffentlich'} · ${new Date(note.created_at).toLocaleString('de-DE')}</div>
            </div>
            <div style="white-space:pre-wrap;margin-top:4px;">${htmlesc(note.content || '')}</div>
        `;
        notesList.appendChild(noteEl);
    });

    // Event Listener
    root.querySelector('#nsc-close').onclick = () => root.innerHTML = '';
    root.querySelector('#nsc-edit').onclick = () => {
        root.innerHTML = '';
        showEditNSC(n);
    };
    root.querySelector('#nsc-history').onclick = () => showHistoryNSC(n.id);
}

/* ============ Neu anlegen (jetzt mit "Aktiv") ============ */
function showAddNSC() {
    const root = modal(`
        <h3>Neuen NSC anlegen</h3>
        ${formRow('Name', '<input class="input" id="n-name" />')}
        ${formRow('Tags (Komma-getrennt)', '<input class="input" id="n-tags" placeholder="z.B. borbaradianer, hof, magier" />')}
        ${formRow('Bild', '<input class="input" id="n-image" type="file" accept="image/*" />')}
        ${formRow('Biographie', '<textarea class="input" id="n-bio" rows="5"></textarea>')}
        <div class="row">
            ${avDateInputs('n-first', state.campaignDate)}
            <div id="n-last-wrap">${avDateInputs('n-last', state.campaignDate)}</div>
        </div>
        <div class="row">
            ${formRow('Verbleib', '<input class="input" id="n-where" />')}
            ${formRow('Aktiv', '<input type="checkbox" id="n-active" checked />')}
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
            <button class="btn secondary" id="cancel-add">Abbrechen</button>
            <button class="btn" id="save-add">Anlegen</button>
        </div>
    `);

    root.querySelector('#cancel-add').onclick = () => root.innerHTML = '';
    root.querySelector('#save-add').onclick = async () => {
        const payload = {
            name: document.getElementById('n-name').value.trim(),
            tags: document.getElementById('n-tags').value.trim(),
            image_url: document.getElementById('n-image').files[0] ? URL.createObjectURL(document.getElementById('n-image').files[0]) : null,
            biography: document.getElementById('n-bio').value.trim(),
            first_encounter: readDatePickerAv('n-first'),
            last_encounter: readDatePickerAv('n-last'),
            whereabouts: document.getElementById('n-where').value.trim(),
            is_active: document.getElementById('n-active').checked
        };

        if (!payload.name) {
            alert('Bitte einen Namen eingeben.');
            return;
        }

        const { data: dup } = await supabase.from('nscs').select('id').eq('name', payload.name).maybeSingle();
        if (dup) {
            alert('Diesen NSC-Namen gibt es schon.');
            return;
        }

        try {
            const { data, error } = await supabase.from('nscs').insert([payload]);
            if (error) throw error;
            await upsertNewTags(parseTags(payload.tags));
            await recordHistoryNSC(null, 'create', payload);
            root.innerHTML = '';
            location.hash = '#/nscs';
        } catch (err) {
            alert(err.message);
        }
    };
}

/* ============ Bearbeiten ============ */
function showEditNSC(n) {
    const root = modal(`
        <h3>NSC bearbeiten</h3>
        ${formRow('Name', `<input class="input" id="e-name" value="${htmlesc(n.name)}" />`)}
        ${formRow('Tags (Komma-getrennt)', `<input class="input" id="e-tags" value="${htmlesc(n.tags || '')}" />`)}
        ${formRow('Bild (neu hochladen, optional)', '<input class="input" id="e-image" type="file" accept="image/*" />')}
        ${formRow('Biographie', `<textarea class="input" id="e-bio" rows="5">${htmlesc(n.biography || '')}</textarea>`)}
        <div class="row">
            ${avDateInputs('e-first', n.first_encounter)}
            <div id="e-last-wrap">${avDateInputs('e-last', n.last_encounter)}</div>
        </div>
        <div class="row">
            ${formRow('Verbleib', `<input class="input" id="e-where" value="${htmlesc(n.whereabouts || '')}" />`)}
            ${formRow('Aktiv', `<input type="checkbox" id="e-active" ${n.is_active ? 'checked' : ''} />`)}
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
            <button class="btn secondary" id="cancel-edit">Abbrechen</button>
            <button class="btn" id="save-edit">Speichern</button>
        </div>
    `);

    root.querySelector('#cancel-edit').onclick = () => root.innerHTML = '';
    root.querySelector('#save-edit').onclick = async () => {
        const updated = {
            name: document.getElementById('e-name').value.trim(),
            tags: document.getElementById('e-tags').value.trim(),
            image_url: document.getElementById('e-image').files[0] ? URL.createObjectURL(document.getElementById('e-image').files[0]) : n.image_url,
            biography: document.getElementById('e-bio').value.trim(),
            first_encounter: readDatePickerAv('e-first'),
            last_encounter: readDatePickerAv('e-last'),
            whereabouts: document.getElementById('e-where').value.trim(),
            is_active: document.getElementById('e-active').checked
        };

        updated.last_encounter = updated.is_active ? state.campaignDate : readDatePickerAv('e-last');

        try {
            const { error } = await supabase.from('nscs').update(updated).eq('id', n.id);
            if (error) throw error;
            await upsertNewTags(parseTags(updated.tags));
            await recordHistoryNSC(n.id, 'update', updated);
            root.innerHTML = '';
            location.hash = '#/nscs';
        } catch (err) {
            alert(err.message);
        }
    };
}

/* ============ Verlauf anzeigen – kompakt ============ */
function renderNscHistorySnapshot(d) {
    if (!d || typeof d !== 'object') return '';
    const keys = Object.keys(d);
    if (keys.length === 1 && 'image_url' in d) {
        const url = d.image_url || '';
        const thumb = url ? `<div style="margin-top:6px"><img src="${url}" alt="Bild" style="max-width:180px;max-height:120px;border-radius:8px;border:1px solid #4b2a33;object-fit:cover"/></div>` : '';
        return `<div><strong>Bild aktualisiert</strong>${thumb}</div>`;
    }
    if ('biography' in d) {
        return `<div class="small" style="white-space:pre-wrap;margin-top:6px">${htmlesc(d.biography || '')}</div>`;
    }
    return '';
}

async function showHistoryNSC(nsc_id) {
    try {
        const { data, error } = await supabase.from('nscs_history').select('*').eq('nsc_id', nsc_id).order('created_at', { ascending: false });
        if (error) throw error;
        const items = (data || []).map(rec => {
            const when = new Date(rec.created_at).toLocaleString('de-DE');
            const who = rec.changed_by_name || 'Unbekannt';
            const snap = renderNscHistorySnapshot(rec.data || {});
            return `<div class="card"><div class="small" style="margin-bottom:6px">${when} – ${htmlesc(who)} (${htmlesc(rec.action || 'update')})</div>${snap || '<div class="small">—</div>'}</div>`;
        }).join('') || '<div class="empty">Noch kein Verlauf.</div>';
        const root = modal(`
            <h3 style="margin:0 0 8px 0">Verlauf (NSC)</h3>
            <div style="display:grid;gap:10px;max-height:60vh;overflow:auto">${items}</div>
            <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
                <button class="btn secondary" id="vh-close">Schließen</button>
            </div>
        `);
        root.querySelector('#vh-close').onclick = () => root.innerHTML = '';
    } catch (err) {
        alert(err.message);
    }
}

/* ============ Tags-Table updaten ============ */
async function upsertNewTags(tagsArr) {
    if (!tagsArr?.length) return;
    await loadAllTags();
    const existing = new Set(TAG_CACHE.map(t => t.toLowerCase()));
    const newTags = tagsArr.filter(tag => !existing.has(tag.toLowerCase()));
    if (newTags.length > 0) {
        await supabase.from('tags').insert(newTags.map(t => ({ tag: t })));
        TAG_CACHE.push(...newTags);
    }
}