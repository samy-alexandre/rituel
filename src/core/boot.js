// src/core/boot.js
// Orchestration / démarrage de l'application : dernier module importé dans src/main.js.
// Il dépend de tout le reste déjà chargé (window : applyCoachIdentity, navTo, updateBellDot,
// startReminderScheduler, initLeaBubble, checkPaymentReturn, loadProfile, applyProfile,
// saveProfile, renderProfileBadges, renderJournal, sendUserMsg, state, currentUser, sb).
// Migration verbatim depuis public/app.legacy.js — comportement de démarrage strictement identique.

// ===== Enter app =====
function enterApp(){
  document.getElementById('auth').classList.add('hidden');
  document.getElementById('onboarding').classList.remove('active');
  document.getElementById('nav').classList.remove('hidden');
  updateUserUI();
  applyCoachIdentity();
  navTo('home');
  updateBellDot();
  startReminderScheduler();
  initLeaBubble();
  checkPaymentReturn();
}

function updateUserUI(){
  const name = state.name || 'toi';
  const first = name.charAt(0).toUpperCase();
  document.getElementById('topbar-name').textContent = name;
  document.getElementById('topbar-avatar').textContent = first;
  document.getElementById('profile-avatar').textContent = first;
  document.getElementById('profile-name').textContent = name;
  if(currentUser && currentUser.email) document.getElementById('profile-email').textContent = currentUser.email;
  else if(state.email) document.getElementById('profile-email').textContent = state.email;
  renderProfileBadges();
  const d=new Date();
  const days=['DIMANCHE','LUNDI','MARDI','MERCREDI','JEUDI','VENDREDI','SAMEDI'];
  const months=['JANV','FÉVR','MARS','AVRIL','MAI','JUIN','JUIL','AOÛT','SEPT','OCT','NOV','DÉC'];
  document.getElementById('topbar-date').textContent = `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
  const h=d.getHours();
  const gh=document.getElementById('greet-hello'); if(gh) gh.textContent = (h>=5 && h<18) ? 'Bonjour' : 'Bonsoir';
  const gi=document.getElementById('greet-invite');
  if(gi){
    const prenom=(document.getElementById('topbar-name')||{}).textContent||'';
    const soir = !(h>=5 && h<18);
    gi.textContent = soir ? 'Prêt' + (prenom && prenom!=='toi' ? '' : '') + ' pour ton rituel du soir ?' : 'Prêt pour ton rituel du jour ?';
  }
}

// Pont window.* (le HTML inline s'y réfère)
window.enterApp = enterApp;
window.updateUserUI = updateUserUI;

// Chat (Léa) : le listener Enter envoie le message.
document.getElementById('chat-input').addEventListener('keydown',e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); sendUserMsg(); } });

// ===== Init : on regarde si une session existe déjà =====
renderJournal(); // rendu de secours par défaut
setTimeout(function(){
  var a=document.getElementById('auth'), ap=document.getElementById('app'), ob=document.getElementById('onboarding');
  var anyVisible=[a,ap,ob].some(function(el){ return el && getComputedStyle(el).visibility==='visible' && !el.classList.contains('hidden'); });
  if(!anyVisible && a){ a.style.visibility='visible'; }
}, 2000);
(async function init(){
  let session=null;
  try{ const r=await sb.auth.getSession(); session=r.data.session; }catch (e) {
  console.error("catch silencieux (app.legacy.js):", e);
}
  if(session && session.user){
    currentUser = session.user;
    let profile = await loadProfile();
    // filet de sécurité : si la base ne renvoie pas le profil, on lit la copie locale
    let fromCache = false;
    if(!profile || !profile.type_peau){
      try{
        const cached = JSON.parse(localStorage.getItem('rituel_profile_'+currentUser.id) || 'null');
        if(cached && cached.type_peau){
          profile = { prenom: (profile&&profile.prenom)||cached.prenom, type_peau: cached.type_peau, objectifs: JSON.stringify(cached.objectifs||[]), is_premium: (profile&&profile.is_premium)||false };
          fromCache = true;
        }
      }catch (e) {
  console.error("catch silencieux (app.legacy.js):", e);
}
    }
    applyProfile(profile);
    if(!state.name && currentUser.user_metadata && currentUser.user_metadata.prenom){
      state.name = currentUser.user_metadata.prenom;
    }
    if(fromCache){ saveProfile(); } // on tente de réparer la base en arrière-plan
    if(profile && profile.type_peau){
      enterApp();
    } else {
      // connectée mais onboarding pas terminé
      document.getElementById('auth').classList.add('hidden');
      const onbEl=document.getElementById('onboarding');
      onbEl.classList.add('active');
    }
  } else {
    // PAS de session : on révèle l'écran de connexion (et lui seul)
  }
})();
document.addEventListener('touchmove',e=>{ if(e.touches.length>1) e.preventDefault(); },{passive:false});
