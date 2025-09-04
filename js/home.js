import { state, setCampaignDate } from './state.js';
import { section } from './components.js';
import { formatAvDate } from './utils.js';


export function renderHome(){
const app = document.getElementById('app');
const d = state.campaignDate;
app.innerHTML = `
<div class="card">
${section('Start')}
<p class="small">Kampagnen-Datum</p>
<div style="display:flex;align-items:center;gap:10px">
<h2 style="margin:6px 0">${formatAvDate(d)}</h2>
<button class="btn secondary" id="date-minus">− Tag</button>
<button class="btn secondary" id="date-plus">+ Tag</button>
</div>
<div class="tags" style="margin-top:10px">
<a class="tag" href="#/heroes">Helden</a>
<a class="tag" href="#/nscs">NSCs</a>
<a class="tag" href="#/objects">Objekte</a>
<a class="tag" href="#/calendar">Kalender</a>
<a class="tag" href="#/timeline">Timeline</a>
</div>
</div>
`;


document.getElementById('date-plus').onclick = ()=>{
const { year, month, day } = state.campaignDate;
let d2 = day+1, m2 = month, y2 = year;
if (d2>30){ d2=1; m2++; }
if (m2>12){ m2=1; y2++; }
setCampaignDate({ year:y2, month:m2, day:d2 });
renderHome();
};
document.getElementById('date-minus').onclick = ()=>{
const { year, month, day } = state.campaignDate;
let d2 = day-1, m2 = month, y2 = year;
if (d2<1){ d2=30; m2--; }
if (m2<1){ m2=12; y2--; }
setCampaignDate({ year:y2, month:m2, day:d2 });
renderHome();
};
}