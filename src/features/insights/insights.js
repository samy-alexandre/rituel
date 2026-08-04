// ===== Tes découvertes (corrélations douces, jamais culpabilisantes) =====
  async function loadInsights(){
    if(!isPremium){ const s=document.getElementById('insights-section'); if(s) s.style.display='none'; return; }
    const sec=document.getElementById('insights-section'); if(!sec) return;
    sec.style.display='none';
    if(!currentUser) return;
    try{
      const since=new Date(); since.setDate(since.getDate()-60);
      const { data } = await sb.from('entries').select('date,sommeil,hydratation,score_peau,humeur,routine_matin,routine_soir,repos').eq('user_id',currentUser.id).gte('date',since.toISOString().slice(0,10));
      const byDate={}; (data||[]).forEach(e=>{ byDate[e.date]=byDate[e.date]?{...byDate[e.date],...e}:e; });
      const days=Object.values(byDate);
      const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
      const out=[];
      const sHi=days.filter(d=>d.sommeil!=null&&d.score_peau!=null&&Number(d.sommeil)>=7).map(d=>Number(d.score_peau));
      const sLo=days.filter(d=>d.sommeil!=null&&d.score_peau!=null&&Number(d.sommeil)<7).map(d=>Number(d.score_peau));
      if(sHi.length>=3&&sLo.length>=3){ const diff=Math.round(avg(sHi)-avg(sLo)); if(diff>=4) out.push(['😴','Les jours où tu dors 7 h ou plus, ton éclat est en moyenne '+diff+' points plus haut. Ton sommeil te va bien ✨']); }
      const hHi=days.filter(d=>d.hydratation!=null&&d.score_peau!=null&&Number(d.hydratation)>=6).map(d=>Number(d.score_peau));
      const hLo=days.filter(d=>d.hydratation!=null&&d.score_peau!=null&&Number(d.hydratation)<6).map(d=>Number(d.score_peau));
      if(hHi.length>=3&&hLo.length>=3){ const diff=Math.round(avg(hHi)-avg(hLo)); if(diff>=4) out.push(['💧','Quand tu bois 6 verres ou plus, ton éclat gagne souvent '+diff+' points. Ta peau aime l\'eau 🌊']); }
      const mOn=days.filter(d=>dayComplete(d)&&d.humeur).map(d=>Number(d.humeur));
      const mOff=days.filter(d=>!dayComplete(d)&&d.humeur).map(d=>Number(d.humeur));
      if(mOn.length>=3&&mOff.length>=3){ const diff=avg(mOn)-avg(mOff); if(diff>=0.5) out.push(['🌸','Les jours de rituel, ton humeur est souvent plus douce. Prendre soin de soi, ça se sent 💛']); }
      if(!out.length) return;
      document.getElementById('insights-list').innerHTML=out.slice(0,2).map(i=>'<div class="ba-card" style="gap:12px;"><div style="font-size:24px;flex-shrink:0;">'+i[0]+'</div><div style="font-size:13.5px;color:var(--ink-soft);line-height:1.5;">'+i[1]+'</div></div>').join('');
      sec.style.display='block';
    }catch (e) {
    console.error("catch silencieux (app.legacy.js):", e);
}
  }
  window.loadInsights = loadInsights; // pont transitoire (section Découvertes/Insights)
