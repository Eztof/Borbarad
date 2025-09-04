import { supabase } from './supabaseClient.js';
import { state, setUser, subscribe } from './state.js';
import { renderAuthBox, modal } from './components.js';


function mountAuthBox(){ renderAuthBox(state.user); }


// Buttons (Header)
document.addEventListener('click', async (e)=>{
if (e.target?.id === 'btn-login') showLogin();
if (e.target?.id === 'btn-register') showRegister();
if (e.target?.id === 'btn-logout') {
await supabase.auth.signOut();
setUser(null);
location.hash = '#/home';
}
});


function showLogin(){
const root = modal(`
<h3>Login</h3>
<div class="row">
<div>
<div class="label">E-Mail</div>
<input class="input" id="auth-email" type="email" placeholder="ihr@example.de" />
</div>
<div>
<div class="label">Passwort</div>
<input class="input" id="auth-pass" type="password" />
</div>
</div>
<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
<button class="btn secondary" id="auth-cancel">Abbrechen</button>
<button class="btn" id="auth-login">Login</button>
</div>
`);
root.querySelector('#auth-cancel').onclick = ()=> root.innerHTML='';
root.querySelector('#auth-login').onclick = async ()=>{
const email = document.getElementById('auth-email').value.trim();
const pass = document.getElementById('auth-pass').value;
const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
if (error){ alert(error.message); return; }
setUser(data.user);
root.innerHTML='';
};
}


function showRegister(){
const root = modal(`
<h3>Registrieren</h3>
<div class="row">
<div>
<div class="label">E-Mail</div>
<input class="input" id="reg-email" type="email" placeholder="ihr@example.de" />
</div>
<div>
<div class="label">Passwort</div>
<input class="input" id="reg-pass" type="password" />
</div>
</div>
<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
<button class="btn secondary" id="reg-cancel">Abbrechen</button>
<button class="btn" id="reg-create">Konto anlegen</button>
</div>
`);
root.querySelector('#reg-cancel').onclick = ()=> root.innerHTML='';
  root.querySelector('#reg-create').onclick = async ()=>{
    const email = document.getElementById('reg-email').value.trim();
    const pass = document.getElementById('reg-pass').value;
    const { data, error } = await supabase.auth.signUp({ email, password: pass });
    if (error){ alert(error.message); return; }
    setUser(data.user);
    root.innerHTML='';
  };
}

subscribe(mountAuthBox);
