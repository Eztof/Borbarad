// js/familytree.js
import { supabase } from './supabaseClient.js';
import { state } from './state.js';
import { section, modal, empty } from './components.js';
import { htmlesc } from './utils.js';

/* ============ API ============ */
// Abrufen des aktiven Helden
async function getActiveHero() {
    if (!state.user?.id) {
        console.warn("Kein Benutzer eingeloggt.");
        return null;
    }
    const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('active_hero_id')
        .eq('user_id', state.user.id)
        .single();
    if (profileError || !profileData?.active_hero_id) {
        return null;
    }
    const activeHeroId = profileData.active_hero_id;
    const { data: heroData, error: heroError } = await supabase
        .from('heroes')
        .select('id, name')
        .eq('id', activeHeroId)
        .single();
    if (heroError) {
        console.error("Fehler beim Abrufen des aktiven Helden:", heroError);
        return null;
    }
    return heroData;
}

// Abrufen aller Stammbaum-Daten für einen Helden
async function fetchFamilyTree(heroId) {
    const { data, error } = await supabase
        .from('family_tree')
        .select('id, hero_id, nsc_id, relation_type, notes, nscs: nsc_id (id, name)')
        .eq('hero_id', heroId);
    if (error) {
        console.error("Fehler beim Abrufen des Stammbaums:", error);
        return [];
    }
    return data || [];
}

// Abrufen aller NSCs (für die Auswahl)
async function listNSCs() {
    const { data, error } = await supabase
        .from('nscs')
        .select('id, name')
        .order('name', { ascending: true });
    if (error) {
        console.error(error);
        return [];
    }
    return data;
}

// Hinzufügen einer neuen Beziehung
async function addFamilyRelation(heroId, nscId, relationType, notes) {
    const { data, error } = await supabase
        .from('family_tree')
        .insert([{ hero_id: heroId, nsc_id: nscId, relation_type: relationType, notes: notes }])
        .select();
    if (error) {
        throw error;
    }
    return data[0];
}

// Löschen einer Beziehung
async function deleteFamilyRelation(relationId) {
    const { error } = await supabase
        .from('family_tree')
        .delete()
        .eq('id', relationId);
    if (error) {
        throw error;
    }
}

// Bearbeiten einer Beziehung
async function updateFamilyRelation(relationId, relationType, notes) {
    const { error } = await supabase
        .from('family_tree')
        .update({ relation_type: relationType, notes: notes })
        .eq('id', relationId);
    if (error) {
        throw error;
    }
}

/* ============ UI ============ */
// Hauptfunktion zum Rendern der Stammbaum-Seite
export async function renderFamilyTree() {
    const app = document.getElementById('app');
    app.innerHTML = '<div class="card"><h2>Stammbaum</h2><p>Lade aktiven Helden...</p></div>';

    if (!state.user?.id) {
        app.innerHTML = '<div class="card"><h2>Stammbaum</h2><p>Zugriff erforderlich. Bitte melde dich an.</p></div>';
        return;
    }

    try {
        const activeHero = await getActiveHero();
        if (!activeHero) {
            app.innerHTML = `
                <div class="card">
                    <h2>Stammbaum</h2>
                    <p>Es ist kein Held als aktiv markiert.</p>
                    <p>Bitte gehe zur <a href="#/heroes">Helden-Seite</a> und aktiviere einen deiner Helden.</p>
                    <button class="btn" onclick="location.hash='#/heroes'">Zu den Helden</button>
                </div>
            `;
            return;
        }

        const relations = await fetchFamilyTree(activeHero.id);
        const nscs = await listNSCs();

        const html = `
            <div class="card">
                ${section(`Stammbaum von ${htmlesc(activeHero.name)}`, `<button class="btn" id="add-relation">+ Beziehung hinzufügen</button>`)}
                ${relations.length > 0 ? `
                    <div id="family-tree-container" class="family-tree-container">
                        ${relations.map(rel => renderRelationCard(rel, activeHero)).join('')}
                    </div>
                ` : empty('Noch keine Beziehungen im Stammbaum. Füge eine neue hinzu!')}
            </div>
        `;
        app.innerHTML = html;

        // Event Listener für "Beziehung hinzufügen"
        document.getElementById('add-relation').onclick = () => showAddRelationModal(activeHero.id, nscs);

        // Event Listener für "Bearbeiten" und "Löschen" auf den Karten
        document.querySelectorAll('.edit-relation').forEach(button => {
            button.addEventListener('click', (e) => {
                const relationId = e.target.dataset.id;
                const relation = relations.find(r => r.id === relationId);
                if (relation) {
                    showEditRelationModal(relation, nscs);
                }
            });
        });

        document.querySelectorAll('.delete-relation').forEach(button => {
            button.addEventListener('click', async (e) => {
                if (!confirm('Diese Beziehung wirklich löschen?')) return;
                const relationId = e.target.dataset.id;
                try {
                    await deleteFamilyRelation(relationId);
                    await renderFamilyTree(); // Seite neu laden
                } catch (err) {
                    alert(`Fehler beim Löschen: ${err.message}`);
                }
            });
        });

    } catch (err) {
        console.error("Fehler in renderFamilyTree:", err);
        app.innerHTML = `<div class="card"><h2>Stammbaum</h2><p>Ein Fehler ist aufgetreten: ${err.message}</p></div>`;
    }
}

// Rendert eine einzelne Beziehungskarte
function renderRelationCard(relation, activeHero) {
    const nscName = relation.nscs?.name || 'Unbekannter NSC';
    return `
        <div class="family-card">
            <div class="family-header">
                <strong>${htmlesc(nscName)}</strong>
            </div>
            <div class="family-body">
                <div><strong>Beziehung:</strong> ${htmlesc(relation.relation_type || '–')}</div>
                ${relation.notes ? `<div><strong>Notizen:</strong> ${htmlesc(relation.notes)}</div>` : ''}
            </div>
            <div class="family-footer">
                <button class="btn secondary edit-relation" data-id="${relation.id}">Bearbeiten</button>
                <button class="btn warn delete-relation" data-id="${relation.id}">Löschen</button>
            </div>
        </div>
    `;
}

// Modal zum Hinzufügen einer neuen Beziehung
function showAddRelationModal(heroId, nscs) {
    const nscOptions = nscs.map(nsc => `<option value="${nsc.id}">${htmlesc(nsc.name)}</option>`).join('');
    const root = modal(`
        <h3>Neue Beziehung hinzufügen</h3>
        <div class="row">
            ${formRow('NSC auswählen', `<select class="input" id="nsc-select">${nscOptions}</select>`)}
            ${formRow('Beziehung', '<input class="input" id="relation-type" placeholder="z.B. Vater, Schwester, Onkel" />')}
        </div>
        ${formRow('Notizen (optional)', '<textarea class="input" id="relation-notes" rows="3"></textarea>')}
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
            <button class="btn secondary" id="cancel-add">Abbrechen</button>
            <button class="btn" id="save-add">Hinzufügen</button>
        </div>
    `);

    root.querySelector('#cancel-add').onclick = () => root.innerHTML = '';
    root.querySelector('#save-add').onclick = async () => {
        const nscId = document.getElementById('nsc-select').value;
        const relationType = document.getElementById('relation-type').value.trim();
        const notes = document.getElementById('relation-notes').value.trim();

        if (!nscId) {
            alert('Bitte wähle einen NSC aus.');
            return;
        }
        if (!relationType) {
            alert('Bitte gib eine Beziehungsart an.');
            return;
        }

        try {
            await addFamilyRelation(heroId, nscId, relationType, notes);
            root.innerHTML = '';
            await renderFamilyTree(); // Seite neu laden
        } catch (err) {
            alert(`Fehler beim Hinzufügen: ${err.message}`);
        }
    };
}

// Modal zum Bearbeiten einer bestehenden Beziehung
function showEditRelationModal(relation, nscs) {
    const nscOptions = nscs.map(nsc => `<option value="${nsc.id}" ${nsc.id === relation.nsc_id ? 'selected' : ''}>${htmlesc(nsc.name)}</option>`).join('');
    const root = modal(`
        <h3>Beziehung bearbeiten</h3>
        <div class="row">
            ${formRow('NSC auswählen', `<select class="input" id="nsc-select">${nscOptions}</select>`)}
            ${formRow('Beziehung', `<input class="input" id="relation-type" value="${htmlesc(relation.relation_type || '')}" />`)}
        </div>
        ${formRow('Notizen (optional)', `<textarea class="input" id="relation-notes" rows="3">${htmlesc(relation.notes || '')}</textarea>`)}
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
            <button class="btn secondary" id="cancel-edit">Abbrechen</button>
            <button class="btn" id="save-edit">Speichern</button>
        </div>
    `);

    root.querySelector('#cancel-edit').onclick = () => root.innerHTML = '';
    root.querySelector('#save-edit').onclick = async () => {
        const nscId = document.getElementById('nsc-select').value;
        const relationType = document.getElementById('relation-type').value.trim();
        const notes = document.getElementById('relation-notes').value.trim();

        if (!nscId) {
            alert('Bitte wähle einen NSC aus.');
            return;
        }
        if (!relationType) {
            alert('Bitte gib eine Beziehungsart an.');
            return;
        }

        try {
            await updateFamilyRelation(relation.id, relationType, notes);
            root.innerHTML = '';
            await renderFamilyTree(); // Seite neu laden
        } catch (err) {
            alert(`Fehler beim Speichern: ${err.message}`);
        }
    };
}

// Hilfsfunktion für Formularzeilen (falls nicht global verfügbar)
function formRow(label, inputHtml) {
    return `<div><div class="label">${label}</div>${inputHtml}</div>`;
}