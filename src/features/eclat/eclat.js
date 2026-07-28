// Domaine « Programme Éclat 30 jours » — défi gratuit, un micro-geste par jour, persisté en
// localStorage. Extrait de app.legacy.js (Phase B), déplacé VERBATIM (octets identiques).
// Aucune donnée d'état en mémoire (tout est en localStorage) ; la liste ECLAT (propre au
// programme) migre avec le module. Dépendances héritées (currentUser, todayStr, showToast,
// cmAsk) : globales window — résolution en identifiant nu via l'objet global.

// ===== Programme Éclat 30 jours (localStorage, gratuit) =====
  const ECLAT=["Masse ton visage 1 min en appliquant ta crème 🤲","Bois un grand verre d\'eau au réveil 💧","Applique ton SPF même s\'il fait gris ☀️","Couche-toi 30 min plus tôt ce soir 😴","Nettoie tes pinceaux ou éponges 🧼","Prends ta photo du jour 📷","Masse ton cou en remontant, il fait partie du visage 🦢","Change ta taie d\'oreiller 🛏️","Lis l\'étiquette d\'un de tes produits 🔍","Tapote ton contour des yeux à l\'annulaire 👁️","Zéro nouveau produit aujourd\'hui · la constance d\'abord 🌿","Bois une tisane à la place d\'un café ☕","Fais ton rituel en pleine conscience, sans téléphone 🧘","Hydrate tes lèvres 3 fois aujourd\'hui 💋","Mange un fruit riche en vitamine C 🍊","Dors sur le dos si tu peux cette nuit 🌙","Nettoie ton écran de téléphone 📱","Massage lymphatique : du centre vers les oreilles ✋","Crème sur les mains après chaque lavage 🤲","Pas de touche-visage aujourd\'hui ✋","Ajoute une étape plaisir à ton rituel du soir 🌸","Aère ta chambre 10 minutes 🪟","Compare ta photo d\'aujourd\'hui au jour 1 ↔️","Étire-toi 2 minutes au réveil 🌅","Double nettoyage ce soir si tu portes du SPF/maquillage 🫧","Note 1 chose que tu aimes chez ta peau 💛","Un jour sans sucre ajouté, ta peau te dira merci 🍬","Masse ton cuir chevelu 1 minute 💆","Prépare ton rituel de demain ce soir 🌙","Célèbre : 30 jours de douceur. Regarde ton avant/après ✨"];
  function eclatKey(){ return 'rituel_eclat_'+(currentUser?currentUser.id:'x'); }
  function eclatState(){ try{ const s=localStorage.getItem(eclatKey()); return s?JSON.parse(s):null; }catch(e){ return null; } }
  function eclatDay(st){ return Math.floor((new Date(todayStr())-new Date(st.start))/86400000)+1; }
  function openEclatSheet(){ renderEclatSheet(); document.getElementById('eclat-sheet').classList.add('open'); }
  function closeEclatSheet(){ document.getElementById('eclat-sheet').classList.remove('open'); }
  function startEclat(){ try{ localStorage.setItem(eclatKey(), JSON.stringify({ start: todayStr(), done: [] })); }catch(e){} renderEclatSheet(); loadEclatProgram(); showToast('C\'est parti pour 30 jours ✨'); }
  async function eclatRestart(){
    if(await cmAsk({titre:'Recommencer le programme ?',texte:'Tu repartiras du jour 1. Ta progression actuelle sera perdue.',ok:'Recommencer',annuler:'Annuler'})) startEclat();
  }
  function eclatDone(){ const st=eclatState(); if(!st) return; const d=eclatDay(st); if(!st.done.includes(d)) st.done.push(d); try{ localStorage.setItem(eclatKey(), JSON.stringify(st)); }catch(e){} renderEclatSheet(); loadEclatProgram(); showToast('Bravo 🌸'); }
  function renderEclatSheet(){
    const b=document.getElementById('eclat-body'); if(!b) return;
    const st=eclatState();
    if(!st){ b.innerHTML='<p style="color:var(--ink-soft);font-size:13.5px;line-height:1.6;margin:0 0 16px;">30 jours, un micro-geste par jour, 2 minutes max. Pas de pression : juste de petites attentions qui s\'additionnent 🌿</p><button class="btn btn-accent" onclick="startEclat()">Commencer le programme ✨</button>'; return; }
    const d=eclatDay(st);
    if(d>30){ b.innerHTML='<div style="text-align:center;padding:8px 0 4px;"><div style="font-size:42px;">🎉</div><div class="serif" style="font-size:20px;margin:8px 0;">Programme terminé !</div><div style="color:var(--muted);font-size:13px;line-height:1.5;">'+st.done.length+'/30 gestes accomplis. Va voir ton avant/après dans le Journal ↔️</div></div><button class="btn btn-accent" style="margin-top:14px;" onclick="eclatRestart()">Refaire 30 jours</button>'; return; }
    const did=st.done.includes(d);
    b.innerHTML='<div style="display:flex;justify-content:space-between;align-items:baseline;"><span class="eyebrow">JOUR '+d+'/30</span><span style="font-size:11px;color:var(--muted);">'+st.done.length+' geste'+(st.done.length>1?'s':'')+' fait'+(st.done.length>1?'s':'')+'</span></div>'
      +'<div style="height:6px;background:var(--surface-warm);border-radius:100px;margin:10px 0 16px;overflow:hidden;"><div style="height:100%;width:'+Math.round(d/30*100)+'%;background:linear-gradient(90deg,var(--blush),var(--accent));border-radius:100px;"></div></div>'
      +'<div class="ba-card" style="gap:12px;"><div style="font-size:26px;flex-shrink:0;">🗓️</div><div style="font-size:14px;color:var(--ink-soft);line-height:1.55;">'+ECLAT[d-1]+'</div></div>'
      +'<button class="btn '+(did?'':'btn-accent')+'" style="margin-top:14px;'+(did?'background:var(--surface-warm);color:var(--ink);':'')+'" onclick="eclatDone()" '+(did?'disabled':'')+'>'+(did?'✓ Fait pour aujourd\'hui':'✓ C\'est fait')+'</button>'
      +'<button onclick="eclatRestart()" class="btn-soft" style="display:block;margin:12px auto 0;">Recommencer</button>';
  }
  function loadEclatProgram(){
    const card=document.getElementById('eclat-card'); const meta=document.getElementById('menu-eclat-meta');
    const st=eclatState();
    if(meta) meta.textContent = st ? (eclatDay(st)>30?'terminé 🎉':'jour '+Math.min(eclatDay(st),30)) : '…';
    if(!card) return;
    if(!st || eclatDay(st)>30){ card.style.display='none'; return; }
    const d=eclatDay(st); const did=st.done.includes(d);
    card.innerHTML='<div style="display:flex;align-items:center;gap:14px;background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:11px 14px;box-shadow:var(--shadow);cursor:pointer;" onclick="openEclatSheet()"><div style="font-size:24px;flex-shrink:0;">'+(did?'✅':'🗓️')+'</div><div style="flex:1;min-width:0;"><span class="eyebrow">ÉCLAT · JOUR '+d+'/30</span><div style="font-size:13px;color:var(--ink-soft);line-height:1.45;margin-top:3px;">'+ECLAT[d-1]+'</div></div></div>';
    card.style.display='block';
  }

// Pont transitoire : invoquées par des handlers onclick inline (index.html + HTML généré)
// et par le code hérité (loadEclatProgram au chargement de l'accueil).
Object.assign(window, {
  eclatKey, eclatState, eclatDay, openEclatSheet, closeEclatSheet,
  startEclat, eclatRestart, eclatDone, renderEclatSheet, loadEclatProgram,
});
