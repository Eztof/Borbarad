// js/familytree.js
import { supabase } from './supabaseClient.js';
import { state } from './state.js';
import { modal, empty } from './components.js';
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

// Abrufen aller Stammbaum-Daten für einen Helden (inkl. Positionen und Quellen)
async function fetchFamilyTree(heroId) {
    const { data, error } = await supabase
        .from('family_tree')
        .select(`
            id,
            hero_id,
            nsc_id,
            relation_type,
            notes,
            position_x,
            position_y,
            connection_type,
            source_id,
            nscs: nsc_id (id, name)
        `)
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

// Hinzufügen einer neuen Beziehung (mit initialer Position)
async function addFamilyRelation(heroId, nscId, relationType, notes, x, y, sourceId = null) {
    const { data, error } = await supabase
        .from('family_tree')
        .insert([{
            hero_id: heroId,
            nsc_id: nscId,
            relation_type: relationType,
            notes: notes,
            position_x: x,
            position_y: y,
            connection_type: 'line',
            source_id: sourceId // Erlaubt Verbindungen zwischen NSCs
        }])
        .select();
    if (error) {
        throw error;
    }
    return data[0];
}

// Aktualisieren der Position einer Karte
async function updateCardPosition(cardId, x, y) {
    const { error } = await supabase
        .from('family_tree')
        .update({ position_x: x, position_y: y })
        .eq('id', cardId);
    if (error) {
        throw error;
    }
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
async function updateFamilyRelation(relationId, relationType, notes, connectionType, sourceId) {
    const { error } = await supabase
        .from('family_tree')
        .update({
            relation_type: relationType,
            notes: notes,
            connection_type: connectionType,
            source_id: sourceId
        })
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
                <div style="display:flex;gap:8px;align-items:center;justify-content:space-between;margin-bottom:16px">
                    <h2>Stammbaum von ${htmlesc(activeHero.name)}</h2>
                    <div>
                        <button class="btn secondary" id="btn-zoom-out">-</button>
                        <button class="btn" id="btn-add-relation">+ NSC hinzufügen</button>
                        <button class="btn secondary" id="btn-zoom-in">+</button>
                    </div>
                </div>
                <div id="canvas-container" style="position:relative;width:100%;height:70vh;overflow:hidden;background:#1a1218;border:1px solid var(--line);border-radius:12px;">
                    <canvas id="family-canvas" style="position:absolute;top:0;left:0;width:100%;height:100%;cursor:grab;"></canvas>
                </div>
                <div style="margin-top:16px;text-align:center;font-size:14px;color:var(--muted);">
                    <p><strong>Bedienung:</strong> Karte antippen und halten, um sie zu verschieben. Doppeltippen, um zu bearbeiten. Langes Tippen, um Verbindung zu erstellen.</p>
                </div>
            </div>
        `;
        app.innerHTML = html;

        // Initialisiere die Canvas
        const canvas = document.getElementById('family-canvas');
        const ctx = canvas.getContext('2d');
        const container = document.getElementById('canvas-container');

        // Canvas-Größe an Container anpassen
        function resizeCanvas() {
            canvas.width = container.clientWidth;
            canvas.height = container.clientHeight;
        }
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        // Zustand für Zoom und Pan
        const state = {
            scale: 1,
            offsetX: 0,
            offsetY: 0,
            isDragging: false,
            isPanning: false,
            lastX: 0,
            lastY: 0,
            selectedCard: null,
            longPressTimer: null,
            startCardForConnection: null,
            relations: relations,
            hero: activeHero,
            nscs: nscs
        };

        // Zeichnet den gesamten Stammbaum
        function draw() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Transform für Zoom und Pan
            ctx.save();
            ctx.translate(state.offsetX, state.offsetY);
            ctx.scale(state.scale, state.scale);

            // Zeichne Verbindungslinien
            state.relations.forEach(rel => {
                if (rel.source_id) {
                    // Verbindung zwischen zwei NSCs
                    const source = state.relations.find(r => r.id === rel.source_id);
                    if (source) {
                        drawConnection(
                            source.position_x || 0,
                            source.position_y || 0,
                            rel.position_x || 0,
                            rel.position_y || 0,
                            rel.connection_type || 'line'
                        );
                    }
                } else {
                    // Verbindung zwischen Held und NSC
                    drawConnection(
                        0, // Held ist immer im Zentrum (0,0)
                        0,
                        rel.position_x || 0,
                        rel.position_y || 0,
                        rel.connection_type || 'line'
                    );
                }
            });

            // Zeichne den zentralen Helden
            drawHeroCard(0, 0, state.hero.name);

            // Zeichne alle NSC-Karten
            state.relations.forEach(rel => {
                const nscName = rel.nscs?.name || 'Unbekannt';
                drawNSCCard(
                    rel.position_x || 0,
                    rel.position_y || 0,
                    nscName,
                    rel.relation_type || '',
                    rel.id === state.selectedCard?.id
                );
            });

            ctx.restore();
        }

        // Zeichnet eine Verbindungslinie
        function drawConnection(x1, y1, x2, y2, type) {
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.strokeStyle = '#c22f2f';
            ctx.lineWidth = 2;

            if (type === 'dashed') {
                ctx.setLineDash([5, 5]);
            } else if (type === 'arrow') {
                // Einfacher Pfeil am Ende
                const angle = Math.atan2(y2 - y1, x2 - x1);
                const headLength = 15;
                ctx.lineTo(x2 - headLength * Math.cos(angle - Math.PI / 6), y2 - headLength * Math.sin(angle - Math.PI / 6));
                ctx.moveTo(x2, y2);
                ctx.lineTo(x2 - headLength * Math.cos(angle + Math.PI / 6), y2 - headLength * Math.sin(angle + Math.PI / 6));
            }

            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Zeichnet die Helden-Karte
        function drawHeroCard(x, y, name) {
            const cardWidth = 120;
            const cardHeight = 60;
            const centerX = x - cardWidth / 2;
            const centerY = y - cardHeight / 2;

            // Karte
            ctx.fillStyle = '#4CAF50';
            ctx.fillRect(centerX, centerY, cardWidth, cardHeight);
            ctx.strokeStyle = '#2E7D32';
            ctx.lineWidth = 2;
            ctx.strokeRect(centerX, centerY, cardWidth, cardHeight);

            // Text
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(name, x, y);
        }

        // Zeichnet eine NSC-Karte
        function drawNSCCard(x, y, name, relation, isSelected) {
            const cardWidth = 140;
            const cardHeight = 80;
            const centerX = x - cardWidth / 2;
            const centerY = y - cardHeight / 2;

            // Karte
            ctx.fillStyle = isSelected ? '#FFC107' : '#2196F3';
            ctx.fillRect(centerX, centerY, cardWidth, cardHeight);
            ctx.strokeStyle = isSelected ? '#FFA000' : '#1976D2';
            ctx.lineWidth = 2;
            ctx.strokeRect(centerX, centerY, cardWidth, cardHeight);

            // Text
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(name, x, centerY + 10);

            ctx.font = '12px Arial';
            ctx.fillText(relation || '–', x, centerY + 35);
        }

        // Finde Karte unter Koordinaten (in Canvas-Koordinaten, nicht transformiert)
        function getCardAt(canvasX, canvasY) {
            for (let rel of state.relations) {
                const cardX = (rel.position_x || 0) * state.scale + state.offsetX;
                const cardY = (rel.position_y || 0) * state.scale + state.offsetY;
                const cardWidth = 140 * state.scale;
                const cardHeight = 80 * state.scale;

                if (
                    canvasX >= cardX - cardWidth / 2 &&
                    canvasX <= cardX + cardWidth / 2 &&
                    canvasY >= cardY - cardHeight / 2 &&
                    canvasY <= cardY + cardHeight / 2
                ) {
                    return rel;
                }
            }
            return null;
        }

        // Hilfsfunktion: Konvertiert Canvas-Koordinaten in Welt-Koordinaten
        function canvasToWorld(canvasX, canvasY) {
            const worldX = (canvasX - state.offsetX) / state.scale;
            const worldY = (canvasY - state.offsetY) / state.scale;
            return { x: worldX, y: worldY };
        }

        // Event Listener für Touch-Events (Mobile-optimiert)
        let lastTap = 0;
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = canvas.getBoundingClientRect();
            const canvasX = touch.clientX - rect.left;
            const canvasY = touch.clientY - rect.top;

            const card = getCardAt(canvasX, canvasY);
            if (card) {
                state.selectedCard = card;
                state.isDragging = true;
                const worldPos = canvasToWorld(canvasX, canvasY);
                state.lastX = worldPos.x;
                state.lastY = worldPos.y;
                canvas.style.cursor = 'grabbing';

                // Long Press für Verbindung
                state.longPressTimer = setTimeout(() => {
                    state.startCardForConnection = card;
                    alert(`Wähle das Ziel für die Verbindung von "${card.nscs?.name || 'NSC'}" aus.`);
                }, 1000); // 1 Sekunde Long Press
            } else {
                state.isPanning = true;
                state.lastX = touch.clientX;
                state.lastY = touch.clientY;
                canvas.style.cursor = 'grabbing';
            }
        });

        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (state.longPressTimer) {
                clearTimeout(state.longPressTimer);
                state.longPressTimer = null;
            }

            const touch = e.touches[0];
            const rect = canvas.getBoundingClientRect();
            const canvasX = touch.clientX - rect.left;
            const canvasY = touch.clientY - rect.top;

            if (state.isDragging && state.selectedCard) {
                const worldPos = canvasToWorld(canvasX, canvasY);
                const deltaX = worldPos.x - state.lastX;
                const deltaY = worldPos.y - state.lastY;

                state.selectedCard.position_x += deltaX;
                state.selectedCard.position_y += deltaY;

                // Speichere Position in DB
                updateCardPosition(state.selectedCard.id, state.selectedCard.position_x, state.selectedCard.position_y)
                    .catch(err => console.error("Fehler beim Speichern der Position:", err));

                state.lastX = worldPos.x;
                state.lastY = worldPos.y;
                draw();
            } else if (state.isPanning) {
                state.offsetX += touch.clientX - state.lastX;
                state.offsetY += touch.clientY - state.lastY;
                state.lastX = touch.clientX;
                state.lastY = touch.clientY;
                draw();
            }
        });

        canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            if (state.longPressTimer) {
                clearTimeout(state.longPressTimer);
                state.longPressTimer = null;
            }

            if (state.startCardForConnection) {
                const touch = e.changedTouches[0];
                const rect = canvas.getBoundingClientRect();
                const canvasX = touch.clientX - rect.left;
                const canvasY = touch.clientY - rect.top;
                const targetCard = getCardAt(canvasX, canvasY);

                if (targetCard && targetCard.id !== state.startCardForConnection.id) {
                    // Verbindung zwischen zwei NSCs erstellen
                    showAddRelationModal(
                        state.hero.id,
                        state.nscs,
                        state,
                        state.startCardForConnection.id, // source_id
                        targetCard.nsc_id // nsc_id für das Ziel
                    );
                } else {
                    alert('Bitte wähle eine andere Karte als Ziel aus.');
                }
                state.startCardForConnection = null;
            }

            state.isDragging = false;
            state.isPanning = false;
            state.selectedCard = null;
            canvas.style.cursor = 'grab';
        });

        // Event Listener für Maus-Events (Desktop)
        canvas.addEventListener('mousedown', (e) => {
            const rect = canvas.getBoundingClientRect();
            const canvasX = e.clientX - rect.left;
            const canvasY = e.clientY - rect.top;

            const card = getCardAt(canvasX, canvasY);
            if (card) {
                state.selectedCard = card;
                state.isDragging = true;
                const worldPos = canvasToWorld(canvasX, canvasY);
                state.lastX = worldPos.x;
                state.lastY = worldPos.y;
                canvas.style.cursor = 'grabbing';
            } else {
                state.isPanning = true;
                state.lastX = e.clientX;
                state.lastY = e.clientY;
                canvas.style.cursor = 'grabbing';
            }
        });

        canvas.addEventListener('mousemove', (e) => {
            if (state.isDragging && state.selectedCard) {
                const rect = canvas.getBoundingClientRect();
                const canvasX = e.clientX - rect.left;
                const canvasY = e.clientY - rect.top;
                const worldPos = canvasToWorld(canvasX, canvasY);

                const deltaX = worldPos.x - state.lastX;
                const deltaY = worldPos.y - state.lastY;

                state.selectedCard.position_x += deltaX;
                state.selectedCard.position_y += deltaY;

                updateCardPosition(state.selectedCard.id, state.selectedCard.position_x, state.selectedCard.position_y)
                    .catch(err => console.error("Fehler beim Speichern der Position:", err));

                state.lastX = worldPos.x;
                state.lastY = worldPos.y;
                draw();
            } else if (state.isPanning) {
                state.offsetX += e.clientX - state.lastX;
                state.offsetY += e.clientY - state.lastY;
                state.lastX = e.clientX;
                state.lastY = e.clientY;
                draw();
            }
        });

        canvas.addEventListener('mouseup', () => {
            state.isDragging = false;
            state.isPanning = false;
            state.selectedCard = null;
            canvas.style.cursor = 'grab';
        });

        canvas.addEventListener('mouseleave', () => {
            state.isDragging = false;
            state.isPanning = false;
            state.selectedCard = null;
            canvas.style.cursor = 'grab';
        });

        // Doppelklick/Doppeltippen zum Bearbeiten
        canvas.addEventListener('dblclick', (e) => {
            const rect = canvas.getBoundingClientRect();
            const canvasX = e.clientX - rect.left;
            const canvasY = e.clientY - rect.top;
            const card = getCardAt(canvasX, canvasY);
            if (card) {
                showEditRelationModal(card, state.nscs, state, draw); // draw-Funktion übergeben
            }
        });

        canvas.addEventListener('touchend', (e) => {
            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTap;
            if (tapLength < 500 && tapLength > 0) {
                // Doppeltippen erkannt
                const touch = e.changedTouches[0];
                const rect = canvas.getBoundingClientRect();
                const canvasX = touch.clientX - rect.left;
                const canvasY = touch.clientY - rect.top;
                const card = getCardAt(canvasX, canvasY);
                if (card) {
                    showEditRelationModal(card, state.nscs, state, draw); // draw-Funktion übergeben
                }
            }
            lastTap = currentTime;
        });

        // Rechtsklick auf Karte zum Löschen (Desktop)
        canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const canvasX = e.clientX - rect.left;
            const canvasY = e.clientY - rect.top;
            const card = getCardAt(canvasX, canvasY);
            if (card) {
                if (confirm(`Möchtest du die Beziehung zu "${card.nscs?.name || 'NSC'}" wirklich löschen?`)) {
                    deleteFamilyRelation(card.id)
                        .then(() => {
                            state.relations = state.relations.filter(r => r.id !== card.id);
                            draw();
                        })
                        .catch(err => alert(`Fehler beim Löschen: ${err.message}`));
                }
            }
        });

        // Zoom-Events
        document.getElementById('btn-zoom-in').addEventListener('click', () => {
            state.scale *= 1.2;
            draw();
        });

        document.getElementById('btn-zoom-out').addEventListener('click', () => {
            state.scale /= 1.2;
            draw();
        });

        // Hinzufügen einer neuen Beziehung
        document.getElementById('btn-add-relation').addEventListener('click', () => {
            showAddRelationModal(state.hero.id, state.nscs, state, null, null, draw); // draw-Funktion übergeben
        });

        // Initiales Zeichnen
        draw();

    } catch (err) {
        console.error("Fehler in renderFamilyTree:", err);
        app.innerHTML = `<div class="card"><h2>Stammbaum</h2><p>Ein Fehler ist aufgetreten: ${err.message}</p></div>`;
    }
}

// Modal zum Hinzufügen einer neuen Beziehung
function showAddRelationModal(heroId, nscs, state, sourceId = null, preselectedNscId = null, drawCallback) {
    const nscOptions = nscs.map(nsc => `<option value="${nsc.id}" ${nsc.id === preselectedNscId ? 'selected' : ''}>${htmlesc(nsc.name)}</option>`).join('');
    const root = modal(`
        <h3>${sourceId ? 'Verbindung erstellen' : 'Neue Beziehung hinzufügen'}</h3>
        <div class="row">
            ${formRow('NSC auswählen', `<select class="input" id="nsc-select">${nscOptions}</select>`)}
            ${formRow('Beziehung', '<input class="input" id="relation-type" placeholder="z.B. Vater, Schwester, Onkel" />')}
        </div>
        ${formRow('Notizen (optional)', '<textarea class="input" id="relation-notes" rows="3"></textarea>')}
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
            <button class="btn secondary" id="cancel-add">Abbrechen</button>
            <button class="btn" id="save-add">${sourceId ? 'Verbindung erstellen' : 'Hinzufügen'}</button>
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
            // Füge neue Karte mit initialer Position hinzu
            let initialX = 200;
            let initialY = 0;
            if (sourceId) {
                // Wenn es eine Verbindung zwischen NSCs ist, platziere die neue Karte relativ zur Quelle
                const sourceCard = state.relations.find(r => r.id === sourceId);
                if (sourceCard) {
                    initialX = (sourceCard.position_x || 0) + 150;
                    initialY = (sourceCard.position_y || 0);
                }
            }

            const newRelation = await addFamilyRelation(heroId, nscId, relationType, notes, initialX, initialY, sourceId);

            // Aktualisiere den lokalen Zustand und zeichne neu
            state.relations.push(newRelation);
            if (drawCallback) drawCallback();

            root.innerHTML = '';
        } catch (err) {
            alert(`Fehler beim Hinzufügen: ${err.message}`);
        }
    };
}

// Modal zum Bearbeiten einer bestehenden Beziehung
function showEditRelationModal(relation, nscs, state, drawCallback) {
    const nscOptions = nscs.map(nsc => `<option value="${nsc.id}" ${nsc.id === relation.nsc_id ? 'selected' : ''}>${htmlesc(nsc.name)}</option>`).join('');
    const connectionTypeOptions = `
        <option value="line" ${relation.connection_type === 'line' ? 'selected' : ''}>Durchgezogene Linie</option>
        <option value="dashed" ${relation.connection_type === 'dashed' ? 'selected' : ''}>Gestrichelte Linie</option>
        <option value="arrow" ${relation.connection_type === 'arrow' ? 'selected' : ''}>Pfeil</option>
    `;

    // Optionen für Quell-NSC (für Verbindungen zwischen NSCs)
    const sourceOptions = `<option value="">Mit Helden verbinden</option>` +
        state.relations
            .filter(r => r.id !== relation.id) // Nicht mit sich selbst verbinden
            .map(r => `<option value="${r.id}" ${r.id === relation.source_id ? 'selected' : ''}>${htmlesc(r.nscs?.name || 'Unbekannt')}</option>`)
            .join('');

    const root = modal(`
        <h3>Beziehung bearbeiten</h3>
        <div class="row">
            ${formRow('NSC auswählen', `<select class="input" id="nsc-select">${nscOptions}</select>`)}
            ${formRow('Beziehung', `<input class="input" id="relation-type" value="${htmlesc(relation.relation_type || '')}" />`)}
        </div>
        ${formRow('Verbindungstyp', `<select class="input" id="connection-type">${connectionTypeOptions}</select>`)}
        ${formRow('Verbunden mit', `<select class="input" id="source-select">${sourceOptions}</select>`)}
        ${formRow('Notizen (optional)', `<textarea class="input" id="relation-notes" rows="3">${htmlesc(relation.notes || '')}</textarea>`)}
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
            <button class="btn secondary" id="cancel-edit">Abbrechen</button>
            <button class="btn warn" id="delete-edit">Löschen</button>
            <button class="btn" id="save-edit">Speichern</button>
        </div>
    `);

    root.querySelector('#cancel-edit').onclick = () => root.innerHTML = '';
    root.querySelector('#delete-edit').onclick = async () => {
        if (!confirm('Diese Beziehung wirklich löschen?')) return;
        try {
            await deleteFamilyRelation(relation.id);
            state.relations = state.relations.filter(r => r.id !== relation.id);
            if (drawCallback) drawCallback();
            root.innerHTML = '';
        } catch (err) {
            alert(`Fehler beim Löschen: ${err.message}`);
        }
    };
    root.querySelector('#save-edit').onclick = async () => {
        const nscId = document.getElementById('nsc-select').value;
        const relationType = document.getElementById('relation-type').value.trim();
        const connectionType = document.getElementById('connection-type').value;
        const sourceId = document.getElementById('source-select').value || null; // Kann null sein (Verbindung zum Helden)
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
            await updateFamilyRelation(relation.id, relationType, notes, connectionType, sourceId);
            // Aktualisiere den lokalen Zustand
            const updatedRelation = state.relations.find(r => r.id === relation.id);
            if (updatedRelation) {
                updatedRelation.nsc_id = nscId;
                updatedRelation.relation_type = relationType;
                updatedRelation.notes = notes;
                updatedRelation.connection_type = connectionType;
                updatedRelation.source_id = sourceId;
            }
            if (drawCallback) drawCallback();
            root.innerHTML = '';
        } catch (err) {
            alert(`Fehler beim Speichern: ${err.message}`);
        }
    };
}

// Hilfsfunktion für Formularzeilen
function formRow(label, inputHtml) {
    return `<div><div class="label">${label}</div>${inputHtml}</div>`;
}