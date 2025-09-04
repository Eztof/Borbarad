import { supabase } from './supabaseClient.js';
import { state } from './state.js';
import { section, modal, formRow, empty } from './components.js';
import { htmlesc } from './utils.js';


async function listHeroes(){
const { data, error } = await supabase
.from('heroes')
.select('*')
.order('created_at', { ascending:false });
if (error){ console.error(error); return []; }
return data;
}


function heroRow(h){
return `<tr>
<td>${htmlesc(h.name)}</td>
<td>${htmlesc(h.species||'')}</td>
<td>${htmlesc(h.profession||'')}</td>
<td class="small">${htmlesc(h.notes||'')}</td>
</tr>`;
}


export async function renderHeroes(){
const app = document.getElementById('app');
const items = await listHeroes();
app.innerHTML = `
<div class="card">
${section('Helden', `<button class=\"btn\" id=\"add-hero\">+ Held</button>`)}
${items.length?`
<div class="card">
<table class="table">
<thead><tr><th>Name</th><th>Spezies</th><th>Profession</th><th>Notizen</th></tr></thead>
<tbody>${items.map(heroRow).join('')}</tbody>
</table>
</div>
`: empty('Noch keine Helden angelegt.')}
</div>
`;


document.getElementById('add-hero').onclick = ()=> showAddHero();
}


function showAddHero(){
const root = modal(`
<h3>Neuen Helden anlegen</h3>
${formRow('Name', '<input class="input" id="h-name" />')}
<div class="row">
${formRow('Spezies', '<input class="input" id="h-species" />')}
${formRow('Profession', '<input class="input" id="h-profession" />')}
</div>
${formRow('Notizen', '<textarea class="input" id="h-notes" rows="4"></textarea>')}
<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
<button class="btn secondary" id="h-cancel">Abbrechen</button>
<button class="btn" id="h-save">Speichern</button>
</div>
`);
}