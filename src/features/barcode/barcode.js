// Domaine « Scan code-barres » — détection via BarcodeDetector sur images canvas, recherche
// produit (/api/barcode) et pré-remplissage de la fiche produit. Extrait de app.legacy.js
// (Phase B), déplacé VERBATIM (octets identiques). État privé : bcStream, bcTimer, bcBusy, bcT0.
// Dépendances héritées lues en identifiant nu (résolues via l'objet global) : showToast, et les
// fonctions du domaine produits (openProductForm, pfEffetsSet, pfSetCat) encore dans app.legacy.js.

// ===== Scan code-barres (détection sur images canvas + 3 bases) =====
  let bcStream=null, bcTimer=null, bcBusy=false, bcT0=0;
  async function openBarcodeSheet(){
    document.getElementById('barcode-sheet').classList.add('open');
    const wrap=document.getElementById('bc-video-wrap');
    const status=document.getElementById('bc-status');
    const manual=document.getElementById('bc-manual'); if(manual) manual.value='';
    if(!('BarcodeDetector' in window) || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
      wrap.style.display='none';
      status.textContent='Le scan caméra n\'est pas supporté sur ce navigateur · tape le code à la main 👇';
      return;
    }
    try{
      bcStream=await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'environment', width:{ideal:1280}, height:{ideal:720} }, audio:false });
      try{ const tr=bcStream.getVideoTracks()[0]; if(tr && tr.applyConstraints) await tr.applyConstraints({ advanced:[{ focusMode:'continuous' }] }); }catch(e){}
      const v=document.getElementById('bc-video'); v.srcObject=bcStream;
      wrap.style.display='block';
      status.textContent='Vise le code-barres, bien à plat et éclairé 📷';
      bcT0=Date.now();
      const det=new BarcodeDetector({ formats:['ean_13','ean_8','upc_a','upc_e','code_128'] });
      const cv=document.createElement('canvas'); const cx=cv.getContext('2d',{ willReadFrequently:true });
      bcTimer=setInterval(async ()=>{
        if(bcBusy || !v.videoWidth) return; bcBusy=true;
        try{
          cv.width=v.videoWidth; cv.height=v.videoHeight;
          cx.drawImage(v,0,0);
          const codes=await det.detect(cv);
          if(codes && codes.length && codes[0].rawValue){ const code=codes[0].rawValue; stopBcCamera(); status.textContent='Code détecté ✓'; bcLookup(code); }
          else if(Date.now()-bcT0>7000){ status.textContent='Rapproche-toi du code et stabilise 🤳 (ou tape-le en dessous)'; }
        }catch(err){}
        bcBusy=false;
      }, 300);
    }catch(e){
      wrap.style.display='none';
      status.textContent='Caméra refusée ou indisponible · tape le code à la main 👇';
    }
  }
  function stopBcCamera(){ if(bcTimer){ clearInterval(bcTimer); bcTimer=null; } if(bcStream){ try{ bcStream.getTracks().forEach(t=>t.stop()); }catch(e){} bcStream=null; } }
  function closeBarcodeSheet(){ stopBcCamera(); document.getElementById('barcode-sheet').classList.remove('open'); }
  function bcLookupManual(){ const v=(document.getElementById('bc-manual').value||'').trim(); if(v) bcLookup(v); }
  async function bcFetchProduct(base, code){
    try{
      const ctl=new AbortController(); const t=setTimeout(()=>ctl.abort(), 6000);
      const r=await fetch(base+encodeURIComponent(code)+'.json',{ signal:ctl.signal }); clearTimeout(t);
      const d=await r.json(); if(d && d.status===1 && d.product) return d.product;
    }catch(e){}
    return null;
  }
  async function bcLookup(code){
    const status=document.getElementById('bc-status');
    const g=document.getElementById('bc-google'); if(g) g.style.display='none';
    status.textContent='Recherche du produit…';
    let d=null;
    try{
      const ctl=new AbortController(); const t=setTimeout(()=>ctl.abort(), 9000);
      const r=await fetch('/api/barcode?code='+encodeURIComponent(code), { signal: ctl.signal });
      clearTimeout(t);
      d=await r.json();
    }catch(e){}
    if(!d || !d.found){
      status.textContent='Produit introuvable dans les bases 😕 (fréquent en cosmétique). Tape son nom à la main, ou jette un œil en ligne :';
      if(g){ g.href='https://www.google.com/search?q='+encodeURIComponent(code); g.style.display='inline-block'; }
      return;
    }
    // Pré-remplir la fiche produit avec les infos trouvées
    closeBarcodeSheet();
    openProductForm();
    setTimeout(function(){
      const cap=function(s){ if(!s) return ''; s=s.trim(); return s.charAt(0).toUpperCase()+s.slice(1); };
      const nomEl=document.getElementById('pf-nom'); if(nomEl && d.nom) nomEl.value=cap(d.nom);
      const mqEl=document.getElementById('pf-marque'); if(mqEl && d.marque) mqEl.value=cap(d.marque);
      if(d.effets) pfEffetsSet(d.effets.charAt(0).toUpperCase()+d.effets.slice(1));
      // Catégorie devinée
      if(d.categorie){
        const catBtn=document.querySelector('#pf-cats .rj-chip[data-cat="'+d.categorie+'"]');
        if(catBtn){ pfSetCat(catBtn, d.categorie); }
      }
    }, 120);
    showToast('Produit trouvé ✨ Vérifie et complète 🌸');
  }

// Pont transitoire : invoquées par des handlers onclick inline (index.html), par le code
// hérité (openBarcodeSheet) et par le gestionnaire de fermeture de feuille (stopBcCamera).
Object.assign(window, {
  openBarcodeSheet, stopBcCamera, closeBarcodeSheet, bcLookupManual, bcFetchProduct, bcLookup,
});
