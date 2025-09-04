import { supabase, uploadImage } from './supabaseClient.js';
import { state } from './state.js';
import { section, modal, formRow, empty, avatar, dateBadge, avDateInputs } from './components.js';
import { byStr, htmlesc, readDatePickerAv, formatAvDate } from './utils.js';


let sortField = 'name';
let sortDir = 1; // 1 asc, -1 desc


async function listNSCs(){
const { data, error } = await supabase
.from('nscs')
.select('*')
.order('name', { ascending:true });
if (error){ console.error(error); return []; }
return data;
}


function row(n){
return `<tr data-id="${n.id}" class="nsc-row">
<td style="display:flex;align-items:center;gap:10px">${avatar(n.image_url, n.name)} <strong>${htmlesc(n.name)}</strong></td>
<td class="small">${htmlesc(n.tags||'')}</td>
<td>${n.first_encounter ? dateBadge(n.first_encounter) : '<span class="small">–</span>'}</td>
<td>${n.last_encounter ? dateBadge(n.last_encounter) : '<span class="small">–</span>'}</td>
<td class="small">${htmlesc(n.whereabouts||'')}</td>
</tr>`;
}


function sortItems(items){
return items.sort((a,b)=> sortDir * byStr(sortField)(a,b));
}


export async function renderNSCs(){
const app = document.getElementById('app');
let items = await listNSCs();


app.innerHTML = `
<div class="card">
${section('NSCs', `<div style=\"display:flex;gap:8px\">
<input class=\"input\" placeholder=\"Suche… (Name/Tags)\" id=\"nsc-q\" style=\"width:260px\"/>
<button class=\"btn\" id=\"add-nsc\">+ NSC</button>
</div>`)}


<div class="card">
<table class="table">
<thead>
<tr>
<th data-sf="name">Name</th>
<th data-sf="tags">Tags</th>
<th>Erstes Treffen</th>
<th>Letztes Treffen</th>
<th>Verbleib</th>
</tr>
</thead>
<tbody id="nsc-tbody">
${items.map(row).join('')}
</tbody>
</table>
</div>


${!items.length ? empty('Noch keine NSCs angelegt.') : ''}
</div>
`;


const tbody = document.getElementById('nsc-tbody');
// Suche
const q = document.getElementById('nsc-q');
q.addEventListener('input', ()=>{
const v = q.value.toLowerCase();
const filtered = items.filter(n=> `${n.name} ${(n.tags||'')}`.toLowerCase().includes(v));
tbody.innerHTML = filtered.map(row).join('');
});


// Sortier-Header
document.querySelectorAll('th[data-sf]').forEach(th=>{
  th.addEventListener('click', ()=>{
    const sf = th.getAttribute('data-sf');
    if (sortField === sf){
      sortDir *= -1;
    } else {
      sortField = sf;
      sortDir = 1;
    }
    const sorted = sortItems(items.slice());
    tbody.innerHTML = sorted.map(row).join('');
  });
});
}
