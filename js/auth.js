import { supabase } from './supabaseClient.js';
import { state, setUser } from './state.js';
import { renderAuthBox, modal } from './components.js';
import { subscribe } from './state.js';

function mountAuthBox(){ renderAuthBox(state.user); }

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
        <div class="label">Nutzername</div>
        <input class="input" id="auth-username" />
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
    const username = document.getElementById('auth-username').value.trim();
    const pass = document.getElementById('auth-pass').value;
    if (!username || !pass){ alert('Bitte Nutzername und Passwort eingeben.'); return; }

    const { data: prof, error: perr } = await supabase
      .from('profiles')
      .select('email_stash')
      .eq('username', username)
      .maybeSingle();

    if (perr){ alert(perr.message); return; }
    if (!prof){ alert('Nutzer nicht gefunden.'); return; }

    const { data, error } = await supabase.auth.signInWithPassword({ email: prof.email_stash, password: pass });
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
        <div class="label">Nutzername</div>
        <input class="input" id="reg-username" />
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
    const username = document.getElementById('reg-username').value.trim();
    const pass = document.getElementById('reg-pass').value;
    if (!username || !pass){ alert('Bitte Nutzername und Passwort eingeben.'); return; }

    const email = `${username}@borbarad.local`;

    const { data: exists } = await supabase.from('profiles').select('username').eq('username', username).maybeSingle();
    if (exists){ alert('Nutzername ist bereits vergeben.'); return; }

    const { data, error } = await supabase.auth.signUp({
      email,
      password: pass,
      options: { data: { username } }
    });
    if (error){ alert(error.message); return; }

    const userId = data.user?.id;
    if (userId){
      const { error: perr } = await supabase.from('profiles').insert({ user_id: userId, username, email_stash: email });
      if (perr){ console.warn('profiles insert:', perr.message); }
    }

    setUser(data.user ?? null);
    alert('Registrierung erfolgreich.');
    root.innerHTML='';
  };
}

supabase.auth.onAuthStateChange((_ev, session)=>{ setUser(session?.user || null); });
subscribe(mountAuthBox);
