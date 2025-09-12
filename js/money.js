import { supabase } from './supabaseClient.js';
import { state } from './state.js';
import { htmlesc } from './utils.js';

// Hilfsfunktion: Formatierung des Geldbetrags
function formatMoney(dukaten, silbertaler, heller, kreuzer) {
    const parts = [];
    if (dukaten > 0) parts.push(`${dukaten} Dukaten`);
    if (silbertaler > 0) parts.push(`${silbertaler} Silbertaler`);
    if (heller > 0) parts.push(`${heller} Heller`);
    if (kreuzer > 0) parts.push(`${kreuzer} Kreuzer`);
    return parts.length > 0 ? parts.join(', ') : '0 Kreuzer';
}


// *** NEU: Funktion zum Abrufen der eigenen Helden ***
async function fetchOwnHeroes() {
    if (!state.user?.id) {
        console.warn("Kein Benutzer eingeloggt.");
        return [];
    }
    const { data, error } = await supabase
        .from('heroes')
        .select('id, name, is_active, purse_dukaten, purse_silbertaler, purse_heller, purse_kreuzer')
        .eq('user_id', state.user.id)
        .order('name', { ascending: true });

    if (error) {
        console.error("Fehler beim Abrufen der eigenen Helden:", error);
        alert("Fehler beim Laden der Heldenliste.");
        return [];
    }
    return data || [];
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
    } else {
        console.log(`Aktiver Held auf ${heroId} gesetzt.`);
        // Optional: Globale State-Variable aktualisieren, falls vorhanden
        // state.activeHeroId = heroId;
    }
}

// *** NEU: Funktion zum Aktualisieren der Geldbörse eines Helden ***
async function updateHeroPurse(heroId, purseData) {
    const { error } = await supabase
        .from('heroes')
        .update(purseData)
        .eq('id', heroId);

    if (error) {
        console.error("Fehler beim Aktualisieren der Geldbörse:", error);
        alert("Fehler beim Speichern der Geldbörse.");
        return false;
    }
    console.log(`Geldbörse für Held ${heroId} aktualisiert.`);
    return true;
}

// *** NEU: Haupt-Render-Funktion für die Geld-Seite ***
export async function renderMoney() {
    const app = document.getElementById('app');
    app.innerHTML = '<div class="card"><h2>Geld</h2><p>Lade Daten...</p></div>';

    if (!state.user?.id) {
        app.innerHTML = '<div class="card"><h2>Geld</h2><p>Zugriff erforderlich. Bitte melde dich an.</p></div>';
        return;
    }

    try {
        // 1. Helden und aktiven Helden abrufen
        const heroes = await fetchOwnHeroes();
        const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('active_hero_id')
            .eq('user_id', state.user.id)
            .single();

        if (profileError) throw profileError;
        const activeHeroId = profileData?.active_hero_id;

        let activeHero = null;
        if (activeHeroId) {
             activeHero = heroes.find(h => h.id === activeHeroId);
        }

        // 2. HTML generieren
        let html = `
            <div class="card">
                <h2>Geld</h2>
                <h3>Meine Helden</h3>
                <div class="card" style="margin-bottom: 20px;">
                    ${heroes.length > 0 ? `
                        <table class="table">
                            <thead>
                                <tr><th>Name</th><th>Status</th><th>Aktion</th></tr>
                            </thead>
                            <tbody>
                                ${heroes.map(h => `
                                    <tr>
                                        <td>${htmlesc(h.name)}</td>
                                        <td>${h.id === activeHeroId ? '<strong>Aktiv</strong>' : 'Inaktiv'}</td>
                                        <td>
                                            ${h.id === activeHeroId ? '-' : `<button class="btn secondary small set-active-btn" data-id="${h.id}">Aktivieren</button>`}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : '<p>Du hast noch keine Helden erstellt.</p>'}
                </div>
        `;

        if (activeHero) {
            html += `
                <h3>Geldbörse: ${htmlesc(activeHero.name)}</h3>
                <div class="card">
                    <p><strong>Aktueller Betrag:</strong> ${formatMoney(activeHero.purse_dukaten, activeHero.purse_silbertaler, activeHero.purse_heller, activeHero.purse_kreuzer)}</p>
                    <form id="purse-form">
                        <input type="hidden" id="purse-hero-id" value="${activeHero.id}" />
                        <div class="row">
                            <label for="input-dukaten">Dukaten:</label>
                            <input type="number" id="input-dukaten" class="input" value="${activeHero.purse_dukaten}" min="0">
                        </div>
                        <div class="row">
                            <label for="input-silbertaler">Silbertaler:</label>
                            <input type="number" id="input-silbertaler" class="input" value="${activeHero.purse_silbertaler}" min="0">
                        </div>
                        <div class="row">
                            <label for="input-heller">Heller:</label>
                            <input type="number" id="input-heller" class="input" value="${activeHero.purse_heller}" min="0">
                        </div>
                        <div class="row">
                            <label for="input-kreuzer">Kreuzer:</label>
                            <input type="number" id="input-kreuzer" class="input" value="${activeHero.purse_kreuzer}" min="0">
                        </div>
                        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
                            <button type="submit" class="btn">Speichern</button>
                        </div>
                    </form>
                </div>
            `;
        } else {
            html += '<p>Bitte aktiviere einen deiner Helden, um die Geldbörse zu sehen und zu bearbeiten.</p>';
        }

        html += '</div>'; // Schließt die äußere card

        app.innerHTML = html;

        // 3. Event Listener hinzufügen

        // Aktiv-Buttons
        document.querySelectorAll('.set-active-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const heroId = e.target.getAttribute('data-id');
                await setActiveHeroInProfile(heroId);
                // Seite neu laden, um Änderungen widerzuspiegeln
                await renderMoney();
            });
        });

        // Formular zum Speichern der Geldbörse
        const form = document.getElementById('purse-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const heroId = document.getElementById('purse-hero-id').value;
                const dukaten = parseInt(document.getElementById('input-dukaten').value, 10) || 0;
                const silbertaler = parseInt(document.getElementById('input-silbertaler').value, 10) || 0;
                const heller = parseInt(document.getElementById('input-heller').value, 10) || 0;
                const kreuzer = parseInt(document.getElementById('input-kreuzer').value, 10) || 0;

                const success = await updateHeroPurse(heroId, { purse_dukaten: dukaten, purse_silbertaler: silbertaler, purse_heller: heller, purse_kreuzer: kreuzer });
                if (success) {
                    alert('Geldbörse erfolgreich gespeichert.');
                    // Seite neu laden, um aktualisierte Werte anzuzeigen
                    await renderMoney();
                }
            });
        }


    } catch (err) {
        console.error("Fehler in renderMoney:", err);
        app.innerHTML = `<div class="card"><h2>Geld</h2><p>Ein Fehler ist aufgetreten: ${err.message}</p></div>`;
    }
}