import { renderHome } from './home.js';
import { renderHeroes } from './heroes.js';
import { renderNSCs } from './nscs.js';
import { renderObjects } from './objects.js';
import { renderCalendar } from './calendar.js';
import { renderTimeline } from './timeline.js';
import { state } from './state.js';

const routes = {
  '#/home': renderHome,
  '#/heroes': renderHeroes,
  '#/nscs': renderNSCs,
  '#/objects': renderObjects,
  '#/calendar': renderCalendar,
  '#/timeline': renderTimeline
};

function setActiveLink(){
  const cur = location.hash || '#/home';
  document.querySelectorAll('.menu a').forEach(a=>{
    if (a.getAttribute('href')===cur) a.classList.add('active'); else a.classList.remove('active');
  });
}

function renderLocked(){
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="card">
      <h2>Zugang erforderlich</h2>
      <p class="small">Bitte zuerst anmelden.</p>
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn secondary" id="btn-login">Login</button>
        <button class="btn" id="btn-register">Registrieren</button>
      </div>
    </div>
  `;
}

function render(){
  const cur = location.hash || '#/home';
  setActiveLink();

  // Route-Guard: ohne Login nur Lock-Screen
  if (!state.user){
    renderLocked();
    return;
  }
  (routes[cur] || renderHome)();
}

window.addEventListener('hashchange', render);
window.addEventListener('load', ()=>{ if (!location.hash) location.hash = '#/home'; render(); });
