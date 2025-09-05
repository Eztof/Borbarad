// js/timeline.js
// Zoombarer & scrollbarer Aventurien-Zeitstrahl mit Segment-Linien und Gruppen-Filtern

import { supabase } from './supabaseClient.js';
import { section, empty, modal } from './components.js';
import {
  AV_MONTHS,
  avToDayNumber,
  dayNumberToAv,
  avToISO,
  formatAvDate,
  htmlesc
} from './utils.js';
import { state } from './state.js';

/* =========================
   Persistente Einstellungen
   ========================= */
const LS_KEY = 'timeline.settings.v2';
function loadSettings() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}
function saveSettings(s) { localStorage.setItem(LS_KEY, JSON.stringify(s)); }

let SETTINGS = Object.assign({
  pxPerDay: 18,                 // Zoomstufe (Pixel/Tag)
  showGroups: { story:true, nsc:true, object:true },
  compactLabels: true
}, loadSettings() || {});

/* ==============
   Hilfsfunktionen
   ============== */
const clamp = (v, a, b)=> Math.max(a, Math.min(b, v));
const PX_MIN = 6, PX_MAX = 60;
const ROW_H = 18, ROW_GAP = 6, TRACK_PAD = 8;  // Segment-Höhen etc.

function monthKey(av){ return `${av.year}-${av.month}`; }
function addDays(num, delta){ return num + delta; }

function titleForSeg(seg){
  const s = formatAvDate(dayNumberToAv(seg.start));
  const e = formatAvDate(dayNumberToAv(seg.end));
  if (seg.kind==='story') return `${seg.label}\n${s}${seg.end>seg.start?` – ${e}`:''}`;
  return `${seg.label}\n${s} – ${e}`;
}

/* ======================
   Datenaufbereitung
   ====================== */
async function fetchAll() {
  const [evRes, nscRes, objRes] = await Promise.all([
    supabase.from('events').select('id,title,av_date,av_date_end,type,description,location'),
    supabase.from('nscs').select('id,name,first_encounter,last_encounter,is_active,biography,whereabouts'),
    supabase.from('objects').select('id,name,first_seen,last_seen,is_active,description,location')
  ]);
  return {
    events: evRes.data || [],
    nscs: nscRes.data || [],
    objects: objRes.data || []
  };
}

// Liefert Segmente (start/end sind DayNumbers relativ zum BF-Kalender)
function buildSegments({ events, nscs, objects }){
  const cur = state.campaignDate || {year:1027, month:1, day:1};
  const curDN = avToDayNumber(cur);
  const segs = [];

  // Story-Events
  for (const e of events){
    if (!e.av_date) continue;
    const s = avToDayNumber(e.av_date);
    const eEnd = e.av_date_end ? avToDayNumber(e.av_date_end) : s; // Ein-Tages-Strecken okay
    segs.push({
      id: e.id, kind:'story', label: e.title,
      start: Math.min(s, eEnd), end: Math.max(s, eEnd),
      meta: e
    });
  }

  // NSCs
  for (const n of nscs){
    if (!n.first_encounter) continue;
    const s = avToDayNumber(n.first_encounter);
    const lastAv = n.is_active ? cur : n.last_encounter;
    const eDN = lastAv ? avToDayNumber(lastAv) : s;
    segs.push({
      id: n.id, kind:'nsc', label: n.name,
      start: Math.min(s, eDN), end: Math.max(s, eDN),
      meta: n
    });
  }

  // Objekte
  for (const o of objects){
    if (!o.first_seen) continue;
    const s = avToDayNumber(o.first_seen);
    const lastAv = o.is_active ? cur : o.last_seen;
    const eDN = lastAv ? avToDayNumber(lastAv) : s;
    segs.push({
      id: o.id, kind:'object', label: o.name,
      start: Math.min(s, eDN), end: Math.max(s, eDN),
      meta: o
    });
  }

  // minimale Strich-Breite (1 Tag) sicherstellen
  segs.forEach(s=>{ if (s.end === s.start) s.end = s.start + 1; });
  return segs;
}

/* =======================
   Layout (Packen in Reihen)
   ======================= */
// Packe pro Gruppe in Reihen, damit nichts überlappt
function packByRows(items){
  // Sortiert nach Start
  const list = [...items].sort((a,b)=> a.start - b.start || a.end - b.end);
  const rows = [];                       // rows[i] = lastEnd
  const placed = [];

  for (const it of list){
    let rowIdx = rows.findIndex(lastEnd => lastEnd <= it.start);
    if (rowIdx === -1){ rowIdx = rows.length; rows.push(-Infinity); }
    rows[rowIdx] = it.end + 0.1;         // leichte Lücke
    placed.push({ ...it, row: rowIdx });
  }
  const rowCount = rows.length || 1;
  return { items: placed, rowCount };
}

/* =======================
   Skala vorbereiten
   ======================= */
function findRange(segs){
  let min = Infinity, max = -Infinity;
  for (const s of segs){
    if (s.start < min) min = s.start;
    if (s.end   > max) max = s.end;
  }
  if (!isFinite(min)) {
    // Fallback: Heute ± 6 Monate
    const dn = avToDayNumber(state.campaignDate || {year:1027,month:1,day:1});
    return { start: dn - 90, end: dn + 90 };
  }
  // Padding um 1 Monat
  return { start: min - 15, end: max + 15 };
}

function buildMonths(range){
  // In unserem Kalender hat jeder Monat 30 Tage – einfach
  const firstMonthIdx = Math.floor(range.start / 30);
  const lastMonthIdx  = Math.floor((range.end-1) / 30);
  const months = [];
  for (let m = firstMonthIdx; m <= lastMonthIdx; m++){
    const y = Math.floor(m / 12);
    const mo = (m % 12) + 1;
    months.push({ year:y, month:mo, startDN: m*30, endDN: (m+1)*30 });
  }
  return months;
}

/* ======================
   Rendering
   ====================== */

let CACHED_SEGMENTS = [];
let RANGE = null;

function renderControls(host){
  host.innerHTML = `
    <div class="tl-controls">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <div class="small">Gruppen:</div>
        <label class="tag"><input type="checkbox" id="tl-f-story" ${SETTINGS.showGroups.story?'checked':''}/> Story</label>
        <label class="tag"><input type="checkbox" id="tl-f-nsc" ${SETTINGS.showGroups.nsc?'checked':''}/> NSCs</label>
        <label class="tag"><input type="checkbox" id="tl-f-obj" ${SETTINGS.showGroups.object?'checked':''}/> Objekte</label>

        <span style="width:1px;height:20px;background:var(--line-soft);margin:0 6px"></span>

        <div class="small">Zoom:</div>
        <button class="btn secondary" id="tl-zoom-out" title="Zoom out">–</button>
        <input id="tl-zoom-range" type="range" min="${PX_MIN}" max="${PX_MAX}" value="${SETTINGS.pxPerDay}" style="width:160px">
        <button class="btn secondary" id="tl-zoom-in" title="Zoom in">+</button>
        <button class="btn secondary" id="tl-fit" title="Gesamte Daten einpassen">Fit</button>
        <button class="btn secondary" id="tl-today" title="Heute (Kampagnendatum)">Heute</button>

        <span style="width:1px;height:20px;background:var(--line-soft);margin:0 6px"></span>
        <label class="tag"><input type="checkbox" id="tl-compact" ${SETTINGS.compactLabels?'checked':''}/> kompakt</label>
      </div>
    </div>
  `;

  const apply = ()=>{ saveSettings(SETTINGS); drawTimeline(); };

  host.querySelector('#tl-f-story').onchange = (e)=>{ SETTINGS.showGroups.story = e.target.checked; apply(); };
  host.querySelector('#tl-f-nsc').onchange   = (e)=>{ SETTINGS.showGroups.nsc   = e.target.checked; apply(); };
  host.querySelector('#tl-f-obj').onchange   = (e)=>{ SETTINGS.showGroups.object= e.target.checked; apply(); };
  host.querySelector('#tl-compact').onchange = (e)=>{ SETTINGS.compactLabels = e.target.checked; apply(); };

  host.querySelector('#tl-zoom-in').onclick  = ()=>{ SETTINGS.pxPerDay = clamp(SETTINGS.pxPerDay*1.2, PX_MIN, PX_MAX); apply(); };
  host.querySelector('#tl-zoom-out').onclick = ()=>{ SETTINGS.pxPerDay = clamp(SETTINGS.pxPerDay/1.2, PX_MIN, PX_MAX); apply(); };
  host.querySelector('#tl-zoom-range').oninput = (e)=>{ SETTINGS.pxPerDay = clamp(+e.target.value, PX_MIN, PX_MAX); apply(); };

  host.querySelector('#tl-fit').onclick = ()=>{ fitToWidth(); };
  host.querySelector('#tl-today').onclick = ()=>{ scrollToDay(avToDayNumber(state.campaignDate||{year:1027,month:1,day:1})); };
}

function fitToWidth(){
  const wrap = document.getElementById('tl-scroll');
  if (!wrap || !RANGE) return;
  const totalDays = (RANGE.end - RANGE.start);
  const target = clamp((wrap.clientWidth - 200) / totalDays, PX_MIN, PX_MAX); // etwas Luft
  SETTINGS.pxPerDay = target;
  saveSettings(SETTINGS);
  drawTimeline();
  wrap.scrollLeft = 0;
}

function scrollToDay(dayNumber){
  const wrap = document.getElementById('tl-scroll');
  const x = (dayNumber - RANGE.start) * SETTINGS.pxPerDay;
  wrap.scrollLeft = clamp(x - wrap.clientWidth/2, 0, (RANGE.end - RANGE.start)*SETTINGS.pxPerDay - wrap.clientWidth);
}

function renderScale(months){
  const scale = document.getElementById('tl-scale');
  scale.innerHTML = months.map(m=>{
    const width = Math.max(1, (m.endDN - Math.max(m.startDN, RANGE.start) - Math.max(0, RANGE.start - m.startDN)) * SETTINGS.pxPerDay);
    const label = `${AV_MONTHS[m.month-1]} ${m.year} BF`;
    return `<div class="tl-scale-cell" style="min-width:${30*SETTINGS.pxPerDay}px;width:${30*SETTINGS.pxPerDay}px">
      <div class="tl-scale-month">${htmlesc(label)}</div>
    </div>`;
  }).join('');
}

function segColorClass(kind){
  if (kind==='nsc') return 'seg-nsc';
  if (kind==='object') return 'seg-object';
  return 'seg-story';
}

function renderLane(title, items, laneId){
  const track = document.createElement('div');
  track.className = 'lane';
  track.innerHTML = `
    <div class="lane-title">${htmlesc(title)}</div>
    <div class="lane-track"><div class="track-body"></div></div>
  `;
  const body = track.querySelector('.track-body');

  // Packen in Reihen
  const { items: placed, rowCount } = packByRows(items);
  const trackHeight = Math.max( ROW_H*rowCount + ROW_GAP*(rowCount-1) + TRACK_PAD*2, 40 );
  track.querySelector('.lane-track').style.height = `${trackHeight}px`;

  for (const it of placed){
    // in Pixel umrechnen
    const left = (it.start - RANGE.start) * SETTINGS.pxPerDay;
    const width = Math.max(1, (it.end - it.start) * SETTINGS.pxPerDay);
    const top = TRACK_PAD + it.row*(ROW_H+ROW_GAP);

    const div = document.createElement('div');
    div.className = `seg ${segColorClass(it.kind)} ${SETTINGS.compactLabels?'compact':''}`;
    div.style.left = `${left}px`;
    div.style.width = `${width}px`;
    div.style.top = `${top}px`;
    div.title = titleForSeg(it);

    const label = document.createElement('div');
    label.className = 'seg-label';
    label.textContent = it.label;
    div.appendChild(label);

    div.addEventListener('click', ()=> openDetails(it));
    body.appendChild(div);
  }
  return track;
}

async function openDetails(seg){
  const meta = seg.meta || {};
  let title = '', body = '';
  if (seg.kind === 'nsc'){
    title = meta.name || 'NSC';
    body = `
      ${meta.whereabouts ? `<p><strong>Verbleib:</strong> ${htmlesc(meta.whereabouts)}</p>` : ''}
      ${meta.biography ? `<p style="white-space:pre-wrap">${htmlesc(meta.biography)}</p>` : ''}
    `;
  }else if (seg.kind === 'object'){
    title = meta.name || 'Objekt';
    body = `
      ${meta.location ? `<p><strong>Ort:</strong> ${htmlesc(meta.location)}</p>` : ''}
      ${meta.description ? `<p style="white-space:pre-wrap">${htmlesc(meta.description)}</p>` : ''}
    `;
  }else{
    title = meta.title || 'Ereignis';
    body = `
      ${meta.type ? `<div class="small">Typ: ${htmlesc(meta.type)}</div>` : ''}
      ${meta.location ? `<p><strong>Ort:</strong> ${htmlesc(meta.location)}</p>` : ''}
      ${meta.description ? `<p style="white-space:pre-wrap">${htmlesc(meta.description)}</p>` : ''}
    `;
  }
  const root = modal(`
    <h3 style="margin:0 0 8px 0">${htmlesc(title)}</h3>
    ${body || '<div class="small">Keine weiteren Details.</div>'}
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
      <button class="btn secondary" id="seg-close">Schließen</button>
    </div>
  `);
  root.querySelector('#seg-close').onclick = ()=> root.innerHTML='';
}

function drawTimeline(){
  // Filtern nach Gruppen
  const active = CACHED_SEGMENTS.filter(s=> SETTINGS.showGroups[s.kind]);

  // Range bestimmen
  RANGE = findRange(active);
  const totalDays = (RANGE.end - RANGE.start);
  const months = buildMonths(RANGE);

  // Header-Skala
  renderScale(months);

  // Breite setzen
  const canvasWidth = Math.max(1, Math.ceil(totalDays * SETTINGS.pxPerDay));
  const scaleEl = document.getElementById('tl-scale');
  const lanesEl = document.getElementById('tl-lanes');
  lanesEl.innerHTML = '';
  scaleEl.style.width = `${canvasWidth}px`;
  document.getElementById('tl-canvas').style.width = `${canvasWidth}px`;

  // Lanes bauen
  const story = active.filter(s=> s.kind==='story');
  const nscs = active.filter(s=> s.kind==='nsc');
  const objs = active.filter(s=> s.kind==='object');

  lanesEl.appendChild(renderLane('Story', story, 'story'));
  lanesEl.appendChild(renderLane('NSCs', nscs, 'nsc'));
  lanesEl.appendChild(renderLane('Objekte', objs, 'object'));

  // Heute-Marker (Kampagnendatum)
  const cur = state.campaignDate || {year:1027,month:1,day:1};
  const curX = (avToDayNumber(cur) - RANGE.start) * SETTINGS.pxPerDay;
  const marker = document.getElementById('tl-today-marker');
  marker.style.left = `${curX}px`;
}

export async function renderTimeline(){
  const app = document.getElementById('app');

  // Daten abrufen & vorbereiten
  const raw = await fetchAll();
  CACHED_SEGMENTS = buildSegments(raw);

  app.innerHTML = `
    <div class="card">
      ${section('Kampagnen-Zeitstrahl (Zoom & Scroll)')}
      <div id="tl-controls"></div>

      <div class="timeline2">
        <div class="tl2-header">
          <div id="tl-scale" class="tl-scale"></div>
        </div>
        <div id="tl-scroll" class="tl2-scroll">
          <div id="tl-canvas" class="tl-canvas">
            <div id="tl-today-marker" style="position:absolute;top:0;bottom:0;width:2px;background:var(--accent2);opacity:.8"></div>
            <div id="tl-lanes"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  renderControls(document.getElementById('tl-controls'));
  drawTimeline();

  // Header mit Inhalt synchron scrollen
  const header = document.querySelector('.tl2-header');
  const scroll = document.getElementById('tl-scroll');
  header.scrollLeft = 0;
  scroll.addEventListener('scroll', ()=>{
    header.scrollLeft = scroll.scrollLeft;
  });

  // Bei Fenster-Resize ggf. Fit beibehalten, wenn Breite kleiner wurde
  let resizeTimer = null;
  window.addEventListener('resize', ()=>{
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(()=> drawTimeline(), 100);
  }, { passive:true });
}
