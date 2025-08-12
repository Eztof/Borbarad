import { signIn, signUp } from '../auth.js'

export function renderAuth(root) {
  root.innerHTML = ''
  const wrap = document.createElement('div')
  wrap.className = 'grid cols-2'

  const login = document.createElement('div')
  login.className = 'card'
  login.innerHTML = `
    <h2>Anmelden</h2>
    <form id="loginForm" class="grid">
      <label>E-Mail<br/><input class="input" name="email" type="email" required/></label>
      <label>Passwort<br/><input class="input" name="password" type="password" required/></label>
      <button class="btn primary">Login</button>
    </form>
  `

  const register = document.createElement('div')
  register.className = 'card'
  register.innerHTML = `
    <h2>Registrieren</h2>
    <form id="regForm" class="grid">
      <label>Benutzername<br/><input class="input" name="username" required/></label>
      <label>E-Mail<br/><input class="input" name="email" type="email" required/></label>
      <label>Passwort<br/><input class="input" name="password" type="password" required/></label>
      <button class="btn">Account anlegen</button>
    </form>
  `

  wrap.append(login, register)
  root.append(wrap)

  login.querySelector('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    try {
      await signIn({ email: fd.get('email'), password: fd.get('password') })
      location.hash = '#/app'
    } catch (err) {
      alert('Login fehlgeschlagen: ' + err.message)
    }
  })

  register.querySelector('#regForm').addEventListener('submit', async (e) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    try {
      await signUp({
        email: fd.get('email'),
        password: fd.get('password'),
        username: fd.get('username')
      })
      alert('Account erstellt! Bitte E-Mail bestätigen (falls Double-Opt-In aktiv).')
      location.hash = '#/app'
    } catch (err) {
      alert('Registrierung fehlgeschlagen: ' + err.message)
    }
  })
}
