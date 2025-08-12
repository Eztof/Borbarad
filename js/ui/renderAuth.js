// js/ui/renderAuth.js
import { signInUsernamePassword, signUpUsernamePassword } from '../auth.js'
import { setRememberPreference } from '../supabaseClient.js'

export function renderAuth(root) {
  root.innerHTML = ''

  const wrap = document.createElement('div')
  wrap.className = 'card'
  wrap.innerHTML = `
    <div class="tabs">
      <button class="tab active" data-tab="login">Anmelden</button>
      <button class="tab" data-tab="register">Registrieren</button>
    </div>
    <div id="formArea"></div>
  `
  root.append(wrap)
  const formArea = wrap.querySelector('#formArea')

  function renderLoginForm() {
    formArea.innerHTML = `
      <form id="loginForm" class="grid" autocomplete="on">
        <label>Nutzername
          <input class="input" name="username" required autocomplete="username"/>
        </label>
        <label>Passwort
          <input class="input" name="password" type="password" required autocomplete="current-password"/>
        </label>
        <label class="row" style="align-items:center; gap:8px;">
          <input type="checkbox" name="remember" checked />
          <span>Angemeldet bleiben</span>
        </label>
        <button class="btn primary">Anmelden</button>
      </form>
    `
    const form = formArea.querySelector('#loginForm')
    form.addEventListener('submit', async (e) => {
      e.preventDefault()
      const fd = new FormData(form)
      const username = fd.get('username')
      const password = fd.get('password')
      const remember = fd.get('remember') === 'on'
      try {
        await signInUsernamePassword({ username, password, remember })
        // Speicherung der Präferenz ist bereits Teil des Auth-Flows,
        // hier nur optional nochmal sicherstellen (kein Reload!)
        setRememberPreference(remember)
        location.hash = '#/app'
      } catch (err) {
        alert('Login fehlgeschlagen: ' + (err?.message ?? err))
      }
    })
  }

  function renderRegisterForm() {
    formArea.innerHTML = `
      <form id="regForm" class="grid" autocomplete="on">
        <label>Nutzername
          <input class="input" name="username" required autocomplete="username"/>
        </label>
        <label>Passwort
          <input class="input" name="password" type="password" required autocomplete="new-password"/>
        </label>
        <label class="row" style="align-items:center; gap:8px;">
          <input type="checkbox" name="remember" checked />
          <span>Angemeldet bleiben</span>
        </label>
        <button class="btn">Account anlegen</button>
        <p class="muted">Es wird intern eine Pseudo-E-Mail aus deinem Nutzernamen erzeugt.</p>
      </form>
    `
    const form = formArea.querySelector('#regForm')
    form.addEventListener('submit', async (e) => {
      e.preventDefault()
      const fd = new FormData(form)
      const username = fd.get('username')
      const password = fd.get('password')
      const remember = fd.get('remember') === 'on'
      try {
        const { needsLogin } = await signUpUsernamePassword({ username, password, remember })
        if (needsLogin) {
          alert('Account erstellt. Bitte jetzt mit Nutzername + Passwort anmelden.')
          activateTab('login')
        } else {
          location.hash = '#/app'
        }
      } catch (err) {
        alert('Registrierung fehlgeschlagen: ' + (err?.message ?? err))
      }
    })
  }

  function activateTab(name) {
    wrap.querySelectorAll('.tab').forEach(btn => {
      const active = btn.dataset.tab === name
      btn.classList.toggle('active', active)
    })
    if (name === 'login') renderLoginForm()
    else renderRegisterForm()
  }

  wrap.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => activateTab(btn.dataset.tab)))

  activateTab('login')
}
