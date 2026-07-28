// Domaine « Indice UV du jour » — géoloc + Open-Meteo au tap, conseil SPF, mis en cache
// (localStorage journalier). Extrait de app.legacy.js (Phase B), déplacé VERBATIM.
// Aucun état mémoire. Dépendances héritées (showToast, todayStr) : globales window.

// ===== Indice UV du jour (géoloc + Open-Meteo, au tap, mis en cache) =====
  function uvInfo(uv){
    if(uv<3) return {label:'Faible', color:'#5DAE63', advice:'UV faible aujourd\'hui. Un SPF léger suffit si tu restes longtemps dehors.'};
    if(uv<6) return {label:'Modéré', color:'#D99A1C', advice:'UV modéré · pense à ta crème solaire SPF 30 avant de sortir ☀️'};
    if(uv<8) return {label:'Élevé', color:'#E0722C', advice:'UV élevé · SPF 50 recommandé, chapeau et lunettes si tu peux.'};
    if(uv<11) return {label:'Très élevé', color:'#D6453F', advice:'UV très élevé · SPF 50, et évite le soleil entre 12h et 16h.'};
    return {label:'Extrême', color:'#9B3B6E', advice:'UV extrême · protection maximale, reste à l\'ombre au maximum.'};
  }
  function renderUV(uv, t, h){
    const card=document.getElementById('uv-card'); if(!card) return;
    const info=uvInfo(uv);
    let extra='';
    if(h!=null && h<35) extra='Air sec ('+h+'%) · couche d\'hydratant généreuse aujourd\'hui 💧';
    else if(h!=null && h>80) extra='Air très humide ('+h+'%) · textures légères, ta peau respirera mieux 🌫️';
    if(t!=null && t<=3) extra=(extra?extra+' · ':'')+'Froid dehors · protège bien les joues et les lèvres 🧣';
    const meteo = (t!=null||h!=null) ? '<div style="font-size:11px;color:var(--muted);margin-top:5px;">'+(t!=null?t+'°':'')+(t!=null&&h!=null?' · ':'')+(h!=null?h+'% d\'humidité':'')+'</div>' : '';
    const extraHtml = extra ? '<div style="font-size:12.5px;color:var(--ink-soft);line-height:1.45;margin-top:5px;">'+extra+'</div>' : '';
    card.innerHTML='<div style="display:flex;align-items:center;gap:14px;background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:12px 14px;box-shadow:var(--shadow);">'
      + '<div style="width:52px;height:52px;border-radius:50%;background:'+info.color+'22;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><div style="font-family:var(--serif);font-size:23px;color:'+info.color+';line-height:1;">'+Math.round(uv)+'</div></div>'
      + '<div style="flex:1;min-width:0;"><div style="display:flex;align-items:center;gap:8px;"><span class="eyebrow">INDICE UV</span><span style="font-size:11px;font-weight:600;color:'+info.color+';">'+info.label+'</span></div><div style="font-size:13px;color:var(--ink-soft);line-height:1.45;margin-top:3px;">'+info.advice+'</div></div>'
      + '</div>';
  }
  async function activateUV(){
    const card=document.getElementById('uv-card'); if(!card) return;
    if(!navigator.geolocation){ showToast('Géolocalisation indisponible'); return; }
    card.innerHTML='<div style="padding:14px;color:var(--muted);font-size:13px;">Localisation en cours…</div>';
    navigator.geolocation.getCurrentPosition(async (pos)=>{
      const lat=pos.coords.latitude.toFixed(2), lon=pos.coords.longitude.toFixed(2);
      try{
        const r=await fetch('https://api.open-meteo.com/v1/forecast?latitude='+lat+'&longitude='+lon+'&daily=uv_index_max&current=temperature_2m,relative_humidity_2m&timezone=auto');
        const d=await r.json();
        const uv = (d && d.daily && Array.isArray(d.daily.uv_index_max)) ? d.daily.uv_index_max[0] : null;
        const t = (d && d.current && typeof d.current.temperature_2m==='number') ? Math.round(d.current.temperature_2m) : null;
        const h = (d && d.current && typeof d.current.relative_humidity_2m==='number') ? Math.round(d.current.relative_humidity_2m) : null;
        if(uv==null){ card.innerHTML='<div style="padding:14px;color:var(--muted);font-size:13px;">Indice UV indisponible pour le moment 🌿</div>'; return; }
        try{ localStorage.setItem('rituel_uv', JSON.stringify({ d: todayStr(), uv, t, h })); }catch(e){}
        renderUV(uv, t, h);
      }catch(e){ card.innerHTML='<div style="padding:14px;color:var(--muted);font-size:13px;">Indice UV indisponible 🌿</div>'; }
    }, ()=>{
      card.innerHTML='<div style="padding:14px;color:var(--muted);font-size:13px;line-height:1.5;">Localisation refusée. <button class="btn-soft" style="padding:7px 14px;font-size:11.5px;margin-top:8px;" onclick="activateUV()">Réessayer</button></div>';
    }, { timeout:8000, maximumAge:3600000 });
  }
  function loadUV(){
    const card=document.getElementById('uv-card'); if(!card) return;
    try{ const c=localStorage.getItem('rituel_uv'); if(c){ const o=JSON.parse(c); if(o && o.d===todayStr() && typeof o.uv==='number'){ renderUV(o.uv, o.t, o.h); return; } } }catch(e){}
    card.innerHTML='<button class="add-product-card" style="margin-top:0;" onclick="activateUV()">☀️ Voir l\'indice UV du jour</button>';
  }

// Pont transitoire : onclick inline (activateUV) + appel hérité (loadUV au rendu de l'accueil).
Object.assign(window, { uvInfo, renderUV, activateUV, loadUV });
