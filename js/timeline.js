// js/timeline.js
// Einspuriger Zeitstrahl mit eigenem horizontalem Scroll, Row-Pack (kein Überlappen) und scroll-synchroner Monatsskala.

import { supabase } from './supabaseClient.js';
import { state } from './state.js';
import { section, empty, modal } from './components.js';
import { AV_MONTHS, htmlesc } from './utils.js';

/* -------- Hilfen für Aventurische Daten -------- */
function norm(av){ if(!av||av.year==null||av.month==null||av.day==null) return null; return {year:+av.year,month:+av.month,day:+av.day}; }
function dn(av){ return av.year*360+(av.month-1)*30+(av.day-1); }
function addDays(av, d){ const n=dn(av)+d, y=Math.floor(n/360), m=Math.floor((n%360)/30)+1, dd=(n%30)+1; return {year:y,month:m,day:dd}; }
function dayDiff(a,b){ return dn(b)-dn(a); }

/* -------- Einstellungen -------- */
const CFG = {
  show: { story:true, nsc:true, object:true },
  autoFit: true,
  window: '12m', // '3m'|'6m'|'12m'|'24m'|'all'
  compactLabels: true,
};
let PPD = 8;                   // Pixel pro Tag (dynamisch)
const PX_MIN = 0.2, PX_MAX = 24;
const ROW_H = 18, ROW_GAP = 6, PAD = 12;

/* -------- Daten holen und Segmente bauen -------- */
async function getSegments(){
  const [evRes, nscRes, objRes] = await Promise.all([
    supabase.from('events').select('id,title,type,description,av_date,av_date_end,location'),
    supabase.from('nscs').select('id,name,biography,whereabouts,first_encounter,last_encounter,is_active'),
    supabase.from('objects').select('id,name,description,location,first_seen,last_seen,is_active'),
  ]);

  const today = state.campaignDate || {year:1027,month:1,day:1};
  const out = [];

  (evRes.data||[]).forEach(e=>{
    const s = norm(e.av_date); if(!s) return;
    const e2 = norm(e.av_date_end)||s;
    out.push({ id:e.id, kind:'story', label:e.title||'Ereignis', start:s, end:e2, meta:e });
  });

  (nscRes.data||[]).forEach(n=>{
    const s = norm(n.first_encounter); if(!s) return;
    const last = norm(n.last_encounter);
    const e2 = (n.is_active===false && last) ? last : (last||today);
    out.push({ id:n.id, kind:'nsc', label:n.name||'NSC', start:s, end:e2, meta:n });
  });

  (objRes.data||[]).forEach(o=>{
    const s = norm(o.first_seen); if(!s) return;
    const last = norm(o.last_seen);
    const e2 = (o.is_active===false && last) ? last : (last||today);
    out.push({ id:o.id, kind:'object', label:o.name||'Objekt', start:s, end:e2, meta:o });
  });

  return out;
}

/* -------- Bereich & Skala -------- */
let SEGS = [];
let RANGE = { start: {year:1027,month:1,day:1}, end:{year:1027,month:6,day:1} };

function computeRange(list){
  if (CFG.autoFit || CFG.window==='all'){
    if (!list.length) return RANGE;
    let s=list[0].start, e=list[0].end;
    for (const it of list){
      if (dn(it.start)<dn(s)) s=it.start;
      if (dn(it.end)>dn(e)) e=it.end;
    }
    s = addDays(s,-30); e = addDays(e,30);
    return { start:s, end:e };
  }
  const base = state.campaignDate || {year:1027,month:1,day:1};
  const map = { '3m':90, '6m':180, '12m':360, '24m':720 };
  const days = map[CFG.window] || 360;
  const half = Math.floor(days/2);
  return { start:addDays(base,-half), end:addDays(base,half) };
}

function pxPerDayFor(width, start, end){
  const days = Math.max(1, dayDiff(start,end));
  return Math.min(PX_MAX, Math.max(PX_MIN, (width-20)/days));
}

function buildMonths(){
  const first = Math.floor(dn(RANGE.start)/30);
  const last  = Math.floor((dn(RANGE.end)-1)/30);
  const arr=[];
  for(let m=first;m<=last;m++){
    const y=Math.floor(m/12), mo=(m%12)+1;
    arr.push({year:y,month:mo});
  }
  return arr;
}

/* -------- Pack-Layout (keine Überlappungen) -------- */
function packRows(items){
  const list = [...items].sort((a,b)=> dn(a.start)-dn(b.start) || dn(a.end)-dn(b.end));
  const rows = []; // jedes Element ist [{start,end},...]
  const placed = [];

  const collides = (row, seg)=>{
    for(const r of row){
      // überlappt, wenn NICHT (a2 < b1 oder a1 > b2)
      if (!(dn(seg.end) <= dn(r.start) || dn(seg.start) >= dn(r.end))) return true;
    }
    return false;
  };

  for(const it of list){
    let idx = rows.findIndex(row => !collides(row,it));
    if (idx===-1){ idx=rows.length; rows.push([]); }
    rows[idx].push({start:it.start,end:it.end});
    placed.push({...it,row:idx});
  }
  return { items:placed, rows:rows.length||1 };
}

/* -------- Details-Modal -------- */
function segTitle(s){
  const a = `${s.start.day}. ${AV_MONTHS[s.start.month-1]} ${s.start.year} BF`;
  const b = `${s.end.day}. ${AV_MONTHS[s.end.month-1]} ${s.end.year} BF`;
  return `${s.label} (${a} – ${b})`;
}
function openDetails(seg){
  let html='';
  const m = seg.meta||{};
  if (seg.kind==='nsc'){
    if (m.whereabouts) html+=`<p><strong>Verbleib:</strong> ${htmlesc(m.whereabouts)}</p>`;
    if (m.biography)   html+=`<p style="white-space:pre-wrap">${htmlesc(m.biography)}</p>`;
  } else if (seg.kind==='object'){
    if (m.location)    html+=`<p><strong>Ort:</strong> ${htmlesc(m.location)}</p>`;
    if (m.description) html+=`<p style="white-space:pre-wrap">${htmlesc(m.description)}</p>`;
  } else {
    if (m.type)        html+=`<div class="small">Typ: ${htmlesc(m.type)}</div>`;
    if (m.location)    html+=`<p><strong>Ort:</strong> ${htmlesc(m.location)}</p>`;
    if (m.description) html+=`<p style="white-space:pre-wrap">${htmlesc(m.description)}</p>`;
  }
  const root = modal(`
    <h3 style="margin:0 0 8px 0">${htmlesc(segTitle(seg))}</h3>
    ${html || '<div class="small">Keine weiteren Details.</div>'}
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
      <button class="btn secondary" id="dlg-close">Schließen</button>
    </div>
  `);
  root.querySelector('#dlg-close').onclick = ()=> root.innerHTML='';
}

/* -------- Zeichnen -------- */
function renderScale(scaleEl, canvasWidth, scrollLeft=0){
  scaleEl.style.width = `${canvasWidth}px`;
  const months = buildMonths();
  scaleEl.innerHTML = months.map(m=>{
    const w = 30*PPD;
    return `<div class="tl-scale-cell" style="min-width:${w}px;width:${w}px">
      <div class="tl-scale-month">${AV_MONTHS[m.month-1]} ${m.year} BF</div>
    </div>`;
  }).join('');
  // Scroll-Sync (ohne eigenen Scrollbalken)
  scaleEl.style.transform = `translateX(${-scrollLeft}px)`;
}

function drawTimeline(keepScroll=false){
  // Filter
  const active = SEGS.filter(s=> CFG.show[s.kind]);

  // Range
  RANGE = computeRange(active);

  const wrap   = document.getElementById('tl-scroll');
  const scale  = document.getElementById('tl-scale');
  const canvas = document.getElementById('tl-canvas');
  const track  = document.getElementById('tl-track');
  const body   = document.getElementById('tl-body');

  const prevLeft = keepScroll ? wrap.scrollLeft : 0;

  // Pixel/Tag
  if (CFG.autoFit){
    PPD = pxPerDayFor(wrap.clientWidth, RANGE.start, RANGE.end);
    document.getElementById('zoom-range').value = String(PPD);
  }

  const totalDays = Math.max(1, dayDiff(RANGE.start,RANGE.end));
  const canvasW = Math.ceil(totalDays*PPD);
  canvas.style.width = `${canvasW}px`;

  renderScale(scale, canvasW, wrap.scrollLeft);

  // Sichtbare Segmente (Clipping)
  const vis = active.map(s=>({
    ...s,
    start: dn(s.start)<dn(RANGE.start)? RANGE.start : s.start,
    end:   dn(s.end)>dn(RANGE.end)?     RANGE.end   : s.end
  })).filter(s=> dn(s.end)>dn(s.start));

  // Packen
  const {items:placed, rows} = packRows(vis);
  const trackHeight = Math.max(rows*ROW_H + (rows-1)*ROW_GAP + PAD*2, 60);
  body.style.height = `${trackHeight}px`;

  // Render
  body.innerHTML='';
  for(const it of placed){
    const left = (dn(it.start)-dn(RANGE.start))*PPD;
    const width = Math.max(1,(dn(it.end)-dn(it.start))*PPD);
    const top = PAD + it.row*(ROW_H+ROW_GAP);

    const el = document.createElement('div');
    el.className = `seg ${it.kind} ${CFG.compactLabels?'compact':''}`;
    el.style.left = `${left}px`;
    el.style.width= `${width}px`;
    el.style.top  = `${top}px`;
    el.title = segTitle(it);

    const lab = document.createElement('div');
    lab.className = 'seg-label';
    lab.textContent = it.label;
    el.appendChild(lab);
    el.addEventListener('click', ()=>openDetails(it));
    body.appendChild(el);
  }

  // Heute-Marker
  const today = state.campaignDate || {year:1027,month:1,day:1};
  let marker = document.getElementById('tl-today');
  if (!marker){ marker = document.createElement('div'); marker.id='tl-today'; marker.className='tl-today'; canvas.appendChild(marker); }
  marker.style.left='0px';
  marker.style.left = `${Math.max(0, (dn(today)-dn(RANGE.start))*PPD)}px`;

  if (keepScroll) wrap.scrollLeft = prevLeft;
  renderScale(scale, canvasW, wrap.scrollLeft);
}

/* -------- UI/Interaktion -------- */
function controlsHtml(){
  return `
    <div class="tl-controls">
      <div class="group">
        <label><input type="checkbox" id="f-story"  checked> Story</label>
        <label><input type="checkbox" id="f-nsc"    checked> NSCs</label>
        <label><input type="checkbox" id="f-obj"    checked> Objekte</label>
      </div>

      <label>Zeitfenster:
        <select class="input" id="tw" style="width:140px">
          <option value="auto" selected>Auto-Fit</option>
          <option value="3m">3 Monate</option>
          <option value="6m">6 Monate</option>
          <option value="12m">12 Monate</option>
          <option value="24m">24 Monate</option>
          <option value="all">Gesamt</option>
        </select>
      </label>

      <label style="display:inline-flex;gap:6px;align-items:center">
        <input type="checkbox" id="autofit" checked> Auto-Fit
      </label>

      <div class="sep"></div>

      <div style="display:inline-flex;gap:6px;align-items:center">
        <span class="small">Zoom</span>
        <input id="zoom-range" type="range" min="${PX_MIN}" max="${PX_MAX}" value="${PPD}" step="0.1" style="width:180px">
      </div>

      <button class="btn secondary" id="fit">Fit</button>
      <button class="btn secondary" id="today">Heute</button>
    </div>
  `;
}

function mountInteractions(){
  const wrap = document.getElementById('tl-scroll');
  const scale= document.getElementById('tl-scale');

  // Scroll-Sync (Skala folgt)
  wrap.addEventListener('scroll', ()=>{ scale.style.transform = `translateX(${-wrap.scrollLeft}px)`; }, {passive:true});

  // Wheel -> horizontal
  wrap.addEventListener('wheel', (e)=>{
    if (!e.ctrlKey){
      const delta = Math.abs(e.deltaX)>Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      wrap.scrollLeft += delta;
      e.preventDefault();
    }
  }, { passive:false });

  // Drag-to-pan
  let down=false, sx=0, sl=0;
  wrap.addEventListener('mousedown',(e)=>{down=true;sx=e.clientX;sl=wrap.scrollLeft;wrap.style.cursor='grabbing';e.preventDefault();});
  window.addEventListener('mouseup',()=>{down=false;wrap.style.cursor='auto';});
  wrap.addEventListener('mousemove',(e)=>{ if(!down) return; wrap.scrollLeft = sl-(e.clientX-sx); });

  // Filter
  document.getElementById('f-story').onchange = e=>{ CFG.show.story=e.target.checked; drawTimeline(true); };
  document.getElementById('f-nsc').onchange   = e=>{ CFG.show.nsc=e.target.checked; drawTimeline(true); };
  document.getElementById('f-obj').onchange   = e=>{ CFG.show.object=e.target.checked; drawTimeline(true); };

  // Zeitfenster
  document.getElementById('tw').onchange = e=>{
    const v = e.target.value;
    if (v==='auto'){ CFG.autoFit=true; CFG.window='12m'; document.getElementById('autofit').checked=true; }
    else { CFG.autoFit = (v==='all') ? true : false; CFG.window=v; document.getElementById('autofit').checked = CFG.autoFit; }
    drawTimeline(false);
  };

  // Auto-Fit
  document.getElementById('autofit').onchange = e=>{ CFG.autoFit=e.target.checked; drawTimeline(false); };

  // Zoom
  document.getElementById('zoom-range').oninput = e=>{
    CFG.autoFit=false; document.getElementById('autofit').checked=false;
    PPD = Math.min(PX_MAX, Math.max(PX_MIN, Number(e.target.value)));
    drawTimeline(true);
  };

  // Fit / Heute
  document.getElementById('fit').onclick   = ()=>{ CFG.autoFit=true; document.getElementById('autofit').checked=true; drawTimeline(false); };
  document.getElementById('today').onclick = ()=>{
    CFG.autoFit=false; document.getElementById('autofit').checked=false;
    CFG.window='12m'; document.getElementById('tw').value='12m'; drawTimeline(false);
  };

  // Resize
  let t=null; window.addEventListener('resize', ()=>{ clearTimeout(t); t=setTimeout(()=>drawTimeline(true),120); }, {passive:true});
}

/* -------- Public Render -------- */
export async function renderTimeline(){
  const app = document.getElementById('app');

  SEGS = await getSegments();
  if (!SEGS.length){
    app.innerHTML = `<div class="card">${section('Kampagnen-Zeitstrahl (Zoom & Scroll)')}${empty('Noch keine Daten.')}</div>`;
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
            <div id="tl-track" class="tl-track">
              <div id="tl-body" class="track-body"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  mountInteractions();
  drawTimeline(false);
}
