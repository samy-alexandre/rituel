  // Supabase (client sb), config et utilitaires : voir src/core/. Exposés sur window par main.js.
  // currentUser : état partagé global (voir src/core/state.js), exposé par main.js.

  // ===== State (cache local de l'écran courant) =====
  // state (onboarding) : état partagé global (voir src/core/state.js).  // ===== Auth (session/auth) : voir src/features/auth/auth.js =====  // ═══════════ Rituel+ (abonnement Stripe) ═══════════
  function refreshPremiumUI(){
    // Carte de vente dans le profil : cachée si déjà abonnée
    const card=document.querySelector('.premium-card');
    if(card) card.style.display = isPremium ? 'none' : '';
    const gere=document.getElementById('premium-manage');
    if(gere) gere.style.display = isPremium ? '' : 'none';
    // Statut lisible : renouvellement prévu, ou abonnement annulé
    const rn=document.getElementById('premium-renew');
    const ti=document.getElementById('premium-title');
    const nt=document.getElementById('premium-note');
    const bt=document.getElementById('premium-btn');
    if(rn && isPremium){
      const dateTxt = premiumUntil
        ? new Date(premiumUntil).toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})
        : null;
      if(premiumCancel){
        if(ti) ti.textContent = 'Rituel+ · annulé';
        rn.textContent = dateTxt ? ('Se termine le '+dateTxt) : 'Se termine à la fin de la période';
        if(nt) nt.innerHTML = 'Ton abonnement ne sera <b>pas renouvelé</b>. Tu gardes tout jusqu\'à cette date 🌸';
        if(bt) bt.textContent = 'Réactiver mon abonnement';
      } else {
        if(ti) ti.textContent = 'Rituel+ actif';
        rn.textContent = dateTxt ? ('Prochain paiement le '+dateTxt) : 'Renouvellement automatique';
        if(nt) nt.innerHTML = 'Renouvellement automatique. Si tu annules, tu gardes l\'accès jusqu\'à la fin de la période déjà payée 🌸';
        if(bt) bt.textContent = 'Gérer ou annuler mon abonnement';
      }
    }
    // Badges "PLUS" : inutiles une fois abonnée
    document.querySelectorAll('.plus-pill').forEach(b=>{ b.style.display = isPremium ? 'none' : ''; });
  }

  // Porte d'entrée unique : renvoie true si l'accès est autorisé, sinon ouvre le paywall
  function requirePlus(raison){
    if(isPremium) return true;
    openPlusSheet(raison);
    return false;
  }

  async function startCheckout(plan){
    if(!currentUser){ showToast('Connecte-toi d\'abord 🌸'); return; }
    const btns=document.querySelectorAll('.plus-buy');
    btns.forEach(b=>{ b.disabled=true; });
    const old=document.getElementById('plus-buy-mois');
    try{
      const { data:{ session } } = await sb.auth.getSession();
      if(!session){ showToast('Reconnecte-toi 🌸'); btns.forEach(b=>{ b.disabled=false; }); return; }
      const r=await fetch('/api/checkout',{
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer '+session.access_token },
        body: JSON.stringify({ plan })
      });
      const d=await r.json();
      if(d && d.url){ window.location.href = d.url; return; }
      showToast(d && d.error ? d.error : 'Paiement indisponible pour le moment 🌸');
    }catch(e){
      showToast('Oups : '+(e.message||'réessaie'));
    }
    btns.forEach(b=>{ b.disabled=false; });
  }

  async function openBillingPortal(){
    if(!currentUser) return;
    try{
      const { data:{ session } } = await sb.auth.getSession();
      const r=await fetch('/api/portal',{ method:'POST', headers:{ 'Authorization':'Bearer '+session.access_token } });
      const d=await r.json();
      if(d && d.url){ window.location.href=d.url; return; }
      showToast(d && d.error ? d.error : 'Indisponible pour le moment 🌸');
    }catch(e){ showToast('Oups : '+(e.message||'réessaie')); }
  }

  // Retour depuis la page de paiement Stripe
  // Le statut peut changer hors de l'app (paiement, annulation) : on revérifie au retour
  document.addEventListener('visibilitychange', async ()=>{
    if(document.visibilityState==='visible' && currentUser){
      try{
        const prof=await loadProfile();
        if(prof && !!prof.is_premium !== isPremium){ applyProfile(prof); }
      }catch (e) {
    console.error("catch silencieux (app.legacy.js):", e);
}
    }
  });

  async function checkPaymentReturn(){
    const p=new URLSearchParams(location.search);
    const r=p.get('paiement');
    if(!r) return;
    history.replaceState({}, '', location.pathname);
    if(r==='ok'){
      showToast('Bienvenue dans Rituel+ 🌸');
      // Le webhook Stripe peut mettre quelques secondes : on rafraîchit le profil
      for(let i=0;i<5;i++){
        await new Promise(res=>setTimeout(res, 1200));
        const prof=await loadProfile();
        if(prof && prof.is_premium){ applyProfile(prof); break; }
      }
    } else if(r==='annule'){
      showToast('Paiement annulé · tu peux réessayer quand tu veux 🌸');
    }
  }

  // ===== Profil (table profiles) =====
  async function loadProfile(){
    if(!currentUser) return null;
    const { data } = await sb.from('profiles').select('*').eq('id', currentUser.id).maybeSingle();
    return data;
  }
  function applyProfile(p){
    if(!p) return;
    isPremium = !!p.is_premium;
    premiumUntil = p.premium_until || null;
    premiumCancel = !!p.premium_cancel;
    refreshPremiumUI();
    if(p.prenom) state.name = p.prenom;
    if(p.type_peau) state.skinType = p.type_peau;
    if(p.objectifs){ try{ const o=JSON.parse(p.objectifs); if(Array.isArray(o)){ state.concerns=o; } else { state.concerns=o.concerns||[]; state.goal=o.goal||null; state.age=o.age||null; } }catch(e){ state.concerns=[]; } }
    state.rituelType = p.rituel_type || state.rituelType || 'both';
    if(p.genre) state.genre = p.genre;
    state.coachGenre = 'femme';
    state.cycleEnabled = !!p.cycle_enabled;
    state.cycleLastStart = p.cycle_last_start || null;
    state.cycleLength = p.cycle_length || 28;
    updateCycleMenuMeta();
    applyCoachIdentity();
    state.email = currentUser ? currentUser.email : '';
  }
  async function saveProfile(){
    if(!currentUser) return;
    const { error } = await sb.from('profiles').upsert({
      id: currentUser.id,
      prenom: state.name,
      type_peau: state.skinType,
      objectifs: JSON.stringify({ concerns: state.concerns||[], goal: state.goal||null, age: state.age||null }),
      genre: state.genre,
      coach_genre: state.coachGenre || 'femme'
    });
    if(error) console.warn('saveProfile:', error.message);
  }

  // ===== RGPD : export et suppression =====
  async function exportData(){
    if(!currentUser){ showToast('Connecte-toi d\'abord'); return; }
    showToast('Préparation de l\'export…');
    const profile = await loadProfile();
    const { data: entries } = await sb.from('entries').select('*').eq('user_id', currentUser.id);
    const payload = { compte:{ email: currentUser.email }, profil: profile, journal: entries||[], exporte_le: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'mes-donnees-rituel.json';
    a.click();
    showToast('Vos données ont été exportées ✓');
  }

  async function deleteAccount(){
    if(!currentUser){ showToast('Connecte-toi d\'abord'); return; }
    if(!await cmAsk({titre:'Supprimer ton compte ?',texte:'Tes photos, ton journal, ton profil et ton compte seront définitivement effacés. Cette action est irréversible.',ok:'Supprimer mon compte',annuler:'Annuler',danger:true})) return;
    showToast('Suppression en cours…');
    try{
      const { data:{ session } } = await sb.auth.getSession();
      const token = session ? session.access_token : '';
      const res = await fetch('/api/delete-account', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer '+token }
      });
      const data = await res.json();
      if(data && data.success){
        try{ localStorage.removeItem('rituel_profile_'+currentUser.id); }catch (e) {
    console.error("catch silencieux (app.legacy.js):", e);
}
        await sb.auth.signOut();
        alert('Ton compte et toutes tes données ont été définitivement supprimés.');
        location.reload();
      } else {
        showToast('Erreur : '+((data && data.error) || 'suppression impossible'));
      }
    }catch(e){
      showToast('Erreur lors de la suppression : '+e.message);
    }
  }

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

  // ===== Profil : badges + édition de la peau =====
  const SKIN_LABELS = { seche:'Peau sèche', mixte:'Peau mixte', grasse:'Peau grasse', sensible:'Peau sensible', normale:'Peau normale' };
  const CONCERN_LABELS = { acne:'Acné', taches:'Taches', rides:'Rides', eclat:'Éclat', pores:'Pores', cernes:'Cernes' };
  window.SKIN_LABELS = SKIN_LABELS; window.CONCERN_LABELS = CONCERN_LABELS; // partagés (ex. contexte chat)
  const SKIN_TYPES = [['seche','🌾','Sèche'],['mixte','🍯','Mixte'],['grasse','✨','Grasse'],['sensible','🌸','Sensible'],['normale','🌿','Normale']];
  window.SKIN_TYPES = SKIN_TYPES;   // partagée avec le module Quiz (lecture via window)
  const CONCERNS = [['acne','🌷','Acné, imperfections'],['taches','🍃','Taches, pigmentation'],['rides','🌹','Rides, fermeté'],['eclat','💫','Éclat, teint terne'],['pores','🌼','Pores dilatés'],['cernes','👁️','Cernes']];

  async function renderProfileBadges(){
    const el = document.getElementById('profile-badges'); if(!el) return;
    let html='';
    if(state.skinType) html += `<span class="badge">${SKIN_LABELS[state.skinType]||'Peau'}</span>`;
    (state.concerns||[]).forEach(c=>{ if(CONCERN_LABELS[c]) html += `<span class="badge">${CONCERN_LABELS[c]}</span>`; });
    const n = currentUser ? await computeStreak() : 0;
    html += `<span class="badge-accent badge">${n>0 ? ('🔥 Série '+n+' j') : '🌱 Pas encore de série'}</span>`;
    el.innerHTML = html;
  }

  let tmpSkin=null, tmpConcerns=[];
  function openSkinSheet(){
    tmpSkin = state.skinType;
    tmpConcerns = [...(state.concerns||[])];
    renderSkinOpts();
    document.getElementById('skin-sheet').classList.add('open');
  }
  function renderSkinOpts(){
    document.getElementById('skin-type-opts').innerHTML = SKIN_TYPES.map(([v,e,l])=>`<button class="onb-opt${tmpSkin===v?' selected':''}" onclick="pickSkin('${v}')"><span class="onb-opt-emoji">${e}</span><div class="onb-opt-text"><div class="onb-opt-title">${l}</div></div><div class="onb-opt-check"></div></button>`).join('');
    document.getElementById('skin-concern-opts').innerHTML = CONCERNS.map(([v,e,l])=>`<button class="onb-opt${tmpConcerns.includes(v)?' selected':''}" onclick="toggleConcern('${v}')"><span class="onb-opt-emoji">${e}</span><div class="onb-opt-text"><div class="onb-opt-title">${l}</div></div><div class="onb-opt-check"></div></button>`).join('');
  }
  function pickSkin(v){ tmpSkin=v; renderSkinOpts(); }
  function toggleConcern(v){ tmpConcerns = tmpConcerns.includes(v) ? tmpConcerns.filter(x=>x!==v) : [...tmpConcerns, v]; renderSkinOpts(); }
  function closeSkinSheet(){ document.getElementById('skin-sheet').classList.remove('open'); }

  async function saveSkinProfile(){
    if(!tmpSkin){ showToast('Choisis un type de peau'); return; }
    state.skinType = tmpSkin;
    state.concerns = tmpConcerns;
    await saveProfile();
    try{ localStorage.setItem('rituel_profile_'+currentUser.id, JSON.stringify({ prenom: state.name, type_peau: state.skinType, objectifs: { concerns: state.concerns||[], goal: state.goal||null } })); }catch (e) {
    console.error("catch silencieux (app.legacy.js):", e);
}
    closeSkinSheet();
    renderProfileBadges();
    showToast('Profil peau mis à jour 🌸');
  }  // ===== Streak (selon le type de rituel choisi) =====  let _stkCache=null;

  // ===== Jour de repos (joker hebdo qui protège la série) =====
  // ===== Ma journée (sommeil / hydratation / alimentation) =====
  const ALIM_LABELS = ['', 'À améliorer', 'Correcte', 'Équilibrée', 'Bonne', 'Parfaite'];
  window.ALIM_LABELS = ALIM_LABELS; // partagé (contexte chat)  // ===== Rituel : produits perso =====
  // currentRoutineView : état partagé promu dans src/core/state.js (window.currentRoutineView).

  // productCatFilter : état partagé promu dans src/core/state.js (window.productCatFilter).
  function toggleCatFilter(){
    const menu=document.getElementById('cat-filter-menu');
    const open = menu.style.display!=='none';
    menu.style.display = open ? 'none' : 'flex';
    document.getElementById('cat-filter-chip').classList.toggle('sel', !open && productCatFilter!=='all');
  }
  // fermer le menu si on clique ailleurs
  document.addEventListener('click', function(e){
    const dd=document.querySelector('.cat-dd');
    const menu=document.getElementById('cat-dd-menu');
    if(dd && menu && !dd.contains(e.target)){ menu.classList.remove('open'); }
  });

    // ═══ Produits : un seul menu, tri + catégorie ═══
  const SORTS = [
    { id:'cat',   n:'Par catégorie' },
    { id:'fav',   n:'Favoris d\'abord' },
    { id:'alpha', n:'De A à Z' },
    { id:'perem', n:'Par date de péremption' }
  ];

  function toggleSortMenu(ev){
    if(ev) ev.stopPropagation();
    const menu=document.getElementById('sort-menu'); if(!menu) return;
    if(menu.classList.contains('open')){ menu.classList.remove('open'); return; }

    const prods = window.__allProducts || [];
    const compte = {};
    prods.forEach(p=>{ const k=p.categorie||'autre'; compte[k]=(compte[k]||0)+1; });

    let html = '<div class="sort-head">Trier par</div>';
    html += SORTS.map(s=>
      '<button type="button" class="sort-opt'+(productSort===s.id?' sel':'')+'" onclick="setProductSort(\''+s.id+'\')">'+
        '<span class="tick">✓</span><span class="lbl">'+s.n+'</span></button>'
    ).join('');

    const utilisees = CATS.filter(x=>compte[x[0]]);
    if(utilisees.length){
      html += '<div class="sort-sep"></div><div class="sort-head">Catégorie</div>';
      html += [['all','Toutes']].concat(utilisees.map(x=>[x[0], x[2]])).map(cat=>{
        const id=cat[0], nom=cat[1];
        const n = (id==='all') ? prods.length : (compte[id]||0);
        return '<button type="button" class="sort-opt'+(productCatFilter===id?' sel':'')+'" onclick="pickCat(\''+id+'\')">'+
          '<span class="tick">✓</span><span class="lbl">'+nom+'</span><span class="cnt">'+n+'</span></button>';
      }).join('');
    }

    menu.innerHTML = html;

    // On sort le menu de l'écran produits et on l'attache au body :
    // tant qu'il reste dedans, il gonfle la hauteur de la page et crée une barre de défilement.
    if(menu.parentElement !== document.body){
      document.body.appendChild(menu);
    }

    const btn = document.getElementById('sort-btn');
    if(btn){
      const r = btn.getBoundingClientRect();
      menu.style.left = Math.max(16, r.left) + 'px';
      menu.style.top  = (r.bottom + 6) + 'px';
      menu.style.right = 'auto';
    }
    menu.classList.add('open');
  }

  function closeSortMenu(){
    const m=document.getElementById('sort-menu');
    if(m) m.classList.remove('open');
  }

  function refreshSortLabel(){
    const el=document.getElementById('sort-label'); if(!el) return;
    if(productCatFilter && productCatFilter!=='all'){
      const info=CATS.find(x=>x[0]===productCatFilter);
      el.textContent = info ? info[2] : 'Catégorie';
      return;
    }
    const s=SORTS.find(x=>x.id===productSort);
    el.textContent = s ? s.n.replace(' d\'abord','').replace('Par date de péremption','Péremption') : 'Trier';
  }

  function pickCat(cat){
    productCatFilter = cat;
    closeSortMenu();
    refreshSortLabel();
    loadProducts();
  }

  // Refermer le menu si on tape ailleurs
  document.addEventListener('click', function(e){
    const menu=document.getElementById('sort-menu');
    if(!menu || !menu.classList.contains('open')) return;
    // Le menu vit désormais dans le <body> : il faut aussi l'exclure du "clic extérieur"
    if(!e.target.closest('.sort-bar') && !e.target.closest('.sort-menu')){
      menu.classList.remove('open');
    }
  });

  // Le menu est fixé à l'écran : on le referme dès que la page bouge
  window.addEventListener('scroll', function(e){
    const m=document.getElementById('sort-menu');
    const t=e.target;
    if(m && t && t.nodeType===1 && (t===m || (t.closest && t.closest('.sort-menu')))) return;
    closeSortMenu();
  }, true);





  function setCatFilter(cat){
    productCatFilter = cat;
    const sel=document.getElementById('cat-filter-select');
    if(sel) sel.classList.toggle('active-filter', cat!=='all');
    loadProducts();
  }

  // rpForceWelcome : état partagé promu dans src/core/state.js (window.rpForceWelcome).
  // rpSlotView : état partagé promu dans src/core/state.js (window.rpSlotView).
  // isPremium / premiumUntil / premiumCancel : état partagé global (src/core/state.js).
      // productSort : état partagé promu dans src/core/state.js (window.productSort).
  function setProductSort(s){
    productSort = s;
    productCatFilter = 'all';   // trier remet la vue complète
    closeSortMenu();
    refreshSortLabel();
    loadProducts();
  }

  // ===== Mode sélection multiple des produits (appui long) =====
  let selectionMode = false;
  let selectedProducts = new Set();
  let longPressTimer = null;

  function startLongPress(id){
    cancelLongPress();
    longPressTimer = setTimeout(function(){
      if(!selectionMode){
        enterSelectionMode();
        toggleProductSelection(id);
        if(navigator.vibrate) navigator.vibrate(40);
      }
    }, 500);
  }
  function cancelLongPress(){ if(longPressTimer){ clearTimeout(longPressTimer); longPressTimer=null; } }

  function onProductCardClick(id, e){
    if(e && e.target && e.target.classList && e.target.classList.contains('pf-fav')) return;
    if(selectionMode){
      if(e) e.stopPropagation();
      toggleProductSelection(id);
    } else {
      openProductBook(id);
    }
  }

  function enterSelectionMode(){
    selectionMode = true;
    selectedProducts.clear();
    document.querySelectorAll('#products-list .sel-circle').forEach(c=>c.style.display='flex');
    document.getElementById('selection-bar').classList.add('show');
  }
  function exitSelectionMode(){
    selectionMode = false;
    selectedProducts.clear();
    document.querySelectorAll('#products-list .sel-circle').forEach(c=>{ c.style.display='none'; c.style.background='transparent'; c.style.borderColor='var(--line)'; c.textContent=''; });
    document.querySelectorAll('#products-list .product-card').forEach(card=>card.style.background='');
    document.getElementById('selection-bar').classList.remove('show');
  }
  function toggleProductSelection(id){
    const card = document.querySelector('#products-list .product-card[data-pid="'+id+'"]');
    if(!card) return;
    const circle = card.querySelector('.sel-circle');
    if(selectedProducts.has(id)){
      selectedProducts.delete(id);
      if(circle){ circle.style.background='transparent'; circle.style.borderColor='var(--line)'; circle.textContent=''; }
      card.style.background='';
    } else {
      selectedProducts.add(id);
      if(circle){ circle.style.background='var(--accent)'; circle.style.borderColor='var(--accent)'; circle.textContent='✓'; }
      card.style.background='var(--blush-soft)';
    }
    // mettre à jour le compteur de la barre
    const cnt=document.getElementById('selection-count');
    if(cnt) cnt.textContent = selectedProducts.size + ' sélectionné' + (selectedProducts.size>1?'s':'');
    // si plus rien de sélectionné, on peut sortir du mode
    if(selectedProducts.size===0) exitSelectionMode();
  }

  // suppression avec confirmation
  function askDeleteSelected(){
    if(selectedProducts.size===0) return;
    document.getElementById('del-confirm-count').textContent = selectedProducts.size>1 ? ('ces '+selectedProducts.size+' produits') : 'ce produit';
    document.getElementById('del-confirm-overlay').style.display='flex';
  }
  function closeDeleteConfirm(){ document.getElementById('del-confirm-overlay').style.display='none'; }
  async function confirmDeleteSelected(){
    const ids = Array.from(selectedProducts);
    closeDeleteConfirm();
    if(!ids.length) return;
    try {
      await sb.from('products').delete().in('id', ids);
      showToast(ids.length>1 ? (ids.length+' produits supprimés 🌸') : 'Produit supprimé 🌸');
    } catch(e){ showToast('Erreur lors de la suppression'); }
    exitSelectionMode();
    loadProducts();
  }

  async function renderRoutineFooter(){
    if(!currentUser) return;
    const { data: all } = await sb.from('products').select('prix').eq('user_id', currentUser.id);
    const arr = all || [];
    let cout=0; arr.forEach(p=>{ const v=parseFloat(p.prix); if(!isNaN(v)) cout+=v; });
    const cv=document.getElementById('cout-val'); if(cv) cv.textContent = cout>0 ? ('~'+Math.round(cout)+'€') : '0€';
    const pc=document.getElementById('prod-count'); if(pc) pc.textContent = arr.length;
  }


  // ===== Swipe-to-dismiss universel sur les fiches (.sheet) =====
  (function(){
    let startY=0, curY=0, startT=0, dragging=false, sheetEl=null, overlayEl=null, active=false;

    function onTouchStart(e){
      const sheet = e.target.closest('.sheet');
      if(!sheet){ sheetEl=null; return; }
      sheetEl = sheet;
      overlayEl = sheet.closest('.sheet-overlay');
      startY = e.touches[0].clientY;
      curY = startY;
      startT = Date.now();
      dragging = true;
      active = false;  // devient vrai seulement si on tire vers le bas en étant en haut
      sheetEl.style.transition = 'none';
    }

    function onTouchMove(e){
      if(!dragging || !sheetEl) return;
      curY = e.touches[0].clientY;
      const dy = curY - startY;  // positif = vers le bas

      // On ne s'active que si : on tire vers le bas ET le contenu est tout en haut
      if(dy > 0 && sheetEl.scrollTop <= 0){
        active = true;
        // léger rubber-band au début (plus doux sur les 40 premiers px)
        const eased = dy < 40 ? dy * 0.6 : (24 + (dy - 40));
        sheetEl.style.transform = 'translateY('+eased+'px)';
        if(overlayEl){ overlayEl.style.background = 'rgba(46,33,28,'+Math.max(0.12, 0.45 - dy/500)+')'; }
        e.preventDefault();
      } else if(active && dy <= 0){
        // on est revenu au-dessus : on annule
        active = false;
        sheetEl.style.transform = 'translateY(0)';
        if(overlayEl){ overlayEl.style.background=''; }
      }
    }

    function onTouchEnd(e){
      if(!dragging || !sheetEl){ dragging=false; return; }
      dragging = false;
      const dy = curY - startY;
      const dt = Date.now() - startT;
      const speed = dy / Math.max(dt,1);  // vitesse du geste (px/ms)
      sheetEl.style.transition = 'transform .28s cubic-bezier(.2,.8,.2,1)';

      // Fermeture si : geste ample (>110px) OU geste rapide vers le bas (flick)
      const shouldClose = active && sheetEl.scrollTop <= 0 && (dy > 110 || (dy > 40 && speed > 0.5));

      if(shouldClose){
        sheetEl.style.transform = 'translateY(100%)';
        const ov = overlayEl, sh = sheetEl;
        setTimeout(function(){
          if(ov) ov.classList.remove('open');
          if(sh){ sh.style.transform=''; sh.style.transition=''; }
          if(ov) ov.style.background='';
        }, 250);
      } else {
        // revenir en place
        sheetEl.style.transform = 'translateY(0)';
        if(overlayEl){ overlayEl.style.background=''; }
      }
      active = false;
    }

    document.addEventListener('touchstart', onTouchStart, {passive:true});
    document.addEventListener('touchmove', onTouchMove, {passive:false});
    document.addEventListener('touchend', onTouchEnd, {passive:true});
  })();

  // Datepicker : extrait dans src/features/datepicker/ (exposé sur window par main.js).


  // ===== Catégories de soins (ordre canonique d'une routine) =====
  const CATS=[['demaquillant','🧼','Démaquillant / baume'],['nettoyant','🫧','Nettoyant'],['toner','💦','Lotion / toner'],['serum','✨','Sérum'],['yeux','👁️','Contour des yeux'],['creme','🧴','Crème hydratante'],['spf','☀️','Protection SPF'],['masque','🎭','Masque / exfoliant'],['cible','🩹','Soin ciblé'],['autre','🌿','Autre']];
  const CAT_RANK={}; CATS.forEach((x,i)=>CAT_RANK[x[0]]=i);
  window.CAT_RANK = CAT_RANK;   // partagée avec le module carnet feuilletable (lecture via window)
  window.CATS = CATS;   // partagée avec le module Fiche produit (lecture via window)
  function catLabel(k){ const f=CATS.find(x=>x[0]===k); return f ? f[1]+' '+f[2] : ''; }



  // Chat (Léa) : extrait dans src/features/chat/chat.js (exposé sur window par main.js).
  document.getElementById('chat-input').addEventListener('keydown',e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); sendUserMsg(); } });

  // ===== Routine tabs =====

  // ===== Journal =====
  function renderJournal(){
    const grid=document.getElementById('journal-grid'); if(!grid) return;
    grid.innerHTML = '<div class="jr-empty"><div class="jr-empty-ico">📷</div>'+
      '<div class="jr-empty-title">Ta première photo</div>'+
      '<div class="jr-empty-sub">Prends-la en lumière naturelle. Dans quelques semaines,<br>tu verras le chemin parcouru 🌸</div>'+
      '<button class="jr-empty-btn" onclick="openPhotoChoice()">Ajouter une photo</button></div>';
  }
  function openEntry(day){ showToast(`Entrée du ${day} · vue détaillée bientôt`); }

  // Charge les vraies entrées du journal depuis Supabase
  // ===== Récap de la semaine (7 derniers jours) =====
  async function loadWeekRecap(){
    const sec=document.getElementById('week-recap'); if(!sec) return;
    if(!currentUser){ sec.style.display='none'; return; }
    try{
      const since=new Date(); since.setDate(since.getDate()-6); const sinceStr=since.toISOString().slice(0,10);
      const { data } = await sb.from('entries').select('*').eq('user_id',currentUser.id).gte('date',sinceStr);
      const es=data||[];
      const byDate={}; es.forEach(e=>{ byDate[e.date] = byDate[e.date] ? {...byDate[e.date], ...e} : e; });
      const days=Object.values(byDate);
      let rituelDays=0, sleepSum=0,sleepN=0, hydSum=0,hydN=0, eclatSum=0,eclatN=0; const moodCount={};
      days.forEach(e=>{
        if(dayComplete(e)) rituelDays++;
        if(e.sommeil!=null){ sleepSum+=Number(e.sommeil); sleepN++; }
        if(e.hydratation!=null){ hydSum+=Number(e.hydratation); hydN++; }
        if(e.score_peau!=null){ eclatSum+=Number(e.score_peau); eclatN++; }
        if(e.humeur){ moodCount[e.humeur]=(moodCount[e.humeur]||0)+1; }
      });
      const MOJI=['','😣','😕','😌','😊','✨'];
      let domMood=null,domN=0; Object.keys(moodCount).forEach(k=>{ if(moodCount[k]>domN){domN=moodCount[k];domMood=k;} });
      const tiles=[];
      tiles.push(['🔥', rituelDays+'/7', 'jours de rituel']);
      if(eclatN) tiles.push(['✨', Math.round(eclatSum/eclatN), 'éclat moyen']);
      if(sleepN) tiles.push(['😴', fmtSleep(sleepSum/sleepN), 'sommeil moyen']);
      if(hydN) tiles.push(['💧', Math.round(hydSum/hydN), 'verres / jour']);
      if(domMood) tiles.push([MOJI[domMood]||'🌸', '', 'humeur dominante']);
      document.getElementById('wr-tiles').innerHTML = tiles.map(t=>`<div style="background:var(--surface-warm);border-radius:14px;padding:12px;text-align:center;"><div style="font-size:22px;">${t[0]}</div>${t[1]!==''?`<div style="font-family:var(--serif);font-size:18px;margin-top:2px;">${t[1]}</div>`:'<div style="height:6px;"></div>'}<div style="font-size:11px;color:var(--muted);margin-top:2px;">${t[2]}</div></div>`).join('');
      let sum;
      if(!days.length) sum='Commence à noter tes journées pour voir ton récap 🌸';
      else if(rituelDays>=6) sum='Quelle régularité · '+rituelDays+' jours de rituel cette semaine ! Ta peau te dit merci 🌸';
      else if(rituelDays>=3) sum='Belle semaine : '+rituelDays+' jours de rituel. On continue en douceur 🌿';
      else if(rituelDays>=1) sum='Un début, c\'est déjà ça ('+rituelDays+' jour'+(rituelDays>1?'s':'')+'). Cette semaine est une nouvelle chance ✨';
      else sum='Rien de noté côté rituel cette semaine · sans culpabilité, on repart tout doucement 🌸';
      document.getElementById('wr-summary').textContent=sum;
      sec.style.display='block';
    }catch(e){ sec.style.display='none'; }
  }

  function openPlusSheet(raison){
    const r=document.getElementById('plus-reason');
    if(r) r.textContent = raison || 'Pour aller plus loin avec ta compagne de soin, sans limite 🌸';
    document.querySelectorAll('.plus-buy').forEach(b=>{ b.disabled=false; });
    document.getElementById('plus-sheet').classList.add('open');
  }
  function closePlusSheet(){ document.getElementById('plus-sheet').classList.remove('open'); }

  // ===== Léa dans la messagerie (badge + message du jour) =====
  function leaSeenKey(){ return 'rituel_leaseen_'+(currentUser?currentUser.id:'x')+'_'+todayStr(); }
  function bellTap(){
    let seen=false; try{ seen=!!localStorage.getItem(leaSeenKey()); }catch (e) {
    console.error("catch silencieux (app.legacy.js):", e);
}
    if(currentUser && !seen){ navTo('chat'); } else { openReminderSheet(); }
  }
  function updateChatBadge(){
    const b=document.getElementById('chat-badge'); if(!b) return;
    let seen=false; try{ seen=!!localStorage.getItem(leaSeenKey()); }catch (e) {
    console.error("catch silencieux (app.legacy.js):", e);
}
    b.style.display = (currentUser && !seen) ? 'inline-block' : 'none';
  }
  let __leaTries=0;
  function leaInjectDaily(){
    if(!currentUser) return;
    const feed=document.getElementById('chat-feed'); if(!feed) return;
    if(feed.querySelector('[data-lea-daily="'+todayStr()+'"]')) { markLeaSeen(); return; }
    const pro=(document.getElementById('lea-proactive-line')||{}).textContent||'';
    let tip=''; try{ tip=localStorage.getItem('rituel_tip_'+currentUser.id+'_'+todayStr())||''; }catch (e) {
    console.error("catch silencieux (app.legacy.js):", e);
}
    if(!tip){ const tb=document.getElementById('lea-tip-body'); tip=tb?tb.textContent:''; if(tip==='Ton conseil du jour arrive… 🌸') tip=''; }
    const full=[pro, tip].filter(Boolean).join('\n\n');
    if(!full){ if(__leaTries<5){ __leaTries++; setTimeout(leaInjectDaily, 1500); } return; }
    const st=document.getElementById('chat-starter'); if(st) st.remove();
    const dv=document.createElement('div'); dv.className='msg msg-ai'; dv.setAttribute('data-lea-daily', todayStr());
    dv.innerHTML=formatMessage(full);
    feed.insertBefore(dv, feed.children[1]||null);
    feed.scrollTop=0;
    markLeaSeen();
  }
  function markLeaSeen(){
    try{ localStorage.setItem(leaSeenKey(),'1'); }catch (e) {
    console.error("catch silencieux (app.legacy.js):", e);
}
    updateChatBadge();
  }

  // ===== Premier bilan de peau (J+5, calcul local, une seule fois) =====
  function bilan5Key(){ return 'rituel_bilan5_'+(currentUser?currentUser.id:'x'); }
  async function maybeShowBilan5(){
    const el=document.getElementById('bilan5-cta'); if(!el) return;
    if(!currentUser){ el.style.display='none'; return; }
    try{ if(localStorage.getItem(bilan5Key())){ el.style.display='none'; return; } }catch (e) {
    console.error("catch silencieux (app.legacy.js):", e);
}
    try{
      const { data } = await sb.from('entries').select('date').eq('user_id', currentUser.id).order('date',{ascending:true}).limit(40);
      const n=new Set((data||[]).map(e=>e.date)).size;
      el.style.display = n>=5 ? 'block' : 'none';
    }catch(e){ el.style.display='none'; }
  }
  async function openBilan5(){
    const body=document.getElementById('bilan5-body');
    document.getElementById('bilan5-sheet').classList.add('open');
    body.innerHTML='<div style="color:var(--muted);font-size:13px;text-align:center;padding:14px 0;">On rassemble tes journées… 🌿</div>';
    try{
      const { data } = await sb.from('entries').select('date,humeur,score_peau,routine_matin,routine_soir,repos,sommeil').eq('user_id', currentUser.id).order('date',{ascending:true}).limit(40);
      const byDate={}; (data||[]).forEach(e=>{ byDate[e.date] = byDate[e.date] ? {...byDate[e.date], ...e} : e; });
      const days=Object.keys(byDate).sort().map(k=>byDate[k]);
      const n=days.length;
      let done=0; const moods=[]; let eclatSum=0, eclatN=0; const prodCount={};
      days.forEach(e=>{
        if(dayComplete(e)) done++;
        if(e.humeur) moods.push(Number(e.humeur));
        if(e.score_peau!=null){ eclatSum+=Number(e.score_peau); eclatN++; }
        [e.routine_matin, e.routine_soir].forEach(arr=>{ if(Array.isArray(arr)) arr.forEach(id=>{ prodCount[id]=(prodCount[id]||0)+1; }); });
      });
      let moodLine=null;
      if(moods.length>=3){
        const h=Math.floor(moods.length/2);
        const a=moods.slice(0,h).reduce((x,y)=>x+y,0)/h;
        const b=moods.slice(h).reduce((x,y)=>x+y,0)/(moods.length-h);
        moodLine = b-a>0.4 ? 'Ton moral a l\u2019air en hausse sur la période 🌸' : (a-b>0.4 ? 'Période douce-amère côté moral · prends soin de toi 🤍' : 'Ton moral est resté stable 🌿');
      }
      let topProd=null, topN=0; Object.keys(prodCount).forEach(k=>{ if(prodCount[k]>topN){ topN=prodCount[k]; topProd=k; } });
      let topName=null;
      if(topProd && topN>=3){
        try{ const { data: p } = await sb.from('products').select('nom').eq('id', topProd).single(); topName=p&&p.nom; }catch (e) {
    console.error("catch silencieux (app.legacy.js):", e);
}
      }
      const ratio=n?done/n:0;
      const conseil = ratio>=0.8
        ? 'Ta régularité est ta vraie force. Garde exactement cette routine encore quelques jours avant de changer quoi que ce soit, c\u2019est comme ça qu\u2019on voit ce qui marche 🌸'
        : (ratio>=0.4
          ? 'De belles bases ! Pour gagner en constance, accroche ton rituel à une habitude déjà installée, juste après le brossage de dents par exemple 🌿'
          : 'On simplifie : vise seulement 3 étapes cette semaine. La constance compte plus que la quantité, le reste viendra tout seul ✨');
      const rows=[];
      rows.push(['📅','<b>'+n+' jours</b> de suivi · bravo, c\u2019est le plus dur qui est fait']);
      rows.push(['🔥','Rituel complet <b>'+done+' jour'+(done>1?'s':'')+' sur '+n+'</b>']);
      if(moodLine) rows.push(['💛', moodLine]);
      if(eclatN) rows.push(['✨','Éclat moyen : <b>'+Math.round(eclatSum/eclatN)+'</b>']);
      if(topName) rows.push(['🧴','Ton produit le plus régulier : <b>'+escapeHtml(topName)+'</b>']);
      rows.push(['💬','<i>'+conseil+' · '+coachName()+'</i>']);
      body.innerHTML = rows.map(r=>'<div style="display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-bottom:1px solid var(--line);"><span style="font-size:18px;">'+r[0]+'</span><span style="flex:1;">'+r[1]+'</span></div>').join('');
    }catch(e){
      body.innerHTML='<div style="color:var(--muted);font-size:13px;text-align:center;padding:14px 0;">Oups, réessaie dans un instant 🌿</div>';
    }
  }
  function closeBilan5(){
    document.getElementById('bilan5-sheet').classList.remove('open');
    try{ localStorage.setItem(bilan5Key(),'1'); }catch (e) {
    console.error("catch silencieux (app.legacy.js):", e);
}
    const el=document.getElementById('bilan5-cta'); if(el) el.style.display='none';
  }  // ===== Tap en dehors d'une fenêtre = fermeture (smooth) =====
  document.addEventListener('click', (e)=>{
    const t=e.target;
    if(t && t.classList && t.classList.contains('sheet-overlay') && t.classList.contains('open')){
      t.classList.remove('open');
      try{ stopBcCamera(); }catch (_e) {
    console.error("catch silencieux (app.legacy.js):", _e);
}
      try{ tlStop(); }catch (_e) {
    console.error("catch silencieux (app.legacy.js):", _e);
}
      try{ camStop(); }catch (_e) {
    console.error("catch silencieux (app.legacy.js):", _e);
}
    }
  });

  // ===== Petit mot proactif de Léa (1×/jour, doux, jamais culpabilisant) =====
  async function loadLeaProactive(e){
    const line=document.getElementById('lea-proactive-line'); if(!line) return;
    if(!currentUser){ line.textContent=''; return; }
    let streak=0; try{ streak=await computeStreak(); }catch (err) {
    console.error("catch silencieux (app.legacy.js):", err);
}
    const h=new Date().getHours();
    const done = e && dayComplete(e);
    const hasPhoto = e && e.photo_path;
    const fier = 'fière';
    let msg;
    if(streak>0 && streak%7===0){ msg='Waouh, '+streak+' jours de rituel · je suis si '+fier+' de toi 🌟'; }
    else if(done && !hasPhoto){ msg='Rituel fait, bravo ✨ Une petite photo pour garder une trace ?'; }
    else if(done){ msg='Ton rituel est fait pour aujourd\'hui, bravo 💛'; }
    else if(h<12){ msg='Coucou 🌸 Un petit rituel pour bien démarrer la journée ?'; }
    else if(h<18){ msg='Ta peau attend son petit moment rituel aujourd\'hui 🌿'; }
    else { msg='Bonsoir 🌙 Un rituel du soir avant de dormir ?'; }
    line.textContent=msg;
  }

  function baSlide(v){
    v=Number(v);
    const b=document.getElementById('ba-before-img'); if(b) b.style.clipPath='inset(0 '+(100-v)+'% 0 0)';
    const l=document.getElementById('ba-line'); if(l) l.style.left=v+'%';
    const k=document.getElementById('ba-knob'); if(k) k.style.left=v+'%';
  }
  // ===== La lettre du mois (1 appel IA/mois, en cache) =====
  function bilanKey(){ const d=new Date(); return 'rituel_bilan_'+(currentUser?currentUser.id:'x')+'_'+d.getFullYear()+'-'+(d.getMonth()+1); }

  // ===== Souvenir : une photo d'il y a un moment =====
  async function loadMemory(){
    const sec=document.getElementById('memory-section'); if(!sec) return;
    sec.style.display='none';
    if(!currentUser) return;
    try{
      const lim=new Date(); lim.setDate(lim.getDate()-30);
      const { data } = await sb.from('entries').select('date,photo_path').eq('user_id',currentUser.id).not('photo_path','is',null).lte('date',lim.toISOString().slice(0,10)).order('date',{ascending:false}).limit(1);
      const row=(data&&data[0])||null; if(!row) return;
      const url=await signedPhoto(row.photo_path); if(!url) return;
      const days=Math.round((new Date(todayStr())-new Date(row.date))/86400000);
      document.getElementById('memory-img').src=url;
      document.getElementById('memory-caption').textContent='Cette photo date d\'il y a '+days+' jours · regarde le chemin parcouru 🌸';
      sec.style.display='block';
    }catch (e) {
    console.error("catch silencieux (app.legacy.js):", e);
}
  }

  // ===== Tes découvertes (corrélations douces, jamais culpabilisantes) =====
  async function loadInsights(){
    if(!isPremium){ const s=document.getElementById('insights-section'); if(s) s.style.display='none'; return; }
    const sec=document.getElementById('insights-section'); if(!sec) return;
    sec.style.display='none';
    if(!currentUser) return;
    try{
      const since=new Date(); since.setDate(since.getDate()-60);
      const { data } = await sb.from('entries').select('date,sommeil,hydratation,score_peau,humeur,routine_matin,routine_soir,repos').eq('user_id',currentUser.id).gte('date',since.toISOString().slice(0,10));
      const byDate={}; (data||[]).forEach(e=>{ byDate[e.date]=byDate[e.date]?{...byDate[e.date],...e}:e; });
      const days=Object.values(byDate);
      const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
      const out=[];
      const sHi=days.filter(d=>d.sommeil!=null&&d.score_peau!=null&&Number(d.sommeil)>=7).map(d=>Number(d.score_peau));
      const sLo=days.filter(d=>d.sommeil!=null&&d.score_peau!=null&&Number(d.sommeil)<7).map(d=>Number(d.score_peau));
      if(sHi.length>=3&&sLo.length>=3){ const diff=Math.round(avg(sHi)-avg(sLo)); if(diff>=4) out.push(['😴','Les jours où tu dors 7 h ou plus, ton éclat est en moyenne '+diff+' points plus haut. Ton sommeil te va bien ✨']); }
      const hHi=days.filter(d=>d.hydratation!=null&&d.score_peau!=null&&Number(d.hydratation)>=6).map(d=>Number(d.score_peau));
      const hLo=days.filter(d=>d.hydratation!=null&&d.score_peau!=null&&Number(d.hydratation)<6).map(d=>Number(d.score_peau));
      if(hHi.length>=3&&hLo.length>=3){ const diff=Math.round(avg(hHi)-avg(hLo)); if(diff>=4) out.push(['💧','Quand tu bois 6 verres ou plus, ton éclat gagne souvent '+diff+' points. Ta peau aime l\'eau 🌊']); }
      const mOn=days.filter(d=>dayComplete(d)&&d.humeur).map(d=>Number(d.humeur));
      const mOff=days.filter(d=>!dayComplete(d)&&d.humeur).map(d=>Number(d.humeur));
      if(mOn.length>=3&&mOff.length>=3){ const diff=avg(mOn)-avg(mOff); if(diff>=0.5) out.push(['🌸','Les jours de rituel, ton humeur est souvent plus douce. Prendre soin de soi, ça se sent 💛']); }
      if(!out.length) return;
      document.getElementById('insights-list').innerHTML=out.slice(0,2).map(i=>'<div class="ba-card" style="gap:12px;"><div style="font-size:24px;flex-shrink:0;">'+i[0]+'</div><div style="font-size:13.5px;color:var(--ink-soft);line-height:1.5;">'+i[1]+'</div></div>').join('');
      sec.style.display='block';
    }catch (e) {
    console.error("catch silencieux (app.legacy.js):", e);
}
  }

  // ═══ Vue d'ensemble + Évolution de la peau (Journal) ═══
  let evEntries = [];
  let evMetric = 'score_peau';
  let evPeriod = 7;   // 7 jours, 30 jours ou 365 jours

  async function loadOverview(){
    const ovSec=document.getElementById('ov-section'), evSec=document.getElementById('ev-section');
    if(!ovSec) return;
    if(!currentUser){ ovSec.style.display='none'; if(evSec) evSec.style.display='none'; return; }
    const since=new Date(); since.setDate(since.getDate()-6);
    const sinceStr=since.toISOString().slice(0,10);
    let es=[];
    try{
      const { data } = await sb.from('entries').select('*').eq('user_id',currentUser.id).gte('date',sinceStr).order('date',{ascending:true});
      es=data||[];
    }catch(e){ es=[]; }
    // fusion par date
    const byDate={}; es.forEach(e=>{ byDate[e.date]=byDate[e.date]?{...byDate[e.date],...e}:e; });
    const days=Object.values(byDate);

    // ── 4 tuiles ──
    let rituelDays=0, photoN=0, scoreSum=0,scoreN=0; const moodCount={};
    days.forEach(e=>{
      if(dayComplete(e)) rituelDays++;
      if(e.photo_path) photoN++;
      if(e.score_peau!=null){ scoreSum+=Number(e.score_peau); scoreN++; }
      if(e.humeur){ moodCount[e.humeur]=(moodCount[e.humeur]||0)+1; }
    });
    const regularite = Math.round((rituelDays/7)*100);
    const MOODS={1:'Difficile',2:'Mitigée',3:'Correcte',4:'Bonne',5:'Rayonnante'};
    let domMood=null,domN=0; Object.keys(moodCount).forEach(k=>{ if(moodCount[k]>domN){domN=moodCount[k];domMood=k;} });
    const moodLabel = domMood ? (MOODS[domMood]||'—') : '—';

    const sparkScore = sparkline(days.map(e=>e.score_peau!=null?Number(e.score_peau):null));
    const sparkReg = sparkline(days.map(e=>dayComplete(e)?1:0), true);

    const tiles=[
      {ico:'🌿', val:rituelDays, sub:'Rituels réalisés<br>/ 7 jours', spark:sparkReg},
      {ico:'📊', val:regularite+'%', sub:'Régularité', spark:sparkScore},
      {ico:'📸', val:photoN, sub:'Photos ajoutées', spark:''},
      {ico:'🌸', val:moodLabel, sub:'Humeur<br>dominante', spark:'', small:true}
    ];
    document.getElementById('ov-tiles').innerHTML = tiles.map(t=>
      '<div class="ov-tile"><div class="top"><div class="ov-ico">'+t.ico+'</div>'+(t.spark||'')+'</div>'+
      '<div class="ov-val"'+(t.small?' style="font-size:19px;margin-top:12px;"':'')+'>'+t.val+'</div>'+
      '<div class="ov-lbl">'+t.sub+'</div></div>'
    ).join('');
    ovSec.style.display='block';

    // ── Évolution ──
    if(evSec){ evSec.style.display='block'; loadEvData(); }
  }

  function sparkline(vals, isBinary){
    const pts = vals.filter(v=>v!=null);
    if(pts.length<2) return '';
    const max = isBinary?1:Math.max(...pts), min=isBinary?0:Math.min(...pts);
    const range = (max-min)||1;
    const W=54,H=30;
    const step = W/(vals.length-1);
    let d='', started=false, x=0;
    vals.forEach((v,i)=>{
      x=i*step;
      if(v==null){ return; }
      const y = H-2 - ((v-min)/range)*(H-4);
      d += (started?'L':'M')+x.toFixed(1)+','+y.toFixed(1)+' ';
      started=true;
    });
    return '<svg class="ov-spark" viewBox="0 0 '+W+' '+H+'"><path d="'+d+'" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  // Charge les données du graphe selon la période choisie (7 j, 1 mois, 1 an)
  async function loadEvData(){
    if(!currentUser){ evEntries=[]; renderEvChart(); return; }
    const since=new Date(); since.setDate(since.getDate()-(evPeriod-1));
    try{
      const { data } = await sb.from('entries')
        .select('date,score_peau,hydratation,humeur')
        .eq('user_id',currentUser.id)
        .gte('date', since.toISOString().slice(0,10))
        .order('date',{ascending:true});
      // Une entrée par date (on fusionne les doublons)
      const byDate={};
      (data||[]).forEach(e=>{ byDate[e.date] = byDate[e.date] ? {...byDate[e.date], ...e} : e; });
      evEntries = Object.keys(byDate).sort().map(k=>byDate[k]);
    }catch(e){ evEntries=[]; }
    renderEvChart();
  }

  function evSetPeriod(p){
    evPeriod = p;
    document.querySelectorAll('.ev-p').forEach(b=>b.classList.toggle('sel', Number(b.dataset.p)===p));
    loadEvData();
  }

  // Prépare les points à tracer : jour par jour, ou moyenne par mois sur un an
  function evPoints(){
    const MOIS=['J','F','M','A','M','J','J','A','S','O','N','D'];
    const val = e => {
      const v = e[evMetric];
      return (v!==null && v!==undefined && v!=='') ? Number(v) : null;
    };
    if(evPeriod <= 31){
      return evEntries.map(e=>({ label: String(parseInt(e.date.slice(8,10),10)), v: val(e) }));
    }
    // Un an : on moyenne par mois pour rester lisible
    const parMois={};
    evEntries.forEach(e=>{
      const v=val(e); if(v===null) return;
      const m=e.date.slice(0,7);
      if(!parMois[m]) parMois[m]={somme:0, n:0};
      parMois[m].somme+=v; parMois[m].n++;
    });
    return Object.keys(parMois).sort().map(m=>({
      label: MOIS[parseInt(m.slice(5,7),10)-1],
      v: Math.round((parMois[m].somme/parMois[m].n)*10)/10
    }));
  }

  function evSetMetric(m){
    evMetric=m;
    document.querySelectorAll('.ev-tab').forEach(b=>b.classList.toggle('sel', b.dataset.metric===m));
    renderEvChart();
  }

  function renderEvChart(){
    const host=document.getElementById('ev-card'); if(!host) return;
    const pts = evPoints();
    const avecValeur = pts.filter(p=>p.v!==null);

    if(avecValeur.length < 1){
      const quand = evPeriod===7 ? 'cette semaine' : (evPeriod===30 ? 'ce mois-ci' : 'cette année');
      host.innerHTML='<div style="text-align:center;color:var(--muted);font-size:12.5px;padding:26px 0;">Pas encore de données '+quand+' 🌸<br>Note l\'état de ta peau pour voir ta courbe apparaître.</div>';
      return;
    }

    const isMood = evMetric==='humeur';
    const max = isMood ? 5 : 100;
    const min = isMood ? 1 : 0;
    const W=300, H=126, padL=10, padR=10, padT=16, padB=24;
    const iw=W-padL-padR, ih=H-padT-padB;
    const n=pts.length;
    const xOf = i => padL + (n<=1 ? iw/2 : (i/(n-1))*iw);
    const yOf = v => padT + ih - ((v-min)/((max-min)||1))*ih;

    // Courbe + aire (on ne relie que les points renseignés)
    let line='';
    avecValeur.forEach((p,k)=>{
      const i = pts.indexOf(p);
      line += (k?'L':'M') + xOf(i).toFixed(1) + ',' + yOf(p.v).toFixed(1) + ' ';
    });
    const iPremier = pts.indexOf(avecValeur[0]);
    const iDernier = pts.indexOf(avecValeur[avecValeur.length-1]);
    const area = 'M'+xOf(iPremier).toFixed(1)+','+(padT+ih)+' '+line.replace(/^M/,'L')+' L'+xOf(iDernier).toFixed(1)+','+(padT+ih)+' Z';

    // Points : discrets si nombreux
    const gros = avecValeur.length <= 14;
    let dots='';
    avecValeur.forEach(p=>{
      const i=pts.indexOf(p);
      dots += '<circle cx="'+xOf(i).toFixed(1)+'" cy="'+yOf(p.v).toFixed(1)+'" r="'+(gros?3.5:2)+'" fill="var(--accent)"/>';
    });

    // Libellés de l'axe : on en saute si trop nombreux
    const pas = n<=8 ? 1 : Math.ceil(n/7);
    let labels='';
    pts.forEach((p,i)=>{
      if(i % pas !== 0 && i !== n-1) return;
      labels += '<text x="'+xOf(i).toFixed(1)+'" y="'+(H-7)+'" font-size="9" fill="var(--muted)" text-anchor="middle">'+p.label+'</text>';
    });

    const dernier = avecValeur[avecValeur.length-1];
    const valeurTxt = isMood
      ? ['','Difficile','Mitigée','Correcte','Bonne','Rayonnante'][Math.round(dernier.v)] || ''
      : dernier.v + '/100';
    const entete = '<text x="'+(W-padR)+'" y="11" font-size="11" fill="var(--accent)" text-anchor="end" font-weight="600">'+valeurTxt+'</text>';

    host.innerHTML =
      '<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:auto;display:block;overflow:visible;">'+
        '<path d="'+area+'" fill="var(--blush-soft)" opacity="0.5"/>'+
        '<path d="'+line+'" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>'+
        dots + labels + entete +
      '</svg>';
  }

  async function loadSuiviAccroche(){
    const host=document.getElementById('suivi-accroche'); if(!host) return;
    if(!currentUser){ host.style.display='none'; return; }
    const since=new Date(); since.setDate(since.getDate()-13);
    let es=[];
    try{
      const { data } = await sb.from('entries').select('date,score_peau').eq('user_id',currentUser.id).gte('date',since.toISOString().slice(0,10)).order('date',{ascending:true});
      es=data||[];
    }catch(e){ es=[]; }
    const byDate={}; es.forEach(e=>{ if(e.score_peau!=null) byDate[e.date]=Number(e.score_peau); });
    const vals=Object.keys(byDate).sort().map(k=>byDate[k]);
    if(vals.length<2){ host.style.display='none'; return; }
    const first=vals[0], last=vals[vals.length-1], delta=last-first;
    let phrase, emoji;
    if(delta>=5){ phrase='Ta peau progresse joliment'; emoji='🌿'; }
    else if(delta>=0){ phrase='Ta peau reste stable, continue'; emoji='🌸'; }
    else { phrase='Chaque jour compte, garde le rythme'; emoji='💧'; }
    const max=Math.max(...vals), min=Math.min(...vals), range=(max-min)||1;
    const W=300,H=54, step=W/(vals.length-1);
    let d='';
    vals.forEach((v,i)=>{ const x=i*step, y=H-4-((v-min)/range)*(H-8); d+=(i?'L':'M')+x.toFixed(1)+','+y.toFixed(1)+' '; });
    const area='M0,'+H+' '+d.replace(/^M/,'L')+' L'+W+','+H+' Z';
    host.innerHTML =
      '<div style="background:linear-gradient(150deg,#FFFEFB,#FAF3EA);border-radius:20px;padding:16px 18px;box-shadow:0 12px 30px rgba(46,33,28,0.08);">'+
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">'+
          '<div style="display:flex;align-items:center;gap:9px;"><span style="font-size:22px;">'+emoji+'</span><span style="font-family:var(--serif);font-size:16px;color:var(--ink);">'+phrase+'</span></div>'+
          (delta!==0?'<span style="font-size:12px;font-weight:600;color:'+(delta>0?'#3E7A4E':'var(--accent)')+';">'+(delta>0?'+':'')+delta+'</span>':'')+
        '</div>'+
        '<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:auto;display:block;overflow:visible;">'+
          '<path d="'+area+'" fill="var(--blush-soft)" opacity="0.5"/>'+
          '<path d="'+d+'" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>'+
          '<circle cx="'+((vals.length-1)*step).toFixed(1)+'" cy="'+(H-4-((last-min)/range)*(H-8)).toFixed(1)+'" r="4" fill="var(--accent)"/>'+
        '</svg>'+
      '</div>';
    host.style.display='block';
  }

      async function loadJournalFromDB(){
    const grid=document.getElementById('journal-grid'); if(!grid) return;
    loadSuiviAccroche();
    loadOverview();
    loadWeekRecap();
    loadMemory();
    loadInsights();
    loadBeforeAfter();
    loadEclatGraph();
    if(!currentUser){ renderJournal(); return; }
    const { data } = await sb.from('entries').select('*').eq('user_id', currentUser.id).order('date',{ascending:false}).limit(30);
    if(!data || !data.length){ renderJournal(); return; }
    // On ne montre QUE les vraies photos : pas de fausses vignettes de peau.
    let html='';
    let nbPhotos=0;
    for(const e of data){
      const url = await signedPhoto(e.photo_path);
      if(!url) continue;
      nbPhotos++;
      const day = e.date ? parseInt(e.date.slice(8,10),10) : '';
      const sc = e.score_peau||0;
      const dot = sc>=80?'var(--sage)':(sc>=70?'var(--gold)':'var(--accent)');
      html+=`<div class="journal-cell" onclick="openEntry('${e.date}')"><img src="${url}" alt="Photo du ${day}" style="width:100%;height:100%;object-fit:cover;"><div class="journal-cell-date">${day}</div><div class="journal-cell-dot" style="background:${dot};"></div></div>`;
    }

    if(!nbPhotos){
      // Aucune photo encore : une invitation douce, pas une grille vide
      grid.innerHTML = '<div class="jr-empty"><div class="jr-empty-ico">📷</div>'+
        '<div class="jr-empty-title">Ta première photo</div>'+
        '<div class="jr-empty-sub">Prends-la en lumière naturelle. Dans quelques semaines,<br>tu verras le chemin parcouru 🌸</div>'+
        '<button class="jr-empty-btn" onclick="openPhotoChoice()">Ajouter une photo</button></div>';
      return;
    }

    html += '<div class="journal-cell add" onclick="openPhotoChoice()"><span>+</span></div>';
    grid.innerHTML = html;
  }

  // ===== Calendrier du Journal =====
  const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  let calRef = (function(){ const d=new Date(); d.setDate(1); return d; })();
  function calMonth(delta){ calRef.setMonth(calRef.getMonth()+delta); renderCalendar(); }
  async function renderCalendar(){
    const grid=document.getElementById('cal-grid'); if(!grid || !currentUser) return;
    const year=calRef.getFullYear(), month=calRef.getMonth();
    document.getElementById('cal-title').textContent = MONTHS_FR[month]+' '+year;
    const first=new Date(year, month, 1);
    const lastDay=new Date(year, month+1, 0).getDate();
    const startStr=year+'-'+pad2(month+1)+'-01';
    const endStr=year+'-'+pad2(month+1)+'-'+pad2(lastDay);
    const { data } = await sb.from('entries').select('date,photo_path,humeur,routine_matin,routine_soir,sommeil,hydratation,alimentation,note,repos').eq('user_id', currentUser.id).gte('date', startStr).lte('date', endStr);
    const map={}; (data||[]).forEach(e=>{ map[e.date]=e; });
    const { data: hlogs } = await sb.from('habit_logs').select('date').eq('user_id', currentUser.id).gte('date', startStr).lte('date', endStr);
    const habitDays=new Set((hlogs||[]).map(l=>l.date));
    let wd=first.getDay(); const offset=(wd===0)?6:(wd-1); // lundi en 1er
    const tStr=todayStr();
    let html='';
    for(let i=0;i<offset;i++) html+='<div class="cal-cell empty"></div>';
    for(let d=1; d<=lastDay; d++){
      const ds=year+'-'+pad2(month+1)+'-'+pad2(d);
      const e=map[ds];
      const isFuture=ds>tStr, isToday=ds===tStr;
      const complete = dayComplete(e);
      const hasEntry = (e && (e.photo_path || e.humeur || e.sommeil!=null || e.hydratation!=null || e.alimentation!=null || e.routine_matin || e.routine_soir || e.note)) || habitDays.has(ds);
      let cls='cal-cell';
      if(complete) cls+=' complete';
      if(isToday) cls+=' today';
      if(isFuture) cls+=' cal-future';
      const tappable = !isFuture;
      if(tappable) cls+=' has';
      const cam = (e && e.photo_path) ? '<span class="cal-cam">📷</span>' : '';
      const rest = (e && e.repos) ? '<span class="cal-rest">☁️</span>' : '';
      const dot = (hasEntry && !complete) ? '<span class="cal-dot"></span>' : '';
      const oc = tappable ? ` onclick="openDayDetail('${ds}')"` : '';
      html += `<div class="${cls}"${oc}>${cam}${rest}<span>${d}</span>${dot}</div>`;
    }
    grid.innerHTML=html;
  }
  // ===== Fiche d'un jour (modifiable) =====
  let ddState = { date:null, mood:null, photoFile:null, photoPath:null, hadSom:false, hadHyd:false, hadAli:false, somTouched:false, hydTouched:false, aliTouched:false };
  async function getEntryIdForDate(ds){
    if(!currentUser) return null;
    const { data } = await sb.from('entries').select('id').eq('user_id', currentUser.id).eq('date', ds).order('created_at',{ascending:true}).limit(1);
    if(data && data.length) return data[0].id;
    const { data: ins, error } = await sb.from('entries').insert({ user_id: currentUser.id, date: ds }).select('id').single();
    if(error){ console.warn('getEntryIdForDate:', error.message); return null; }
    return ins ? ins.id : null;
  }
  function ddTouch(k){ if(k==='som') ddState.somTouched=true; if(k==='hyd') ddState.hydTouched=true; if(k==='ali') ddState.aliTouched=true; }
  function ddHydraLbl(v){ const n=parseInt(v,10); document.getElementById('dd-hydra-val').textContent = n+(n>1?' verres':' verre'); }
  function ddPickMood(el,val){
    document.querySelectorAll('#dd-mood-row .mood-btn').forEach(b=>b.classList.remove('selected'));
    el.classList.add('selected');
    ddState.mood = val;
    document.getElementById('dd-intensity-box').classList.remove('hidden');
  }
  function ddPhotoPreview(input){
    const f=input.files[0]; if(!f) return;
    ddState.photoFile=f;
    const r=new FileReader(); r.onload=ev=>{ document.getElementById('dd-photo-wrap').innerHTML=`<img src="${ev.target.result}" style="width:100%;border-radius:16px;display:block;">`; }; r.readAsDataURL(f);
  }
  async function openDayDetail(ds){
    if(!currentUser) return;
    const { data } = await sb.from('entries').select('*').eq('user_id', currentUser.id).eq('date', ds).order('created_at',{ascending:true}).limit(1);
    const e=(data && data.length)?data[0]:null;
    const [y,m,d]=ds.split('-').map(Number);
    const dObj=new Date(y, m-1, d);
    const jours=['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
    document.getElementById('dd-title').textContent = jours[dObj.getDay()]+' '+d+' '+MONTHS_FR[m-1].toLowerCase();

    ddState = { date:ds, mood:(e&&e.humeur)||null, photoFile:null, photoPath:(e&&e.photo_path)||null,
      hadSom: !!(e && e.sommeil!=null), hadHyd: !!(e && e.hydratation!=null), hadAli: !!(e && e.alimentation!=null),
      somTouched:false, hydTouched:false, aliTouched:false };

    // photo
    const pw=document.getElementById('dd-photo-wrap');
    if(e && e.photo_path){ const url=await signedPhoto(e.photo_path); pw.innerHTML = url?`<img src="${url}" style="width:100%;border-radius:16px;display:block;">`:''; }
    else pw.innerHTML = `<div style="background:var(--surface-warm);border-radius:16px;padding:24px;text-align:center;color:var(--muted);font-size:13px;">Pas de photo ce jour</div>`;

    // humeur
    document.querySelectorAll('#dd-mood-row .mood-btn').forEach(b=>b.classList.remove('selected'));
    const ibox=document.getElementById('dd-intensity-box');
    if(e && e.humeur){
      const btns=document.querySelectorAll('#dd-mood-row .mood-btn'); if(btns[e.humeur-1]) btns[e.humeur-1].classList.add('selected');
      ibox.classList.remove('hidden');
      document.getElementById('dd-intensity').value = e.humeur_intensite!=null ? e.humeur_intensite : 50;
      document.getElementById('dd-intensity-val').textContent = (e.humeur_intensite!=null?e.humeur_intensite:50)+'%';
    } else { ibox.classList.add('hidden'); document.getElementById('dd-intensity').value=50; document.getElementById('dd-intensity-val').textContent='50%'; }

    // sommeil / hydra / alim
    const som = (e&&e.sommeil!=null)?e.sommeil:7; document.getElementById('dd-sommeil').value=som; document.getElementById('dd-sommeil-val').textContent=fmtSleep(som);
    const hyd = (e&&e.hydratation!=null)?e.hydratation:6; document.getElementById('dd-hydra').value=hyd; ddHydraLbl(hyd);
    const ali = (e&&e.alimentation!=null)?e.alimentation:3; document.getElementById('dd-alim').value=ali; document.getElementById('dd-alim-val').textContent=ALIM_LABELS[ali]||'…';

    // routines + note
    document.getElementById('dd-matin').checked = !!(e && e.routine_matin);
    document.getElementById('dd-soir').checked = !!(e && e.routine_soir);
    document.getElementById('dd-note').value = (e && e.note) ? e.note : '';
    await renderDayHabits(ds);

    document.getElementById('day-detail').classList.add('open');
  }
  async function saveDayDetail(){
    if(!currentUser || !ddState.date) return;
    showToast('Enregistrement…');
    const fields = {
      humeur: ddState.mood,
      humeur_intensite: ddState.mood ? parseInt(document.getElementById('dd-intensity').value,10) : null,
      routine_matin: document.getElementById('dd-matin').checked,
      routine_soir: document.getElementById('dd-soir').checked,
      note: document.getElementById('dd-note').value.trim()
    };
    if(ddState.hadSom || ddState.somTouched) fields.sommeil = parseFloat(document.getElementById('dd-sommeil').value);
    if(ddState.hadHyd || ddState.hydTouched) fields.hydratation = parseInt(document.getElementById('dd-hydra').value,10);
    if(ddState.hadAli || ddState.aliTouched) fields.alimentation = parseInt(document.getElementById('dd-alim').value,10);
    if(ddState.photoFile){
      const ext=(ddState.photoFile.name.split('.').pop()||'jpg').toLowerCase();
      const path=`${currentUser.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await sb.storage.from('photos').upload(path, ddState.photoFile, { upsert:true });
      if(!upErr) fields.photo_path = path;
    }
    const id = await getEntryIdForDate(ddState.date);
    if(id) await sb.from('entries').update(fields).eq('id', id);
    closeDayDetail();
    showToast('Jour enregistré 🌸');
    bustStreak();
    renderCalendar();
    if(ddState.date===todayStr()){ loadHomeData(); loadJournalFromDB(); }
  }
  function closeDayDetail(){ document.getElementById('day-detail').classList.remove('open'); }

  // ===== Rappels (notifications) =====
  const REMINDER_ITEMS = [
    { id:'matin', body:'☀️ C\'est l\'heure de ton rituel du matin 🌸', defTime:'08:00' },
    { id:'eau',   body:'💧 Pense à boire un verre d\'eau, ta peau te dira merci', defTime:'14:00' },
    { id:'soir',  body:'🌙 Petit rappel : ton rituel du soir t\'attend 💛', defTime:'21:00' }
  ];
  function remKey(){ return 'rituel_reminders_'+(currentUser?currentUser.id:'anon'); }
  function getReminders(){
    try{ const r=JSON.parse(localStorage.getItem(remKey())||'null'); if(r && r.items) return r; }catch (e) {
    console.error("catch silencieux (app.legacy.js):", e);
}
    return { enabled:false, items: REMINDER_ITEMS.map(it=>({ id:it.id, time:it.defTime, on:true, lastFired:null })) };
  }
  function saveReminders(cfg){ try{ localStorage.setItem(remKey(), JSON.stringify(cfg)); }catch (e) {
    console.error("catch silencieux (app.legacy.js):", e);
} }
  function updateBellDot(){ const d=document.getElementById('bell-dot'); if(d) d.style.display = getReminders().enabled ? 'block' : 'none'; }

  function refreshPermLabel(){
    const sub=document.getElementById('rem-perm-sub'); if(!sub) return;
    if(!('Notification' in window)){ sub.textContent='Non supporté sur ce navigateur'; return; }
    if(Notification.permission==='granted') sub.textContent='Notifications autorisées ✓';
    else if(Notification.permission==='denied') sub.textContent='Notifications bloquées (à réactiver dans le navigateur)';
    else sub.textContent='Autoriser les notifications';
  }
  function openReminderSheet(){
    document.getElementById('reminder-sheet').classList.add('open');
    refreshPushBtn();
  }
  async function onReminderMaster(el){
    if(el.checked && ('Notification' in window) && Notification.permission==='default'){
      const p = await Notification.requestPermission();
      refreshPermLabel();
      if(p!=='granted'){ el.checked=false; showToast('Autorise les notifications pour activer les rappels'); }
    } else { refreshPermLabel(); }
  }
  function closeReminderSheet(){ document.getElementById('reminder-sheet').classList.remove('open'); }
  function saveReminderSheet(){
    const enabled = document.getElementById('rem-enabled').checked;
    const items = REMINDER_ITEMS.map(it=>({
      id: it.id,
      time: document.getElementById('rem-'+it.id+'-time').value || it.defTime,
      on: document.getElementById('rem-'+it.id+'-on').checked,
      lastFired: null
    }));
    saveReminders({ enabled, items });
    updateBellDot();
    startReminderScheduler();
    closeReminderSheet();
    showToast(enabled ? 'Rappels activés 🔔' : 'Rappels enregistrés');
  }
  let reminderTimer=null;
  function startReminderScheduler(){
    if(reminderTimer) clearInterval(reminderTimer);
    reminderTimer = setInterval(checkReminders, 30000);
    checkReminders();
  }
  function checkReminders(){
    const cfg=getReminders();
    if(!cfg.enabled) return;
    if(!('Notification' in window) || Notification.permission!=='granted') return;
    const now=new Date();
    const hhmm = pad2(now.getHours())+':'+pad2(now.getMinutes());
    const today = todayStr();
    let changed=false;
    cfg.items.forEach(it=>{
      if(it.on && it.time===hhmm && it.lastFired!==today){
        const def = REMINDER_ITEMS.find(x=>x.id===it.id);
        try{ new Notification('Rituel', { body: (def && def.body) || 'Petit rappel 🌸' }); }catch (e) {
    console.error("catch silencieux (app.legacy.js):", e);
}
        it.lastFired = today; changed=true;
      }
    });
    if(changed) saveReminders(cfg);
  }
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
