// Domaine « Timelapse des photos » — diaporama accéléré de l'évolution (photos du journal),
// premium. Extrait de app.legacy.js (Phase B), déplacé VERBATIM (octets identiques).
// État privé au module : tlPhotos, tlIdx, tlTimer, tlPlaying.
// Dépendances héritées lues en identifiant nu, résolues via l'objet global : requirePlus,
// currentUser, sb, showToast, signedPhoto, fmtDateLong (désormais dans core/utils.js).

// ===== Timelapse des photos =====
  let tlPhotos=[], tlIdx=0, tlTimer=null, tlPlaying=false;
  async function openTimelapse(){
    if(!requirePlus('Revois toute ton évolution en accéléré, jour après jour 🎞️')) return;
    if(!currentUser) return;
    showToast('Chargement de ton évolution…');
    const { data } = await sb.from('entries').select('date,photo_path').eq('user_id',currentUser.id).not('photo_path','is',null).order('date',{ascending:true});
    const rows=(data||[]).filter(r=>r.photo_path);
    if(rows.length<2){ showToast('Il faut au moins 2 photos 🌸'); return; }
    tlPhotos=[];
    for(const r of rows){ const url=await signedPhoto(r.photo_path); if(url) tlPhotos.push({url,date:r.date}); }
    if(tlPhotos.length<2){ showToast('Photos indisponibles'); return; }
    const rg=document.getElementById('tl-range'); rg.max=String(tlPhotos.length-1); rg.value='0';
    rg.oninput=(ev)=>{ tlStop(); tlShow(parseInt(ev.target.value,10)); };
    document.getElementById('timelapse-sheet').classList.add('open');
    tlShow(0); tlStart();
  }
  function tlShow(i){ tlIdx=i; const p=tlPhotos[i]; if(!p) return; const img=document.getElementById('tl-img'); if(img) img.src=p.url; const dt=document.getElementById('tl-date'); if(dt) dt.textContent=fmtDateLong(p.date)+'  ·  '+(i+1)+'/'+tlPhotos.length; const rg=document.getElementById('tl-range'); if(rg) rg.value=String(i); }
  function tlStart(){ tlPlaying=true; const b=document.getElementById('tl-play'); if(b) b.textContent='⏸ Pause'; tlTimer=setInterval(()=>{ let n=tlIdx+1; if(n>=tlPhotos.length) n=0; tlShow(n); }, 850); }
  function tlStop(){ tlPlaying=false; const b=document.getElementById('tl-play'); if(b) b.textContent='▶ Lire'; if(tlTimer){ clearInterval(tlTimer); tlTimer=null; } }
  function tlToggle(){ tlPlaying ? tlStop() : tlStart(); }
  function closeTimelapse(){ tlStop(); document.getElementById('timelapse-sheet').classList.remove('open'); }

// Pont transitoire : invoquées par des handlers onclick inline (index.html) et par le
// gestionnaire de fermeture de feuille hérité (tlStop). Résolution contre window à l'appel.
Object.assign(window, { openTimelapse, tlShow, tlStart, tlStop, tlToggle, closeTimelapse });
