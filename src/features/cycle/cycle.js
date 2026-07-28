// Domaine « Suivi de cycle » (opt-in, discret) — phase du cycle → conseil peau, carte accueil,
// réglages. Extrait de app.legacy.js (Phase B), déplacé VERBATIM (octets identiques).
// État privé au module : cyTmp. Les données persistantes vivent sur l'objet `state` partagé
// (state.cycleEnabled/cycleLastStart/cycleLength) et en base (profiles).
// Dépendances héritées lues en identifiant nu (résolues via l'objet global) : state, todayStr,
// dpFmtDisplay, currentUser, sb, showToast.

// ===== Suivi de cycle (opt-in, discret) =====
  let cyTmp={ enabled:false };
  function cyclePhaseInfo(){
    if(!state.cycleEnabled || !state.cycleLastStart) return null;
    const len=Math.max(20, Math.min(45, parseInt(state.cycleLength,10)||28));
    const start=new Date(state.cycleLastStart+'T00:00:00');
    const today=new Date(todayStr()+'T00:00:00');
    const diff=Math.floor((today-start)/86400000);
    if(isNaN(diff) || diff<0) return null;
    if(diff >= len*2) return { stale:true };
    const day=(diff % len)+1;
    const ovu=len-14;
    let phase, emoji, tip;
    if(day<=5){ phase='menstruelle'; emoji='🌙'; tip='Peau souvent plus sensible · douceur et hydratation aujourd\'hui.'; }
    else if(day<ovu-1){ phase='folliculaire'; emoji='🌱'; tip='Ta peau est en forme · bon moment pour tes actifs.'; }
    else if(day<=ovu+1){ phase='ovulation'; emoji='☀️'; tip='Éclat naturel au rendez-vous ✨'; }
    else { phase='lutéale'; emoji='🍂'; tip='Imperfections possibles · nettoyage doux et patience.'; }
    return { day, phase, emoji, tip, len };
  }
  function loadCycleCard(){
    const sec=document.getElementById('cycle-section'), card=document.getElementById('cycle-card');
    if(!sec || !card) return;
    const i=cyclePhaseInfo();
    if(!i){ sec.style.display='none'; return; }
    if(i.stale){
      card.innerHTML='<div style="display:flex;align-items:center;gap:14px;background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:14px 16px;box-shadow:var(--shadow);cursor:pointer;" onclick="openCycleSheet()"><div style="font-size:24px;flex-shrink:0;">🌸</div><div style="flex:1;min-width:0;"><span class="eyebrow">SUIVI DE CYCLE</span><div style="font-size:13px;color:var(--ink-soft);line-height:1.45;margin-top:3px;">Ça fait un moment · mets à jour la date de tes dernières règles pour des repères justes.</div></div></div>';
      sec.style.display='block'; return;
    }
    card.innerHTML='<div style="display:flex;align-items:center;gap:14px;background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:11px 14px;box-shadow:var(--shadow);" onclick="openCycleSheet()">'
      + '<div style="font-size:24px;flex-shrink:0;">'+i.emoji+'</div>'
      + '<div style="flex:1;min-width:0;"><div style="display:flex;align-items:center;gap:8px;"><span class="eyebrow">CYCLE · JOUR '+i.day+'</span><span style="font-size:11px;font-weight:600;color:var(--accent-deep);text-transform:capitalize;">'+i.phase+'</span></div>'
      + '<div style="font-size:13px;color:var(--ink-soft);line-height:1.45;margin-top:3px;">'+i.tip+'</div></div>'
      + '</div>';
    sec.style.display='block';
  }
  function updateCycleMenuMeta(){ const m=document.getElementById('menu-cycle-meta'); if(m) m.textContent = state.cycleEnabled ? 'activé' : '…'; }
  function cySetEnabled(on){
    cyTmp.enabled=on;
    const a=document.getElementById('cy-on'), b=document.getElementById('cy-off'), body=document.getElementById('cy-body');
    if(a) a.classList.toggle('selected', on);
    if(b) b.classList.toggle('selected', !on);
    if(body) body.style.display = on ? 'block' : 'none';
  }
  function cyToday(){ const el=document.getElementById('cy-start'); if(el){ const t=todayStr(); el.setAttribute('data-iso',t); el.value=dpFmtDisplay(t); } }
  function openCycleSheet(){
    cyTmp={ enabled: !!state.cycleEnabled };
    const st=document.getElementById('cy-start'); if(st){ const _v=state.cycleLastStart||''; st.setAttribute('data-iso',_v); st.value=_v?dpFmtDisplay(_v):''; }
    const ln=document.getElementById('cy-length'); if(ln) ln.value = state.cycleLength || 28;
    cySetEnabled(cyTmp.enabled);
    document.getElementById('cycle-sheet').classList.add('open');
  }
  function closeCycleSheet(){ document.getElementById('cycle-sheet').classList.remove('open'); }
  async function saveCycle(){
    state.cycleEnabled = cyTmp.enabled;
    const st=((document.getElementById('cy-start').getAttribute('data-iso')||'')||'').trim();
    state.cycleLastStart = st || null;
    state.cycleLength = Math.max(20, Math.min(45, parseInt(document.getElementById('cy-length').value,10)||28));
    if(currentUser){
      try{ await sb.from('profiles').update({ cycle_enabled: state.cycleEnabled, cycle_last_start: state.cycleLastStart, cycle_length: state.cycleLength }).eq('id', currentUser.id); }catch(e){}
    }
    closeCycleSheet();
    updateCycleMenuMeta();
    loadCycleCard();
    if(state.cycleEnabled && !state.cycleLastStart) showToast('Pense à noter le 1er jour de tes règles 🌸');
    else showToast(state.cycleEnabled ? 'Suivi de cycle activé 🌸' : 'Suivi de cycle désactivé');
  }

// Pont transitoire : invoquées par des handlers onclick inline (index.html) et par le code
// hérité (loadCycleCard / updateCycleMenuMeta au rendu de l'accueil). Résolution via window.
Object.assign(window, {
  cyclePhaseInfo, loadCycleCard, updateCycleMenuMeta, cySetEnabled, cyToday,
  openCycleSheet, closeCycleSheet, saveCycle,
});
