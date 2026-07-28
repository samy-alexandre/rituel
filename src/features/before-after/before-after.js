// Domaine « Avant / Après » — comparateur photo première vs dernière (slider). Extrait de
// app.legacy.js (Phase B), déplacé VERBATIM. Deps héritées (currentUser, sb, signedPhoto,
// baSlide) globales. Aucun état, aucune const partagée.

// ===== Avant / Après (première photo vs dernière) =====
  async function loadBeforeAfter(){
    const sec=document.getElementById('ba-section'); if(!sec) return;
    sec.style.display='none';
    if(!currentUser) return;
    try{
      const [firstR, lastR] = await Promise.all([
        sb.from('entries').select('date,photo_path').eq('user_id',currentUser.id).not('photo_path','is',null).order('date',{ascending:true}).limit(1),
        sb.from('entries').select('date,photo_path').eq('user_id',currentUser.id).not('photo_path','is',null).order('date',{ascending:false}).limit(1)
      ]);
      const first=(firstR.data&&firstR.data[0])||null;
      const last=(lastR.data&&lastR.data[0])||null;
      if(!first || !last || first.date===last.date) return; // besoin de 2 jours différents
      const [u1,u2]=await Promise.all([signedPhoto(first.photo_path), signedPhoto(last.photo_path)]);
      if(!u1 || !u2) return;
      document.getElementById('ba-before-img').src=u1;
      document.getElementById('ba-after-img').src=u2;
      const rg=document.getElementById('ba-range'); if(rg) rg.value=50;
      baSlide(50);
      const fmt=(d)=>{ const p=d.split('-'); return p[2]+'/'+p[1]; };
      const days=Math.round((new Date(last.date)-new Date(first.date))/86400000);
      document.getElementById('ba-before-label').textContent='Jour 1 · '+fmt(first.date);
      document.getElementById('ba-after-label').textContent="Aujourd'hui · "+fmt(last.date);
      document.getElementById('ba-caption').textContent='+'+days+' jour'+(days>1?'s':'')+' entre les deux 🌸';
      sec.style.display='block';
    }catch(e){}
  }

// Pont transitoire : appel hérité (loadBeforeAfter au rendu du journal). Résolution via window.
Object.assign(window, { loadBeforeAfter });
