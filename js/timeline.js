// js/timeline.js
// Einspuriger Zeitstrahl mit hübscher Optik, dynamischer Monats-Skala,
// Row-Packing (kein Überlappen), eigenem horizontalem Scroll & Zoom.
// Fixes: Scroll-Clamping beim Zoomen/Wechsel, Labels sichtbar, Skala immer synchron.

import { supabase } from './supabaseClient.js';
import { state } from './state.js';
import { section, empty, modal } from './components.js';
import { AV_MONTHS, htmlesc } from './utils.js';

/* -------- Aventurische-Helfer -------- */
const norm = (av)=> (av && av.year!=null && av.month!=null && av.day!=null)
  ? {year:+av.year,month:+av.month,day:+av.day} : null;
const dn   = (av)=> av.year*360+(av.month-1)*30+(av.day-1);
const addD = (av,d)=>{ const N=dn(av)+d; return {year:Math.floor(N/360),month:Math.floor((N%360)/30)+1,day:(N%30)+1}; };
const diff = (a,b)=> dn(b)-dn(a);

/* -------- UI-Config -------- */
const CFG = {
  show: { story:true, nsc:true, object:true },
  autoFit: true,
  window: 'auto', // 'auto'|'3m'|'6m'|'12m'|'24m'|'all'
  compactLabels: true
};
let PPD = 8;               // Pixel pro Tag (dynamisch)
const PX_MIN = 0.3, PX_MAX = 30;
const ROW_H = 22, ROW_GAP = 8, PAD_TOP = 14;

let SEGS = [];
let RANGE = { start:{year:1027,month:1,day:1}, end:{year:1027,month:6,day:1} };
let LAST_CANVAS_W = 0;

/* -------- Daten sammeln -------- */
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
function computeRange(list){
  if (CFG.window==='all' || CFG.autoFit){
    if (!list.length) return RANGE;
    let s=list[0].start, e=list[0].end;
    for (const it of list){ if(dn(it.start)<dn(s)) s=it.start; if(dn(it.end)>dn(e)) e=it.end; }
    s = addD(s,-30); e = addD(e,30);
    return {start:s,end:e};
  }
  const base = state.campaignDate || {year:1027,month:1,day:1};
  const map = {'3m':90,'6m':180,'12m':360,'24m':720};
  const days = map[CFG.window] || 360;
  const half = Math.floor(days/2);
  return { start:addD(base,-half), end:addD(base,half) };
}

function pxPerDayFit(width, start, end){
  const days = Math.max(1, diff(start,end));
  return Math.min(PX_MAX, Math.max(PX_MIN, (width-20)/days));
}

function monthsInRange(){
  const first = Math.floor(dn(RANGE.start)/30);
  const last  = Math.floor((dn(RANGE.end)-1)/30);
  const arr=[];
  for(let m=first;m<=last;m++){
    const y=Math.floor(m/12), mo=(m%12)+1;
    arr.push({year:y,month:mo});
  }
  return arr;
}

function renderScale(scaleEl, canvasWidth, scrollLeft=0){
  const months = monthsInRange();
  const monthW = 30*PPD;

  // Skalenbreite = Canvasbreite → keine Drift
  scaleEl.style.width = `${canvasWidth}px`;

  let step = 1;
  if (monthW < 90) step = 2;
  if (monthW < 60) step = 3;
  if (monthW < 40) step = 6;
  if (monthW < 28) step = 12;

  let html = '';
  for(let i=0;i<months.length;i++){
    const m = months[i];
    const show = (i%step===0);
    const showYear = (m.month===1 && step<=6);
    const label = show ? AV_MONTHS[m.month-1] : '&nbsp;';
    html += `<div class="tl-scale-cell" style="width:${monthW}px">
      <div class="tl-scale-month">
        <span>${label}</span>
        ${showYear ? `<span class="yr">${m.year} BF</span>` : ''}
      </div>
    </div>`;
  }
  scaleEl.innerHTML = html;
  scaleEl.style.transform = `translateX(${-scrollLeft}px)`;
}

/* -------- Pack-Layout -------- */
function packRows(items){
  const list = [...items].sort((a,b)=> dn(a.start)-dn(b.start) || dn(a.end)-dn(b.end));
  const rows = [];
  const placed = [];

  const collides = (row, seg)=>{
    for(const r of row){
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
  const m=seg.meta||{};
  if (seg.kind==='nsc'){
    if (m.whereabouts) html+=`<p><strong>Verbleib:</strong> ${htmlesc(m.whereabouts)}</p>`;
    if (m.biography)   html+=`<p style="white-space:pre-wrap">${htmlesc(m.biography)}</p>`;
  }else if (seg.kind==='object'){
    if (m.location)    html+=`<p><strong>Ort:</strong> ${htmlesc(m.location)}</p>`;
    if (m.description) html+=`<p style="white-space:pre-wrap">${htmlesc(m.description)}</p>`;
  }else{
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
function clampScroll(wrap, canvasW, prevLeft, keepScroll){
  const max = Math.max(0, canvasW - wrap.clientWidth);
  if (keepScroll){
    // Wenn die Breite geändert wurde, skaliere die Scrollposition proportional
    const ratio = LAST_CANVAS_W ? (canvasW / LAST_CANVAS_W) : 1;
    wrap.scrollLeft = Math.min(max, Math.max(0, Math.round(prevLeft * ratio)));
  }else{
    wrap.scrollLeft = Math.min(max, Math.max(0, wrap.scrollLeft));
  }
}

function drawTimeline(keepScroll=false){
  const active = SEGS.filter(s=> CFG.show[s.kind]);

  RANGE = computeRange(active);

  const wrap   = document.getElementById('tl-scroll');
  const scale  = document.getElementById('tl-scale');
  const canvas = document.getElementById('tl-canvas');
  const body   = document.getElementById('tl-body');

  const prevLeft = keepScroll ? wrap.scrollLeft : 0;

  if (CFG.autoFit){
    PPD = pxPerDayFit(wrap.clientWidth, RANGE.start, RANGE.end);
    const zr = document.getElementById('zoom-range');
    if (zr) zr.value = String(PPD);
  }

  const totalDays = Math.max(1, diff(RANGE.start,RANGE.end));
  const canvasW = Math.ceil(totalDays*PPD);
  canvas.style.width = `${canvasW}px`;

  // Scroll clamping/Scaling: verhindert „Flucht“ nach rechts
  clampScroll(wrap, canvasW, prevLeft, keepScroll);
  LAST_CANVAS_W = canvasW;

  // Skala
  renderScale(scale, canvasW, wrap.scrollLeft);

  // Sichtbare Segmente clampen
  const vis = active.map(s=>({
    ...s,
    start: dn(s.start)<dn(RANGE.start)? RANGE.start : s.start,
    end:   dn(s.end)>dn(RANGE.end)?     RANGE.end   : s.end
  })).filter(s=> dn(s.end)>dn(s.start));

  // Packen
  const {items:placed, rows} = packRows(vis);
  const trackHeight = Math.max(rows*ROW_H + (rows-1)*ROW_GAP + PAD_TOP*2, 70);
  body.style.height = `${trackHeight}px`;

  // Render
  body.innerHTML='';
  for(const it of placed){
    const left  = (dn(it.start)-dn(RANGE.start))*PPD;
    const width = Math.max(1,(dn(it.end)-dn(it.start))*PPD);
    const top   = PAD_TOP + it.row*(ROW_H+ROW_GAP);

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
  marker.style.left = `${Math.max(0,(dn(today)-dn(RANGE.start))*PPD)}px`;

  // final: Skala exakt nachziehen
  renderScale(scale, canvasW, wrap.scrollLeft);
}

/* -------- UI / Interaction -------- */
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
        <input id="zoom-range" type="range" min="${PX_MIN}" max="${PX_MAX}" value="${PPD}" step="0.1" style="width:200px">
      </div>

      <button class="btn secondary" id="fit">Fit</button>
      <button class="btn secondary" id="today">Heute</button>
    </div>
  `;
}

function mountInteractions(){
  const wrap = document.getElementById('tl-scroll');
  const scale= document.getElementById('tl-scale');

  // Scroll -> Skala mitscrollen
  wrap.addEventListener('scroll', ()=>{ scale.style.transform = `translateX(${-wrap.scrollLeft}px)`; }, {passive:true});

  // Wheel -> horizontal pannen (ohne Browser-Seitwärts-Scroll)
  wrap.addEventListener('wheel', (e)=>{
    if (!e.ctrlKey){
      const delta = Math.abs(e.deltaX)>Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      wrap.scrollLeft += delta;
      e.preventDefault();
    }
  }, {passive:false});

  // Drag-to-pan
  let dragging=false, sx=0, sl=0;
  wrap.addEventListener('mousedown',(e)=>{dragging=true;sx=e.clientX;sl=wrap.scrollLeft;wrap.style.cursor='grabbing';e.preventDefault();});
  window.addEventListener('mouseup',()=>{dragging=false;wrap.style.cursor='auto';});
  wrap.addEventListener('mousemove',(e)=>{ if(!dragging) return; wrap.scrollLeft = sl-(e.clientX-sx); });

  // Filter
  document.getElementById('f-story').onchange = e=>{ CFG.show.story=e.target.checked; drawTimeline(true); };
  document.getElementById('f-nsc').onchange   = e=>{ CFG.show.nsc=e.target.checked;     drawTimeline(true); };
  document.getElementById('f-obj').onchange   = e=>{ CFG.show.object=e.target.checked;  drawTimeline(true); };

  // Zeitfenster
  document.getElementById('tw').onchange = e=>{
    CFG.window = e.target.value;
    CFG.autoFit = (CFG.window==='auto' || CFG.window==='all');
    document.getElementById('autofit').checked = CFG.autoFit;
    drawTimeline(false);
  };

  // AutoFit
  document.getElementById('autofit').onchange = e=>{ CFG.autoFit=e.target.checked; drawTimeline(false); };

  // Zoom
  document.getElementById('zoom-range').oninput = e=>{
    CFG.autoFit=false; document.getElementById('autofit').checked=false;
    PPD = Math.min(PX_MAX, Math.max(PX_MIN, Number(e.target.value)));
    drawTimeline(true);
  };

  // Fit & Heute
  document.getElementById('fit').onclick   = ()=>{ CFG.autoFit=true; document.getElementById('autofit').checked=true; drawTimeline(false); };
  document.getElementById('today').onclick = ()=>{
    CFG.autoFit=false; document.getElementById('autofit').checked=false;
    CFG.window='12m'; document.getElementById('tw').value='12m';
    drawTimeline(false);
  };

  // Resize (debounced)
  let t=null; window.addEventListener('resize', ()=>{ clearTimeout(t); t=setTimeout(()=>drawTimeline(true),120); }, {passive:true});
}

/* -------- Exportierter Renderer -------- */
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
            <div class="tl-track">
              <div id="tl-body" class="track-body"></div>
              <div id="tl-today" class="tl-today"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  mountInteractions();
  drawTimeline(false);
}
