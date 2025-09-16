// js/router.js
import { state, subscribe } from './state.js';
import { renderHome } from './home.js';
import { renderHeroes } from './heroes.js';
import { renderMoney } from './money.js';
import { renderNSCs } from './nscs.js';
import { renderObjects } from './objects.js';
import { renderCalendar } from './calendar.js';
import { renderDiary } from './diary.js';
import { renderTags } from './tags.js';
import { renderOpen } from './open.js';
// *** NEU: Importiere die Authentifizierungsfunktionen ***
import { showLogin, showRegister } from './auth.js';
import { renderFamilyTree } from './familytree.js';

// Routen-Zuordnung
const routes = {
  '#/home': renderHome,
  '#/heroes': renderHeroes,
  '#/familytree': renderFamilyTree,
  '#/money': renderMoney,
  '#/nscs': renderNSCs,
  '#/objects': renderObjects,
  '#/calendar': renderCalendar,
  '#/diary': renderDiary,
  '#/tags': renderTags,
  '#/open': renderOpen
};

function baseHash() {
  return location.hash.split('?')[0];
}

function setActiveLink() {
  const base = baseHash();
  document.querySelectorAll('nav a').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === base);
  });
}

function renderLocked(){
  // *** WICHTIG: Alle offenen Modals schließen und das modal-root Element entfernen ***
  const modalRoot = document.getElementById('modal-root');
  if (modalRoot) {
    // Entferne das gesamte modal-root Element aus dem DOM
    modalRoot.remove();
  }
  
  const app = document.getElementById('app');
  app.innerHTML = `<div class="card"><h2>Zugang erforderlich</h2><div style="display:flex;gap:8px;margin-top:10px"><button class="btn secondary" id="btn-login">Login</button><button class="btn" id="btn-register">Registrieren</button></div></div>`;
  
  // Event Listener für die Buttons hinzufügen
  document.getElementById('btn-login').onclick = showLogin;
  document.getElementById('btn-register').onclick = showRegister;
}

function render(){
  const curBase = baseHash();
  setActiveLink();
  
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

// Sofort re-rendern bei Login/Logout
subscribe(() => { render(); });