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

function heroRow(h, activeHeroId) { // *** Geändert: activeHeroId als Parameter ***
    // Bestimme, ob dieser Held der aktive Held ist
    const isActive = h.id === activeHeroId;
    const statusText = isActive ? '<strong style="color: #4CAF50;">Aktiv</strong>' : 'Inaktiv';
    // Zeige den "Aktivieren"-Button nur, wenn der Held nicht aktiv ist
    const actionCell = isActive ?
        '<td><em>-</em></td>' :
        `<td><button class="btn secondary small set-hero-active-btn" data-id="${h.id}" data-name="${htmlesc(h.name)}">Aktivieren</button></td>`;

    return `<tr>
        <td><strong>${htmlesc(h.name)}</strong></td>
        <td>${htmlesc(h.species || '')}</td>
        <td>${htmlesc(h.profession || '')}</td>
        <td class="small">${htmlesc(h.notes || '')}</td>
        <td>${Number(h.ap_total ?? 0)}</td>
        <td>${Number(h.lp_current ?? 0)} / ${Number(h.lp_max ?? 0)}</td>
        <td>${statusText}</td> <!-- *** NEU: Status-Spalte *** -->
        ${actionCell}          <!-- *** NEU: Aktion-Spalte *** -->
    </tr>`;
}

export async function renderHeroes() {
    const app = document.getElementById('app');
    // Initialer Lade-Status
    app.innerHTML = '<div class="card"><h2>Helden</h2><p>Lade Helden und aktiven Status...</p></div>';

    if (!state.user?.id) {
        app.innerHTML = '<div class="card"><h2>Helden</h2><p>Zugriff erforderlich. Bitte melde dich an.</p></div>';
        return;
    }

    try {
        // 1. Helden und aktiven Helden abrufen
        const items = await listHeroes();
        const activeHeroId = await getActiveHeroId(); // *** NEU: Aktiven Helden abrufen ***

        // 2. HTML generieren
        const html = `<div class="card">
            ${section('Helden', `<button class="btn" id="add-hero">+ Held</button>`)}
            ${items.length ?
                `<div class="card">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Spezies</th>
                                <th>Profession</th>
                                <th>Notizen</th>
                                <th>AP</th>
                                <th>LP</th>
                                <th>Status</th> <!-- *** NEU: Überschrift *** -->
                                <th>Aktion</th> <!-- *** NEU: Überschrift *** -->
                            </tr>
                        </thead>
                        <tbody>
                            ${items.map(h => heroRow(h, activeHeroId)).join('')} <!-- *** Geändert: activeHeroId übergeben *** -->
                        </tbody>
                    </table>
                </div>` :
                empty('Noch keine Helden angelegt.')
            }
        </div>`;

        app.innerHTML = html;

        // 3. Event Listener hinzufügen

        // Button: Neuen Helden anlegen
        document.getElementById('add-hero').onclick = () => showAddHero();

        // *** NEU: Event Listener für "Aktivieren"-Buttons ***
        document.querySelectorAll('.set-hero-active-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                e.preventDefault(); // Verhindert Standardverhalten
                const heroId = e.target.getAttribute('data-id');
                const heroName = e.target.getAttribute('data-name');

                if (!heroId) {
                    console.error("Keine Held ID für Aktivierung gefunden.");
                    return;
                }

                // Optional: Bestätigungsdialog
                if (!confirm(`Soll "${heroName}" jetzt als aktiver Held festgelegt werden?`)) {
                    return;
                }

                try {
                    // Aktiven Helden im Profil setzen
                    await setActiveHeroInProfile(heroId);
                    alert(`"${heroName}" ist jetzt der aktive Held.`);
                    // Seite neu laden, um den aktualisierten Status anzuzeigen
                    await renderHeroes();
                } catch (err) {
                    console.error("Fehler beim Aktivieren des Helden:", err);
                    alert(`Fehler beim Aktivieren von "${heroName}": ${err.message}`);
                }
            });
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