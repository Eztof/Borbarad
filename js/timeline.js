import { supabase } from './supabaseClient.js';
import { section, empty, modal } from './components.js';
import { AV_MONTHS, avToDayNumber, dayNumberToAv } from './utils.js';
import { state } from './state.js';

/* ===========================================================
   Zeitstrahl mit Zoom/Scroll + Segment-Linien
   =========================================================== */

const PX_PER_MONTH_BASE = 120; // Basisbreite eines Aventurischen Monats bei Zoom 1
let zoom = 1;                  // Zoomfaktor (wird mit Buttons verändert)

let range = null;              // { startMonth:{y,m}, endMonth:{y,m}, startDayNum, endDayNum }
let segments = null;           // { story:[], nscs:[], objects:[] } (berechnete Segmente mit Layout)

function monthKey(y, m){ return `${y}-${m}`; }
function cmpMonth(a,b){ if (a.year!==b.year) return a.year-b.year; return a.month-b.month; }
function prevMonth({year,month}){ return monthWrap(year, month-1); }
function nextMonth({year,month}){ return monthWrap(year, month+1); }
function monthWrap(y,m){ if (m<1) return {year:y-1, month:12}; if (m>12) return {year:y+1, month:1}; return {year:y, month:m}; }

function monthsDiff(a,b){ // inclusive distance in months from a to b: Jan..Jan => 0
  return (b.year - a.year)*12 + (b.month - a.month);
}
function monthsBetweenInclusive(a,b){ // array of month objects inclusive
  const out = [];
  let cur = {year:a.year, month:a.month};
  while (cmpMonth(cur,b) <= 0){
    out.push({year:cur.year, month:cur.month});
    cur = nextMonth(cur);
  }
  return out;
}

function clampSegDays(startDay, endDay){
  // Sicherheit: keine negativen Längen
  if (endDay < startDay) return { startDay, endDay: startDay };
  return { startDay, endDay };
}

function computeRange(allSegs){
  if (!allSegs.length){
    // Fallback: Kampagnenjahr als Range
    const y = state.campaignDate?.year || 1027;
    const startDayNum = avToDayNumber({year:y, month:1, day:1});
    const endDayNum   = avToDayNumber({year:y, month:12, day:30});
    return {
      startMonth: {year:y, month:1},
      endMonth: {year:y, month:12},
      startDayNum, endDayNum
    };
  }
  let minDay = Infinity, maxDay = -Infinity;
  for (const s of allSegs){
    minDay = Math.min(minDay, s.startDay);
    maxDay = Math.max(maxDay, s.endDay);
  }
  // an Monatsgrenzen ausrichten
  const minAv = dayNumberToAv(minDay);
  const maxAv = dayNumberToAv(maxDay);
  const startMonth = { year: minAv.year, month: minAv.month };
  const endMonth   = { year: maxAv.year, month: maxAv.month };
  const startDayNum = avToDayNumber({year:startMonth.year, month:startMonth.month, day:1});
  const endDayNum   = avToDayNumber({year:endMonth.year, month:endMonth.month, day:30});
  return { startMonth, endMonth, startDayNum, endDayNum };
}

function pxPerMonth(){ return PX_PER_MONTH_BASE * zoom; }

/* Mappt einen aventurischen Tag (als "fortlaufende Zahl") auf Pixel innerhalb der Range */
function dayToX(dayNum){
  const start = range.startDayNum;
  const months = monthsDiff(range.startMonth, dayNumberToAv(dayNum));
  const withinMonthDays = (dayNumberToAv(dayNum).day - 1); // 0..29
  const x = months * pxPerMonth() + (withinMonthDays/30) * pxPerMonth();
  return x;
}

function daySpanToWidth(startDay, endDay){
  const dx = dayToX(endDay) - dayToX(startDay);
  return Math.max(6, dx); // min 6px sichtbare Breite
}

/* Greedy-Layout: ordnet Segmente zeilenweise an, um Überlappungen zu vermeiden */
function layoutRows(items){
  // Sort by start
  const arr = [...items].sort((a,b)=> a.startDay - b.startDay || a.endDay - b.endDay);
  const rows = []; // rowEnds: letzte belegte endDay je Zeile
  for (const s of arr){
    let placed = false;
    for (let r=0; r<rows.length; r++){
      if (s.startDay > rows[r]){ // passt in diese Zeile (strikt nach Ende)
        s.row = r;
        rows[r] = s.endDay;
        placed = true;
        break;
      }
    }
    if (!placed){
      s.row = rows.length;
      rows.push(s.endDay);
    }
  }
  const rowCount = rows.length || 1;
  return { items: arr, rowCount };
}

/* --------- Datenaufbereitung zu Segmenten --------- */
async function collectSegments(){
  const [evRes, nscRes, objRes] = await Promise.all([
    supabase.from('events').select('id,title,av_date,av_date_end,type,description,location'),
    supabase.from('nscs').select('id,name,first_encounter,last_encounter,is_active,whereabouts,biography'),
    supabase.from('objects').select('id,name,first_seen,last_seen,is_active,location,description')
  ]);

  const all = { story:[], nscs:[], objects:[] };
  const allFlat = [];

  // Events -> Segmente
  (evRes.data||[]).forEach(e=>{
    if (!e.av_date) return;
    const sDay = avToDayNumber(e.av_date);
    const eDay = e.av_date_end ? avToDayNumber(e.av_date_end) : sDay;
    const { startDay, endDay } = clampSegDays(sDay, eDay);
    const seg = {
      kind: 'story',
      label: e.title || 'Ereignis',
      startDay, endDay,
      meta: { ...e }
    };
    all.story.push(seg);
    allFlat.push(seg);
  });

  // NSCs -> Segmente von first_encounter bis last (aktiv -> Kampagnen-Datum)
  (nscRes.data||[]).forEach(n=>{
    if (!n.first_encounter) return;
    const sDay = avToDayNumber(n.first_encounter);
    const last = n.is_active ? state.campaignDate : n.last_encounter;
    const eDay = last ? avToDayNumber(last) : sDay;
    const { startDay, endDay } = clampSegDays(sDay, eDay);
    const seg = {
      kind: 'nsc',
      label: n.name,
      startDay, endDay,
      meta: { ...n }
    };
    all.nscs.push(seg);
    allFlat.push(seg);
  });

  // Objekte -> Segmente von first_seen bis last (aktiv -> Kampagnen-Datum)
  (objRes.data||[]).forEach(o=>{
    if (!o.first_seen) return;
    const sDay = avToDayNumber(o.first_seen);
    const last = o.is_active ? state.campaignDate : o.last_seen;
    const eDay = last ? avToDayNumber(last) : sDay;
    const { startDay, endDay } = clampSegDays(sDay, eDay);
    const seg = {
      kind: 'obj',
      label: o.name,
      startDay, endDay,
      meta: { ...o }
    };
    all.objects.push(seg);
    allFlat.push(seg);
  });

  // Range berechnen
  range = computeRange(allFlat);

  // Layout je Lane
  const layStory  = layoutRows(all.story);
  const layNSCs   = layoutRows(all.nscs);
  const layObjs   = layoutRows(all.objects);

  return {
    story:  layStory,
    nscs:   layNSCs,
    objects:layObjs
  };
}

/* --------- Rendering --------- */

function renderScale(scaleEl){
  // Monate von range.startMonth .. range.endMonth
  const months = monthsBetweenInclusive(range.startMonth, range.endMonth);
  const w = months.length * pxPerMonth();
  scaleEl.style.width = `${w}px`;
  scaleEl.innerHTML = months.map(m => `
    <div class="tl-scale-cell" style="width:${pxPerMonth()}px">
      <div class="tl-scale-month">${AV_MONTHS[m.month-1]}</div>
      <div class="tl-scale-year">${m.year} BF</div>
    </div>
  `).join('');
  return w;
}

function segHtml(s, rowHeight){
  const left = dayToX(s.startDay);
  const width = daySpanToWidth(s.startDay, s.endDay);
  const top = 8 + s.row * rowHeight; // 8px Padding oben
  const cls = s.kind === 'nsc' ? 'seg-nsc' : s.kind === 'obj' ? 'seg-obj' : 'seg-story';
  const title = s.label.replace(/"/g,'&quot;');
  return `
    <div class="seg ${cls}" 
         style="left:${left}px;width:${width}px;top:${top}px"
         data-kind="${s.kind}" 
         data-meta='${encodeURIComponent(JSON.stringify(s.meta))}'
         title="${title}">
      <div class="seg-label">${title}</div>
    </div>
  `;
}

function laneHtml(title, layout, laneClass){
  const rowHeight = 22; // px
  const rows = Math.max(1, layout.rowCount);
  const trackHeight = rows*rowHeight + 16; // + padding
  const segs = layout.items.map(s => segHtml(s, rowHeight)).join('');
  return `
    <div class="lane">
      <div class="lane-title">${title}</div>
      <div class="lane-track ${laneClass}" style="height:${trackHeight}px">
        ${segs || ''}
      </div>
    </div>
  `;
}

function attachSegClicks(container){
  container.querySelectorAll('.seg').forEach(el=>{
    el.addEventListener('click', ()=>{
      const kind = el.getAttribute('data-kind');
      const meta = JSON.parse(decodeURIComponent(el.getAttribute('data-meta')));
      showSegModal(kind, meta);
    });
  });
}

function showSegModal(kind, meta){
  // Minimale Info je nach Typ
  let title = '';
  let body = '';
  if (kind === 'nsc'){
    title = meta.name;
    body = `
      <div class="small">Status: ${meta.is_active ? 'Aktiv (nutzt aktuelles Kampagnen-Datum)' : 'Inaktiv'}</div>
      ${meta.whereabouts ? `<p><strong>Verbleib:</strong> ${meta.whereabouts}</p>` : ''}
      ${meta.biography ? `<p style="white-space:pre-wrap">${meta.biography}</p>` : ''}
    `;
  }else if (kind === 'obj'){
    title = meta.name;
    body = `
      <div class="small">Status: ${meta.is_active ? 'Aktiv (im Besitz / in Nutzung)' : 'Inaktiv'}</div>
      ${meta.location ? `<p><strong>Ort:</strong> ${meta.location}</p>` : ''}
      ${meta.description ? `<p style="white-space:pre-wrap">${meta.description}</p>` : ''}
    `;
  }else{
    title = meta.title || 'Ereignis';
    body = `
      ${meta.type ? `<div class="small">Typ: ${meta.type}</div>` : ''}
      ${meta.location ? `<p><strong>Ort:</strong> ${meta.location}</p>` : ''}
      ${meta.description ? `<p style="white-space:pre-wrap">${meta.description}</p>` : ''}
    `;
  }
  const root = modal(`
    <h3 style="margin:0 0 8px 0">${title}</h3>
    ${body || '<div class="small">Keine weiteren Details.</div>'}
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
      <button class="btn secondary" id="seg-close">Schließen</button>
    </div>
  `);
  root.querySelector('#seg-close').onclick = ()=> root.innerHTML='';
}

function syncScroll(headerEl, scrollEl){
  scrollEl.addEventListener('scroll', ()=>{ headerEl.scrollLeft = scrollEl.scrollLeft; });
}

function renderControls(container){
  container.innerHTML = `
    <div class="tl-controls">
      <div class="tl-zoom">
        <button class="btn secondary" id="tl-zoom-out">–</button>
        <button class="btn secondary" id="tl-zoom-in">+</button>
        <button class="btn secondary" id="tl-zoom-fit">Fit</button>
      </div>
    </div>
  `;
  container.querySelector('#tl-zoom-in').onclick = ()=>{ zoom = Math.min(3, +(zoom*1.25).toFixed(3)); renderTimeline(); };
  container.querySelector('#tl-zoom-out').onclick = ()=>{ zoom = Math.max(0.4, +(zoom/1.25).toFixed(3)); renderTimeline(); };
  container.querySelector('#tl-zoom-fit').onclick = ()=>{
    // Fit: Versuch, die volle Range ungefähr in den sichtbaren Bereich zu bringen
    const wrap = document.getElementById('tl-scroll');
    if (!wrap) return;
    const monthsCount = monthsBetweenInclusive(range.startMonth, range.endMonth).length;
    // Ziel: Gesamte Breite ~ 1.2 * wrap.clientWidth
    const targetPxPerMonth = Math.max(60, Math.min(200, (wrap.clientWidth*1.2)/monthsCount));
    zoom = +(targetPxPerMonth / PX_PER_MONTH_BASE).toFixed(3);
    renderTimeline();
  };
}

export async function renderTimeline(){
  // Daten holen + vorbereiten
  const lay = await collectSegments();
  segments = lay; // merken

  // Grundgerüst rendern
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="card">
      ${section('Kampagnen-Zeitstrahl (Zoom & Scroll)')}
      <div id="tl-controls-host"></div>
      <div class="timeline2">
        <div class="tl2-header">
          <div class="tl-scale" id="tl-scale"></div>
        </div>
        <div class="tl2-scroll" id="tl-scroll">
          <div class="tl-canvas" id="tl-canvas">
            <div id="tl-lanes"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  renderControls(document.getElementById('tl-controls-host'));

  // Skala + Breite setzen
  const scaleEl = document.getElementById('tl-scale');
  const totalWidth = renderScale(scaleEl);

  // Lanes
  const lanesEl = document.getElementById('tl-lanes');
  lanesEl.innerHTML = [
    laneHtml('Story',  segments.story,  'track-story'),
    laneHtml('NSCs',   segments.nscs,   'track-nsc'),
    laneHtml('Objekte',segments.objects,'track-obj')
  ].join('');

  // Canvas-Breite
  const canvasEl = document.getElementById('tl-canvas');
  canvasEl.style.width = `${totalWidth}px`;

  // Scroll-Sync
  const header = scaleEl.parentElement; // .tl2-header (mit overflow hidden)
  const scroll = document.getElementById('tl-scroll');
  syncScroll(header, scroll);

  // Klicks auf Segmente
  attachSegClicks(lanesEl);
}
