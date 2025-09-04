import { supabase } from './supabaseClient.js';
import { section, empty } from './components.js';
import { avToISO } from './utils.js';


async function fetchTimelineItems(){
const [evRes, nscRes, objRes] = await Promise.all([
supabase.from('events').select('id,title,av_date,av_date_end'),
supabase.from('nscs').select('id,name,first_encounter,last_encounter'),
supabase.from('objects').select('id,name,first_seen,last_seen')
]);
const items = [];
(evRes.data||[]).forEach(e=> items.push({
id: e.id, content: e.title, start: avToISO(e.av_date), end: e.av_date_end? avToISO(e.av_date_end): undefined
}));
(nscRes.data||[]).forEach(n=>{
if (n.first_encounter) items.push({ content:`NSC: ${n.name} – erste Begegnung`, start: avToISO(n.first_encounter) });
if (n.last_encounter) items.push({ content:`NSC: ${n.name} – letzte Begegnung`, start: avToISO(n.last_encounter) });
});
(objRes.data||[]).forEach(o=>{
if (o.first_seen) items.push({ content:`Objekt: ${o.name} – entdeckt`, start: avToISO(o.first_seen) });
if (o.last_seen) items.push({ content:`Objekt: ${o.name} – zuletzt gesehen`, start: avToISO(o.last_seen) });
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
const timeline = new vis.Timeline(container, visItems, {
selectable: false,
zoomKey: 'ctrlKey',
orientation: 'top',
// Styling via CSS
});
}