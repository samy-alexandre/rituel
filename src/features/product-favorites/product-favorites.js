// Domaine « Produits — fraîcheur & favoris » — utilitaires transverses du carnet :
// productDateInfo (badge de péremption/ouverture) et favoris (localStorage).
// Extrait de app.legacy.js (Phase B), déplacé VERBATIM (octets identiques). Aucun état mémoire.
// Dépendances héritées lues en identifiant nu (résolues via l'objet global) : currentUser,
// productSort (état partagé promu dans core/state.js), loadProducts (orchestrateur hérité).
// Ces fonctions sont appelées par plusieurs modules produits déjà extraits (cartes, fiche,
// vue livre) via window.

// ===== Fraîcheur & favoris produits =====
function productDateInfo(p) {
  const fmt = (d) => {
    const x = d.split('-');
    return x[2] + '/' + x[1] + '/' + x[0].slice(2);
  };
  const parts = [];
  let peremLine = '';
  if (p.date_ouverture) parts.push('Ouvert le ' + fmt(p.date_ouverture));
  if (p.date_peremption) {
    const exp = new Date(p.date_peremption);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Math.round((exp - today) / 86400000);
    const months = days / 30;
    // Couleur selon le temps restant
    let col;
    if (days < 0)
      col = ['#FBE2DC', '#B23A1E']; // périmé : rouge
    else if (months > 9)
      col = ['#EFE7DD', '#7A6B5C']; // > 9 mois : neutre
    else if (months > 6)
      col = ['#E3F0E0', '#3E7A4E']; // 6-9 : vert
    else if (months > 3)
      col = ['#F7ECCB', '#8A6A1E']; // 3-6 : orange
    else col = ['#FBE2DC', '#B23A1E']; // < 3 mois : rouge
    // Texte de la pastille
    let txt;
    if (days < 0) {
      const dPass = Math.abs(days);
      txt =
        '⚠️ Périmé ' +
        (dPass === 0
          ? "aujourd'hui"
          : dPass === 1
            ? 'depuis 1 jour'
            : 'depuis ' + dPass + ' jours');
    } else if (days === 0) {
      txt = "⚠️ Périme aujourd'hui";
    } else {
      const joursTxt = days === 1 ? '1 jour' : days + ' jours';
      txt = 'Périme le ' + fmt(p.date_peremption) + ' (' + joursTxt + ')';
    }
    peremLine =
      '<div style="margin-top:5px;"><span class="prod-badge" style="background:' +
      col[0] +
      ';color:' +
      col[1] +
      ';">' +
      txt +
      '</span></div>';
  }
  const line = parts.length ? '<div class="product-dates">' + parts.join(' · ') + '</div>' : '';
  return line + peremLine;
}

// ===== Favoris produits (localStorage) =====
function favSet() {
  try {
    return new Set(
      JSON.parse(
        localStorage.getItem('rituel_favs_' + (currentUser ? currentUser.id : 'x')) || '[]'
      )
    );
  } catch (e) {
    return new Set();
  }
}
function favSave(s) {
  try {
    localStorage.setItem(
      'rituel_favs_' + (currentUser ? currentUser.id : 'x'),
      JSON.stringify([...s])
    );
  } catch (e) {}
}
function toggleFav(id, ev) {
  if (ev) ev.stopPropagation();
  const s = favSet();
  if (s.has(id)) s.delete(id);
  else s.add(id);
  favSave(s);
  const _on = s.has(id);
  const _b = ev && ev.currentTarget ? ev.currentTarget : null;
  if (_b) {
    _b.textContent = _on ? '★' : '☆';
    _b.classList.toggle('on', _on);
  }
  if (!_b || productSort === 'fav') loadProducts();
}

// Pont transitoire : appelées en identifiant nu par le code hérité et par les modules produits
// (product-cards, product-book, product-flipbook). Résolution contre window au moment de l'appel.
Object.assign(window, { productDateInfo, favSet, favSave, toggleFav });
