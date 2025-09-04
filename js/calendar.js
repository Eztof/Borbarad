import { supabase } from './supabaseClient.js';
import { state } from './state.js';
import { section, empty } from './components.js';
import { avToISO } from './utils.js';

async function fetchEvents(){
  const [evRes, nscRes, objRes] = await Promise.all([
    supabase.from('events').select('*'),
    supabase.from('nscs').select('id,name,first_encounter,last_encounter,is_active'),
    supabase.from('objects').select('id,name,first_seen,last_seen,is_active')
  ]);
  const events = (evRes.data||[]).map(e=>({
    id: e.id,
    title: e.title,
    start: avToISO(e.av_date),
    end: e.av_date_end ? avToISO(e.av_date_end) : undefined,
    extendedProps: e
  }));
  (nscRes.data||[]).forEach(n=>{
    if (n.first_encounter) events.push({ title:`${n.name} – erste Begegnung`, start: avToISO(n.first_encounter) });
    const last = n.is_active ? state.campaignDate : n.last_encounter;
    if (last) events.push({ title:`${n.name} – letzte Begegnung`, start: avToISO(last) });
  });
  (objRes.data||[]).forEach(o=>{
    if (o.first_seen) events.push({ title:`${o.name} – entdeckt`, start: avToISO(o.first_seen) });
    const last = o.is_active ? state.campaignDate : o.last_seen;
    if (last) events.push({ title:`${o.name} – letzter Kontakt`, start: avToISO(last) });
  });
  return events;
}

export async function renderCalendar(){
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="card">
      ${section('Kalender / Timeline')}
      <div id="calendar" style="padding:6px"></div>
    </div>
  `;
  const events = await fetchEvents();
  if (!events.length){
    document.getElementById('calendar').innerHTML = empty('Noch keine Ereignisse.');
    return;
  }
  const calEl = document.getElementById('calendar');
  const calendar = new FullCalendar.Calendar(calEl, {
    initialView: 'dayGridMonth',
    height: 'auto',
    headerToolbar: { left:'prev,next today', center:'title', right:'dayGridMonth,timeGridWeek,listWeek' },
    events
  });
  calendar.render();
}
