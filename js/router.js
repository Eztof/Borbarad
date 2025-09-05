import { renderHome } from './home.js';
import { renderHeroes } from './heroes.js';
import { renderNSCs } from './nscs.js';
import { renderObjects } from './objects.js';
import { renderCalendar } from './calendar.js';
import { renderTimeline } from './timeline.js';
import { renderTags } from './tags.js';
import { renderDiary } from './diary.js';
import { renderOpen } from './open.js';
import { state } from './state.js';

const routes = {
  '#/home': renderHome,
  '#/heroes': renderHeroes,
  '#/nscs': renderNSCs,
  '#/objects': renderObjects,
  '#/calendar': renderCalendar,
  '#/timeline': renderTimeline,
  '#/diary': renderDiary,
  '#/open': renderOpen,
  '#/tags': renderTags
};

function baseHash(){
  // Ignoriere Query-Teil hinter '?', damit z.B. "#/nscs?edit=..." korrekt auf "#/nscs" matched
  const h = location.hash || '#/home';
  return h.split('?')[0] || '#/home';
}

function setActiveLink(){
  const cur = baseHash();
  document.querySelectorAll('.menu a').forEach(a=>{
    if (a.getAttribute('href')===cur) a.classList.add('active');
    else a.classList.remove('active');
  });
}

function renderLocked(){
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="card">
      <h2>Zugang erforderlich</h2>
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn secondary" id="btn-login">Login</button>
        <button class="btn" id="btn-register">Registrieren</button>
      </div>
    </div>
  `;
}

function render(){
  const curBase = baseHash();
  setActiveLink();

  // Route-Guard: ohne Login Lock-Screen
  if (!state.user){
    renderLocked();
    return;
  }

  const handler = routes[curBase] || renderHome;
  handler();
}

window.addEventListener('hashchange', render);
window.addEventListener('load', ()=>{
  if (!location.hash) location.hash = '#/home';
  render();
});
