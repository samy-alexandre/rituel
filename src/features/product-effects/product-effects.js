// Domaine « Effets produit » — sélecteur multi-pastilles des effets d'un produit (Hydrate,
// Apaise…), avec ajout d'un effet personnalisé ; sérialisé en « Hydrate · Apaise ».
// Extrait de app.legacy.js (Phase B), déplacé VERBATIM. La liste PF_EFFETS (propre au widget)
// et l'état pfEffSel/pfEffKnown migrent avec le module. Seule dépendance : escapeHtml (globale).

const PF_EFFETS = [
  'Hydrate',
  'Nourrit',
  'Apaise',
  'Répare',
  'Purifie',
  'Matifie',
  'Exfolie',
  'Démaquille',
  'Illumine',
  'Unifie le teint',
  'Anti-imperfections',
  'Anti-âge',
  'Anti-rougeurs',
  'Anti-taches',
  'Anti-cernes',
  'Raffermit',
  'Resserre les pores',
  'Protège du soleil',
];
// Effets d'un produit : sélection multiple par pastilles, stockée dans « effets »
// sous la forme « Hydrate · Apaise ». Un effet personnalisé peut être ajouté.
let pfEffSel = []; // effets choisis, dans l'ordre
let pfEffKnown = []; // liste affichée au dernier rendu (index -> libellé)
function pfEffKey(s) {
  return (s || '').trim().toLowerCase();
}
function pfEffetsRender() {
  const wrap = document.getElementById('pf-effets-chips');
  if (!wrap) return;
  pfEffKnown = PF_EFFETS.slice();
  pfEffSel.forEach(function (e) {
    if (
      !pfEffKnown.some(function (k) {
        return pfEffKey(k) === pfEffKey(e);
      })
    )
      pfEffKnown.push(e);
  });
  wrap.innerHTML = pfEffKnown
    .map(function (e, i) {
      const on = pfEffSel.some(function (s) {
        return pfEffKey(s) === pfEffKey(e);
      });
      return (
        '<button type="button" class="rj-chip pf-eff' +
        (on ? ' selected' : '') +
        '" onclick="pfEffToggle(' +
        i +
        ',this)">' +
        escapeHtml(e) +
        '</button>'
      );
    })
    .join('');
}
function pfEffToggle(i, el) {
  const e = pfEffKnown[i];
  if (e == null) return;
  const k = pfEffKey(e),
    idx = pfEffSel.findIndex(function (s) {
      return pfEffKey(s) === k;
    });
  if (idx >= 0) {
    pfEffSel.splice(idx, 1);
    if (el) el.classList.remove('selected');
  } else {
    pfEffSel.push(e);
    if (el) el.classList.add('selected');
  }
}
function pfEffAddCustom() {
  const inp = document.getElementById('pf-effets');
  if (!inp) return;
  const v = (inp.value || '').trim();
  if (!v) return;
  if (
    !pfEffSel.some(function (s) {
      return pfEffKey(s) === pfEffKey(v);
    })
  )
    pfEffSel.push(v);
  inp.value = '';
  pfEffetsRender();
}
function pfEffKeydown(ev) {
  if (ev && ev.key === 'Enter') {
    ev.preventDefault();
    pfEffAddCustom();
  }
}
function pfEffetsGet() {
  return pfEffSel.join(' · ');
}
function pfEffetsSet(v) {
  pfEffSel = [];
  (v || '').split(/\s*·\s*|\s*,\s*/).forEach(function (part) {
    const t = part.trim();
    if (t) pfEffSel.push(t);
  });
  pfEffetsRender();
}

// Pont transitoire : onclick inline (index.html) + appels hérités depuis le formulaire produit
// (pfEffetsSet/Get/Render) et le module code-barres (pfEffetsSet). Résolution via window.
Object.assign(window, {
  pfEffKey,
  pfEffetsRender,
  pfEffToggle,
  pfEffAddCustom,
  pfEffKeydown,
  pfEffetsGet,
  pfEffetsSet,
});
