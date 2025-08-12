// Simpler Hash-Router, damit GitHub Pages glücklich ist
const routes = new Map()
// route: '#/login' -> callback()
export function addRoute(hash, cb) { routes.set(hash, cb) }

export function startRouter(defaultHash = '#/app') {
  const run = () => {
    const h = location.hash || defaultHash
    const cb = routes.get(h) || routes.get(defaultHash)
    cb?.()
    // nav active state
    document.querySelectorAll('nav a').forEach(a => {
      a.classList.toggle('active', a.getAttribute('href') === h)
    })
  }
  window.addEventListener('hashchange', run)
  run()
}
