import { startRouter, addRoute } from './router.js'
import { renderAuth } from './ui/renderAuth.js'
import { renderDashboard } from './ui/renderDashboard.js'
import { getSessionUser, onAuthChange, signOut } from './auth.js'

const app = document.getElementById('app')
const nav = document.getElementById('nav')

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

// Routen definieren
addRoute('#/login', async () => {
  const user = await getSessionUser()
  renderNav(!!user)
  if (user) { location.hash = '#/app'; return }
  renderAuth(app)
})

addRoute('#/app', async () => {
  const user = await getSessionUser()
  renderNav(!!user)
  if (!user) { location.hash = '#/login'; return }
  await renderDashboard(app)
})

// Auth-Änderungen -> Router neu zeichnen
onAuthChange(async () => {
  const user = await getSessionUser()
  renderNav(!!user)
  if (!user && location.hash !== '#/login') location.hash = '#/login'
})

// Router starten
startRouter('#/login')
