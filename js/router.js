import { renderHome } from './home.js';
import { renderHeroes } from './heroes.js';
import { renderNSCs } from './nscs.js';
import { renderObjects } from './objects.js';
import { renderCalendar } from './calendar.js';
import { renderTimeline } from './timeline.js';


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


function render(){
const cur = location.hash || '#/home';
setActiveLink();
(routes[cur] || renderHome)();
}


window.addEventListener('hashchange', render);
window.addEventListener('load', ()=>{ if (!location.hash) location.hash = '#/home'; render(); });