// js/heroes.js
import { supabase } from './supabaseClient.js';
import { state } from './state.js';
import { section, empty, modal, formRow } from './components.js';
import { htmlesc } from './utils.js'; // Korrigierter Import-Pfad

/* ============ API ============ */

async function listHeroes() {
    const { data, error } = await supabase
        .from('heroes')
        .select('id,name,species,profession,notes,ap_total,lp_current,lp_max')
        .order('created_at', { ascending: false });
    if (error) {
        console.error(error);
        return [];
    }
    return data || [];
}

async function createHero(hero) {
    const { data, error } = await supabase
        .from('heroes')
        .insert([hero])
        .select();
    if (error) {
        console.error(error);
        throw error;
    }
    return data[0];
}

// *** NEU: Funktion zum Setzen des aktiven Helden im Profil ***
async function setActiveHeroInProfile(heroId) {
    if (!state.user?.id) {
        console.warn("Kein Benutzer eingeloggt.");
        return;
    }
    const { error } = await supabase
        .from('profiles')
        .update({ active_hero_id: heroId })
        .eq('user_id', state.user.id);

    if (error) {
        console.error("Fehler beim Setzen des aktiven Helden:", error);
        alert("Fehler beim Aktivieren des Helden.");
        throw error; // Werfen Sie den Fehler weiter, um ihn in renderHeroes zu behandeln
    } else {
        console.log(`Aktiver Held auf ${heroId} gesetzt.`);
        // Optional: Globale State-Variable aktualisieren, falls vorhanden
        // state.activeHeroId = heroId;
    }
}

// *** NEU: Funktion zum Abrufen des aktuell aktiven Helden aus dem Profil ***
async function getActiveHeroId() {
    if (!state.user?.id) {
        console.warn("Kein Benutzer eingeloggt.");
        return null;
    }
    const { data, error } = await supabase
        .from('profiles')
        .select('active_hero_id')
        .eq('user_id', state.user.id)
        .single();

    if (error) {
        // Es ist nicht unbedingt ein Fehler, wenn noch kein Profil existiert
        console.warn("Fehler beim Abrufen des aktiven Helden aus dem Profil:", error);
        return null;
    }
    return data?.active_hero_id || null;
}


/* ============ UI ============ */
// Funktion für die Desktop-Tabelle
function heroRow(h, activeHeroId) {
    const isActive = h.id === activeHeroId;
    const statusText = isActive ? '<strong style="color: #4CAF50;">Aktiv</strong>' : 'Inaktiv';
    const actionCell = isActive ?
        '<td><em>-</em></td>' :
        `<td><button class="btn secondary small set-hero-active-btn" data-id="${h.id}" data-name="${htmlesc(h.name)}">Aktivieren</button></td>`;
    return `<tr data-id="${h.id}" class="hero-row">
        <td><strong>${htmlesc(h.name)}</strong></td>
        <td>${htmlesc(h.species || '')}</td>
        <td>${htmlesc(h.profession || '')}</td>
        <td class="small">${htmlesc(h.notes || '')}</td>
        <td>${Number(h.ap_total ?? 0)}</td>
        <td>${Number(h.lp_current ?? 0)} / ${Number(h.lp_max ?? 0)}</td>
        <td>${statusText}</td>
        ${actionCell}
    </tr>`;
}

// NEUE Funktion: Card-Ansicht für Mobile
function mobileCard(h, activeHeroId) {
    const isActive = h.id === activeHeroId;
    const statusText = isActive ? 'Aktiv' : 'Inaktiv';
    return `
        <div class="mobile-card" data-id="${h.id}" style="cursor: pointer;">
            <div class="mobile-card-header">
                <h3>${htmlesc(h.name)}</h3>
            </div>
            <div class="mobile-card-body">
                <div class="mobile-card-item">
                    <span class="mobile-card-label">Spezies:</span>
                    <span class="mobile-card-value">${htmlesc(h.species || '–')}</span>
                </div>
                <div class="mobile-card-item">
                    <span class="mobile-card-label">Profession:</span>
                    <span class="mobile-card-value">${htmlesc(h.profession || '–')}</span>
                </div>
                <div class="mobile-card-item">
                    <span class="mobile-card-label">AP:</span>
                    <span class="mobile-card-value">${Number(h.ap_total ?? 0)}</span>
                </div>
                <div class="mobile-card-item">
                    <span class="mobile-card-label">LP:</span>
                    <span class="mobile-card-value">${Number(h.lp_current ?? 0)} / ${Number(h.lp_max ?? 0)}</span>
                </div>
                <div class="mobile-card-item">
                    <span class="mobile-card-label">Status:</span>
                    <span class="mobile-card-value">${statusText}</span>
                </div>
            </div>
        </div>
    `;
}

export async function renderHeroes() {
    const app = document.getElementById('app');
    app.innerHTML = '<div class="card"><h2>Helden</h2><p>Lade Helden und aktiven Status...</p></div>';
    if (!state.user?.id) {
        app.innerHTML = '<div class="card"><h2>Helden</h2><p>Zugriff erforderlich. Bitte melde dich an.</p></div>';
        return;
    }
    try {
        const items = await listHeroes();
        const activeHeroId = await getActiveHeroId();
        // HTML generieren - Mobile View verwendet jetzt mobileCard
        const html = `<div class="card">
            ${section('Helden', `<button class="btn" id="add-hero">+ Held</button>`)}
            <div id="desktop-view" class="card">
                ${items.length ?
                    `<table class="table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Spezies</th>
                                <th>Profession</th>
                                <th>Notizen</th>
                                <th>AP</th>
                                <th>LP</th>
                                <th>Status</th>
                                <th>Aktion</th>
                            </tr>
                        </thead>
                        <tbody id="heroes-tbody">
                            ${items.map(h => heroRow(h, activeHeroId)).join('')}
                        </tbody>
                    </table>` :
                    empty('Noch keine Helden angelegt.')
                }
            </div>
            <div id="mobile-view" class="mobile-cards-container">
                ${items.length ? items.map(h => mobileCard(h, activeHeroId)).join('') : empty('Noch keine Helden angelegt.')}
            </div>
        </div>`;
        app.innerHTML = html;
        // Mobile/Desktop View Toggle
        const desktopView = document.getElementById('desktop-view');
        const mobileView = document.getElementById('mobile-view');
        const tbody = document.getElementById('heroes-tbody');
        function updateView() {
            if (window.innerWidth <= 768) {
                desktopView.style.display = 'none';
                mobileView.style.display = 'block';
            } else {
                desktopView.style.display = 'block';
                mobileView.style.display = 'none';
            }
        }
        updateView();
        window.addEventListener('resize', updateView);
        // Button: Neuen Helden anlegen
        document.getElementById('add-hero').onclick = () => showAddHero();
        // Event Listener für Desktop (Tabelle)
        if (tbody) {
            tbody.addEventListener('click', (e) => {
                // "Aktivieren"-Button
                if (e.target.classList.contains('set-hero-active-btn')) {
                    e.preventDefault();
                    const heroId = e.target.getAttribute('data-id');
                    const heroName = e.target.getAttribute('data-name');
                    if (!heroId) return;
                    handleActivateHero(heroId, heroName);
                }
                // Zeile anklicken -> Helden bearbeiten
                const tr = e.target.closest('tr.hero-row');
                if (tr && !e.target.classList.contains('set-hero-active-btn')) {
                    const id = tr.dataset.id;
                    const hero = items.find(x => x.id === id);
                    if (hero) showEditHero(hero); // NEUE Funktion: Helden bearbeiten
                }
            });
        }
        // Event Listener für Mobile (Karten)
        mobileView.addEventListener('click', (e) => {
            const card = e.target.closest('.mobile-card');
            if (!card) return;
            if (card.contains(e.target)) {
                const id = card.dataset.id;
                const hero = items.find(x => x.id === id);
                if (hero) showEditHero(hero); // NEUE Funktion: Helden bearbeiten
            }
        });
    } catch (err) {
        console.error("Fehler in renderHeroes:", err);
        app.innerHTML = `<div class="card"><h2>Helden</h2><p>Ein Fehler ist aufgetreten: ${err.message}</p></div>`;
    }
}

/* ============ Helden anlegen ============ */

function showAddHero() {
    const root = modal(`<h3>Neuen Helden anlegen</h3>
        ${formRow('Name', '<input class="input" id="h-name" />')}
        <div class="row">
            ${formRow('Spezies', '<input class="input" id="h-species" />')}
            ${formRow('Profession', '<input class="input" id="h-profession" />')}
        </div>
        ${formRow('AP (gesamt)', '<input class="input" id="h-ap" type="number" min="0" value="0" />')}
        <div class="row">
            ${formRow('LP aktuell', '<input class="input" id="h-lpcur" type="number" min="0" value="30" />')}
            ${formRow('LP max', '<input class="input" id="h-lpmax" type="number" min="0" value="30" />')}
        </div>
        ${formRow('Notizen', '<textarea class="input" id="h-notes" rows="3"></textarea>')}
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
            <button class="btn secondary" onclick="this.closest('.modal').remove()">Abbrechen</button>
            <button class="btn" id="btn-save-hero">Speichern</button>
        </div>`);

    root.querySelector('#btn-save-hero').onclick = async () => {
        const hero = {
            name: document.getElementById('h-name').value.trim(),
            species: document.getElementById('h-species').value.trim(),
            profession: document.getElementById('h-profession').value.trim(),
            ap_total: parseInt(document.getElementById('h-ap').value) || 0,
            lp_current: parseInt(document.getElementById('h-lpcur').value) || 0,
            lp_max: parseInt(document.getElementById('h-lpmax').value) || 0,
            notes: document.getElementById('h-notes').value.trim(),
            user_id: state.user.id
        };
        if (!hero.name) {
            alert('Bitte gib einen Namen ein.');
            return;
        }
        if (hero.lp_current > hero.lp_max) {
            alert('LP aktuell darf nicht größer als LP max sein.');
            return;
        }
        try {
            await createHero(hero);
            root.remove();
            location.hash = '#/heroes'; // Seite neu laden
        } catch (error) {
            alert(error.message);
        }
    };
}

/* ============ Helden bearbeiten (Modal) ============ */
function showEditHero(hero) {
    const root = modal(`
        <h3>Helden bearbeiten: ${htmlesc(hero.name)}</h3>
        ${formRow('Name', `<input class="input" id="edit-name" value="${htmlesc(hero.name)}" />`)}
        <div class="row">
            ${formRow('Spezies', `<input class="input" id="edit-species" value="${htmlesc(hero.species || '')}" />`)}
            ${formRow('Profession', `<input class="input" id="edit-profession" value="${htmlesc(hero.profession || '')}" />`)}
        </div>
        ${formRow('Notizen', `<textarea class="input" id="edit-notes" rows="3">${htmlesc(hero.notes || '')}</textarea>`)}
        <div class="row">
            ${formRow('AP (gesamt)', `<input class="input" id="edit-ap" type="number" min="0" value="${Number(hero.ap_total ?? 0)}" />`)}
            ${formRow('LP aktuell', `<input class="input" id="edit-lpcur" type="number" min="0" value="${Number(hero.lp_current ?? 0)}" />`)}
        </div>
        ${formRow('LP max', `<input class="input" id="edit-lpmax" type="number" min="0" value="${Number(hero.lp_max ?? 0)}" />`)}
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
            <button class="btn warn" id="btn-delete-hero">Löschen</button>
            <button class="btn secondary" id="btn-set-active">Als Aktiv setzen</button>
            <button class="btn secondary" id="btn-cancel">Abbrechen</button>
            <button class="btn" id="btn-save">Speichern</button>
        </div>
    `);
    // Button: Abbrechen
    root.querySelector('#btn-cancel').onclick = () => root.innerHTML = '';
    // Button: Als Aktiv setzen
    root.querySelector('#btn-set-active').onclick = async () => {
        try {
            await setActiveHeroInProfile(hero.id);
            alert(`"${hero.name}" ist jetzt der aktive Held.`);
            root.innerHTML = '';
            await renderHeroes(); // Seite neu laden
        } catch (err) {
            alert(`Fehler beim Aktivieren von "${hero.name}": ${err.message}`);
        }
    };
    // Button: Löschen
    root.querySelector('#btn-delete-hero').onclick = async () => {
        if (!confirm(`Held "${hero.name}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`)) return;
        try {
            const { error } = await supabase.from('heroes').delete().eq('id', hero.id);
            if (error) throw error;
            // Prüfen, ob der gelöschte Held der aktive Held war
            const activeHeroId = await getActiveHeroId();
            if (activeHeroId === hero.id) {
                // Aktiven Helden im Profil zurücksetzen
                await supabase.from('profiles').update({ active_hero_id: null }).eq('user_id', state.user.id);
            }
            root.innerHTML = '';
            await renderHeroes(); // Seite neu laden
        } catch (err) {
            alert(`Fehler beim Löschen von "${hero.name}": ${err.message}`);
        }
    };
    // Button: Speichern
    root.querySelector('#btn-save').onclick = async () => {
        const updatedHero = {
            name: document.getElementById('edit-name').value.trim(),
            species: document.getElementById('edit-species').value.trim(),
            profession: document.getElementById('edit-profession').value.trim(),
            notes: document.getElementById('edit-notes').value.trim(),
            ap_total: parseInt(document.getElementById('edit-ap').value) || 0,
            lp_current: parseInt(document.getElementById('edit-lpcur').value) || 0,
            lp_max: parseInt(document.getElementById('edit-lpmax').value) || 0,
        };
        if (!updatedHero.name) {
            alert('Bitte gib einen Namen ein.');
            return;
        }
        if (updatedHero.lp_current > updatedHero.lp_max) {
            alert('LP aktuell darf nicht größer als LP max sein.');
            return;
        }
        try {
            const { error } = await supabase.from('heroes').update(updatedHero).eq('id', hero.id);
            if (error) throw error;
            root.innerHTML = '';
            await renderHeroes(); // Seite neu laden
        } catch (err) {
            alert(`Fehler beim Speichern: ${err.message}`);
        }
    };
}

/* Hilfsfunktion: Aktivieren eines Helden (wird von Desktop und Mobile verwendet) */
async function handleActivateHero(heroId, heroName) {
    try {
        await setActiveHeroInProfile(heroId);
        alert(`"${heroName}" ist jetzt der aktive Held.`);
        await renderHeroes(); // Seite neu laden
    } catch (err) {
        alert(`Fehler beim Aktivieren von "${heroName}": ${err.message}`);
    }
}