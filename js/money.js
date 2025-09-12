// js/money.js
import { supabase } from './supabaseClient.js';
import { state } from './state.js';
import { htmlesc } from './utils.js';

// Hilfsfunktion: Formatierung des Geldbetrags (für die Anzeige des Gesamtbetrags)
// *** Dynamische Gesamtsummenanzeige ***
function formatTotalMoney(dukaten, silbertaler, heller, kreuzer) {
    // Umrechnung in kleinste Einheit (Kreuzer)
    const totalInKreuzer = (dukaten * 10 * 10 * 10) + (silbertaler * 10 * 10) + (heller * 10) + kreuzer;

    if (totalInKreuzer === 0) {
        return "0 Kreuzer";
    } else if (totalInKreuzer < 100) {
        // Weniger als 100 Kreuzer -> zeige in Kreuzer
        return `${totalInKreuzer} Kreuzer`;
    } else if (totalInKreuzer < 100 * 10) {
        // Weniger als 100 Heller (1000 Kreuzer) -> zeige in Heller
        const totalInHeller = totalInKreuzer / 10.0;
        // Zeige eine Nachkommastelle, wenn nicht ganzzahlig
        return `${Number.isInteger(totalInHeller) ? totalInHeller : totalInHeller.toFixed(1)} Heller`;
    } else if (totalInKreuzer < 100 * 10 * 10) {
        // Weniger als 100 Silbertaler (10000 Kreuzer) -> zeige in Silbertaler
        const totalInSilbertaler = totalInKreuzer / (10.0 * 10.0);
        // Zeige eine Nachkommastelle, wenn nicht ganzzahlig
        return `${Number.isInteger(totalInSilbertaler) ? totalInSilbertaler : totalInSilbertaler.toFixed(1)} Silbertaler`;
    } else {
        // 100 Silbertaler oder mehr -> zeige in Dukaten, wenn >= 1000, sonst Silbertaler
        const totalInSilbertaler = totalInKreuzer / (10.0 * 10.0);
        if (totalInSilbertaler >= 1000) {
             const totalInDukaten = totalInKreuzer / (10.0 * 10.0 * 10.0);
             return `${Number.isInteger(totalInDukaten) ? totalInDukaten : totalInDukaten.toFixed(1)} Dukaten`;
        } else {
            return `${Number.isInteger(totalInSilbertaler) ? totalInSilbertaler : totalInSilbertaler.toFixed(1)} Silbertaler`;
        }
    }
}

// Hilfsfunktion: Formatierung der detaillierten Aufstellung (wie vorher)
function formatDetailedMoney(dukaten, silbertaler, heller, kreuzer) {
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

// *** Haupt-Render-Funktion für die Geld-Seite mit verbesserter Gesamtsummenanzeige ***
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
            // *** Dynamische Gesamtsumme ***
            const totalFormatted = formatTotalMoney(
                activeHero.purse_dukaten,
                activeHero.purse_silbertaler,
                activeHero.purse_heller,
                activeHero.purse_kreuzer
            );
            const detailedFormatted = formatDetailedMoney(
                activeHero.purse_dukaten,
                activeHero.purse_silbertaler,
                activeHero.purse_heller,
                activeHero.purse_kreuzer
            );

            html += `
                <h3>Geldbörse: ${htmlesc(activeHero.name)}</h3>
                <div class="card">
                    <!-- *** Gestylter Container für die Gesamtsumme *** -->
                    <div class="purse-total-display">
                        <strong>Gesamt:</strong> ${totalFormatted}
                    </div>
                    <p><strong>Aufstellung:</strong> ${detailedFormatted}</p>
                    
                    <form id="purse-form">
                        <input type="hidden" id="purse-hero-id" value="${activeHero.id}" />
                        
                        <!-- Dukaten -->
                        <div class="purse-row">
                            <label for="input-dukaten">Dukaten:</label>
                            <div class="purse-controls">
                                <button type="button" class="btn secondary small purse-dec" data-target="input-dukaten">−</button>
                                <input type="number" id="input-dukaten" class="input purse-input" value="${activeHero.purse_dukaten}" min="0">
                                <button type="button" class="btn secondary small purse-inc" data-target="input-dukaten">+</button>
                            </div>
                        </div>

                        <!-- Silbertaler -->
                        <div class="purse-row">
                            <label for="input-silbertaler">Silbertaler:</label>
                            <div class="purse-controls">
                                <button type="button" class="btn secondary small purse-dec" data-target="input-silbertaler">−</button>
                                <input type="number" id="input-silbertaler" class="input purse-input" value="${activeHero.purse_silbertaler}" min="0">
                                <button type="button" class="btn secondary small purse-inc" data-target="input-silbertaler">+</button>
                            </div>
                        </div>

                        <!-- Heller -->
                        <div class="purse-row">
                            <label for="input-heller">Heller:</label>
                            <div class="purse-controls">
                                <button type="button" class="btn secondary small purse-dec" data-target="input-heller">−</button>
                                <input type="number" id="input-heller" class="input purse-input" value="${activeHero.purse_heller}" min="0">
                                <button type="button" class="btn secondary small purse-inc" data-target="input-heller">+</button>
                            </div>
                        </div>

                        <!-- Kreuzer -->
                        <div class="purse-row">
                            <label for="input-kreuzer">Kreuzer:</label>
                            <div class="purse-controls">
                                <button type="button" class="btn secondary small purse-dec" data-target="input-kreuzer">−</button>
                                <input type="number" id="input-kreuzer" class="input purse-input" value="${activeHero.purse_kreuzer}" min="0">
                                <button type="button" class="btn secondary small purse-inc" data-target="input-kreuzer">+</button>
                            </div>
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
            
            // *** Event Listener für Plus/Minus Buttons ***
            form.querySelectorAll('.purse-inc, .purse-dec').forEach(button => {
                button.addEventListener('click', (e) => {
                    const targetId = e.target.getAttribute('data-target');
                    const input = document.getElementById(targetId);
                    if (input) {
                        let value = parseInt(input.value, 10) || 0;
                        if (e.target.classList.contains('purse-inc')) {
                            value += 1;
                        } else if (e.target.classList.contains('purse-dec')) {
                            value = Math.max(0, value - 1); // Verhindert negative Werte
                        }
                        input.value = value;
                    }
                });
            });

            // Formular Submit Handler
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

                // Validierung (optional, bereits durch Minus-Button-Logik eingeschränkt)
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