  // Supabase (client sb), config et utilitaires : voir src/core/. Exposés sur window par main.js.
  // currentUser : état partagé global (voir src/core/state.js), exposé par main.js.

  // ===== State (cache local de l'écran courant) =====
  // state (onboarding) : état partagé global (voir src/core/state.js).  // ===== Auth (session/auth) : voir src/features/auth/auth.js =====
  // Rituel+ (abonnement Stripe) : voir src/features/premium/premium.js


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
  }  // ===== Streak (selon le type de rituel choisi) =====  let _stkCache=null;

  // ===== Jour de repos (joker hebdo qui protège la série) =====
  // ===== Ma journée (sommeil / hydratation / alimentation) =====
  const ALIM_LABELS = ['', 'À améliorer', 'Correcte', 'Équilibrée', 'Bonne', 'Parfaite'];
  window.ALIM_LABELS = ALIM_LABELS; // partagé (contexte chat)  // ===== Rituel : produits perso =====
  // currentRoutineView : état partagé promu dans src/core/state.js (window.currentRoutineView).  // productSort / productCatFilter : état partagé promu dans src/core/state.js (window.productSort / window.productCatFilter).

  // rpForceWelcome : état partagé promu dans src/core/state.js (window.rpForceWelcome).
  // rpSlotView : état partagé promu dans src/core/state.js (window.rpSlotView).
  // isPremium / premiumUntil / premiumCancel : état partagé global (src/core/state.js).  // Datepicker : extrait dans src/features/datepicker/ (exposé sur window par main.js).



  // Chat (Léa) : extrait dans src/features/chat/chat.js (exposé sur window par main.js).
  document.getElementById('chat-input').addEventListener('keydown',e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); sendUserMsg(); } });  // ===== Routine tabs =====  // ===== Récap de la semaine (7 derniers jours) : extrait dans src/features/journal/journal.js (exposé sur window par main.js). =====
  // Léa dans la messagerie (badge + message du jour) : extrait dans src/features/chat/chat.js (exposé sur window par main.js). // ===== Rappels (notifications) : extrait dans src/features/reminders/reminders.js (exposé sur window par main.js). =====
  // Toast : extrait dans src/ui/toast.js (exposé sur window par main.js).

  // ===== Reset (déconnexion + nettoyage local) =====

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
