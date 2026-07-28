// Domaine « Bulle Léa flottante » — pastille Léa déplaçable (se colle aux bords) + popup
// d'accroche vers la messagerie. Extrait de app.legacy.js (Phase B), déplacé VERBATIM.
// État privé : bubbleInit. Dépendances héritées (coachName, openChat) : globales window.

// ===== Bulle & popup Léa flottante =====
  function closeLeaPop(){ const p=document.getElementById('lea-pop'); if(p) p.classList.remove('show'); const m=document.getElementById('lea-pop-menu'); if(m) m.classList.remove('open'); }
  function leaPopMenu(ev){ if(ev) ev.stopPropagation(); const m=document.getElementById('lea-pop-menu'); if(m) m.classList.toggle('open'); }
  function leaPopChat(){ closeLeaPop(); if(typeof openChat==='function') openChat(); }
  function toggleLeaPop(){
    const b=document.getElementById('lea-bubble'); if(!b) return;
    let p=document.getElementById('lea-pop');
    if(!p){ p=document.createElement('div'); p.id='lea-pop'; p.className='lea-pop'; document.body.appendChild(p); }
    if(p.classList.contains('show')){ closeLeaPop(); return; }
    const nm=(typeof coachName==='function'? coachName() : 'Léa');
    p.innerHTML='<div class="lea-pop-head"><span class="lea-pop-av">'+nm.charAt(0).toUpperCase()+'</span><span class="lea-pop-name">'+nm+'</span>'+
      '<button class="lea-pop-ic" aria-label="Options" onclick="leaPopMenu(event)">⋯</button>'+
      '<button class="lea-pop-ic" aria-label="Fermer" onclick="closeLeaPop()">×</button>'+
      '<div class="lea-pop-menu" id="lea-pop-menu"><button onclick="leaPopChat()">💬 Ouvrir la messagerie</button></div></div>'+
      '<div class="lea-pop-msg">Coucou 🌸 Une question sur ta peau, un produit ou ta routine ? Je suis là.</div>'+
      '<div class="lea-pop-hint">Touche ⋯ pour ouvrir la messagerie</div>';
    const W=238; p.style.width=W+'px'; p.style.visibility='hidden'; p.classList.add('show');
    const r=b.getBoundingClientRect();
    let left=r.left+r.width/2-W/2; left=Math.max(10, Math.min(left, window.innerWidth-W-10));
    const ph=p.offsetHeight||160;
    let top=r.top-ph-10; if(top<64) top=Math.min(r.bottom+10, window.innerHeight-ph-14);
    p.style.left=left+'px'; p.style.top=top+'px'; p.style.visibility='';
  }
  document.addEventListener('click', function(e){
    const p=document.getElementById('lea-pop');
    if(!p || !p.classList.contains('show')) return;
    if(e.target.closest && (e.target.closest('.lea-pop') || e.target.closest('.lea-bubble'))) return;
    closeLeaPop();
  });

  // ===== Bulle Léa flottante (déplaçable, se colle aux bords) =====
  function placeBubble(x,y){
    const b=document.getElementById('lea-bubble'); if(!b) return;
    x = Math.max(8, Math.min(x, window.innerWidth - 46 - 8));
    y = Math.max(60, Math.min(y, window.innerHeight - 46 - 84));
    b.style.left = x+'px'; b.style.top = y+'px'; b.style.right='auto'; b.style.bottom='auto';
  }
  let bubbleInit=false;
  function initLeaBubble(){
    const b=document.getElementById('lea-bubble'); if(!b || bubbleInit) return;
    bubbleInit=true;
    placeBubble(window.innerWidth - 46 - 14, window.innerHeight - 46 - 176);
    let dragging=false, moved=false, sx=0, sy=0, ox=0, oy=0;
    b.addEventListener('pointerdown', e=>{
      dragging=true; moved=false; closeLeaPop();
      try{ b.setPointerCapture(e.pointerId); }catch(_){}
      sx=e.clientX; sy=e.clientY;
      const r=b.getBoundingClientRect(); ox=r.left; oy=r.top;
      b.style.transition='none';
    });
    b.addEventListener('pointermove', e=>{
      if(!dragging) return;
      const dx=e.clientX-sx, dy=e.clientY-sy;
      if(Math.abs(dx)>4 || Math.abs(dy)>4) moved=true;
      placeBubble(ox+dx, oy+dy);
    });
    b.addEventListener('pointerup', e=>{
      if(!dragging) return; dragging=false;
      b.style.transition='left .25s ease, top .25s ease';
      if(!moved){ toggleLeaPop(); return; }
      const r=b.getBoundingClientRect();
      const toLeft = (r.left + r.width/2) < window.innerWidth/2;
      placeBubble(toLeft ? 14 : (window.innerWidth - 46 - 14), r.top);
    });
  }

// Pont transitoire : onclick inline (popup) + appels hérités (initLeaBubble/toggleLeaPop).
Object.assign(window, {
  closeLeaPop, leaPopMenu, leaPopChat, toggleLeaPop, placeBubble, initLeaBubble,
});
