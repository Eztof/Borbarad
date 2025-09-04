import { formatAvDate, datePickerAv } from './utils.js';

export function renderAuthBox(user){
  const el = document.getElementById('authbox');
  if (!el) return;
  const name = user?.user_metadata?.username || user?.email || 'User';
  el.innerHTML = user ? `
    <span class="small">Angemeldet: ${name}</span>
    <button class="btn secondary" id="btn-logout">Logout</button>
  ` : `
    <button class="btn secondary" id="btn-login">Login</button>
    <button class="btn" id="btn-register">Registrieren</button>
  `;
}

export function modal(html){
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="modal"><div class="panel">${html}</div></div>`;
  root.addEventListener('click', (e)=>{ if(e.target===root) root.innerHTML=''; }, { once:true });
  return root;
}

export function avatar(url, name){
  const initials = (name||' ').split(/\s+/).map(s=>s[0]).join('').slice(0,2).toUpperCase();
  return url ? `<img src="${url}" alt="${name}" style="width:40px;height:40px;border-radius:10px;object-fit:cover;"/>` : `
    <div style="width:40px;height:40px;border-radius:10px;background:#0f1924;border:1px solid #203047;display:flex;align-items:center;justify-content:center;font-weight:700;color:#8aa0b7">${initials}</div>`;
}

export function dateBadge(av){ return `<span class="tag">${formatAvDate(av)}</span>`; }
export function section(title, actionsHtml=''){ return `<div class="toolbar"><h2 style="margin:6px 0">${title}</h2><div>${actionsHtml}</div></div>`; }
export function empty(text){ return `<div class="empty">${text}</div>`; }
export function formRow(label, inputHtml){ return `<div><div class="label">${label}</div>${inputHtml}</div>`; }
export function avDateInputs(idPrefix, value){ return formRow('Datum (Aventurisch)', `<div class="card">${datePickerAv(idPrefix, value)}</div>`); }
