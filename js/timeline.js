import { supabase } from './supabaseClient.js';
import { section, empty } from './components.js';
import { AV_MONTHS } from './utils.js';
import { state } from './state.js';

let yearView = null;

function initYear(){
  yearView = state.campaignDate?.year || 1027;
}

function leftPercent(av){
  // Position innerhalb des Jahres (0..100%)
  const monthIdx = (av.month-1);              // 0..11
  const inMonth = (av.day-1) / 30;            // 0..1
  const pos = (monthIdx + inMonth) / 12;      // 0..1
  return `${pos*100}%`;
}

async function collectItems(){
  const [evRes, nscRes, objRes] = await Promise.all([
    supabase.from('events').select('id,title,av_date,type'),
    supabase.from('nscs').select('id,name,first_encounter,last_encounter,is_active'),
    supabase.from('objects').select('id,name,first_seen,last_seen,is_active')
  ]);

  const items = {
    story: [],
    nscs: [],
    objects: []
  };

  (evRes.data||[]).forEach(e=>{
    if (!e.av_date) return;
    items.story.push({ label:e.title, av:e.av_date, type:e.type||'story' });
  });

  (nscRes.data||[]).forEach(n=>{
    if (n.first_encounter) items.nscs.push({ label:`${n.name} (erstmals)`, av:n.first_encounter });
    const last = n.is_active ? state.campaignDate : n.last_encounter;
    if (last) items.nscs.push({ label:`${n.name} (letzte)`, av:last });
  });

  (objRes.data||[]).forEach(o=>{
    if (o.first_seen) items.objects.push({ label:`${o.name} (entdeckt)`, av:o.first_seen });
    const last = o.is_active ? state.campaignDate : o.last_seen;
    if (last) items.objects.push({ label:`${o.name} (letzter Kontakt)`, av:last });
  });

  // Filter auf aktuelles Jahr
  const y = yearView;
  for (const k of Object.keys(items)){
    items[k] = items[k].filter(it => it.av?.year === y);
  }
  return items;
}

function renderMonthsScale(){
  return `
    <div class="tl-months">
      ${AV_MONTHS.map(m=>`<div class="tl-month">${m}</div>`).join('')}
    </div>
  `;
}

function laneHtml(title, arr, cls){
  if (!arr.length) return `
    <div class="lane">
      <div class="lane-title">${title}</div>
      <div class="lane-track">${empty('')}</div>
    </div>
  `;
  const dots = arr.map(it=>`
    <div class="tl-item" style="left:${leftPercent(it.av)}" title="${it.label}">
      <div class="tl-dot ${cls}"></div>
      <div class="tl-label">${it.label}</div>
    </div>
  `).join('');
  return `
    <div class="lane">
      <div class="lane-title">${title}</div>
      <div class="lane-track">${dots}</div>
    </div>
  `;
}

export async function renderTimeline(){
  if (!yearView) initYear();
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="card">
      ${section('Kampagnen-Zeitstrahl')}
      <div class="tl-controls">
        <button class="btn secondary" id="tl-prev">‹</button>
        <div class="tl-title">${yearView} BF</div>
        <button class="btn secondary" id="tl-next">›</button>
      </div>
      <div class="timeline-wrap">
        <div class="timeline">
          ${renderMonthsScale()}
          <div id="lanes"></div>
        </div>
      </div>
    </div>
  `;

  const items = await collectItems();
  const lanesEl = document.getElementById('lanes');
  lanesEl.innerHTML = [
    laneHtml('Story', items.story, 'story'),
    laneHtml('NSCs', items.nscs, 'nsc'),
    laneHtml('Objekte', items.objects, 'obj')
  ].join('');

  document.getElementById('tl-prev').onclick = ()=>{ yearView--; renderTimeline(); };
  document.getElementById('tl-next').onclick = ()=>{ yearView++; renderTimeline(); };
}
