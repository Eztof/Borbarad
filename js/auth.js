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
  const root = modal(`<h3>Login</h3><div class="row"><div><div class="label">Nutzername</div><input class="input" id="auth-username" /></div><div><div class="label">Passwort</div><input class="input" type="password" id="auth-password" /></div></div><div style="display:flex;gap:8px;margin-top:10px"><button class="btn secondary" id="auth-cancel">Abbrechen</button><button class="btn" id="auth-login">Login</button></div>`);
  
  root.querySelector('#auth-cancel').onclick = () => {
    root.innerHTML = ''; // Modal schließen
    // ODER root.remove(); // Entfernt das gesamte modal-root Element
  };
  
  root.querySelector('#auth-login').onclick = async () => {
    const username = root.querySelector('#auth-username').value.trim();
    const pass = root.querySelector('#auth-password').value;
    if (!username || !pass){
      alert('Bitte Nutzername und Passwort eingeben.');
      return;
    }
    try {
      // 1. Profil abrufen, um die E-Mail zu erhalten
      const { data: prof, error: perr } = await supabase.from('profiles')
        .select('email_stash')
        .eq('username', username)
        .maybeSingle();

      if (perr) {
        alert(perr.message);
        return;
      }
      if (!prof) {
        alert('Nutzer nicht gefunden.');
        return;
      }

      // 2. Anmeldung mit E-Mail und Passwort
      const { data, error } = await supabase.auth.signInWithPassword({
        email: prof.email_stash,
        password: pass
      });

      if (error) {
        alert(error.message);
        return;
      }

      // *** WICHTIG: Modal schließen, bevor setUser gerufen wird ***
      root.innerHTML = ''; // Leeren des Modals
      // ODER root.remove(); // Alternativ: Komplettes Entfernen

      // 3. State aktualisieren (löst Rerender aus)
      setUser(data.user);
      location.hash = '#/home';

    } catch (err) {
        console.error("Unerwarteter Fehler beim Login:", err);
        alert(`Ein Fehler ist aufgetreten: ${err.message || String(err)}`);
        // Auch bei Fehlern Modal schließen? Oder offen lassen?
        // root.innerHTML = '';
    }
  };
}

function showRegister(){
  const root = modal(`<h3>Registrieren</h3><div class="row"><div><div class="label">Nutzername</div><input class="input" id="reg-username" /></div><div><div class="label">E-Mail</div><input class="input" type="email" id="reg-email" /></div><div><div class="label">Passwort</div><input class="input" type="password" id="reg-password" /></div></div><div style="display:flex;gap:8px;margin-top:10px"><button class="btn secondary" id="reg-cancel">Abbrechen</button><button class="btn" id="reg-register">Registrieren</button></div>`);

  root.querySelector('#reg-cancel').onclick = () => {
    root.innerHTML = ''; // Modal schließen
    // ODER root.remove();
  };

  root.querySelector('#reg-register').onclick = async () => {
    const username = root.querySelector('#reg-username').value.trim();
    const email = root.querySelector('#reg-email').value.trim();
    const password = root.querySelector('#reg-password').value;

    if (!username || !email || !password) {
      alert('Bitte alle Felder ausfüllen.');
      return;
    }

    try {
      // 1. Nutzer registrieren
      const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            username: username // Speichere den Nutzernamen im Metadatenbereich
          }
        }
      });

      if (error) {
        alert(error.message);
        return;
      }

      // 2. Profil erstellen/updaten mit username und email_stash
      const { error: profileError } = await supabase.from('profiles').upsert({
        user_id: data.user.id,
        username: username,
        email_stash: email // Speichere E-Mail separat für Login
      }, { onConflict: 'user_id' });

      if (profileError) {
        console.error("Profil konnte nicht erstellt werden:", profileError);
        alert("Registrierung fast erfolgreich, aber Profil konnte nicht erstellt werden. Bitte kontaktiere den Support.");
        return; // Stoppe hier, da das Profil wichtig ist
      }

      // *** WICHTIG: Modal schließen, bevor setUser gerufen wird ***
      root.innerHTML = ''; // Leeren des Modals
      // ODER root.remove();

      // 3. State aktualisieren (löst Rerender aus)
      // Optional: Direktes Login nach Registrierung, falls nicht per E-Mail bestätigt
      setUser(data.user); // Nur wenn direktes Login gewünscht ist
      

      // Optional: Automatisch anmelden (nur wenn keine E-Mail-Bestätigung nötig ist)
      // Oder: Modal schließen und Nutzer zum Login auffordern
      // root.innerHTML = '';
      // showLogin(); // Wechsle zum Login-Formular

    } catch (err) {
        console.error("Unerwarteter Fehler bei der Registrierung:", err);
        alert(`Ein Fehler ist aufgetreten: ${err.message || String(err)}`);
        // Auch bei Fehlern Modal schließen? Oder offen lassen?
        // root.innerHTML = '';
    }
  };
}

supabase.auth.onAuthStateChange((_ev, session)=>{ setUser(session?.user || null); });
subscribe(mountAuthBox);
