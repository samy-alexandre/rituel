// Domaine « Éditeur de rituel classique » (feuille rituel-sheet) — composition d'un rituel
// nommé : sélection de produits, rappels (semainier + heure), enregistrement. Historiquement
// remplacé par le chemin cm (openRituelEditor délègue à openRituelChemin quand il existe),
// conservé comme repli. Extrait de app.legacy.js (Phase B), déplacé VERBATIM (octets identiques).
// État PRIVÉ au module (vérifié : aucune fuite hors du domaine, aucun couplage à rpSlotView/chDraft) :
// rituelDraft, rdProductMap, rdPickerSel, rdHebdoDay, rdSort, rdCatFilter.
// Dépendances héritées lues en identifiant nu (résolues via l'objet global) : sb, currentUser,
// showToast, cmAsk, loadRituels, loadHomeRoutine, recomputeRituelType, openRituelChemin,
// catLabel, favSet, signedPhoto, dpFmtDisplay, escapeHtml ; CATS/CAT_RANK exposées sur window.

// ===== Rituels nommés — état de l'éditeur =====
  let rituelDraft = null;       // { id, nom, moment, produits:[ids] }
  let rdProductMap = {};        // id -> produit
  let rdPickerSel = new Set();

// ===== Éditeur de rituel (composition + rappels + enregistrement) =====
  async function openRituelEditor(id, presetMoment){
    if(typeof openRituelChemin==='function') return openRituelChemin(id, presetMoment);
    if(!currentUser){ showToast('Connecte-toi d\'abord'); return; }
    const { data: prods } = await sb.from('products').select('id,nom,emoji,effets,categorie,date_peremption').eq('user_id', currentUser.id).order('position',{ascending:true}).order('created_at',{ascending:true});
    rdProductMap = {}; (prods||[]).forEach(p=>{ rdProductMap[p.id]=p; });
    let loadedRappels = null;
    if(id){
      const { data: r } = await sb.from('rituels').select('*').eq('id', id).maybeSingle();
      rituelDraft = r ? { id:r.id, nom:r.nom||'', moment:r.moment||'matin', produits:(Array.isArray(r.produits)?r.produits.slice():[]) } : { id:null, nom:'', moment:'matin', produits:[] };
      loadedRappels = r ? r.rappels : null;
    } else {
      rituelDraft = { id:null, nom:'', moment:(presetMoment||'matin'), produits:[] };
    }
    document.getElementById('rd-nom').value = rituelDraft.nom;
    setTimeout(function(){ rdApplyRappels(loadedRappels); }, 0);
    rdSetMoment(rituelDraft.moment);

    document.getElementById('rd-title').textContent = id ? 'Modifier le rituel' : 'Nouveau rituel';

    renderRdProducts();
    document.getElementById('rituel-sheet').classList.add('open');
  }
  function closeRituelSheet(){ document.getElementById('rituel-sheet').classList.remove('open'); }
  // Récupère l'objet rappels depuis l'interface du semainier
  function rdCollectRappels(){
    const onEl = document.getElementById('rd-rem-on');
    const on = onEl && onEl.checked;
    const m = rituelDraft ? rituelDraft.moment : 'matin';

    if(m==='hebdo'){
      // Soin hebdo : le rappel tombe le jour choisi pour le soin
      const obj = { on: !!on, hebdoDay: rdHebdoDay };
      if(on){
        obj.days = [rdHebdoDay];
        obj.soir = document.getElementById('rd-h-soir').value || '21:00';
      }
      return obj;
    }

    if(!on) return null;
    // Matin ou soir : la routine est quotidienne, donc le rappel aussi
    const obj = { on:true, days:[0,1,2,3,4,5,6] };
    if(m==='matin'||m==='both'){ obj.matin = document.getElementById('rd-h-matin').value || '08:00'; }
    if(m==='soir'||m==='both'){ obj.soir  = document.getElementById('rd-h-soir').value  || '21:00'; }
    return obj;
  }
  // Applique un objet rappels à l'interface (édition)
  function rdApplyRappels(rap){
    const onEl=document.getElementById('rd-rem-on');
    const panel=document.getElementById('rd-rem-panel');
    const bell=document.getElementById('rd-bell');
    if(!onEl) return;

    const actif = !!(rap && rap.on);
    onEl.checked = actif;

    if(rap){
      if(rap.matin) document.getElementById('rd-h-matin').value = rap.matin;
      if(rap.soir)  document.getElementById('rd-h-soir').value  = rap.soir;
    }
    // Le jour du soin hebdo (semainier hors rappels) : on le restaure toujours
    rdHebdoDay = (rap && typeof rap.hebdoDay === 'number') ? rap.hebdoDay : 0;
    document.querySelectorAll('.rd-hday').forEach(b=>{
      b.classList.toggle('on', parseInt(b.dataset.hday,10) === rdHebdoDay);
    });

    // Le panneau reste fermé : la cloche indique juste s'il y a un rappel
    if(panel) panel.style.display = 'none';
    if(bell){
      bell.classList.remove('on');
      bell.classList.toggle('has-rem', actif);
    }
    rdSyncRemTimes();
  }

  // ===== Semainier de rappels (par rituel) =====
  let rdHebdoDay = 0;  // 0=dimanche par défaut
  function rdPickHebdoDay(d){
    rdHebdoDay = d;
    document.querySelectorAll('.rd-hday').forEach(b=>b.classList.toggle('on', parseInt(b.dataset.hday,10)===d));
    rdSyncRemTimes();   // la note du rappel suit le jour choisi
  }
  // La cloche : discrète, elle ouvre les réglages de rappel au besoin
  function rdToggleRemPanel(){
    const panel=document.getElementById('rd-rem-panel');
    const bell=document.getElementById('rd-bell');
    const on=document.getElementById('rd-rem-on');
    if(!panel || !bell || !on) return;

    const actif = !on.checked;      // la cloche allume ou éteint le rappel
    on.checked = actif;
    panel.style.display = actif ? 'block' : 'none';
    bell.classList.toggle('on', actif);

    if(actif){
      rdSyncRemTimes();
      panel.scrollIntoView({ behavior:'smooth', block:'nearest' });
    }
  }

  // Un point sur la cloche quand des rappels sont actifs
  function rdRefreshBell(){
    const bell=document.getElementById('rd-bell');
    const on=document.getElementById('rd-rem-on');
    if(!bell || !on) return;
    bell.classList.toggle('has-rem', !!on.checked);
  }

  function rdToggleRem(){
    setTimeout(rdRefreshBell, 0);
    const on=document.getElementById('rd-rem-on').checked;
    document.getElementById('rd-rem-body').style.display = on ? 'block' : 'none';
    if(on) rdSyncRemTimes();
  }
  
  
  
  // affiche les sélecteurs d'heure selon le moment (matin/soir/both)
  function rdSyncRemTimes(){
    const tm=document.getElementById('rd-time-matin'), ts=document.getElementById('rd-time-soir');
    if(!tm||!ts) return;
    const m = rituelDraft ? rituelDraft.moment : 'matin';
    // Une seule heure : celle du créneau concerné
    tm.style.display = (m==='matin'||m==='both') ? 'flex' : 'none';
    ts.style.display = (m==='soir'||m==='both'||m==='hebdo') ? 'flex' : 'none';

  }

    function rdSetMoment(m){
    rituelDraft.moment = m;
    const hd=document.getElementById('rd-hebdo-day'); if(hd) hd.style.display = (m==='hebdo') ? 'block' : 'none';
    // Le nom suggéré apparaît en gris dans le champ : discret, et modifiable
    const nomEl=document.getElementById('rd-nom');
    if(nomEl){
      nomEl.placeholder = (m==='matin') ? 'Rituel du matin'
                        : (m==='soir')  ? 'Rituel du soir'
                        : (m==='hebdo') ? 'Soin de la semaine' : 'Mon rituel';
    }
    if(document.getElementById('rd-rem-on') && document.getElementById('rd-rem-on').checked) rdSyncRemTimes();
  }
  function rdRemove(id){ rituelDraft.produits = rituelDraft.produits.filter(x=>x!==id); renderRdProducts(); }
  function renderRdProducts(){
    const list=document.getElementById('rd-products'); if(!list) return;
    if(!rituelDraft.produits.length){ list.innerHTML=''; return; }
    list.innerHTML = rituelDraft.produits.map((id,i)=>{
      const p=rdProductMap[id]; if(!p) return '';
      return `<div class="rd-card" data-id="${id}"><div class="rd-handle">⠿</div><div class="rd-emoji">${p.emoji||'🧴'}</div><div style="flex:1;min-width:0;"><div class="rd-step" style="font-size:10px;color:var(--accent-deep);letter-spacing:.08em;">ÉTAPE ${i+1}</div><div class="product-name" style="font-size:15px;">${escapeHtml(p.nom||'')}${p.categorie? ' <span style="font-size:10px;color:var(--muted);font-weight:500;">· '+catLabel(p.categorie)+'</span>' : ''}</div></div><button class="rd-remove" onclick="rdRemove('${id}')">×</button></div>`;
    }).join('');
    initRituelDnd();
    renderRdConflicts();
  }
  function rdActives(p){
    const s=((p&&p.nom||'')+' '+(p&&p.effets||'')).toLowerCase();
    const set=new Set();
    if(/r[ée]tin|tr[ée]tin|adapal/.test(s)) set.add('retinoid');
    if(/vitamine c|vitamin c|ascorb/.test(s)) set.add('vitc');
    if(/\baha\b|\bbha\b|\bpha\b|glycoliqu|salicyliqu|lactiqu|mand[ée]liqu|peeling|exfoli/.test(s)) set.add('acids');
    if(/benzoyl|peroxyde de benzoyle|\bbpo\b/.test(s)) set.add('bpo');
    return set;
  }
  function detectConflicts(prods){
    const all=new Set(); prods.forEach(p=>rdActives(p).forEach(a=>all.add(a)));
    const m=[];
    if(all.has('retinoid')&&all.has('acids')) m.push('Rétinoïde + acides exfoliants : souvent trop irritant dans le même rituel. Beaucoup préfèrent les espacer (un soir sur deux).');
    if(all.has('retinoid')&&all.has('vitc')) m.push('Rétinoïde + vitamine C : on les sépare souvent · vitamine C le matin, rétinoïde le soir.');
    if(all.has('retinoid')&&all.has('bpo')) m.push('Rétinoïde + peroxyde de benzoyle : peuvent s\'irriter ou se neutraliser selon la formule · souvent mieux d\'alterner.');
    if(all.has('acids')&&all.has('vitc')) m.push('Acides exfoliants + vitamine C : combo parfois irritant · beaucoup préfèrent les espacer.');
    return m;
  }
  function renderRdConflicts(){
    const box=document.getElementById('rd-conflicts'); if(!box) return;
    const prods=(rituelDraft&&rituelDraft.produits||[]).map(id=>rdProductMap[id]).filter(Boolean);
    const msgs=detectConflicts(prods);
    if(!msgs.length){ box.innerHTML=''; return; }
    box.innerHTML='<div style="background:#FBF1E6;border:1px solid #EBD9BE;border-radius:14px;padding:12px 14px;font-size:12.5px;color:#7A5A2E;line-height:1.55;margin-bottom:4px;">💡 <b>Petit conseil</b><br>'+msgs.map(escapeHtml).join('<br>')+'<br><button class="btn-soft" style="padding:7px 14px;font-size:11.5px;margin-top:8px;" onclick="closeRituelSheet();navTo(\'chat\')">En parler à Léa →</button><div style="margin-top:6px;color:#A98A5E;font-size:11px;">Ça dépend de ta peau et des formules · ce n\'est pas un avis médical.</div></div>';
  }
  function renumberRd(){
    const list=document.getElementById('rd-products'); if(!list) return;
    [...list.querySelectorAll('.rd-card')].forEach((c,i)=>{ const s=c.querySelector('.rd-step'); if(s) s.textContent='ÉTAPE '+(i+1); });
  }
  function initRituelDnd(){
    const list=document.getElementById('rd-products'); if(!list) return;
    list.querySelectorAll('.rd-handle').forEach(h=>{
      h.onpointerdown=(e)=>{
        e.preventDefault();
        const dragEl=h.closest('.rd-card'); if(!dragEl) return;
        const cards=[...list.querySelectorAll('.rd-card')];
        const idx=cards.indexOf(dragEl);
        const gap=parseFloat(getComputedStyle(list).rowGap)||8;
        const rowH=dragEl.offsetHeight+gap;
        const startY=e.clientY;
        let curIdx=idx;
        dragEl.classList.add('dragging');
        try{ h.setPointerCapture(e.pointerId); }catch(_){}
        const others=cards.filter(x=>x!==dragEl);
        const move=(ev)=>{
          const dy=ev.clientY-startY;
          dragEl.style.transform='translateY('+dy+'px)';
          let target=idx+Math.round(dy/rowH);
          target=Math.max(0, Math.min(cards.length-1, target));
          if(target!==curIdx){
            curIdx=target;
            others.forEach(o=>{
              const oi=cards.indexOf(o);
              let shift=0;
              if(idx<curIdx && oi>idx && oi<=curIdx) shift=-rowH;
              else if(idx>curIdx && oi>=curIdx && oi<idx) shift=rowH;
              o.style.transform = shift ? 'translateY('+shift+'px)' : '';
            });
            if(navigator.vibrate) navigator.vibrate(8);
          }
        };
        const up=()=>{
          document.removeEventListener('pointermove',move);
          document.removeEventListener('pointerup',up);
          document.removeEventListener('pointercancel',up);
          dragEl.classList.remove('dragging');
          cards.forEach(x=>{ x.style.transform=''; });
          if(curIdx!==idx){
            const order=[...others]; order.splice(curIdx,0,dragEl);
            order.forEach(x=>list.appendChild(x));
            renumberRd();
          }
          rituelDraft.produits = [...list.querySelectorAll('.rd-card')].map(x=>x.dataset.id);
        };
        document.addEventListener('pointermove',move);
        document.addEventListener('pointerup',up);
        document.addEventListener('pointercancel',up);
      };
    });
  }
  // ===== Tri/filtre du picker de produits (rituel) =====
  let rdSort = 'fav';
  let rdCatFilter = 'all';
  function setRdSort(s){
    rdSort = s;
    document.querySelectorAll('[data-rdsort]').forEach(b=>b.classList.toggle('sel', b.dataset.rdsort===s));
    renderRdPickerList();
  }
  function toggleRdCatDD(){ document.getElementById('rd-cat-menu').classList.toggle('open'); }
  function pickRdCat(cat, label){
    rdCatFilter = cat;
    document.querySelectorAll('#rd-cat-menu .cat-dd-opt').forEach(b=>b.classList.toggle('sel', b.dataset.cat===cat));
    const btn=document.getElementById('rd-cat-btn');
    btn.innerHTML = label + ' <span style="font-size:8px;opacity:0.6;">▼</span>';
    btn.classList.toggle('active-filter', cat!=='all');
    document.getElementById('rd-cat-menu').classList.remove('open');
    renderRdPickerList();
  }
  // construit la liste filtrée + triée
  function renderRdPickerList(){
    const list=document.getElementById('rd-picker-list');
    if(!list) return;
    let ids = Object.keys(rdProductMap).filter(id=>!rituelDraft.produits.includes(id));
    // filtre catégorie
    if(rdCatFilter!=='all'){
      ids = ids.filter(id=>{ const p=rdProductMap[id]; return (p && (p.categorie||'autre')===rdCatFilter); });
    }
    // tri
    const favs = (typeof favSet==='function') ? favSet() : new Set();
    ids.sort(function(a,b){
      const pa=rdProductMap[a], pb=rdProductMap[b];
      if(rdSort==='alpha'){ return (pa.nom||'').localeCompare(pb.nom||'', 'fr', {sensitivity:'base'}); }
      if(rdSort==='perem'){
        const da=pa.date_peremption||'', db=pb.date_peremption||'';
        if(!da && !db) return 0; if(!da) return 1; if(!db) return -1; return da.localeCompare(db);
      }
      // favoris
      const fa=favs.has(a)?1:0, fb=favs.has(b)?1:0;
      if(fa!==fb) return fb-fa; return 0;
    });
    if(!ids.length){
      list.innerHTML='<div style="color:var(--muted);font-size:13px;padding:8px 2px;line-height:1.5;">Aucun produit dans cette vue 🌸</div>';
      return;
    }
    list.innerHTML = ids.map(id=>{ const p=rdProductMap[id]; const sel=rdPickerSel.has(id);
      const nom=(p.nom||'').split(' · ')[0];
      return '<button class="rd-pick'+(sel?' picked':'')+'" data-id="'+id+'" onclick="rdTogglePick(\''+id+'\',this)" style="display:flex;align-items:center;gap:12px;width:100%;padding:10px 12px;border-radius:14px;border:1.5px solid '+(sel?'var(--accent)':'var(--line)')+';background:var(--surface);cursor:pointer;text-align:left;">'+
        '<span style="font-size:20px;">'+(p.emoji||'🧴')+'</span>'+
        '<span style="flex:1;font-size:14px;color:var(--ink);">'+nom+'</span>'+
        '<span style="width:22px;height:22px;border-radius:50%;border:1.5px solid '+(sel?'var(--accent)':'var(--line)')+';background:'+(sel?'var(--accent)':'transparent')+';display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;">'+(sel?'✓':'')+'</span>'+
      '</button>';
    }).join('');
  }

  function openRituelHelp(){ document.getElementById('rituel-help-overlay').style.display='flex'; }
  function closeRituelHelp(){ document.getElementById('rituel-help-overlay').style.display='none'; }

      async function openRdPicker(){
    rdPickerSel = new Set();
    rdSort = 'fav'; rdCatFilter = 'all';
    // reset visuel des chips
    setTimeout(function(){
      document.querySelectorAll('[data-rdsort]').forEach(b=>b.classList.toggle('sel', b.dataset.rdsort==='fav'));
      const cb=document.getElementById('rd-cat-btn'); if(cb){ cb.innerHTML='Catégorie <span style="font-size:8px;opacity:0.6;">▼</span>'; cb.classList.remove('active-filter'); }
      document.querySelectorAll('#rd-cat-menu .cat-dd-opt').forEach(b=>b.classList.toggle('sel', b.dataset.cat==='all'));
    },0);
    renderRdPickerList();
    document.getElementById('rd-picker').classList.add('open');
  }
  function rdTogglePick(id, btn){
    if(rdPickerSel.has(id)){ rdPickerSel.delete(id); }
    else { rdPickerSel.add(id); }
    renderRdPickerList();
  }
  function closeRdPicker(){ document.getElementById('rd-picker').classList.remove('open'); }
  function confirmRdPicker(){
    rdPickerSel.forEach(id=>{ if(!rituelDraft.produits.includes(id)) rituelDraft.produits.push(id); });
    closeRdPicker();
    renderRdProducts();
  }
  async function saveRituel(){
    if(!currentUser) return;
    const _autoNom = rituelDraft.moment==='matin'?'Rituel du matin':(rituelDraft.moment==='soir'?'Rituel du soir':(rituelDraft.moment==='hebdo'?'Soins de la semaine':'Mon rituel'));
    const nom = (document.getElementById('rd-nom').value.trim()) || _autoNom;
    showToast('Enregistrement…');
    try{
      const { data: cp } = await sb.from('products').select('id,categorie').in('id', rituelDraft.produits);
      const rk={}; (cp||[]).forEach(p=>rk[p.id]=(p.categorie in CAT_RANK)?CAT_RANK[p.categorie]:99);
      const before=rituelDraft.produits.join(',');
      rituelDraft.produits=[...rituelDraft.produits].map((id,i)=>({id,i})).sort((x,y)=>((rk[x.id]??99)-(rk[y.id]??99))||(x.i-y.i)).map(x=>x.id);
      if(rituelDraft.produits.join(',')!==before) showToast('Ordre ajusté selon les catégories ✨');
    }catch(e){}
    try{
      const { data: oth } = await sb.from('rituels').select('id,moment,actif').eq('user_id', currentUser.id);
      const myM=(rituelDraft.moment==='matin'||rituelDraft.moment==='both');
      const myS=(rituelDraft.moment==='soir'||rituelDraft.moment==='both');
      const offIds=(oth||[]).filter(r=>r.actif && r.id!==rituelDraft.id && r.moment!=='hebdo' && rituelDraft.moment!=='hebdo' && ((myM&&(r.moment==='matin'||r.moment==='both'))||(myS&&(r.moment==='soir'||r.moment==='both')))).map(r=>r.id);
      if(offIds.length) await sb.from('rituels').update({actif:false}).in('id', offIds);
    }catch(e){}
    let savedId = rituelDraft.id || null;
    if(rituelDraft.id){
      await sb.from('rituels').update({ nom, moment:rituelDraft.moment, produits:rituelDraft.produits, actif:true, rappels:rdCollectRappels() }).eq('id', rituelDraft.id);
    } else {
      const { data: existing } = await sb.from('rituels').select('id').eq('user_id', currentUser.id);
      const position = existing ? existing.length : 0;
      const { data: _ins } = await sb.from('rituels').insert({ user_id:currentUser.id, nom, moment:rituelDraft.moment, produits:rituelDraft.produits, position, actif:true , rappels:rdCollectRappels() }).select('id').maybeSingle(); savedId = _ins ? _ins.id : savedId;
    }
    await recomputeRituelType();
    closeRituelSheet();
    showToast('Rituel enregistré ✓');
    window.__allRituels=null;
    loadRituels();
    loadHomeRoutine();
    if(savedId) setTimeout(function(){ openRituelChemin(savedId); }, 200);
  }

// Pont transitoire : onclick inline (rituel-sheet : saveRituel, rdTogglePick, rdRemove…) et
// appels hérités (openRituelEditor depuis les écrans produits/rituel, closeRituelSheet).
Object.assign(window, {
  closeRdPicker, closeRituelHelp, closeRituelSheet, confirmRdPicker, detectConflicts,
  initRituelDnd, openRdPicker, openRituelEditor, openRituelHelp, pickRdCat, rdActives,
  rdApplyRappels, rdCollectRappels, rdPickHebdoDay, rdRefreshBell, rdRemove, rdSetMoment,
  rdSyncRemTimes, rdTogglePick, rdToggleRem, rdToggleRemPanel, renderRdConflicts,
  renderRdPickerList, renderRdProducts, renumberRd, saveRituel, setRdSort, toggleRdCatDD,
});
