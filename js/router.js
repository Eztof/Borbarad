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
import { renderFamilyTree } from './familytree.js'; // NEU

const routes = {
    '#/home': renderHome,
    '#/heroes': renderHeroes,
    '#/money': renderMoney,
    '#/nscs': renderNSCs,
    '#/objects': renderObjects,
    '#/calendar': renderCalendar,
    '#/diary': renderDiary,
    '#/tags': renderTags,
    '#/open': renderOpen,
    '#/familytree': renderFamilyTree, // NEU
};

function baseHash(){
    return (location.hash || '#/home').split('?')[0];
}

function setActiveLink(){
    const cur = baseHash();
    document.querySelectorAll('.menu a').forEach(a=>{
        if (a.getAttribute('href')===cur) a.classList.add('active');
        else a.classList.remove('active');
    });
}

function renderLocked(){
    // *** WICHTIG: Alle offenen Modals schließen ***
    const modalRoot = document.getElementById('modal-root');
    if (modalRoot) {
        modalRoot.innerHTML = '';
    }
    
    const app = document.getElementById('app');
    app.innerHTML = `<div class="card"><h2>Zugang erforderlich</h2><div style="display:flex;gap:8px;margin-top:10px"><button class="btn secondary" id="btn-login">Login</button><button class="btn" id="btn-register">Registrieren</button></div></div>`;
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