// Domaine « Rituel guidé » — parcours plein écran, produit par produit, avec validation finale.
// Extrait de app.legacy.js (Phase B), déplacé VERBATIM. État privé : gdItems, gdIdx, gdPeriod.
// Dépend de globales window (showToast, __homeRoutine) et de fonctions héritées déjà globales
// (updateTodayEntry, applyRoutineState, bustStreak, renderStreak).

// ===== Rituel guidé (plein écran, pas à pas) =====
let gdItems = [],
  gdIdx = 0,
  gdPeriod = 'matin';
function openGuided() {
  const soirVisible =
    document.getElementById('routine-soir') &&
    getComputedStyle(document.getElementById('routine-soir')).display !== 'none';
  gdPeriod = soirVisible ? 'soir' : 'matin';
  const items = (window.__homeRoutine && window.__homeRoutine[gdPeriod]) || [];
  if (!items.length) {
    showToast("Ajoute d'abord des produits à ton rituel 🌸");
    return;
  }
  gdItems = items;
  gdIdx = 0;
  document.getElementById('guided-sheet').style.display = 'flex';
  gdShow();
}
function gdShow() {
  const p = gdItems[gdIdx];
  if (!p) return;
  document.getElementById('gd-count').textContent =
    'ÉTAPE ' +
    (gdIdx + 1) +
    '/' +
    gdItems.length +
    ' · ' +
    (gdPeriod === 'soir' ? 'SOIR 🌙' : 'MATIN ☀️');
  document.getElementById('gd-emoji').textContent = p.emoji || '🧴';
  document.getElementById('gd-name').textContent = p.nom || '';
  document.getElementById('gd-effets').textContent = p.effets || '';
  document.getElementById('gd-progress').innerHTML = gdItems
    .map(
      (_, k) =>
        '<div class="onb-dot' + (k < gdIdx ? ' done' : k === gdIdx ? ' active' : '') + '"></div>'
    )
    .join('');
  document.getElementById('gd-prev').style.visibility = gdIdx === 0 ? 'hidden' : 'visible';
  document.getElementById('gd-next').textContent =
    gdIdx === gdItems.length - 1 ? '✨ Terminer mon rituel' : 'Étape suivante';
}
function guidedPrev() {
  if (gdIdx > 0) {
    gdIdx--;
    gdShow();
  }
}
async function guidedNext() {
  if (gdIdx < gdItems.length - 1) {
    gdIdx++;
    gdShow();
    return;
  }
  closeGuided();
  await updateTodayEntry(gdPeriod === 'soir' ? { routine_soir: true } : { routine_matin: true });
  applyRoutineState(gdPeriod, true);
  bustStreak();
  renderStreak();
  showToast('Rituel terminé, ta peau te dit merci ✨');
}
function closeGuided() {
  document.getElementById('guided-sheet').style.display = 'none';
}

// Pont transitoire : invoquées par des handlers onclick inline (index.html + hérité).
Object.assign(window, { openGuided, gdShow, guidedPrev, guidedNext, closeGuided });
