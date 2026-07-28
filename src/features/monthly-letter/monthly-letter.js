// Domaine « Lettre du mois » — bilan mensuel chaleureux généré par Léa (/api/lea), popup en fin
// de mois + archive. Extrait de app.legacy.js (Phase B), déplacé VERBATIM. Deps héritées lues
// en identifiant nu (via l'objet global) : currentUser, requirePlus, coachName, bilanKey
// (hérité), et buildLeaContext/formatMessage (module chat). Aucune const partagée.

// ===== Lettre du mois (fin de mois, popup, archive dans Moi) =====
  function lettreYM(){ const d=new Date(); return d.getFullYear()+'-'+(d.getMonth()+1); }
  function lettreSeen(){ try{ return !!localStorage.getItem('rituel_lettreseen_'+(currentUser?currentUser.id:'x')+'_'+lettreYM()); }catch(e){ return false; } }
  function lettreArchive(){ try{ return JSON.parse(localStorage.getItem('rituel_lettres_'+currentUser.id)||'[]'); }catch(e){ return []; } }
  function maybeShowLettreCta(){
    const el=document.getElementById('lettre-cta'); if(!el) return;
    if(!currentUser){ el.style.display='none'; return; }
    const now=new Date(); const last=new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
    const fin = now.getDate() >= last-2;
    const M=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
    const t=document.getElementById('lettre-cta-title'); if(t) t.textContent='Ta lettre de '+M[now.getMonth()]+' est prête 💌';
    el.style.display = (fin && !lettreSeen()) ? 'block' : 'none';
  }
  async function fetchLettre(){
    try{ const cached=localStorage.getItem(bilanKey()); if(cached) return cached; }catch(e){}
    const ctx=await buildLeaContext();
    const res=await fetch('/api/lea',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({
      messages:[{ role:'user', content:"(Message automatique de l'app, ce n'est pas une vraie question de la personne.) Écris ta petite lettre du mois : un bilan chaleureux en 4 à 6 phrases d'après mes données (série, éclat, habitudes, peau), avec un encouragement doux pour le mois qui commence. Pas de question à la fin. Termine par une signature courte avec ton prénom." }],
      profile: ctx, user_id: currentUser?currentUser.id:null
    })});
    const d=await res.json();
    const txt=(d && d.reply) ? d.reply : null;
    if(txt){ try{ localStorage.setItem(bilanKey(), txt); }catch(e){} }
    return txt;
  }
  async function openLettre(arch){
    if(!requirePlus('Ta lettre du mois : le bilan doux de ton parcours 💌')) return;
    const body=document.getElementById('lettre-body');
    document.getElementById('lettre-sheet').classList.add('open');
    if(typeof arch==='string'){ body.innerHTML=formatMessage(arch); return; }
    body.innerHTML='<div style="color:var(--muted);font-size:13px;text-align:center;padding:14px 0;">'+coachName()+' écrit ta lettre… ✍️</div>';
    const txt=await fetchLettre();
    if(!txt){ body.innerHTML='<div style="color:var(--muted);font-size:13px;text-align:center;padding:14px 0;">Oups, réessaie dans un instant 🌿</div>'; return; }
    body.innerHTML=formatMessage(txt);
    try{
      const a=lettreArchive();
      if(!a.some(x=>x.k===lettreYM())){ a.unshift({ k:lettreYM(), t:txt }); localStorage.setItem('rituel_lettres_'+currentUser.id, JSON.stringify(a)); }
    }catch(e){}
  }
  function closeLettre(){
    document.getElementById('lettre-sheet').classList.remove('open');
    try{ localStorage.setItem('rituel_lettreseen_'+currentUser.id+'_'+lettreYM(),'1'); }catch(e){}
    maybeShowLettreCta();
  }
  function openLettreAt(i){ const a=lettreArchive(); if(a[i]) openLettre(a[i].t); }
  function openLettresList(){
    const host=document.getElementById('lettres-list');
    const a=lettreArchive();
    const M=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
    host.innerHTML = a.length ? a.map(function(x,i){ const p=x.k.split('-'); return '<button class="btn-soft" style="display:block;width:100%;text-align:left;margin-bottom:8px;padding:12px 14px;border-radius:14px;" onclick="openLettreAt('+i+')">💌 Lettre de '+M[parseInt(p[1],10)-1]+' '+p[0]+'</button>'; }).join('')
      : '<p style="color:var(--muted);font-size:13px;text-align:center;padding:10px 0;">Ta première lettre arrivera à la fin du mois 🌸</p>';
    document.getElementById('lettres-sheet').classList.add('open');
  }
  function closeLettresList(){ document.getElementById('lettres-sheet').classList.remove('open'); }

// Pont transitoire : onclick inline (lettre + liste) + appels hérités (maybeShowLettreCta à
// l'accueil). Résolution contre window au moment de l'appel.
Object.assign(window, {
  lettreYM, lettreSeen, lettreArchive, maybeShowLettreCta, fetchLettre,
  openLettre, closeLettre, openLettreAt, openLettresList, closeLettresList,
});
