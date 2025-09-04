import { supabase, uploadImage } from './supabaseClient.js';
import { section, modal, formRow, empty, avatar, dateBadge, avDateInputs } from './components.js';
import { byStr, htmlesc, readDatePickerAv, formatAvDate } from './utils.js';


let sortField = 'name';
let sortDir = 1;


async function listObjects(){
const { data, error } = await supabase
.from('objects')
.select('*')
.order('name', { ascending:true });
if (error){ console.error(error); return []; }
return data;
}


function row(o){
return `<tr data-id="${o.id}" class="obj-row">
<td style="display:flex;align-items:center;gap:10px">${avatar(o.image_url, o.name)} <strong>${htmlesc(o.name)}</strong></td>
<td class="small">${htmlesc(o.tags||'')}</td>
<td>${o.first_seen ? dateBadge(o.first_seen) : '<span class="small">–</span>'}</td>
<td>${o.last_seen ? dateBadge(o.last_seen) : '<span class="small">–</span>'}</td>
<td class="small">${htmlesc(o.location||'')}</td>
</tr>`;
}


export async function renderObjects(){
const app = document.getElementById('app');
let items = await listObjects();


app.innerHTML = `
<div class="card">
${section('Objekte', `<div style=\"display:flex;gap:8px\">
<input class=\"input\" placeholder=\"Suche… (Name/Tags)\" id=\"obj-q\" style=\"width:260px\"/>
<button class=\"btn\" id=\"add-obj\">+ Objekt</button>
</div>`)}


<div class="card">
<table class="table">
<thead>
<tr>
<th data-sf="name">Name</th>
<th data-sf="tags">Tags</th>
<th>Erstes Auftauchen</th>
<th>Letztes Auftauchen</th>
<th>Ort</th>
</tr>
</thead>
<tbody id="obj-tbody">
${items.map(row).join('')}
</tbody>
</table>
</div>


${!items.length ? empty('Noch keine Objekte angelegt.') : ''}
</div>
`;


const tbody = document.getElementById('obj-tbody');
const q = document.getElementById('obj-q');
}