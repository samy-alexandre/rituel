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
}

window.bilan5Key = bilan5Key;
window.maybeShowBilan5 = maybeShowBilan5;
window.openBilan5 = openBilan5;
window.closeBilan5 = closeBilan5;
