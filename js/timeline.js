// js/timeline.js
// Eigener Zeitstrahl mit horizontalem In-Component-Scroll (kein Browser-Scroll).
import { supabase } from './supabaseClient.js';
import { state } from './state.js';
import { section, empty, modal } from './components.js';
import { AV_MONTHS, htmlesc } from './utils.js';

/* -------------------------------
   Daten sammeln und Aufbereiten
--------------------------------*/
function normalizeAv(av){
  if (!av || av.year==null || av.month==null || av.day==null) return null;
  return { year:Number(av.year), month:Number(av.month), day:Number(av.day) };
}
function avToDay({year,month,day}){ return year*360 + (month-1)*30 + (day-1); }
function maxDay(a,b){ return avToDay(a) > avToDay(b) ? a : b; }

async function fetchSegments(){
  const [evRes, nscRes, objRes] = await Promise.all([
    supabase.from('events').select('id,title,type,description,av_date,av_date_end,location,related_nsc_id,related_object_id'),
    supabase.from('nscs').select('id,name,biography,whereabouts,first_encounter,last_encounter,is_active'),
    supabase.from('objects').select('id,name,description,location,first_seen,last_seen,is_active'),
  ]);

  const today = state.campaignDate || {year:1027,month:1,day:1};

  const segs = [];

  // Story-Events
  (evRes.data||[]).forEach(e=>{
    const start = normalizeAv(e.av_date);
    const end   = normalizeAv(e.av_date_end) || start;
    if (!start) return;
    segs.push({
      id:e.id, kind:'story',
      label:e.title || 'Ereignis',
      start, end,
      meta:{ title:e.title, type:e.type, description:e.description, location:e.location }
    });
  });

  // NSCs
  (nscRes.data||[]).forEach(n=>{
    const fs = normalizeAv(n.first_encounter);
    if (!fs) return;
    const last = normalizeAv(n.last_encounter);
    const end  = (n.is_active===false && last) ? last : (last || today);
    segs.push({
      id:n.id, kind:'nsc',
      label:n.name || 'NSC',
      start:fs, end,
      meta:{ name:n.name, biography:n.biography, whereabouts:n.whereabouts }
    });
  });

  // Objekte
  (objRes.data||[]).forEach(o=>{
    const fs = normalizeAv(o.first_seen);
    if (!fs) return;
    const last = normalizeAv(o.last_seen);
    const end  = (o.is_active===false && last) ? last : (last || today);
    segs.push({
      id:o.id, kind:'object',
      label:o.name || 'Objekt',
      start:fs, end,
      meta:{ name:o.name, description:o.description, location:o.location }
    });
  });

  return segs;
}

/* -------------------------------
   Layout / Rendering
--------------------------------*/
const SETTINGS = {
  showGroups:{ story:true, nscs:true, objects:true },
  windowMonths: 12,     // 3,6,12,24 oder 'all'
  autoFit: true,
  compactLabels: true,
};

let CACHED_SEGMENTS = [];
let RANGE = { start: {year:1026,month:1,day:1}, end: {year:1028,month:1,day:1} };
let PPD = 8;            // Pixel pro Aventurischem Tag (wird dynamisch gesetzt)
const PX_MIN = 0.2;     // Min/Max Zoom-Schranken
const PX_MAX = 20;

function dayDiff(a,b){ return avToDay(b) - avToDay(a); }
function addDays(av, plus){
  const n = avToDay(av) + plus;
  const year = Math.floor(n/360);
  const m = Math.floor((n%360)/30)+1;
  const d = (n%30)+1;
  return {year,month:m,day:d};
}

function computeDisplayRange(activeSegs){
  // Auto-Fit: kleinster bis größter Tag (mit etwas Puffer)
  if (SETTINGS.autoFit || SETTINGS.windowMonths==='all'){
    if (!activeSegs.length) return RANGE;
    let start = activeSegs[0].start;
    let end   = activeSegs[0].end || activeSegs[0].start;
    for (const s of activeSegs){
      if (avToDay(s.start) < avToDay(start)) start = s.start;
      const e = s.end || s.start;
      if (avToDay(e) > avToDay(end)) end = e;
    }
    // 1 Monat Puffer an beiden Enden
    start = addDays(start, -30);
    end   = addDays(end,   30);
    return { start, end };
  }

  // Fester Zeitraum: um "heute" herum
  const m = Number(SETTINGS.windowMonths) || 12;
  const mid = state.campaignDate || {year:1027,month:1,day:1};
  const half = Math.round((m*30)/2);
  return { start: addDays(mid,-half), end: addDays(mid,half) };
}

function pxPerDayFor(containerWidth, start, end){
  const totalDays = Math.max(1, dayDiff(start,end));
  return Math.min(PX_MAX, Math.max(PX_MIN, (containerWidth-16)/totalDays));
}

function drawScale(scaleEl){
  const totalDays = Math.max(1, dayDiff(RANGE.start, RANGE.end));
  const width = Math.ceil(totalDays * PPD);

  // Breite hart setzen, damit NUR der interne Scroller horizontal wird
  scaleEl.style.width = `${width}px`;
  scaleEl.innerHTML = '';

  // Monate zwischen Start und Ende erzeugen
  let cur = { ...RANGE.start };
  let lastYear = null;
  while (avToDay(cur) < avToDay(RANGE.end)){
    const monthStart = { ...cur };
    const monthEnd   = addDays(monthStart, 30);
    const left  = Math.floor(dayDiff(RANGE.start, monthStart) * PPD);
    const w     = Math.ceil(dayDiff(monthStart, monthEnd) * PPD);

    const cell = document.createElement('div');
    cell.className = 'tl-scale-cell';
    cell.style.left = `${left}px`;
    cell.style.width = `${w}px`;
    cell.style.position = 'relative';
    cell.innerHTML = `
      <div class="tl-scale-month">${AV_MONTHS[monthStart.month-1]} ${monthStart.year} BF</div>
    `;
    scaleEl.appendChild(cell);

    cur = monthEnd;
    lastYear = monthStart.year;
  }
}

function segClass(kind){
  if (kind==='nsc') return 'seg nsc';
  if (kind==='object') return 'seg object';
  return 'seg story';
}
function titleFor(s){
  const a = `${s.start.day}. ${AV_MONTHS[s.start.month-1]} ${s.start.year} BF`;
  const b = `${s.end.day}. ${AV_MONTHS[s.end.month-1]} ${s.end.year} BF`;
  return `${s.label} (${a} – ${b})`;
}

function placeSegmentsInto(trackEl, items){
  // Zeilen-Beladung (verhindert Überlappung)
  const placed = [];
  const rows = [];

  function fits(row, seg){
    for (const it of row){
      const a1 = avToDay(seg.start), a2 = avToDay(seg.end);
      const b1 = avToDay(it.start),  b2 = avToDay(it.end);
      if (!(a2 < b1 || a1 > b2)) return false; // Kollision
    }
    return true;
  }

  for (const it of items){
    let put = false;
    for (const row of rows){ if (fits(row,it)){ row.push(it); put=true; break; } }
    if (!put){ rows.push([it]); }
    placed.push(it);
  }

  const ROW_H = 18, ROW_GAP = 6, PAD = 10;
  const totalRows = rows.length || 1;
  trackEl.style.height = `${Math.max(totalRows*ROW_H + (totalRows-1)*ROW_GAP + PAD*2, 40)}px`;

  for (let r=0;r<rows.length;r++){
    for (const it of rows[r]){
      const left  = Math.max(0, Math.floor(dayDiff(RANGE.start, it.start) * PPD));
      const width = Math.max(1, Math.ceil(dayDiff(it.start, it.end) * PPD));
      const top   = PAD + r*(ROW_H+ROW_GAP);

      const div = document.createElement('div');
      div.className = `${segClass(it.kind)} ${SETTINGS.compactLabels?'compact':''}`;
      div.style.left = `${left}px`;
      div.style.width = `${width}px`;
      div.style.top   = `${top}px`;
      div.title = titleFor(it);

      const lab = document.createElement('div');
      lab.className = 'seg-label';
      lab.textContent = it.label;
      div.appendChild(lab);

      div.addEventListener('click', ()=>openDetails(it));
      trackEl.appendChild(div);
    }
  }
}

async function openDetails(seg){
  const m = seg.meta || {};
  let title = seg.label;
  let html = '';
  if (seg.kind==='nsc'){
    html += m.whereabouts ? `<p><strong>Verbleib:</strong> ${htmlesc(m.whereabouts)}</p>` : '';
    html += m.biography ? `<p style="white-space:pre-wrap">${htmlesc(m.biography)}</p>` : '';
  }else if (seg.kind==='object'){
    html += m.location ? `<p><strong>Ort:</strong> ${htmlesc(m.location)}</p>` : '';
    html += m.description ? `<p style="white-space:pre-wrap">${htmlesc(m.description)}</p>` : '';
  }else{
    html += m.type ? `<div class="small">Typ: ${htmlesc(m.type)}</div>` : '';
    html += m.location ? `<p><strong>Ort:</strong> ${htmlesc(m.location)}</p>` : '';
    html += m.description ? `<p style="white-space:pre-wrap">${htmlesc(m.description)}</p>` : '';
  }
  const root = modal(`
    <h3 style="margin:0 0 8px 0">${htmlesc(title)}</h3>
    ${html || '<div class="small">Keine weiteren Details.</div>'}
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
      <button class="btn secondary" id="seg-close">Schließen</button>
    </div>
  `);
  root.querySelector('#seg-close').onclick = ()=> root.innerHTML='';
}

/* -------------------------------
   Zeichnen
--------------------------------*/
function drawTimeline(reuseScroll=false){
  const active = CACHED_SEGMENTS.filter(s=>{
    if (s.kind==='story')  return SETTINGS.showGroups.story;
    if (s.kind==='nsc')    return SETTINGS.showGroups.nscs;
    if (s.kind==='object') return SETTINGS.showGroups.objects;
    return true;
  });

  // Range + Zoom berechnen
  RANGE = computeDisplayRange(active);

  const scrollWrap = document.getElementById('tl-scroll');
  const prevScroll = reuseScroll ? scrollWrap.scrollLeft : 0;

  // PPD setzen (Auto-Fit nutzt Containerbreite)
  if (SETTINGS.autoFit){
    PPD = pxPerDayFor(scrollWrap.clientWidth, RANGE.start, RANGE.end);
  }

  // Breite Zwangsweise nur innerhalb des Scrollers
  const scaleEl = document.getElementById('tl-scale');
  const lanesEl = document.getElementById('tl-lanes');
  drawScale(scaleEl);

  // Canvas passend breit machen
  const totalDays = Math.max(1, dayDiff(RANGE.start, RANGE.end));
  const canvasW = Math.ceil(totalDays * PPD);
  document.getElementById('tl-canvas').style.width = `${canvasW}px`;

  // Lanes rendern
  lanesEl.innerHTML = '';
  const groups = [
    { key:'story',   title:'Story',   items: active.filter(s=>s.kind==='story') },
    { key:'nscs',    title:'NSCs',    items: active.filter(s=>s.kind==='nsc') },
    { key:'objects', title:'Objekte', items: active.filter(s=>s.kind==='object') },
  ];

  for (const g of groups){
    const lane = document.createElement('div');
    lane.className = 'lane';
    lane.innerHTML = `<div class="lane-title">${g.title}</div><div class="lane-track"></div>`;
    lanesEl.appendChild(lane);
    placeSegmentsInto(lane.querySelector('.lane-track'), g.items);
  }

  // Heute-Markierung
  const today = state.campaignDate || {year:1027,month:1,day:1};
  const tLeft = Math.max(0, Math.floor(dayDiff(RANGE.start, today) * PPD));
  let todayEl = document.getElementById('tl-today');
  if (!todayEl){ todayEl = document.createElement('div'); todayEl.id='tl-today'; todayEl.className='tl-today'; document.getElementById('tl-canvas').appendChild(todayEl); }
  todayEl.style.left = `${tLeft}px`;

  // Scrollposition beibehalten (falls gewünscht)
  if (reuseScroll) scrollWrap.scrollLeft = prevScroll;
}

/* -------------------------------
   Interaktionen / UI
--------------------------------*/
function mountControls(){
  // Checkboxen
  document.getElementById('chk-story').onchange  = e=>{ SETTINGS.showGroups.story   = e.target.checked; drawTimeline(true); };
  document.getElementById('chk-nscs').onchange   = e=>{ SETTINGS.showGroups.nscs    = e.target.checked; drawTimeline(true); };
  document.getElementById('chk-objects').onchange= e=>{ SETTINGS.showGroups.objects = e.target.checked; drawTimeline(true); };

  // Zeitfenster
  document.getElementById('sel-window').onchange = e=>{
    const v = e.target.value;
    SETTINGS.windowMonths = (v==='all') ? 'all' : Number(v);
    SETTINGS.autoFit = (v==='auto');
    document.getElementById('chk-autofit').checked = SETTINGS.autoFit;
    drawTimeline(false);
  };

  // Auto-Fit
  document.getElementById('chk-autofit').onchange = e=>{
    SETTINGS.autoFit = e.target.checked;
    drawTimeline(false);
  };

  // Fit & Heute
  document.getElementById('btn-fit').onclick = ()=>{ SETTINGS.autoFit = true; document.getElementById('chk-autofit').checked = true; drawTimeline(false); };
  document.getElementById('btn-today').onclick = ()=>{
    SETTINGS.autoFit = false; document.getElementById('chk-autofit').checked = false;
    SETTINGS.windowMonths = 12; document.getElementById('sel-window').value = '12';
    drawTimeline(false);
  };

  // Zoom Slider
  const slider = document.getElementById('zoom-range');
  slider.oninput = ()=>{
    SETTINGS.autoFit = false; document.getElementById('chk-autofit').checked = false;
    PPD = Math.min(PX_MAX, Math.max(PX_MIN, Number(slider.value)));
    drawTimeline(true);
  };

  // Scrolling Verhalten: In-Component horizontal (Mausrad & Drag)
  const wrap = document.getElementById('tl-scroll');

  // Wheel -> horizontal
  wrap.addEventListener('wheel', (e)=>{
    // mit Shift oder mit trackpad-typischem deltaY auch horizontal scrollen
    if (!e.ctrlKey){
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      wrap.scrollLeft += delta;
      e.preventDefault();
    }
  }, { passive:false });

  // Drag to pan
  let isDown=false, startX=0, startLeft=0;
  wrap.addEventListener('mousedown', (e)=>{ isDown=true; startX=e.clientX; startLeft=wrap.scrollLeft; wrap.style.cursor='grabbing'; e.preventDefault(); });
  window.addEventListener('mouseup', ()=>{ isDown=false; wrap.style.cursor='auto'; });
  wrap.addEventListener('mousemove', (e)=>{ if(!isDown) return; const dx=e.clientX-startX; wrap.scrollLeft=startLeft-dx; });

  // Resize -> neu zeichnen
  window.addEventListener('resize', ()=> drawTimeline(true));
}

function controlsHtml(){
  return `
  <div class="tl-controls">
    <div class="group">
      <label><input type="checkbox" id="chk-story" checked> Story</label>
      <label><input type="checkbox" id="chk-nscs" checked> NSCs</label>
      <label><input type="checkbox" id="chk-objects" checked> Objekte</label>
    </div>

    <label>Zeitfenster:
      <select class="input" id="sel-window" style="width:140px">
        <option value="auto" selected>Auto-Fit</option>
        <option value="3">3 Monate</option>
        <option value="6">6 Monate</option>
        <option value="12">12 Monate</option>
        <option value="24">24 Monate</option>
        <option value="all">Gesamt</option>
      </select>
    </label>

    <label style="display:inline-flex;gap:6px;align-items:center">
      <input type="checkbox" id="chk-autofit" checked> Auto-Fit
    </label>

    <div class="sep"></div>

    <div style="display:inline-flex;gap:6px;align-items:center">
      <span class="small">Zoom</span>
      <input id="zoom-range" type="range" min="${PX_MIN}" max="${PX_MAX}" value="${PPD}" step="0.1" style="width:180px">
    </div>

    <button class="btn secondary" id="btn-fit">Fit</button>
    <button class="btn secondary" id="btn-today">Heute</button>
  </div>`;
}

/* -------------------------------
   Public Renderer
--------------------------------*/
export async function renderTimeline(){
  const app = document.getElementById('app');

  // Daten holen
  CACHED_SEGMENTS = await fetchSegments();
  if (!CACHED_SEGMENTS.length){
    app.innerHTML = `<div class="card">${section('Kampagnen-Zeitstrahl (Zoom & Scroll)')}
        ${empty('Noch keine Daten.')}
      </div>`;
    return;
  }

  app.innerHTML = `
    <div class="card">
      ${section('Kampagnen-Zeitstrahl (Zoom & Scroll)')}
      ${controlsHtml()}
      <div class="timeline2">
        <div class="tl2-header"><div id="tl-scale" class="tl-scale"></div></div>
        <div class="tl2-scroll" id="tl-scroll">
          <div id="tl-canvas" class="tl-canvas">
            <div id="tl-lanes"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  mountControls();
  drawTimeline(false);
}
