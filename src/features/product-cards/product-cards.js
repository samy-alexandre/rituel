// Domaine « Carnet de produits — rendu des cartes » — teintes par catégorie + HTML des cartes
// produit (plat ou groupé par chapitre) + état vide. Extrait de app.legacy.js (Phase B),
// déplacé VERBATIM (octets identiques). Le nuancier CN_TINT (propre au carnet) migre avec le
// module. Dépendances héritées lues en identifiant nu (résolues via l'objet global) : CATS
// (constante PARTAGÉE, exposée sur window.CATS), signedPhoto, escapeHtml, productDateInfo.
// Les cartes générées appellent (au clic) onProductCardClick, startLongPress, cancelLongPress,
// toggleFav, openBarcodeSheet — résolus contre window au moment du clic.

// ===== Carnet de produits : teintes + rendu premium =====
  const CN_TINT = { demaquillant:'#F6E6E0', nettoyant:'#E6EFE4', toner:'#E7EDF0', serum:'#F7ECD9', yeux:'#ECE7F0', creme:'#EFEAE2', spf:'#FBEFD3', masque:'#F3E4EC', cible:'#F6E2DC', autre:'#EDE9E1' };

  function cnMoment(p){ return ''; }

  async function cnCardHtml(p, favs){
    let thumb = p.emoji || '🧴';
    if(p.photo_path){ const url=await signedPhoto(p.photo_path); if(url) thumb='<img src="'+url+'" alt="">'; }
    const parts=(p.nom||'').split(' · ');
    const name=escapeHtml(parts[0]||'');
    const brand=parts.length>1 ? escapeHtml(parts.slice(1).join(' · ')) : '';
    const meta = [p.effets?escapeHtml(p.effets):'', (p.prix!=null&&p.prix!=='')?(p.prix+'€'):''].filter(Boolean).join(' · ');
    const tint = CN_TINT[p.categorie||'autre'] || CN_TINT.autre;
    return '<div class="cn-card product-card" data-pid="'+p.id+'" onclick="onProductCardClick(\''+p.id+'\', event)" ontouchstart="startLongPress(\''+p.id+'\')" ontouchend="cancelLongPress()" ontouchmove="cancelLongPress()">'+
      '<div class="sel-circle" style="display:none;width:24px;height:24px;border-radius:50%;border:2px solid var(--line);flex-shrink:0;align-items:center;justify-content:center;color:#fff;font-size:13px;"></div>'+
      '<div class="cn-thumb" style="background:'+tint+';">'+thumb+'</div>'+
      '<div class="cn-body">'+
        '<div class="cn-name">'+name+'</div>'+
        (brand?'<div class="cn-brand">'+brand+'</div>':'')+
        (meta?'<div class="cn-meta">'+meta+'</div>':'')+
        cnMoment(p)+
        productDateInfo(p)+
      '</div>'+
      '<button class="pf-fav cn-fav'+(favs.has(p.id)?' on':'')+'" onclick="toggleFav(\''+p.id+'\', event)">'+(favs.has(p.id)?'★':'☆')+'</button>'+
    '</div>';
  }

  async function cnRenderFlat(products, favs){
    let html=''; for(const p of products){ html += await cnCardHtml(p, favs); } return html;
  }

  async function cnRenderChaptered(products, favs){
    const groups={}; products.forEach(p=>{ const c=p.categorie||'autre'; (groups[c]=groups[c]||[]).push(p); });
    let html='';
    for(const cat of CATS){
      const items=groups[cat[0]];
      if(!items || !items.length) continue;
      html += '<div class="cn-chapter"><span class="cn-chapter-ic">'+cat[1]+'</span><span class="cn-chapter-t">'+cat[2]+'</span><span class="cn-chapter-n">'+items.length+'</span><span class="cn-chapter-rule"></span></div>';
      for(const p of items){ html += await cnCardHtml(p, favs); }
    }
    return html;
  }

  function cnEmptyHtml(){
    return '<div class="cn-empty"><div class="cn-empty-ic">🧴</div><div class="cn-empty-t">Ton carnet est vide</div><div class="cn-empty-s">Scanne un produit ou ajoute-le à la main pour commencer ta collection.</div><button class="cn-empty-btn" onclick="openBarcodeSheet()">📷 Scanner un produit</button></div>';
  }

// Pont transitoire : appelées par le code hérité (loadProducts / renderProductsBook) qui
// orchestre l'affichage de la liste. Résolution contre window au moment de l'appel.
Object.assign(window, { cnMoment, cnCardHtml, cnRenderFlat, cnRenderChaptered, cnEmptyHtml });
