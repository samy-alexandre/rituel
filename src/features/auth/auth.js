// src/features/auth/auth.js
// Domaine Auth : connexion, inscription, récupération de mot de passe, déconnexion,
// politique de confidentialité, boutons de chargement. Extrait verbatim de
// public/app.legacy.js (allégés des catch « silencieux » → catch documentés).
// Le pont transitoire window.* est conservé pour les handlers onclick inline du HTML.

// Helper transverse : état du bouton (label + désactivation)
function setBtnLoading(btn, loading, labelIdle) {
  if (!btn) return;
  btn.disabled = loading;
  btn.textContent = loading ? 'Un instant…' : labelIdle;
}

// ===== Formulaires / onglets login vs signup =====
function switchAuth(mode) {
  document.getElementById('tab-login').classList.toggle('active', mode === 'login');
  document.getElementById('tab-signup').classList.toggle('active', mode === 'signup');
  document.getElementById('form-login').classList.toggle('hidden', mode !== 'login');
  document.getElementById('form-signup').classList.toggle('hidden', mode !== 'signup');
}

// ===== Landing publique =====
function startAuth(m) {
  const l = document.getElementById('landing');
  if (l) l.classList.add('hidden');
  const b = document.getElementById('auth-back');
  if (b) b.classList.remove('hidden');
  document.querySelector('.auth-toggle').classList.remove('hidden');
  switchAuth(m);
}

function backToLanding() {
  const l = document.getElementById('landing');
  if (l) l.classList.remove('hidden');
  const b = document.getElementById('auth-back');
  if (b) b.classList.add('hidden');
  document.querySelector('.auth-toggle').classList.add('hidden');
  document.getElementById('form-login').classList.add('hidden');
  document.getElementById('form-signup').classList.add('hidden');
}

// ===== Politique de confidentialité =====
function openPolicy() {
  try {
    const pd = document.getElementById('policy-date');
    if (pd)
      pd.textContent = new Date().toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
  } catch (e) {
    // La date n'est qu'un complément : on ne bloque pas l'ouverture de la policy
    console.error('openPolicy (date) :', e);
  }
  document.getElementById('policy').classList.add('open');
}

function closePolicy() {
  document.getElementById('policy').classList.remove('open');
}

// ===== Inscription =====
function pickSignupGenre(g) {
  window.state.signupGenre = g;
  const f = document.getElementById('gp-femme');
  const h = document.getElementById('gp-homme');
  if (f) f.classList.toggle('sel', g === 'femme');
  if (h) h.classList.toggle('sel', g === 'homme');
}

async function doSignup() {
  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim().toLowerCase();
  const pass = document.getElementById('signup-pass').value;
  const age = parseInt(document.getElementById('signup-age').value, 10);
  const err = document.getElementById('signup-error');
  err.textContent = '';
  const btn = document.querySelector('#form-signup .btn');
  if (!name) {
    err.textContent = 'Indiquez votre prénom.';
    return;
  }
  if (!age || age < 13 || age > 120) {
    err.textContent = 'Indique un âge valide.';
    return;
  }
  if (!window.state.signupGenre) {
    err.textContent = 'Indique si tu es une femme ou un homme.';
    return;
  }
  if (!validEmail(email)) {
    err.textContent = 'E-mail invalide.';
    return;
  }
  if (pass.length < 6) {
    err.textContent = 'Mot de passe : 6 caractères minimum.';
    return;
  }
  if (!document.getElementById('signup-consent').checked) {
    err.textContent = 'Veuillez accepter la politique de confidentialité pour continuer.';
    return;
  }
  setBtnLoading(btn, true);
  window.state.age = age;
  window.state.genre = window.state.signupGenre;
  const { data, error } = await window.sb.auth.signUp({
    email,
    password: pass,
    options: { data: { prenom: name, age: age, genre: window.state.signupGenre } },
  });
  setBtnLoading(btn, false, 'Créer mon carnet Rituel');
  if (error) {
    if (/already/i.test(error.message)) err.textContent = 'Un compte existe déjà avec cet e-mail.';
    else err.textContent = error.message;
    return;
  }
  // Si la confirmation par e-mail est activée, pas de session immédiate
  if (!data.session) {
    err.style.color = 'var(--sage)';
    err.textContent = 'Compte créé ! Vérifie ton e-mail pour confirmer, puis connecte-toi.';
    switchAuth('login');
    err.style.color = '';
    return;
  }
  window.currentUser = data.user;
  window.state.name = name;
  document.getElementById('auth').classList.add('hidden');
  const ob = document.getElementById('onboarding');
  ob.classList.add('active');
}

// ===== Connexion =====
async function doLogin() {
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const pass = document.getElementById('login-pass').value;
  const err = document.getElementById('login-error');
  err.textContent = '';
  const btn = document.querySelector('#form-login .btn');
  if (!validEmail(email)) {
    err.textContent = 'E-mail invalide.';
    return;
  }
  setBtnLoading(btn, true);
  const { data, error } = await window.sb.auth.signInWithPassword({ email, password: pass });
  setBtnLoading(btn, false, 'Se connecter');
  if (error) {
    if (/Invalid login/i.test(error.message)) err.textContent = 'E-mail ou mot de passe incorrect.';
    else if (/not confirmed/i.test(error.message))
      err.textContent = "E-mail pas encore confirmé. Vérifie ta boîte mail.";
    else err.textContent = error.message;
    return;
  }
  window.currentUser = data.user;
  const profile = await loadProfile();
  applyProfile(profile);
  if (profile && profile.type_peau) {
    enterApp();
  } else {
    // connecté mais onboarding pas terminé
    document.getElementById('auth').classList.add('hidden');
    const ob = document.getElementById('onboarding');
    ob.classList.add('active');
  }
}

// ===== Mot de passe oublié =====
async function forgotPassword() {
  const email = (document.getElementById('login-email').value || '').trim().toLowerCase();
  const err = document.getElementById('login-error');
  if (!validEmail(email)) {
    if (err) {
      err.style.color = '';
      err.textContent = 'Entre ton e-mail ci-dessus, puis retape « Mot de passe oublié ? ».';
    }
    return;
  }
  try {
    await window.sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin });
    if (err) {
      err.style.color = 'var(--sage)';
      err.textContent = 'E-mail envoyé ! Ouvre le lien reçu pour choisir un nouveau mot de passe.';
    }
  } catch (e) {
    if (err) {
      err.style.color = '';
      err.textContent = "Impossible d'envoyer l'e-mail · réessaie.";
    }
  }
}

// ===== Nouveau mot de passe (lien de récupération) =====
async function pwUpdate() {
  const pwd = document.getElementById('pwreset-input').value;
  const er = document.getElementById('pwreset-error');
  if (er) er.textContent = '';
  if ((pwd || '').length < 6) {
    if (er) er.textContent = '6 caractères minimum.';
    return;
  }
  const btn = document.getElementById('pwreset-btn');
  setBtnLoading(btn, true);
  const { error } = await window.sb.auth.updateUser({ password: pwd });
  setBtnLoading(btn, false, 'Valider mon nouveau mot de passe');
  if (error) {
    if (er) er.textContent = error.message;
    return;
  }
  document.getElementById('pwreset-sheet').classList.remove('open');
  showToast('Mot de passe mis à jour ✓');
}

window.sb.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') {
    const a = document.getElementById('auth');
    if (a) {
      a.classList.remove('hidden');
      a.style.visibility = 'visible';
    }
    const sh = document.getElementById('pwreset-sheet');
    if (sh) sh.classList.add('open');
  }
});

// ===== Déconnexion =====
async function doLogout() {
  await window.sb.auth.signOut();
  location.reload();
}

// Pont transitoire : ces fonctions sont appelées par les handlers onclick inline de index.html.
window.switchAuth = switchAuth;
window.startAuth = startAuth;
window.backToLanding = backToLanding;
window.openPolicy = openPolicy;
window.closePolicy = closePolicy;
window.setBtnLoading = setBtnLoading;
window.pickSignupGenre = pickSignupGenre;
window.doSignup = doSignup;
window.doLogin = doLogin;
window.forgotPassword = forgotPassword;
window.pwUpdate = pwUpdate;
window.doLogout = doLogout;
