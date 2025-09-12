// js/money.js
import { supabase } from './supabaseClient.js';
import { state } from './state.js';
import { htmlesc } from './utils.js'; // Stellen Sie sicher, dass der Pfad korrekt ist

// Hilfsfunktion: Formatierung des Geldbetrags
function formatMoney(dukaten, silbertaler, heller, kreuzer) {
    const parts = [];
    if (dukaten > 0) parts.push(`${dukaten} Dukaten`);
    if (silbertaler > 0) parts.push(`${silbertaler} Silbertaler`);
    if (heller > 0) parts.push(`${heller} Heller`);
    if (kreuzer > 0) parts.push(`${kreuzer} Kreuzer`);
    return parts.length > 0 ? parts.join(', ') : '0 Kreuzer';
}

// *** Funktion zum Abrufen des aktiven Helden mit Geldbörse ***
async function fetchActiveHeroWithPurse() {
    if (!state.user?.id) {
        console.warn("Kein Benutzer eingeloggt.");
        return null;
    }

    // 1. Aktive Held ID aus dem Profil abrufen
    const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('active_hero_id')
        .eq('user_id', state.user.id)
        .single();

    if (profileError || !profileData?.active_hero_id) {
        // Kein Profil oder kein aktiver Held gesetzt
        console.log("Kein aktiver Held im Profil gefunden.");
        return null; // Signalisiert: kein aktiver Held
    }

    const activeHeroId = profileData.active_hero_id;

    // 2. Daten des aktiven Helden abrufen
    const { data: heroData, error: heroError } = await supabase
        .from('heroes')
        .select('id, name, purse_dukaten, purse_silbertaler, purse_heller, purse_kreuzer')
        .eq('id', activeHeroId)
        .single(); // Es sollte nur ein Held mit dieser ID geben

    if (heroError) {
        console.error("Fehler beim Abrufen des aktiven Helden:", heroError);
        // Je nach Fehlerart könnte man unterscheiden
        // z.B. falls Held gelöscht wurde, aber ID im Profil steht
        return null;
    }

    return heroData || null;
}

// *** Funktion zum Aktualisieren der Geldbörse eines Helden ***
async function updateHeroPurse(heroId, purseData) {
    // Optional: Überprüfen, ob der Held dem Nutzer gehört (RLS macht das meist)
    const { error } = await supabase
        .from('heroes')
        .update(purseData)
        .eq('id', heroId); // RLS sollte sicherstellen, dass nur eigene Helden bearbeitet werden

    if (error) {
        console.error("Fehler beim Aktualisieren der Geldbörse:", error);
        alert("Fehler beim Speichern der Geldbörse.");
        return false;
    }
    console.log(`Geldbörse für Held ${heroId} aktualisiert.`);
    return true;
}

// *** Haupt-Render-Funktion für die vereinfachte Geld-Seite ***
export async function renderMoney() {
    const app = document.getElementById('app');
    app.innerHTML = '<div class="card"><h2>Geld</h2><p>Lade aktiven Helden...</p></div>';

    if (!state.user?.id) {
        app.innerHTML = '<div class="card"><h2>Geld</h2><p>Zugriff erforderlich. Bitte melde dich an.</p></div>';
        return;
    }

    try {
        const activeHero = await fetchActiveHeroWithPurse();

        let html = '<div class="card"><h2>Geld</h2>';

        if (activeHero) {
            // *** Fall 1: Aktiver Held gefunden ***
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
            // *** Fall 2: Kein aktiver Held ***
            html += `
                <div class="card">
                   <p>Es ist kein Held als aktiv markiert.</p>
                   <p>Bitte gehe zur <a href="#/heroes">Helden-Seite</a> und aktiviere einen deiner Helden, um hier seine Geldbörse zu verwalten.</p>
                   <button class="btn" onclick="location.hash='#/heroes'">Zu den Helden</button>
                </div>
            `;
        }

        html += '</div>'; // Schließt die äußere card
        app.innerHTML = html;

        // Event Listener nur hinzufügen, wenn das Formular existiert
        const form = document.getElementById('purse-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const heroId = document.getElementById('purse-hero-id').value;
                // Stelle sicher, dass heroId gültig ist
                if (!heroId) {
                     alert("Ungültiger Held für die Geldbörse.");
                     return;
                }
                const dukaten = parseInt(document.getElementById('input-dukaten').value, 10) || 0;
                const silbertaler = parseInt(document.getElementById('input-silbertaler').value, 10) || 0;
                const heller = parseInt(document.getElementById('input-heller').value, 10) || 0;
                const kreuzer = parseInt(document.getElementById('input-kreuzer').value, 10) || 0;

                // Validierung (optional)
                if (dukaten < 0 || silbertaler < 0 || heller < 0 || kreuzer < 0) {
                    alert("Bitte geben Sie nur positive Zahlen ein.");
                    return;
                }

                const success = await updateHeroPurse(heroId, {
                    purse_dukaten: dukaten,
                    purse_silbertaler: silbertaler,
                    purse_heller: heller,
                    purse_kreuzer: kreuzer
                });
                if (success) {
                    alert('Geldbörse erfolgreich gespeichert.');
                    // Seite neu laden, um aktualisierte Werte anzuzeigen
                    await renderMoney();
                }
            });
        }

    } catch (err) {
        console.error("Fehler in renderMoney:", err);
        let errorMsg = "Ein unerwarteter Fehler ist aufgetreten.";
        if (err.message) {
            errorMsg += ` Details: ${err.message}`;
        }
        app.innerHTML = `<div class="card"><h2>Geld</h2><p>${errorMsg}</p></div>`;
    }
}