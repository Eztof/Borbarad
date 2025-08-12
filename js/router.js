// Sehr simpler Hash-Router: #/auth, #/heroes, #/heroes/new, #/heroes/:id
const listeners = [];

export function onRoute(cb) { listeners.push(cb); }
export function go(path) { if (location.hash !== `#${path}`) location.hash = `#${path}`; else emit(); }
function parse() { return location.hash.slice(1) || "/"; }
function emit() { const path = parse(); listeners.forEach(cb => cb(path)); }

window.addEventListener("hashchange", emit);
export function startRouter() { emit(); }
