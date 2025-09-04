import { supabase } from './supabaseClient.js';
import { section, empty } from './components.js';
import { avToISO } from './utils.js';
import { state } from './state.js';

async function fetchTimelineItems(){
  const [evRes, nscRes, objRes] = await Promise.all([
    supabase.from('events').select('id,title,av_date,av_date_end'),
    supabase.from('nscs').select('id,name,first_encounter,last_encounter,is_active'),
    supabase.from('objects').select('id,name,first_seen,last_seen,is_active')
  ]);
  const items = [];
  (evRes.data||[]).forEach(e=> items.push({
    id: e.id, content: e.title, start: avToISO(e.av_date), end: e.av_date_end? avToISO(e.av_date_end): undefined
  }));
  (nscRes.data||[]).forEach(n=>{
    if (n.first_encounter) items.push({ content:`NSC: ${n.name} – erste Begegnung`, start: avToISO(n.first_encounter) });
    const last = n.is_active ? state.campaignDate : n.last_encounter;
    if (last) items.push({ content:`NSC: ${n.name} – letzte Begegnung`, start: avToISO(last) });
  });
  (objRes.data||[]).forEach(o=>{
    if (o.first_seen) items.push({ content:`Objekt: ${o.name} – entdeckt`, start: avToISO(o.first_seen) });
    const last = o.is_active ? state.campaignDate : o.last_seen;
    if (last) items.push({ content:`Objekt: ${o.name} – letzter Kontakt`, start: avToISO(last) });
  });
  return items;
}

export async function renderTimeline(){
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="card">
      ${section('Kampagnen-Timeline (aventurisch)')}
      <div id="timeline"></div>
    </div>
  `;
  const items = await fetchTimelineItems();
  const container = document.getElementById('timeline');
  if (!items.length){ container.innerHTML = empty('Noch keine Daten.'); return; }
  const visItems = new vis.DataSet(items);
  new vis.Timeline(container, visItems, {
    selectable: false,
    zoomKey: 'ctrlKey',
    orientation: 'top'
  });
}
