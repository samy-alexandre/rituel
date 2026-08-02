// Domaine « Formulaire produit » — création/édition d'une fiche produit : icône ou photo,
// catégorie, effets, prix, dates (ouverture / péremption imprimée / durée de conservation),
// calcul de la péremption effective, enregistrement et suppression.
// Extrait de app.legacy.js (Phase B). Le code des fonctions est copié OCTET POUR OCTET depuis
// le monolithe (4 fragments réassemblés — les fonctions étaient éparpillées entre le domaine
// liste-produits et l'IIFE swipe-to-dismiss, laissés dans app.legacy.js).
// État privé au module : editingProductId, pfPhotoFile, pfState, pfMois, pfPhotoPath, pfEmoji,
// pfCat + la liste PRODUCT_EMOJIS. Aucune dépendance const partagée.
// Dépendances héritées lues en identifiant nu (résolues via l'objet global) : currentUser, sb,
// showToast, escapeHtml, cmAsk, loadProducts, catLabel, dpFmtDisplay (datepicker),
// pfEffetsGet/pfEffetsRender/pfEffetsSet (module product-effects).

// ===== État & constantes du formulaire produit =====
let editingProductId = null;
let pfPhotoFile = null;
let pfState = 'open';
let pfMois = null;

let pfPhotoPath = null;
let pfEmoji = '🧴';
const PRODUCT_EMOJIS = [
  '🧴',
  '🧼',
  '🫧',
  '💧',
  '💎',
  '✨',
  '☀️',
  '🌙',
  '🌸',
  '🌿',
  '💛',
  '🧪',
  '👁️',
  '💋',
];
let pfCat = 'autre';

// ===== Icône / photo, aperçu, fermeture =====
function renderEmojiPicker() {
  var el = document.getElementById('pf-icon-picker');
  if (!el) return;
  el.innerHTML =
    '<button type="button" class="pf-photo-choice" onclick="document.getElementById(\'pf-photo-input\').click()">📷  Prendre mon produit en photo</button><div class="pf-or">ou choisis une icône</div>' +
    '<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;">' +
    PRODUCT_EMOJIS.map(
      (e) =>
        `<button type="button" onclick="pickEmoji('${e}')" style="width:42px;height:42px;border-radius:12px;border:1px solid ${e === pfEmoji ? 'var(--accent)' : 'var(--line)'};background:${e === pfEmoji ? 'var(--accent)' : 'var(--surface)'};font-size:20px;cursor:pointer;">${e}</button>`
    ).join('') +
    '</div>';
}
function pfToggleIconPicker() {
  var el = document.getElementById('pf-icon-picker');
  if (!el) return;
  var open = el.style.display !== 'none';
  el.style.display = open ? 'none' : 'block';
  if (!open) renderEmojiPicker();
}
function pickEmoji(e) {
  pfEmoji = e;
  pfPhotoFile = null;
  var btn = document.getElementById('pf-icon-btn');
  if (btn) btn.textContent = e;
  var pk = document.getElementById('pf-icon-picker');
  if (pk) pk.style.display = 'none';
}
function pfPhotoPreview(input) {
  const f = input.files[0];
  if (!f) return;
  pfPhotoFile = f;
  const _pk = document.getElementById('pf-icon-picker');
  if (_pk) _pk.style.display = 'none';
  const _b = document.getElementById('pf-icon-btn');
  if (!_b) return;
  const r = new FileReader();
  r.onload = (ev) => {
    _b.innerHTML =
      '<img src="' +
      ev.target.result +
      '" alt="" style="width:100%;height:100%;object-fit:cover;">';
  };
  r.readAsDataURL(f);
}
function closeProductSheet() {
  document.getElementById('product-sheet').classList.remove('open');
}

// ===== Durée de conservation & péremption effective =====
function pfSetMois(m) {
  pfMois = pfMois === m ? null : m; // re-cliquer désélectionne
  document
    .querySelectorAll('.pf-mois-btn')
    .forEach((b) => b.classList.toggle('sel', parseInt(b.dataset.mois, 10) === pfMois));
  pfRefreshPerem();
}
// Calcule la date de péremption EFFECTIVE : la plus proche entre
// la date imprimée sur le produit et (ouverture + durée de conservation).
function pfEffectivePerem(printedStr, ouvStr, mois) {
  const dates = [];
  if (printedStr) {
    dates.push(new Date(printedStr));
  }
  if (ouvStr && mois) {
    const d = new Date(ouvStr);
    d.setMonth(d.getMonth() + mois);
    dates.push(d);
  }
  if (!dates.length) return null;
  return new Date(
    Math.min.apply(
      null,
      dates.map((d) => d.getTime())
    )
  );
}
function pfRefreshPerem() {
  const el = document.getElementById('pf-perem-calc');
  if (!el) return;
  const _pe = document.getElementById('pf-peremption');
  const printed = _pe ? _pe.getAttribute('data-iso') || '' : '';
  const _ou = document.getElementById('pf-ouverture');
  const ouv = _ou ? _ou.getAttribute('data-iso') || '' : '';
  const eff = pfEffectivePerem(printed, ouv, pfMois);
  if (!eff) {
    el.textContent = '';
    return;
  }
  const fmt = eff.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  // Expliquer quelle date est retenue
  let note = '';
  if (printed && ouv && pfMois) {
    const dOuv = new Date(ouv);
    dOuv.setMonth(dOuv.getMonth() + pfMois);
    const dPr = new Date(printed);
    note = dPr <= dOuv ? ' (date sur le produit)' : ' (après ouverture)';
  }
  el.textContent = '🌸 Périme le ' + fmt + note;
}

async function openProductForm(id) {
  editingProductId = id || null;
  pfPhotoFile = null;
  pfPhotoPath = null;
  pfEmoji = '🧴';
  pfCat = 'autre';
  setTimeout(function () {
    var b = document.getElementById('pf-icon-btn');
    if (b) b.textContent = '🧴';
    var pk = document.getElementById('pf-icon-picker');
    if (pk) pk.style.display = 'none';
  }, 0);
  pfMois = null;
  setTimeout(function () {
    document.querySelectorAll('.pf-mois-btn').forEach((b) => b.classList.remove('sel'));
    ['pf-ouverture', 'pf-peremption'].forEach(function (id) {
      var e = document.getElementById(id);
      if (e) {
        e.setAttribute('data-iso', '');
        e.value = '';
      }
    });
    const el = document.getElementById('pf-perem-calc');
    if (el) el.textContent = '';
  }, 0);
  document.getElementById('pf-error').textContent = '';
  document.getElementById('pf-nom').value = '';
  document.getElementById('pf-marque').value = '';
  pfEffetsSet('');
  document.getElementById('pf-prix').value = '';
  document.getElementById('pf-ouverture').value = '';
  document.getElementById('pf-peremption').value = '';
  document.getElementById('pf-delete').style.display = id ? 'block' : 'none';
  document.getElementById('product-sheet-title').textContent = id
    ? 'Modifier le produit'
    : 'Nouveau produit';
  document.getElementById('product-sheet').classList.add('open');
  if (id) {
    const { data: p } = await sb.from('products').select('*').eq('id', id).maybeSingle();
    if (p) {
      var _full = p.nom || '';
      var _parts = _full.split(' · ');
      document.getElementById('pf-nom').value = _parts[0] || '';
      document.getElementById('pf-marque').value = _parts[1] || '';
      pfEmoji = p.emoji || '🧴';
      var _ib = document.getElementById('pf-icon-btn');
      if (_ib) _ib.textContent = pfEmoji;
      // Remplir les dates connues (les deux peuvent coexister)
      if (p.date_ouverture) {
        var _o = document.getElementById('pf-ouverture');
        _o.setAttribute('data-iso', p.date_ouverture);
        _o.value = dpFmtDisplay(p.date_ouverture);
      }
      if (p.date_peremption) {
        var _pp = document.getElementById('pf-peremption');
        _pp.setAttribute('data-iso', p.date_peremption);
        _pp.value = dpFmtDisplay(p.date_peremption);
      }
      // Récupérer la durée de conservation mémorisée (stockée dans date_debut sous forme "0001-01-0M")
      if (p.date_debut) {
        var _mm = parseInt(String(p.date_debut).slice(-2), 10);
        if ([3, 6, 9, 12].indexOf(_mm) >= 0) {
          pfMois = _mm;
        }
      }
      setTimeout(function () {
        document
          .querySelectorAll('.pf-mois-btn')
          .forEach((b) => b.classList.toggle('sel', parseInt(b.dataset.mois, 10) === pfMois));
        pfRefreshPerem();
      }, 10);
      pfEffetsSet(p.effets || '');
      pfCat = p.categorie || 'autre';
      document
        .querySelectorAll('#pf-cats .rj-chip')
        .forEach((b) => b.classList.toggle('selected', b.dataset.cat === pfCat));
      document.getElementById('pf-prix').value = p.prix != null ? p.prix : '';
    }
  }
}

// ===== Catégorie, enregistrement, suppression =====
function pfSetCat(el, k) {
  pfCat = k;
  document.querySelectorAll('#pf-cats .rj-chip').forEach((b) => b.classList.remove('selected'));
  el.classList.add('selected');
}

async function saveProduct() {
  if (!currentUser) return;
  const cap = function (s) {
    if (!s) return '';
    s = s.trim();
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  const nomRaw = document.getElementById('pf-nom').value.trim();
  const marqueRaw = document.getElementById('pf-marque').value.trim();
  const err = document.getElementById('pf-error');
  if (!nomRaw) {
    err.textContent = 'Donne au moins un nom au produit.';
    return;
  }
  const nom = marqueRaw ? cap(nomRaw) + ' · ' + cap(marqueRaw) : cap(nomRaw);
  const _effRaw = pfEffetsGet();
  const effets = _effRaw ? _effRaw.charAt(0).toUpperCase() + _effRaw.slice(1) : '';
  const prixRaw = document.getElementById('pf-prix').value.trim();
  const prix = prixRaw === '' ? null : parseFloat(prixRaw.replace(',', '.'));
  // Toutes les infos peuvent coexister. La péremption stockée = la plus proche.
  const d_ouv = document.getElementById('pf-ouverture').getAttribute('data-iso') || null;
  const printedPer = document.getElementById('pf-peremption').getAttribute('data-iso') || null;
  let d_per = null;
  const _eff = pfEffectivePerem(printedPer, d_ouv, pfMois);
  if (_eff) d_per = _eff.toISOString().slice(0, 10);
  // Mémoriser la durée de conservation choisie dans date_debut (format "0001-01-0M")
  let d_deb = null;
  if (pfMois) {
    d_deb = '0001-01-' + (pfMois < 10 ? '0' + pfMois : '' + pfMois);
  }
  err.textContent = '';
  showToast('Enregistrement…');
  let _photoPath = null;
  if (pfPhotoFile) {
    try {
      const _ext = ((pfPhotoFile.name || 'photo.jpg').split('.').pop() || 'jpg')
        .toLowerCase()
        .slice(0, 4);
      const _path = currentUser.id + '/products/' + Date.now() + '.' + _ext;
      const { error: _up } = await sb.storage
        .from('photos')
        .upload(_path, pfPhotoFile, { upsert: true });
      if (!_up) _photoPath = _path;
    } catch (e) {}
  }
  if (editingProductId) {
    const _payload = {
      nom,
      effets,
      categorie: pfCat,
      prix,
      emoji: pfEmoji,
      date_ouverture: d_ouv,
      date_debut: d_deb,
      date_peremption: d_per,
    };
    if (_photoPath) _payload.photo_path = _photoPath;
    await sb.from('products').update(_payload).eq('id', editingProductId);
  } else {
    const { data: existing } = await sb.from('products').select('id').eq('user_id', currentUser.id);
    const position = existing ? existing.length : 0;
    const _ins = {
      user_id: currentUser.id,
      moment: 'matin',
      position,
      nom,
      effets,
      categorie: pfCat,
      prix,
      emoji: pfEmoji,
      date_ouverture: d_ouv,
      date_debut: d_deb,
      date_peremption: d_per,
      in_matin: true,
      in_soir: true,
    };
    if (_photoPath) _ins.photo_path = _photoPath;
    await sb.from('products').insert(_ins);
  }
  closeProductSheet();
  showToast('Produit enregistré ✓');
  loadProducts();
}

async function deleteProduct() {
  if (!editingProductId) return;
  if (
    !(await cmAsk({
      titre: 'Supprimer ce produit ?',
      texte: 'Il sera retiré de ton carnet et de tous tes rituels.',
      ok: 'Supprimer',
      annuler: 'Annuler',
      danger: true,
    }))
  )
    return;
  await sb.from('products').delete().eq('id', editingProductId);
  closeProductSheet();
  showToast('Produit supprimé');
  loadProducts();
}

// Pont transitoire : invoquées par des handlers onclick inline (index.html) et par le code
// hérité (openProductForm depuis le carnet/liste, closeProductSheet, saveProduct…) ainsi que
// par le module code-barres (openProductForm). Résolution contre window au moment de l'appel.
Object.assign(window, {
  renderEmojiPicker,
  pfToggleIconPicker,
  pickEmoji,
  pfPhotoPreview,
  closeProductSheet,
  pfSetMois,
  pfEffectivePerem,
  pfRefreshPerem,
  openProductForm,
  pfSetCat,
  saveProduct,
  deleteProduct,
});
