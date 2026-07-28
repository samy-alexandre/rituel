// Domaine « Fiche produit plein écran » (façon livre) — vue détail d'un produit du carnet :
// visuel, catégorie, effets, suivi de fraîcheur/péremption, favori, actions modifier/supprimer.
// Extrait de app.legacy.js (Phase B), déplacé VERBATIM (octets identiques). Le dégradé PB_GRAD
// (propre à cette fiche) migre avec le module. Aucun état mémoire (lit window.__allProducts +
// favoris localStorage). Dépendances héritées lues en identifiant nu (résolues via l'objet
// global) : CATS (constante PARTAGÉE laissée dans app.legacy.js, exposée sur window.CATS),
// escapeHtml, signedPhoto, favSet, favSave, cmAsk, sb, showToast, openProductForm, loadProducts.

// ===== Fiche produit plein écran (façon livre) =====
  const PB_GRAD = {
    demaquillant:['#F7E7E1','#E9CDC4'], nettoyant:['#E9F1E7','#CFE0CB'], toner:['#E7EDF1','#CDD9E1'],
    serum:['#F8EDDA','#EDD6B0'], yeux:['#EEE8F1','#D8CDE1'], creme:['#F0EBE3','#DFD4C4'],
    spf:['#FCF0D6','#F2DCA0'], masque:['#F5E6EE','#E4C6D6'], cible:['#F7E4DE','#EBC6BB'], autre:['#EFEBE3','#DED5C6']
  };

  function pbDates(p){
    const fmt=(d)=>{ const x=d.split('-'); return x[2]+'/'+x[1]+'/'+x[0].slice(2); };
    let rows='';
    if(p.date_ouverture) rows+='<div class="pb-date-row"><span>Ouvert le</span><b>'+fmt(p.date_ouverture)+'</b></div>';
    if(p.date_peremption){
      const exp=new Date(p.date_peremption); const today=new Date(); today.setHours(0,0,0,0);
      const days=Math.round((exp-today)/86400000); const months=days/30;
      let col;
      if(days<0) col=['#FBE2DC','#B23A1E'];
      else if(months>9) col=['#EFE7DD','#7A6B5C'];
      else if(months>6) col=['#E3F0E0','#3E7A4E'];
      else if(months>3) col=['#F7ECCB','#8A6A1E'];
      else col=['#FBE2DC','#B23A1E'];
      let txt;
      if(days<0){ const dp=Math.abs(days); txt='⚠️ Périmé '+(dp===0?"aujourd'hui":(dp===1?'depuis 1 jour':'depuis '+dp+' jours')); }
      else if(days===0){ txt='⚠️ Périme aujourd\'hui'; }
      else { txt='Périme le '+fmt(p.date_peremption)+' · '+(days===1?'1 jour':days+' jours'); }
      rows+='<div class="pb-date-row"><span>Fraîcheur</span><span class="pb-badge" style="background:'+col[0]+';color:'+col[1]+';">'+txt+'</span></div>';
    }
    return rows ? '<div class="pb-section"><div class="pb-sec-t">Suivi</div>'+rows+'</div>' : '';
  }

  async function openProductBook(id, minimal){
    const p=(window.__allProducts||[]).find(x=>String(x.id)===String(id));
    if(!p) return;
    const el=document.getElementById('product-book'); if(!el) return;
    const g=PB_GRAD[p.categorie||'autre']||PB_GRAD.autre;
    const parts=(p.nom||'').split(' · ');
    const name=escapeHtml(parts[0]||'');
    const brand=parts.length>1 ? escapeHtml(parts.slice(1).join(' · ')) : '';
    const catL=(CATS.find(x=>x[0]===(p.categorie||'autre'))||['','','Soin'])[2];
    let visual;
    if(p.photo_path){ const url=await signedPhoto(p.photo_path); visual = url ? '<img src="'+url+'" alt="">' : '<div class="pb-halo"></div><div class="pb-emoji">'+(p.emoji||'🧴')+'</div>'; }
    else visual='<div class="pb-halo"></div><div class="pb-emoji">'+(p.emoji||'🧴')+'</div>';
    const isFav=favSet().has(p.id);
    let chips='';
    if(!minimal && p.prix!=null&&p.prix!=='') chips+='<span class="pb-chip price">'+p.prix+'€</span>';
    const desc=p.effets?('<div class="pb-desc">'+escapeHtml(p.effets)+'</div>'):'';
    // En mode minimal (clic depuis l'aperçu d'un rituel) : catégorie, nom, marque, effets — rien d'autre.
    el.innerHTML='<div class="pb-wrap">'+
      '<button class="pb-close" onclick="closeProductBook()">‹</button>'+
      (minimal?'':'<button class="pb-fav'+(isFav?' on':'')+'" id="pb-fav-btn" onclick="pbToggleFav(\''+p.id+'\')">'+(isFav?'★':'☆')+'</button>')+
      '<div class="pb-visual" style="background:linear-gradient(150deg,'+g[0]+','+g[1]+');">'+visual+'</div>'+
      '<div class="pb-card"><div class="pb-cat">'+catL+'</div><div class="pb-name">'+name+'</div>'+
      (brand?'<div class="pb-brand">'+brand+'</div>':'')+desc+
      (minimal?'':(
        (chips?'<div class="pb-chips">'+chips+'</div>':'')+
        pbDates(p)+
        '<div class="pb-actions"><button class="pb-edit" onclick="pbEdit(\''+p.id+'\')">Modifier</button><button class="pb-del" onclick="pbDelete(\''+p.id+'\')">Supprimer</button></div>'))+
      '</div></div>';
    el.scrollTop=0;
    el.classList.add('show');
    document.body.style.overflow='hidden';
  }
  function closeProductBook(){ const el=document.getElementById('product-book'); if(el) el.classList.remove('show'); document.body.style.overflow=''; }
  function pbEdit(id){ closeProductBook(); setTimeout(function(){ openProductForm(id); }, 260); }
  function pbToggleFav(id){ const s=favSet(); if(s.has(id)) s.delete(id); else s.add(id); favSave(s); const b=document.getElementById('pb-fav-btn'); if(b){ b.textContent=s.has(id)?'★':'☆'; b.classList.toggle('on', s.has(id)); } }
  async function pbDelete(id){ if(!await cmAsk({titre:'Supprimer ce produit ?',texte:'Il sera retiré de ton carnet et de tous tes rituels.',ok:'Supprimer',annuler:'Annuler',danger:true})) return; try{ await sb.from('products').delete().eq('id', id); }catch(e){} closeProductBook(); if(typeof showToast==='function') showToast('Produit supprimé'); loadProducts(); }

// Pont transitoire : onclick inline (HTML généré) + appels hérités (openProductBook depuis le
// carnet/aperçu de rituel). Résolution contre window au moment de l'appel.
Object.assign(window, {
  pbDates, openProductBook, closeProductBook, pbEdit, pbToggleFav, pbDelete,
});
