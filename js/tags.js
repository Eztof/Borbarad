import { supabase } from './supabaseClient.js';
import { section, empty } from './components.js';
import { htmlesc } from './utils.js';

async function fetchTagsUsage(){
  // View lesen
  const { data, error } = await supabase
    .from('tags_usage')
    .select('tag,uses')
    .order('uses', { ascending:false });
  if (error){ console.error(error); return []; }
  return data;
}

function row(t){
  return `<tr>
    <td><span class="badge">${htmlesc(t.tag)}</span></td>
    <td>${Number(t.uses||0)}</td>
  </tr>`;
}

export async function renderTags(){
  const app = document.getElementById('app');
  const list = await fetchTagsUsage();

  app.innerHTML = `
    <div class="card">
      ${section('Tags', `
        <div style="display:flex;gap:8px">
          <input class="input" id="tags-q" placeholder="Suche Tag…" style="width:260px"/>
        </div>
      `)}
      ${list.length ? `
        <div class="card">
          <table class="table">
            <thead><tr><th>Tag</th><th>Verwendet</th></tr></thead>
            <tbody id="tags-tbody">${list.map(row).join('')}</tbody>
          </table>
        </div>
      ` : empty('Noch keine Tags.')}
    </div>
  `;

  const q = document.getElementById('tags-q');
  const tbody = document.getElementById('tags-tbody');
  if (q && tbody){
    q.addEventListener('input', ()=>{
      const v = q.value.toLowerCase();
      const filtered = list.filter(t => (t.tag||'').toLowerCase().includes(v));
      tbody.innerHTML = filtered.map(row).join('');
    });
  }
}
