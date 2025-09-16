import { formatAvDate, datePickerAv } from './utils.js';

export function renderAuthBox(user){
  const el = document.getElementById('authbox');
  if (!el) return;
  const name = user?.user_metadata?.username || user?.email || 'User';
  el.innerHTML = user ? `
    <button class="btn secondary" id="btn-logout">Logout</button>
  ` : `
    <button class="btn secondary" id="btn-login">Login</button>
    <button class="btn" id="btn-register">Registrieren</button>
  `;
}

export function modal(html){
  // Sicherstellen, dass das Modal-Root existiert
  let root = document.getElementById('modal-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'modal-root';
    root.setAttribute('aria-live', 'polite');
    document.body.appendChild(root);
  }
  // Setze den HTML-Inhalt
  root.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><div class="panel">${html}</div></div>`;
  
  // Schließen bei Klick außerhalb des Panels
  root.onclick = (e) => {
    if (e.target === root) {
      root.innerHTML = ''; // Leere den Inhalt statt das Element zu entfernen
    }
  };
  
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

/** Datums-Inputs (Aventurisch) – jetzt mit frei wählbarem Label */
export function avDateInputs(idPrefix, value, label='Datum (Aventurisch)'){
  return formRow(label, `<div class="card">${datePickerAv(idPrefix, value)}</div>`);
}
