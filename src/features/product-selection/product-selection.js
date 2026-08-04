// ===== Mode sélection multiple des produits (appui long) =====
// Migré de public/app.legacy.js (déplacement verbatim). Pont transitoire window.*
// conservé tant que le HTML inline (index.html) référence ces fonctions.
let selectionMode = false;
let selectedProducts = new Set();
let longPressTimer = null;

function startLongPress(id){
  cancelLongPress();
  longPressTimer = setTimeout(function(){
    if(!selectionMode){
      enterSelectionMode();
      toggleProductSelection(id);
      if(navigator.vibrate) navigator.vibrate(40);
    }
  }, 500);
}
function cancelLongPress(){ if(longPressTimer){ clearTimeout(longPressTimer); longPressTimer=null; } }

function onProductCardClick(id, e){
  if(e && e.target && e.target.classList && e.target.classList.contains('pf-fav')) return;
  if(selectionMode){
    if(e) e.stopPropagation();
    toggleProductSelection(id);
  } else {
    openProductBook(id);
  }
}

function enterSelectionMode(){
  selectionMode = true;
  selectedProducts.clear();
  document.querySelectorAll('#products-list .sel-circle').forEach(c=>c.style.display='flex');
  document.getElementById('selection-bar').classList.add('show');
}
function exitSelectionMode(){
  selectionMode = false;
  selectedProducts.clear();
  document.querySelectorAll('#products-list .sel-circle').forEach(c=>{ c.style.display='none'; c.style.background='transparent'; c.style.borderColor='var(--line)'; c.textContent=''; });
  document.querySelectorAll('#products-list .product-card').forEach(card=>card.style.background='');
  document.getElementById('selection-bar').classList.remove('show');
}
function toggleProductSelection(id){
  const card = document.querySelector('#products-list .product-card[data-pid="'+id+'"]');
  if(!card) return;
  const circle = card.querySelector('.sel-circle');
  if(selectedProducts.has(id)){
    selectedProducts.delete(id);
    if(circle){ circle.style.background='transparent'; circle.style.borderColor='var(--line)'; circle.textContent=''; }
    card.style.background='';
  } else {
    selectedProducts.add(id);
    if(circle){ circle.style.background='var(--accent)'; circle.style.borderColor='var(--accent)'; circle.textContent='✓'; }
    card.style.background='var(--blush-soft)';
  }
  // mettre à jour le compteur de la barre
  const cnt=document.getElementById('selection-count');
  if(cnt) cnt.textContent = selectedProducts.size + ' sélectionné' + (selectedProducts.size>1?'s':'');
  // si plus rien de sélectionné, on peut sortir du mode
  if(selectedProducts.size===0) exitSelectionMode();
}

// suppression avec confirmation
function askDeleteSelected(){
  if(selectedProducts.size===0) return;
  document.getElementById('del-confirm-count').textContent = selectedProducts.size>1 ? ('ces '+selectedProducts.size+' produits') : 'ce produit';
  document.getElementById('del-confirm-overlay').style.display='flex';
}
function closeDeleteConfirm(){ document.getElementById('del-confirm-overlay').style.display='none'; }
async function confirmDeleteSelected(){
  const ids = Array.from(selectedProducts);
  closeDeleteConfirm();
  if(!ids.length) return;
  try {
    await sb.from('products').delete().in('id', ids);
    showToast(ids.length>1 ? (ids.length+' produits supprimés 🌸') : 'Produit supprimé 🌸');
  } catch(e){ showToast('Erreur lors de la suppression'); }
  exitSelectionMode();
  loadProducts();
}

async function renderRoutineFooter(){
  if(!currentUser) return;
  const { data: all } = await sb.from('products').select('prix').eq('user_id', currentUser.id);
  const arr = all || [];
  let cout=0; arr.forEach(p=>{ const v=parseFloat(p.prix); if(!isNaN(v)) cout+=v; });
  const cv=document.getElementById('cout-val'); if(cv) cv.textContent = cout>0 ? ('~'+Math.round(cout)+'€') : '0€';
  const pc=document.getElementById('prod-count'); if(pc) pc.textContent = arr.length;
}

// Pont transitoire : expose les fonctions sur window pour le HTML inline (index.html)
// et le code hérité (app.legacy.js) tant que la migration n'est pas complète.
window.startLongPress = startLongPress;
window.cancelLongPress = cancelLongPress;
window.onProductCardClick = onProductCardClick;
window.enterSelectionMode = enterSelectionMode;
window.exitSelectionMode = exitSelectionMode;
window.toggleProductSelection = toggleProductSelection;
window.askDeleteSelected = askDeleteSelected;
window.closeDeleteConfirm = closeDeleteConfirm;
window.confirmDeleteSelected = confirmDeleteSelected;
window.renderRoutineFooter = renderRoutineFooter;
