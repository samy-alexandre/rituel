// Datepicker custom — widget de sélection de date autonome.
// Extrait de app.legacy.js (Phase B). Aucun couplage à l'état applicatif : uniquement le DOM.
// Les fonctions appelées via onclick inline (HTML + markup généré) et par le code hérité
// sont exposées sur window (pont transitoire).

// ===== Datepicker custom (logique) =====
function dpFmtDisplay(iso) {
  if (!iso) return '';
  const p = iso.split('-');
  return p[2] + '/' + p[1] + '/' + p[0];
}

let dpTarget = null,
  dpView = new Date(),
  dpSelected = null;
const DP_MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];
const DP_DOW = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
function dpOpen(inputId) {
  dpTarget = document.getElementById(inputId);
  if (!dpTarget) return;
  const v = dpTarget.getAttribute('data-iso');
  if (v) {
    dpSelected = new Date(v);
    dpView = new Date(v);
  } else {
    dpSelected = null;
    dpView = new Date();
  }
  // jours de la semaine (une seule fois)
  const dow = document.getElementById('dp-dow');
  dow.innerHTML = DP_DOW.map((d) => '<div class="dp-dow">' + d + '</div>').join('');
  const yBox = document.getElementById('dp-years');
  if (yBox) {
    yBox.classList.remove('open');
  }
  document.getElementById('dp-days').style.display = '';
  dow.style.display = '';
  dpRender();
  document.getElementById('dp-overlay').classList.add('open');
}
function dpClose() {
  document.getElementById('dp-overlay').classList.remove('open');
  dpTarget = null;
}
function dpPrevMonth() {
  dpView.setMonth(dpView.getMonth() - 1);
  dpRender();
}
function dpNextMonth() {
  dpView.setMonth(dpView.getMonth() + 1);
  dpRender();
}
// Choisir l'année d'un coup, au lieu de cliquer 12 fois sur la flèche
function dpToggleYears() {
  const box = document.getElementById('dp-years');
  const days = document.getElementById('dp-days');
  const dow = document.getElementById('dp-dow');
  if (!box) return;
  const ouvert = box.classList.contains('open');
  if (ouvert) {
    box.classList.remove('open');
    days.style.display = '';
    dow.style.display = '';
    return;
  }
  // Années disponibles : de 5 ans en arrière à 15 ans en avant (péremption)
  const y = dpView.getFullYear();
  const now = new Date().getFullYear();
  const debut = Math.min(now - 5, y - 5);
  const fin = Math.max(now + 15, y + 5);
  let html = '';
  for (let a = debut; a <= fin; a++) {
    html +=
      '<button type="button" class="dp-year' +
      (a === y ? ' sel' : '') +
      '" onclick="dpPickYear(' +
      a +
      ')">' +
      a +
      '</button>';
  }
  box.innerHTML = html;
  box.classList.add('open');
  days.style.display = 'none';
  dow.style.display = 'none';
  // On centre la vue sur l'année courante
  const sel = box.querySelector('.dp-year.sel');
  if (sel) sel.scrollIntoView({ block: 'center' });
}

function dpPickYear(a) {
  dpView = new Date(a, dpView.getMonth(), 1);
  document.getElementById('dp-years').classList.remove('open');
  document.getElementById('dp-days').style.display = '';
  document.getElementById('dp-dow').style.display = '';
  dpRender();
}

function dpRender() {
  document.getElementById('dp-title').textContent =
    DP_MONTHS[dpView.getMonth()] + ' ' + dpView.getFullYear();
  const y = dpView.getFullYear(),
    m = dpView.getMonth();
  const first = new Date(y, m, 1);
  let startDow = first.getDay();
  startDow = startDow === 0 ? 6 : startDow - 1; // lundi=0
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const daysPrev = new Date(y, m, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let html = '';
  // jours du mois précédent (grisés)
  for (let i = startDow - 1; i >= 0; i--) {
    html += '<button type="button" class="dp-day other" disabled>' + (daysPrev - i) + '</button>';
  }
  // jours du mois
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(y, m, d);
    let cls = 'dp-day';
    if (date.getTime() === today.getTime()) cls += ' today';
    if (
      dpSelected &&
      date.getFullYear() === dpSelected.getFullYear() &&
      date.getMonth() === dpSelected.getMonth() &&
      date.getDate() === dpSelected.getDate()
    )
      cls += ' sel';
    const ds = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    html +=
      '<button type="button" class="' +
      cls +
      '" onclick="dpPick(\'' +
      ds +
      '\')">' +
      d +
      '</button>';
  }
  // On complète toujours jusqu'à 6 semaines : la carte garde la même taille d'un mois à l'autre
  const posees = startDow + daysInMonth;
  for (let d = 1; posees + d - 1 < 42; d++) {
    html += '<button type="button" class="dp-day other" disabled>' + d + '</button>';
  }
  document.getElementById('dp-days').innerHTML = html;
}
function dpPick(ds) {
  if (!dpTarget) return;
  dpTarget.setAttribute('data-iso', ds);
  dpTarget.value = dpFmtDisplay(ds);
  dpTarget.dispatchEvent(new Event('change'));
  dpClose();
}
function dpClear() {
  if (dpTarget) {
    dpTarget.setAttribute('data-iso', '');
    dpTarget.value = '';
    dpTarget.dispatchEvent(new Event('change'));
  }
  dpClose();
}
function dpToday() {
  const t = new Date();
  dpPick(
    t.getFullYear() +
      '-' +
      String(t.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(t.getDate()).padStart(2, '0')
  );
}

// Pont transitoire vers le code hérité et les handlers onclick inline.
Object.assign(window, {
  dpFmtDisplay,
  dpOpen,
  dpClose,
  dpPrevMonth,
  dpNextMonth,
  dpToggleYears,
  dpPickYear,
  dpPick,
  dpClear,
  dpToday,
});
