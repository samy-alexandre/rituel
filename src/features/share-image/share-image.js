// Domaine « Image à partager » (story) — génère une image récap (série/éclat) partageable
// via l'API de partage native. Extrait de app.legacy.js (Phase B), déplacé VERBATIM.
// Deps héritées (currentUser, coachName, showToast…) globales. Aucun état, aucune const partagée.

// ===== Image à partager (story) =====
  async function shareStreakImage(){
    if(!currentUser){ showToast('Connecte-toi pour partager 🌸'); return; }
    showToast('Création de l\'image… 🌸');
    const n = await computeStreak();
    const cs = getComputedStyle(document.documentElement);
    const get=(v,fb)=>{ const x=cs.getPropertyValue(v).trim(); return x||fb; };
    const accent=get('--accent','#C95A3F'), accentSoft=get('--accent-soft','#EBCDC0'), blushSoft=get('--blush-soft','#F6E0DC'), ink=get('--ink','#2E211C'), inkSoft=get('--ink-soft','#6B5B52');
    // plante en SVG avec couleurs résolues (les var() ne marchent pas dans une image isolée)
    let svg = plantSVG(plantStage(n), currentPlant()).replace('style="width:150px;height:150px;"','width="540" height="540"');
    ['--sage','--gold','--blush','--accent','--accent-soft','--blush-soft'].forEach(v=>{ svg = svg.split('var('+v+')').join(get(v,'#888')); });

    const W=1080,H=1920;
    const canvas=document.createElement('canvas'); canvas.width=W; canvas.height=H;
    const ctx=canvas.getContext('2d');
    const g=ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,'#FFFFFF'); g.addColorStop(0.55,blushSoft); g.addColorStop(1,accentSoft);
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    try{ await Promise.all([document.fonts.load('700 280px Newsreader'), document.fonts.load('600 72px Manrope'), document.fonts.load('italic 700 96px Newsreader')]); await document.fonts.ready; }catch(e){}
    // plante
    const img=new Image();
    const svgUrl='data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(svg)));
    await new Promise(res=>{ img.onload=res; img.onerror=res; img.src=svgUrl; });
    try{ ctx.drawImage(img,(W-560)/2,300,560,560); }catch(e){}
    ctx.textAlign='center';
    if(n>0){
      ctx.fillStyle=accent; ctx.font='italic 700 280px Newsreader, Georgia, serif'; ctx.fillText(String(n), W/2, 1140);
      ctx.fillStyle=ink; ctx.font='600 72px Manrope, Arial, sans-serif'; ctx.fillText(n>1?'jours de rituel':'jour de rituel', W/2, 1240);
    } else {
      ctx.fillStyle=accent; ctx.font='italic 700 110px Newsreader, Georgia, serif'; ctx.fillText('Mon rituel commence', W/2, 1120);
    }
    ctx.fillStyle=inkSoft; ctx.font='400 44px Manrope, Arial, sans-serif'; ctx.fillText('Ma peau, jour après jour 🌸', W/2, 1330);
    ctx.fillStyle=accent; ctx.font='italic 700 96px Newsreader, Georgia, serif'; ctx.fillText('Rituel', W/2, 1700);
    ctx.fillStyle=inkSoft; ctx.font='400 40px Manrope, Arial, sans-serif'; ctx.fillText('monrituel.app', W/2, 1772);
    canvas.toBlob(async (blob)=>{
      if(!blob){ showToast('Oups, réessaie 🌿'); return; }
      const file=new File([blob],'rituel-'+n+'jours.png',{type:'image/png'});
      try{
        if(navigator.canShare && navigator.canShare({files:[file]})){
          await navigator.share({ files:[file], text:(n>0?(n+' jours de rituel 🌱'):'Je commence mon rituel 🌱')+' monrituel.app' });
          return;
        }
      }catch(e){ if(e && e.name==='AbortError') return; }
      const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='rituel-'+n+'jours.png'; document.body.appendChild(a); a.click(); a.remove();
      showToast('Image enregistrée · partage-la en story 🌸');
    },'image/png');
  }

// Pont transitoire : onclick inline (bouton partager). Résolution contre window.
Object.assign(window, { shareStreakImage });
