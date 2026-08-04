// src/features/premium/premium.js
// Rituel+ (abonnement Stripe) : UI du paywall, achat, portail, retour de paiement.
// Déplacé verbatim de public/app.legacy.js (Phase B). Exposé sur window (pont transitoire).

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

function openPlusSheet(raison){
  const r=document.getElementById('plus-reason');
  if(r) r.textContent = raison || 'Pour aller plus loin avec ta compagne de soin, sans limite 🌸';
  document.querySelectorAll('.plus-buy').forEach(b=>{ b.disabled=false; });
  document.getElementById('plus-sheet').classList.add('open');
}
function closePlusSheet(){ document.getElementById('plus-sheet').classList.remove('open'); }

// Pont transitoire : expose sur window les fonctions encore appelées par les handlers inline
function __expose(name, fn){ if(typeof window!=='undefined') window[name] = fn; }
__expose('refreshPremiumUI', refreshPremiumUI);
__expose('requirePlus', requirePlus);
__expose('startCheckout', startCheckout);
__expose('openBillingPortal', openBillingPortal);
__expose('checkPaymentReturn', checkPaymentReturn);
__expose('openPlusSheet', openPlusSheet);
__expose('closePlusSheet', closePlusSheet);
