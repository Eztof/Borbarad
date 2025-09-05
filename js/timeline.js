// js/timeline.js
// Bildschirmfreundlicher Aventurien-Zeitstrahl mit Auto-Fit, Zeitfenster, Zoom, Scroll & Filtern

import { supabase } from './supabaseClient.js';
import { section, empty, modal } from './components.js';
import {
  AV_MONTHS,
  avToDayNumber,
  dayNumberToAv,
  formatAvDate,
  htmlesc
} from './utils.js';
import { state } from './state.js';

/* =========================
   Persistente Einstellungen
   ========================= */
const LS_KEY = 'timeline.settings.v3';
function loadSettings() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; }
}
function saveSettings(s) { localStorage.setItem(LS_KEY, JSON.stringify(s)); }

let SETTINGS = Object.assign({
  pxPerDay: 12,                      // nur relevant, wenn autoFit=false
  autoFit: true,                     // << Standard: Timeline passt sich Kartenbreite an
  window: '12m',                     // '3m' | '6m' | '12m' | 'all'
  showGroups: { story:true, nsc:true, object:true },
  compactLabels: true
}, loadSettings() || {});

/* ==============
   Konstanten
   ============== */
const clamp = (v, a, b)=> Math.max(a, Math.min(b, v));
const PX_MIN = 4, PX_MAX = 60;
const ROW_H = 18, ROW_GAP = 6, TRACK_PAD = 8;  // Segment-Layout

/* ==============
   Daten laden
   ============== */
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

/* ======================
   Segmente bauen
   ====================== */
let CACHED_SEGMENTS = [];

function buildSegments({ events, nscs, objects }){
  const cur = state.campaignDate || {year:1027, month:1, day:1};
  const curDN = avToDayNumber(cur);
  const segs = [];

  // Story
  for (const e of events){
    if (!e.av_date) continue;
    const s = avToDayNumber(e.av_date);
    const eEnd = e.av_date_end ? avToDayNumber(e.av_date_end) : s;
    segs.push({
      id: e.id, kind:'story', label: e.title,
      start: Math.min(s, eEnd), end: Math.max(s, eEnd) + 1, // +1 = minimale sichtbare Länge
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
      start: Math.min(s, eDN), end: Math.max(s, eDN) + 1,
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
      start: Math.min(s, eDN), end: Math.max(s, eDN) + 1,
      meta: o
    });
  }

  return segs;
}

/* =======================
   Zeitbereich bestimmen
   ======================= */
function totalRange(segs){
  let min = Infinity, max = -Infinity;
  for (const s of segs){ if (s.start < min) min = s.start; if (s.end > max) max = s.end; }
  if (!isFinite(min)) {
    const dn = avToDayNumber(state.campaignDate || {year:1027,month:1,day:1});
    return { start: dn - 45, end: dn + 45 }; // 3 Monate Fallback
  }
  return { start: min - 15, end: max + 15 }; // 1/2 Monat Rand
}

function rangeFromWindow(mode){
  const cur = state.campaignDate || {year:1027,month:1,day:1};
  const c = avToDayNumber(cur);
  const map = { '3m':90, '6m':180, '12m':360 };
  const days = map[mode] || 180;
  return { start: c - Math.floor(days/2), end: c + Math.ceil(days/2) };
}

/* =======================
   Reihen-Pack-Layout
   ======================= */
function packByRows(items){
  const list = [...items].sort((a,b)=> a.start - b.start || a.end - b.end);
  const rows = [];       // rows[i] = lastEnd
  const placed = [];

  for (const it of list){
    let rowIdx = rows.findIndex(lastEnd => lastEnd <= it.start);
    if (rowIdx === -1){ rowIdx = rows.length; rows.push(-Infinity); }
    rows[rowIdx] = it.end + 0.25; // kleine Lücke
    placed.push({ ...it, row: rowIdx });
  }
  return { items: placed, rowCount: rows.length || 1 };
}

/* =======================
   Rendering Helpers
   ======================= */
function segClass(kind){ return kind==='nsc' ? 'seg-nsc' : (kind==='object' ? 'seg-object' : 'seg-story'); }
function titleFor(seg){
  const s = formatAvDate(dayNumberToAv(seg.start));
  const e = formatAvDate(dayNumberToAv(seg.end-1));
  if (seg.kind==='story') return `${seg.label}\n${s}${seg.end>seg.start?` – ${e}`:''}`;
  return `${seg.label}\n${s} – ${e}`;
}

let RANGE = null;         // aktueller Anzeigebereich (DayNumbers)
let PPD = SETTINGS.pxPerDay; // aktuelle Pixel/Tag (kann sich bei AutoFit ändern)

/* =======================
   Bedienleiste
   ======================= */
function renderControls(host){
  host.innerHTML = `
    <div class="tl-controls">
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <div class="small">Gruppen:</div>
        <label class="tag"><input type="checkbox" id="tl-f-story" ${SETTINGS.showGroups.story?'checked':''}/> Story</label>
        <label class="tag"><input type="checkbox" id="tl-f-nsc" ${SETTINGS.showGroups.nsc?'checked':''}/> NSCs</label>
        <label class="tag"><input type="checkbox" id="tl-f-obj" ${SETTINGS.showGroups.object?'checked':''}/> Objekte</label>

        <span style="width:1px;height:20px;background:var(--line-soft);margin:0 4px"></span>

        <div class="small">Zeitfenster:</div>
        <select id="tl-window" class="input" style="width:140px;height:34px;padding:0 8px">
          <option value="3m"  ${SETTINGS.window==='3m'?'selected':''}>3 Monate</option>
          <option value="6m"  ${SETTINGS.window==='6m'?'selected':''}>6 Monate</option>
          <option value="12m" ${SETTINGS.window==='12m'?'selected':''}>12 Monate</option>
          <option value="all" ${SETTINGS.window==='all'?'selected':''}>Gesamt</option>
        </select>

        <label class="tag"><input type="checkbox" id="tl-autofit" ${SETTINGS.autoFit?'checked':''}/> Auto-Fit</label>

        <span style="width:1px;height:20px;background:var(--line-soft);margin:0 4px"></span>

        <div class="small">Zoom:</div>
        <button class="btn secondary" id="tl-zoom-out" title="Zoom out">–</button>
        <input id="tl-zoom-range" type="range" min="${PX_MIN}" max="${PX_MAX}" value="${SETTINGS.pxPerDay}" style="width:160px">
        <button class="btn secondary" id="tl-zoom-in" title="Zoom in">+</button>

        <button class="btn secondary" id="tl-fit" title="An Kartenbreite anpassen">Fit</button>
        <button class="btn secondary" id="tl-today" title="Heute (Kampagnendatum)">Heute</button>

        <span style="width:1px;height:20px;background:var(--line-soft);margin:0 4px"></span>
        <label class="tag"><input type="checkbox" id="tl-compact" ${SETTINGS.compactLabels?'checked':''}/> kompakt</label>
      </div>
    </div>
  `;

  const apply = ()=>{ saveSettings(SETTINGS); drawTimeline(true); };
  const zoomRange = host.querySelector('#tl-zoom-range');
  const setZoomEnabled = (on)=>{ zoomRange.disabled = !on; host.querySelector('#tl-zoom-in').disabled = !on; host.querySelector('#tl-zoom-out').disabled = !on; };
  setZoomEnabled(!SETTINGS.autoFit);

  host.querySelector('#tl-f-story').onchange = (e)=>{ SETTINGS.showGroups.story = e.target.checked; apply(); };
  host.querySelector('#tl-f-nsc').onchange   = (e)=>{ SETTINGS.showGroups.nsc   = e.target.checked; apply(); };
  host.querySelector('#tl-f-obj').onchange   = (e)=>{ SETTINGS.showGroups.object= e.target.checked; apply(); };

  host.querySelector('#tl-window').onchange  = (e)=>{ SETTINGS.window = e.target.value; apply(); };
  host.querySelector('#tl-autofit').onchange = (e)=>{ SETTINGS.autoFit = e.target.checked; setZoomEnabled(!SETTINGS.autoFit); apply(); };
  host.querySelector('#tl-compact').onchange = (e)=>{ SETTINGS.compactLabels = e.target.checked; apply(); };

  host.querySelector('#tl-zoom-in').onclick  = ()=>{ SETTINGS.pxPerDay = clamp(SETTINGS.pxPerDay*1.2, PX_MIN, PX_MAX); zoomRange.value = SETTINGS.pxPerDay; apply(); };
  host.querySelector('#tl-zoom-out').onclick = ()=>{ SETTINGS.pxPerDay = clamp(SETTINGS.pxPerDay/1.2, PX_MIN, PX_MAX); zoomRange.value = SETTINGS.pxPerDay; apply(); };
  zoomRange.oninput = (e)=>{ SETTINGS.pxPerDay = clamp(+e.target.value, PX_MIN, PX_MAX); apply(); };

  host.querySelector('#tl-fit').onclick   = ()=>{ SETTINGS.autoFit = true; setZoomEnabled(false); apply(); };
  host.querySelector('#tl-today').onclick = ()=>{ scrollToDay(avToDayNumber(state.campaignDate||{year:1027,month:1,day:1})); };
}

/* =======================
   Zeichnen
   ======================= */
function computeDisplayRange(activeSegs){
  if (SETTINGS.window === 'all') return totalRange(activeSegs);
  return rangeFromWindow(SETTINGS.window);
}

function renderScale(months){
  const scale = document.getElementById('tl-scale');
  scale.innerHTML = months.map(m => {
    const w = 30 * PPD;
    const label = `${AV_MONTHS[m.month-1]} ${m.year} BF`;
    return `<div class="tl-scale-cell" style="min-width:${w}px;width:${w}px">
      <div class="tl-scale-month">${htmlesc(label)}</div>
    </div>`;
  }).join('');
}

function buildMonths(range){
  const first = Math.floor(range.start / 30);
  const last  = Math.floor((range.end-1) / 30);
  const out = [];
  for (let m=first; m<=last; m++){
    const y = Math.floor(m/12);
    const mo = (m%12)+1;
    out.push({ year:y, month:mo });
  }
  return out;
}

function packAndRenderLane(title, items){
  const track = document.createElement('div');
  track.className = 'lane';
  track.innerHTML = `
    <div class="lane-title">${htmlesc(title)}</div>
    <div class="lane-track"><div class="track-body"></div></div>
  `;
  const body = track.querySelector('.track-body');

  // Nur Items rendern, die im Range sichtbar sind (Clipping)
  const clipped = items
    .map(s => ({
      ...s,
      start: Math.max(s.start, RANGE.start),
      end:   Math.min(s.end,   RANGE.end)
    }))
    .filter(s => s.end > s.start);

  // Reihen packen
  const { items: placed, rowCount } = packByRows(clipped);
  track.querySelector('.lane-track').style.height =
    `${Math.max(ROW_H*rowCount + ROW_GAP*(rowCount-1) + TRACK_PAD*2, 40)}px`;

  for (const it of placed){
    const left  = (it.start - RANGE.start) * PPD;
    const width = Math.max(1, (it.end - it.start) * PPD);
    const top   = TRACK_PAD + it.row*(ROW_H+ROW_GAP);

    const div = document.createElement('div');
    div.className = `seg ${segClass(it.kind)} ${SETTINGS.compactLabels?'compact':''}`;
    div.style.left = `${left}px`;
    div.style.width = `${width}px`;
    div.style.top = `${top}px`;
    div.title = titleFor(it);

    const lab = document.createElement('div');
    lab.className = 'seg-label';
    lab.textContent = it.label;
    div.appendChild(lab);

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

function drawTimeline(reuseScroll=false){
  // Aktive Gruppen filtern
  const active = CACHED_SEGMENTS.filter(s => SETTINGS.showGroups[s.kind]);

  // Range bestimmen
  RANGE = computeDisplayRange(active);

  // Pixel/Tag bestimmen
  const scrollWrap = document.getElementById('tl-scroll');
  if (SETTINGS.autoFit){
    const innerW = Math.max(320, scrollWrap.clientWidth - 16); // etwas Luft
    const totalDays = Math.max(1, RANGE.end - RANGE.start);
    PPD = clamp(innerW / totalDays, PX_MIN, PX_MAX);
  } else {
    PPD = clamp(SETTINGS.pxPerDay, PX_MIN, PX_MAX);
  }

  // Skala & Breiten
  const months = buildMonths(RANGE);
  renderScale(months);

  const canvasWidth = Math.max(1, Math.ceil((RANGE.end - RANGE.start) * PPD));
  const scaleEl = document.getElementById('tl-scale');
  const lanesEl = document.getElementById('tl-lanes');
  const canvas  = document.getElementById('tl-canvas');

  // Scroll-Position merken
  const prevScroll = reuseScroll ? scrollWrap.scrollLeft : 0;

  lanesEl.innerHTML = '';
  scaleEl.style.width = `${canvasWidth}px`;
  canvas.style.width  = `${canvasWidth}px`;

  // Lanes aufbauen
  const story = active.filter(s=> s.kind==='story');
  const nscs  = active.filter(s=> s.kind==='nsc');
  const objs  = active.filter(s=> s.kind==='object');

  lanesEl.appendChild(packAndRenderLane('Story',   story));
  lanesEl.appendChild(packAndRenderLane('NSCs',    nscs));
  lanesEl.appendChild(packAndRenderLane('Objekte', objs));

  // Heute-Marker (Kampagnendatum)
  const cur = state.campaignDate || {year:1027,month:1,day:1};
  const curX = (avToDayNumber(cur) - RANGE.start) * PPD;
  const marker = document.getElementById('tl-today-marker');
  marker.style.left = `${clamp(curX, 0, canvasWidth)}px`;

  // Scroll-Sync Header
  const header = document.querySelector('.tl2-header');
  header.scrollLeft = scrollWrap.scrollLeft;

  // ggf. vorherige Scrollposition behalten
  if (reuseScroll) scrollWrap.scrollLeft = prevScroll;
}

function scrollToDay(dayNumber){
  const wrap = document.getElementById('tl-scroll');
  const totalW = (RANGE.end - RANGE.start)*PPD;
  const targetX = (dayNumber - RANGE.start) * PPD - wrap.clientWidth/2;
  wrap.scrollLeft = clamp(targetX, 0, Math.max(0, totalW - wrap.clientWidth));
}

/* =======================
   Public Render
   ======================= */
export async function renderTimeline(){
  const app = document.getElementById('app');

  // Daten holen & Segmente cachen
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
            <div id="tl-today-marker" style="position:absolute;top:0;bottom:0;width:2px;background:var(--accent2);opacity:.9"></div>
            <div id="tl-lanes"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  renderControls(document.getElementById('tl-controls'));

  // Beim ersten Render direkt Auto-Fit auf das gewählte Zeitfenster
  drawTimeline();

  // Header mit Inhalt synchron scrollen
  const header = document.querySelector('.tl2-header');
  const scroll = document.getElementById('tl-scroll');
  header.scrollLeft = 0;
  scroll.addEventListener('scroll', ()=>{ header.scrollLeft = scroll.scrollLeft; });

  // Neu zeichnen bei Resize (Auto-Fit bleibt aktiv)
  let t=null;
  window.addEventListener('resize', ()=>{
    clearTimeout(t); t=setTimeout(()=> drawTimeline(true), 120);
  }, { passive:true });
}
