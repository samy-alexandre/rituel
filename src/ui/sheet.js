// ===== Swipe-to-dismiss universel sur les fiches (.sheet) =====
// Comportement transverse extrait verbatim de public/app.legacy.js.
// S'exécute à l'import : attache les écouteurs document pour toute feuille .sheet.
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
