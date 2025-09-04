import { supabase } from './supabaseClient.js';
import { state } from './state.js';
import { section, empty } from './components.js';
import { AV_MONTHS } from './utils.js';

let view = null; // { year, month }

function initView(){
  const d = state.campaignDate || { year:1027, month:1, day:1 };
  view = { year: d.year, month: d.month };
}

function monthLabel(y,m){ return `${AV_MONTHS[m-1]} ${y} BF`; }
function clampMonth(y,m){
  if (m<1){ y--; m=12; } else if (m>12){ y++; m=1; }
  return { year:y, month:m };
}

function dayKey(y,m,d){ return `${y}-${m}-${d}`; }

async function collectEvents(){
  // Hole rohe Daten
  const [evRes, nscRes, objRes] = await Promise.all([
    supabase.from('events').select('id,title,av_date,av_date_end,type'),
    supabase.from('nscs').select('id,name,first_encounter,last_encounter,is_active'),
    supabase.from('objects').select('id,name,first_seen,last_seen,is_active')
  ]);

  const events = [];

  // Freie Events
  (evRes.data||[]).forEach(e=>{
    if (e.av_date){
      events.push({ title:e.title, av_date:e.av_date, type:e.type||'story' });
    }
    if (e.av_date_end){
      events.push({ title:`${e.title} (Ende)`, av_date:e.av_date_end, type:e.type||'story' });
    }
  });

  // NSCs
  (nscRes.data||[]).forEach(n=>{
    if (n.first_encounter) events.push({ title:`${n.name} – erste Begegnung`, av_date:n.first_encounter, type:'nsc' });
    const last = n.is_active ? state.campaignDate : n.last_encounter;
    if (last) events.push({ title:`${n.name} – letzte Begegnung`, av_date:last, type:'nsc' });
  });

  // Objekte
  (objRes.data||[]).forEach(o=>{
    if (o.first_seen) events.push({ title:`${o.name} – entdeckt`, av_date:o.first_seen, type:'object' });
    const last = o.is_active ? state.campaignDate : o.last_seen;
    if (last) events.push({ title:`${o.name} – letzter Kontakt`, av_date:last, type:'object' });
  });

  return events;
}

function groupByDay(events, y, m){
  const map = new Map();
  for (let d=1; d<=30; d++) map.set(dayKey(y,m,d), []);
  events.forEach(e=>{
    const a = e.av_date;
    if (!a) return;
    if (a.year===y && a.month===m && a.day>=1 && a.day<=30){
      map.get(dayKey(y,m,a.day)).push(e);
    }
  });
  return map;
}

function renderGrid(container, y, m, byDay){
  // 5 Reihen x 7 Spalten = 35 Zellen; wir füllen 1..30, Rest leer
  const cells = [];
  for (let i=1;i<=35;i++){
    const day = i<=30 ? i : null;
    if (day){
      const evs = byDay.get(dayKey(y,m,day)) || [];
      const chips = evs.slice(0,4).map(e=>`<div class="chip ${e.type}">${e.title}</div>`).join('');
      const more  = evs.length>4 ? `<div class="small">+${evs.length-4} weitere…</div>` : '';
      cells.push(`
        <div class="cal-cell">
          <div class="cal-day">${day}</div>
          <div class="cal-evts">${chips}${more}</div>
        </div>
      `);
    }else{
      cells.push(`<div class="cal-cell cal-empty"></div>`);
    }
  }
  container.innerHTML = `
    <div class="cal-nav">
      <button class="btn secondary" id="cal-prev">‹</button>
      <div class="cal-title">${monthLabel(y,m)}</div>
      <button class="btn secondary" id="cal-next">›</button>
    </div>
    <div class="cal-grid">${cells.join('')}</div>
  `;
  container.querySelector('#cal-prev').onclick = ()=>{ const t=clampMonth(y,m-1); renderCalendarAt(t.year,t.month); };
  container.querySelector('#cal-next').onclick = ()=>{ const t=clampMonth(y,m+1); renderCalendarAt(t.year,t.month); };
}

async function renderCalendarAt(y,m){
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="card">
      ${section('Kalender (Aventurisch)')}
      <div id="calendar"></div>
    </div>
  `;
  const events = await collectEvents();
  const byDay = groupByDay(events, y, m);
  renderGrid(document.getElementById('calendar'), y, m, byDay);
}

export async function renderCalendar(){
  if (!view) initView();
  await renderCalendarAt(view.year, view.month);
}
