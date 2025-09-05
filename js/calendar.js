import { supabase } from './supabaseClient.js';
import { state } from './state.js';
import { section, empty, modal } from './components.js';
import { AV_MONTHS, htmlesc } from './utils.js';

/** ====== interner UI-State ====== */
let view = null;              // { year, month } – aktuell angezeigter Monat
let filters = { story:true, nsc:true, object:true, diary:true }; // Tagebuch ergänzt

/** ====== Helpers ====== */
function initView(){
  const d = state.campaignDate || { year:1027, month:1, day:1 };
  view = { year: d.year, month: d.month };
}
function clampMonth(y,m){
  if (m<1){ y--; m=12; } else if (m>12){ y++; m=1; }
  return { year:y, month:m };
}
function monthLabel(y,m){ return `${AV_MONTHS[m-1]} ${y} BF`; }
function dayKey(y,m,d){ return `${y}-${m}-${d}`; }
function isTodayCell(y,m,d){
  const c = state.campaignDate; if (!c) return false;
  return c.year===y && c.month===m && c.day===d;
}

/** ====== Daten holen und in Tage gruppieren ====== */
async function collectEvents(){
  const [evRes, nscRes, objRes, diaryRes] = await Promise.all([
    supabase.from('events').select('id,title,av_date,av_date_end,type,description'),
    supabase.from('nscs').select('id,name,first_encounter,last_encounter,is_active'),
    supabase.from('objects').select('id,name,first_seen,last_seen,is_active'),
    supabase.from('diary').select('id,title,av_date')  // << Tagebuch
  ]);

  const events = [];

  // Freie Kampagnen-Events
  (evRes.data||[]).forEach(e=>{
    if (e.av_date){
      events.push({ title:e.title, type:e.type||'story', av_date:e.av_date, desc:e.description||'' });
    }
    if (e.av_date_end){
      events.push({ title:`${e.title} (Ende)`, type:e.type||'story', av_date:e.av_date_end, desc:e.description||'' });
    }
  });

  // NSCs
  (nscRes.data||[]).forEach(n=>{
    if (n.first_encounter)
      events.push({ title:`NSC: ${n.name} – erste Begegnung`, type:'nsc', av_date:n.first_encounter });
    const last = n.is_active ? state.campaignDate : n.last_encounter;
    if (last)
      events.push({ title:`NSC: ${n.name} – letzter Kontakt`, type:'nsc', av_date:last });
  });

  // Objekte
  (objRes.data||[]).forEach(o=>{
    if (o.first_seen)
      events.push({ title:`Objekt: ${o.name} – entdeckt`, type:'object', av_date:o.first_seen });
    const last = o.is_active ? state.campaignDate : o.last_seen;
    if (last)
      events.push({ title:`Objekt: ${o.name} – letzter Kontakt`, type:'object', av_date:last });
  });

  // Tagebuch (je Eintrag ein Ereignis am av_date)
  (diaryRes.data||[]).forEach(d=>{
    if (d.av_date){
      events.push({ title:d.title || 'Tagebuch', type:'diary', av_date:d.av_date });
    }
  });

  return events;
}

function groupByDay(events, y, m){
  const map = new Map();
  for (let d=1; d<=30; d++) map.set(dayKey(y,m,d), []);
  (events||[]).forEach(ev=>{
    const a = ev.av_date;
    if (!a) return;
    if (a.year===y && a.month===m && a.day>=1 && a.day<=30){
      map.get(dayKey(y,m,a.day)).push(ev);
    }
  });
  // filtern
  for (let d=1;d<=30;d++){
    const key = dayKey(y,m,d);
    const arr = (map.get(key)||[]).filter(ev => filters[ev.type] !== false);
    map.set(key, arr);
  }
  return map;
}

/** ====== Tages-Modal ====== */
function showDayList(y,m,d, list){
  if (!list?.length) return;
  const root = modal(`
    <div class="daylist">
      <h3>${d}. ${AV_MONTHS[m-1]} ${y} BF</h3>
      <div>
        ${list.map(ev => `<div class="chip ${ev.type}" title="${htmlesc(ev.title)}">${htmlesc(ev.title)}</div>`).join('')}
      </div>
      <div style="display:flex;justify-content:flex-end;margin-top:12px">
        <button class="btn secondary" id="dl-close">Schließen</button>
      </div>
    </div>
  `);
  root.querySelector('#dl-close').onclick = ()=> root.innerHTML='';
}

/** ====== Rendering ====== */
function renderToolbar(container, y, m){
  container.innerHTML = `
    <div class="cal-toolbar">
      <div class="cal-left">
        <button class="btn secondary" id="prev-year">«</button>
        <button class="btn secondary" id="prev-month">‹</button>
        <div class="cal-title">${monthLabel(y,m)}</div>
        <button class="btn secondary" id="next-month">›</button>
        <button class="btn secondary" id="next-year">»</button>
      </div>
      <div class="cal-right">
        <div class="cal-legend">
          <label><input type="checkbox" id="flt-story" ${filters.story?'checked':''}/> Story</label>
          <label><input type="checkbox" id="flt-nsc" ${filters.nsc?'checked':''}/> NSCs</label>
          <label><input type="checkbox" id="flt-object" ${filters.object?'checked':''}/> Objekte</label>
          <label><input type="checkbox" id="flt-diary" ${filters.diary?'checked':''}/> Tagebuch</label>
        </div>
        <button class="btn" id="go-today">Heute</button>
      </div>
    </div>
    <div id="cal-grid" class="cal-grid"></div>
  `;

  // Navigation
  container.querySelector('#prev-month').onclick = ()=>{ const t=clampMonth(y,m-1); renderCalendarAt(t.year,t.month); };
  container.querySelector('#next-month').onclick = ()=>{ const t=clampMonth(y,m+1); renderCalendarAt(t.year,t.month); };
  container.querySelector('#prev-year').onclick  = ()=>{ renderCalendarAt(y-1,m); };
  container.querySelector('#next-year').onclick  = ()=>{ renderCalendarAt(y+1,m); };
  container.querySelector('#go-today').onclick   = ()=>{
    const d = state.campaignDate || {year:y,month:m,day:1};
    renderCalendarAt(d.year, d.month);
  };

  // Filter
  container.querySelector('#flt-story').onchange  = (e)=>{ filters.story  = e.target.checked; renderCalendarAt(y,m); };
  container.querySelector('#flt-nsc').onchange    = (e)=>{ filters.nsc    = e.target.checked; renderCalendarAt(y,m); };
  container.querySelector('#flt-object').onchange = (e)=>{ filters.object = e.target.checked; renderCalendarAt(y,m); };
  container.querySelector('#flt-diary').onchange  = (e)=>{ filters.diary  = e.target.checked; renderCalendarAt(y,m); };
}

function renderGrid(container, y, m, byDay){
  const grid = container.querySelector('#cal-grid');
  const cells = [];
  for (let i=1; i<=30; i++){
    const list = byDay.get(dayKey(y,m,i)) || [];
    const chips = list.slice(0,3).map(ev=>`<div class="chip ${ev.type}" title="${htmlesc(ev.title)}">${htmlesc(ev.title)}</div>`).join('');
    const more  = list.length>3 ? `<div class="cal-more">+${list.length-3} weitere…</div>` : '';
    const todayClass = isTodayCell(y,m,i) ? ' cal-today' : '';
    cells.push(`
      <div class="cal-cell${todayClass}" data-day="${i}">
        <div class="cal-day">${i}</div>
        <div class="cal-evts">${chips}${more}</div>
      </div>
    `);
  }
  grid.innerHTML = cells.join('');

  // Click -> Tagesliste
  grid.querySelectorAll('.cal-cell').forEach(cell=>{
    cell.addEventListener('click', ()=>{
      const d = Number(cell.dataset.day);
      const list = byDay.get(dayKey(y,m,d)) || [];
      showDayList(y,m,d,list);
    });
  });
}

async function renderCalendarAt(y,m){
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="card">
      ${section('Kalender (Aventurisch)')}
      <div class="cal-wrap" id="cal-wrap"></div>
    </div>
  `;

  const wrap = document.getElementById('cal-wrap');
  renderToolbar(wrap, y, m);

  const events = await collectEvents();
  const byDay  = groupByDay(events, y, m);
  renderGrid(wrap, y, m, byDay);
}

/** ====== Public ====== */
export async function renderCalendar(){
  if (!view) initView();
  await renderCalendarAt(view.year, view.month);
}
