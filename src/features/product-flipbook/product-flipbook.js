// Domaine « Carnet produits — vue feuilletable » (mode livre) — pagination facon grimoire :
// sommaire par chapitres, pages produit, chiffres romains, dates. Extrait de app.legacy.js
// (Phase B), déplacé VERBATIM (octets identiques). Aucun état mémoire (préférence de vue en
// localStorage). Dépendances héritées lues en identifiant nu (résolues via l'objet global) :
//  - état partagé promu : productCatFilter, productSort (core/state.js) ;
//  - constantes partagées : CATS, CAT_RANK (exposées sur window côté hérité) ;
//  - fonctions : favSet, favSave, loadProducts, catLabel, signedPhoto, escapeHtml, et le rendu
//    des cartes cnRenderFlat/cnRenderChaptered/cnCardHtml (module product-cards).

// ===== Produits en livre : vue feuilletable =====
  function getProdView(){ try{ return localStorage.getItem('rituel_prodview')||'list'; }catch(e){ return 'list'; } }
  function setProdView(v){ try{ localStorage.setItem('rituel_prodview', v); }catch(e){} }
  function toggleProductView(){ setProdView(getProdView()==='book'?'list':'book'); loadProducts(); }
  function pbkToggleFav(id, el){ const s=favSet(); if(s.has(id)) s.delete(id); else s.add(id); favSave(s); if(el){ el.textContent=s.has(id)?'★':'☆'; el.classList.toggle('on', s.has(id)); } }

  function pbkGoTo(i){ const l=document.getElementById('products-list'); if(!l) return; l.scrollTo({left:i*(l.clientWidth||1), behavior:'smooth'}); }
  function bkSommairePage(products){
    const groups={}; products.forEach(function(p,i){ const c=p.categorie||'autre'; (groups[c]=groups[c]||[]).push({p:p,i:i}); });
    let body='', nbCat=0;
    CATS.forEach(function(cat){
      const items=groups[cat[0]]; if(!items||!items.length) return; nbCat++;
      body+='<div class="bkt-cat"><span class="bkt-cat-t">'+cat[1]+'  '+cat[2]+'</span><span class="bkt-rule"></span></div>';
      items.forEach(function(it){
        const nm=escapeHtml((it.p.nom||'').split(' · ')[0]);
        body+='<div class="bkt-item" onclick="pbkGoTo('+(it.i+1)+')"><span class="bkt-e">'+(it.p.emoji||'🧴')+'</span><span class="bkt-n">'+nm+'</span><span class="bkt-lead"></span><span class="bkt-p">'+(it.i+1)+'</span></div>';
      });
    });
    const n=products.length;
    return '<div class="pbk-page"><div class="bkt">'+
      '<div class="bkt-orn">❧</div>'+
      '<div class="bkt-k">Sommaire</div>'+
      '<div class="bkt-title">Ma <em>collection</em></div>'+
      '<div class="bkt-sub">'+n+' produit'+(n>1?'s':'')+' · '+nbCat+' famille'+(nbCat>1?'s':'')+'</div>'+
      '<div class="bkt-div"><span class="bkt-rule"></span><span>❦</span><span class="bkt-rule"></span></div>'+
      '<div class="bkt-grid">'+body+'</div>'+
      '<div class="bkt-hint">glisse pour feuilleter →</div>'+
      '</div></div>';
  }

  function bkRoman(n){ const r=[[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']]; let s=''; r.forEach(function(p){ while(n>=p[0]){ s+=p[1]; n-=p[0]; } }); return s||'I'; }
  function bkRow(k,v,cls){ return '<div class="bk2-row"><span class="bk2-k">'+k+'</span><span class="bk2-lead"></span><span class="bk2-v'+(cls||'')+'">'+v+'</span></div>'; }
  function bkDateRows(p){
    const fmt=function(d){ const x=d.split('-'); return x[2]+'/'+x[1]+'/'+x[0].slice(2); };
    let out='';
    if(p.date_ouverture) out+=bkRow('Ouvert le', fmt(p.date_ouverture));
    if(p.date_peremption){
      const exp=new Date(p.date_peremption), t=new Date(); t.setHours(0,0,0,0);
      const days=Math.round((exp-t)/86400000), months=days/30;
      let c; if(days<0) c=['#FBE2DC','#B23A1E']; else if(months>9) c=['#EFE7DD','#7A6B5C']; else if(months>6) c=['#E3F0E0','#3E7A4E']; else if(months>3) c=['#F7ECCB','#8A6A1E']; else c=['#FBE2DC','#B23A1E'];
      let txt; if(days<0) txt='Périmé'; else if(days===0) txt="Périme aujourd'hui"; else txt=fmt(p.date_peremption)+' · '+days+' j';
      out+='<div class="bk2-row"><span class="bk2-k">Fraîcheur</span><span class="bk2-lead"></span><span class="bk2-v badge" style="background:'+c[0]+';color:'+c[1]+';">'+txt+'</span></div>';
    }
    return out;
  }
  async function pbkPage(p, favs, idx, total){
    const parts=(p.nom||'').split(' · ');
    const name=escapeHtml(parts[0]||'');
    const brand=parts.length>1 ? escapeHtml(parts.slice(1).join(' · ')) : '';
    const catL=(CATS.find(function(x){return x[0]===(p.categorie||'autre');})||['','','Soin'])[2];
    let plate;
    if(p.photo_path){ const url=await signedPhoto(p.photo_path); plate = url ? '<img src="'+url+'" alt="">' : '<div class="bk2-emoji">'+(p.emoji||'🧴')+'</div>'; }
    else plate='<div class="bk2-emoji">'+(p.emoji||'🧴')+'</div>';
    const moment=(p.in_matin&&p.in_soir)?'Matin & soir':(p.in_matin?'Matin':(p.in_soir?'Soir':'—'));
    let rows=bkRow('Catégorie', escapeHtml(catL))+bkRow('Moment', moment);
    if(p.prix!=null&&p.prix!=='') rows+=bkRow('Prix', p.prix+' €');
    rows+=bkDateRows(p);
    const notes=p.effets?escapeHtml(p.effets):'—';
    return '<div class="pbk-page" data-pid="'+p.id+'">'+
      '<button class="bk2-fav'+(favs.has(p.id)?' on':'')+'" onclick="pbkToggleFav(\''+p.id+'\',this)">'+(favs.has(p.id)?'★':'☆')+'</button>'+
      '<div class="bk2">'+
        '<div class="bk2-head"><span class="bk2-rule"></span><span class="bk2-plate-no">Fiche N° '+(idx+1)+'</span><span class="bk2-rule"></span></div>'+
        '<div class="bk2-plate"><div class="bk2-plate-in">'+
          '<span class="bk2-corner tl">❦</span><span class="bk2-corner tr">❦</span><span class="bk2-corner bl">❦</span><span class="bk2-corner br">❦</span>'+
          plate+'</div></div>'+
        '<div class="bk2-caption">'+escapeHtml(catL)+'</div>'+
        '<div class="bk2-title">'+name+'</div>'+
        (brand?'<div class="bk2-latin">'+brand+'</div>':'')+
        '<div class="bk2-orn">❧</div>'+
        '<div class="bk2-rows">'+rows+'</div>'+
        '<div class="bk2-notes-t">Notes</div><div class="bk2-notes">'+notes+'</div>'+
        '<div class="bk2-actions"><button class="bk2-edit" onclick="openProductForm(\''+p.id+'\')">Modifier</button><button class="bk2-del" onclick="pbDelete(\''+p.id+'\')">Retirer</button></div>'+
        '<div class="bk2-foot"><span class="bk2-rule"></span><span class="bk2-folio">— '+(idx+1)+' / '+total+' —</span><span class="bk2-rule"></span></div>'+
      '</div></div>';
  }

  async function renderProductsBook(products, favs){
    const list=document.getElementById('products-list');
    let pages=bkSommairePage(products); for(let i=0;i<products.length;i++){ pages += await pbkPage(products[i], favs, i, products.length); }
    list.style.cssText=''; list.className='pl-book';
    list.innerHTML=pages;
    const sec=list.parentElement;
    let dots=document.getElementById('pbk-dots');
    if(!dots){ dots=document.createElement('div'); dots.id='pbk-dots'; dots.className='pbk-dots'; if(sec) sec.appendChild(dots); }
    let _d=''; for(let i=0;i<products.length+1;i++){ _d+='<span class="pbk-dot'+(i===0?' on':'')+'"></span>'; }
    dots.innerHTML=_d;
    list.onscroll=function(){ const i=Math.round(list.scrollLeft/(list.clientWidth||1)); dots.querySelectorAll('.pbk-dot').forEach(function(d,j){ d.classList.toggle('on', j===i); }); };
    list.scrollLeft=0;
  }

    async function loadProducts(){
    if(!currentUser) return;
    const list = document.getElementById('products-list');
    const { data } = await sb.from('products').select('*').eq('user_id', currentUser.id).order('position',{ascending:true}).order('created_at',{ascending:true});
    const _favs = favSet();
    let baseData = (data || []);
    // On garde la liste complète : elle sert à compter les produits par catégorie
    window.__allProducts = baseData.slice();
    refreshSortLabel();
    // Filtre par catégorie
    if(productCatFilter && productCatFilter!=='all'){
      baseData = baseData.filter(function(p){ return (p.categorie||'autre')===productCatFilter; });
    }
    const products = baseData.slice().sort(function(a,b){
      if(productSort==='alpha'){
        return (a.nom||'').localeCompare(b.nom||'', 'fr', {sensitivity:'base'});
      }
      if(productSort==='perem'){
        // les produits avec une date de péremption d'abord, du plus proche au plus lointain
        const da=a.date_peremption||'', db=b.date_peremption||'';
        if(!da && !db) return 0;
        if(!da) return 1;  // sans date → à la fin
        if(!db) return -1;
        return da.localeCompare(db);
      }
      // défaut : favoris en premier
      const fa=_favs.has(a.id)?1:0, fb=_favs.has(b.id)?1:0;
      if(fa!==fb) return fb-fa;
      return 0;
    });
    const rt=document.getElementById('routine');
    const _oldDots=document.getElementById('pbk-dots'); if(_oldDots) _oldDots.remove();
    const _tg=document.getElementById('prodview-toggle');
    if(getProdView()==='book' && products.length){
      rt.classList.add('book-mode');
      if(_tg) _tg.textContent='☰';
      const bookProds=products.slice().sort(function(a,b){ const ra=(CAT_RANK[a.categorie||'autre']!=null?CAT_RANK[a.categorie||'autre']:99), rb=(CAT_RANK[b.categorie||'autre']!=null?CAT_RANK[b.categorie||'autre']:99); return ra-rb; });
      await renderProductsBook(bookProds, _favs);
    } else {
      rt.classList.remove('book-mode');
      if(_tg) _tg.textContent='📖';
      list.className=''; list.style.cssText='display:flex;flex-direction:column;gap:0;';
      if(!products.length){ list.innerHTML = cnEmptyHtml(); }
      else if(productSort==='cat' && (!productCatFilter || productCatFilter==='all')){ list.innerHTML = await cnRenderChaptered(products, _favs); }
      else { list.innerHTML = await cnRenderFlat(products, _favs); }
    }
    renderRoutineFooter();
  }

// Pont transitoire : onclick inline (toggleProductView, pbkGoTo, pbkToggleFav…) + appels
// hérités (loadProducts appelle renderProductsBook/getProdView). Résolution via window.
Object.assign(window, {
  getProdView, setProdView, toggleProductView, pbkToggleFav, pbkGoTo,
  bkSommairePage, bkRoman, bkRow, bkDateRows, pbkPage, renderProductsBook, loadProducts,
});
