// js/main.js
import { startRouter, addRoute } from './router.js'
import { renderAuth } from './ui/renderAuth.js'
import { renderDashboard } from './ui/renderDashboard.js'
import { getSessionUser, onAuthChange, signOut } from './auth.js'

const app = document.getElementById('app')
const nav = document.getElementById('nav')

function showError(message, details) {
  app.innerHTML = `
    <div class="card">
      <h3>Fehler</h3>
      <p>${message}</p>
      ${details ? `<pre style="white-space:pre-wrap">${details}</pre>` : ''}
      <div class="row">
        <button id="btnReload" class="btn">Neu laden</button>
        <a class="btn" href="#/login">Zum Login</a>
      </div>
    </div>
  `
  app.querySelector('#btnReload')?.addEventListener('click', () => location.reload())
}

// Navigation dynamisch
function renderNav(isAuthed) {
  nav.innerHTML = ''
  if (isAuthed) {
    const aApp = document.createElement('a')
    aApp.href = '#/app'
    aApp.textContent = 'App'
    const aLogout = document.createElement('a')
    aLogout.href = '#/logout'
    aLogout.textContent = 'Logout'
    aLogout.addEventListener('click', async (e) => {
      e.preventDefault()
      await signOut()
      location.hash = '#/login'
    })
    nav.append(aApp, aLogout)
  } else {
    const aLogin = document.createElement('a')
    aLogin.href = '#/login'
    aLogin.textContent = 'Login'
    nav.append(aLogin)
  }
}

// Routen definieren (mit Try/Catch)
addRoute('#/login', async () => {
  try {
    const user = await getSessionUser()
    renderNav(!!user)
    if (user) { location.hash = '#/app'; return }
    renderAuth(app)
  } catch (err) {
    renderNav(false)
    showError('Login-Seite konnte nicht geladen werden.', err?.message)
  }
})

addRoute('#/app', async () => {
  try {
    const user = await getSessionUser()
    renderNav(!!user)
    if (!user) { location.hash = '#/login'; return }
    await renderDashboard(app)
  } catch (err) {
    showError('Dashboard konnte nicht geladen werden.', err?.message)
  }
})

// Auth-Änderungen -> Router neu zeichnen
onAuthChange(async () => {
  try {
    const user = await getSessionUser()
    renderNav(!!user)
    if (!user && location.hash !== '#/login') location.hash = '#/login'
  } catch (err) {
    showError('Sitzung konnte nicht geprüft werden.', err?.message)
  }
})

// Router starten (setzt bei leerem Hash auf #/login)
if (!location.hash) location.hash = '#/login'
startRouter('#/login')

// Global: letzte Sicherheitsleine
window.addEventListener('error', (e) => {
  showError('Ein unbekannter Fehler ist aufgetreten.', e?.error?.message ?? e?.message)
})
window.addEventListener('unhandledrejection', (e) => {
  showError('Ein Fehler bei einer Anfrage ist aufgetreten.', e?.reason?.message ?? String(e?.reason))
})
