// Boîte de dialogue maison (confirmation / saisie). Brique UI autonome : DOM + Promise,
// aucune dépendance à l'état applicatif. Remplace les fenêtres natives (qui cassent l'ambiance).

export function cmAsk(o) {
  return new Promise(function (res) {
    let m = document.getElementById('cm-modal');
    if (!m) {
      m = document.createElement('div');
      m.id = 'cm-modal';
      m.className = 'cm-modal';
      document.body.appendChild(m);
    }
    const val = (o.valeur || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
    m.innerHTML =
      '<div class="cm-modal-box"><div class="cm-modal-t">' +
      o.titre +
      '</div>' +
      (o.texte ? '<div class="cm-modal-s">' + o.texte + '</div>' : '') +
      (o.champ
        ? '<input class="cm-modal-in" id="cm-modal-in" maxlength="40" value="' +
          val +
          '" placeholder="' +
          (o.placeholder || '') +
          '">'
        : '') +
      '<div class="cm-modal-b"><button id="cm-modal-no">' +
      (o.annuler || 'Annuler') +
      '</button>' +
      '<button class="' +
      (o.danger ? 'danger' : 'go') +
      '" id="cm-modal-ok">' +
      (o.ok || 'Valider') +
      '</button></div></div>';
    const fin = function (v) {
      m.classList.remove('show');
      setTimeout(function () {
        m.innerHTML = '';
      }, 260);
      res(v);
    };
    m.querySelector('#cm-modal-no').onclick = function () {
      fin(null);
    };
    m.querySelector('#cm-modal-ok').onclick = function () {
      const i = m.querySelector('#cm-modal-in');
      fin(i ? i.value.trim() : true);
    };
    m.onclick = function (e) {
      if (e.target === m) fin(null);
    };
    const inp = m.querySelector('#cm-modal-in');
    if (inp)
      inp.onkeydown = function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          fin(inp.value.trim());
        }
      };
    requestAnimationFrame(function () {
      m.classList.add('show');
      if (inp) {
        inp.focus();
        inp.select();
      }
    });
  });
}

// Pont transitoire : appelée en identifiant nu par le code hérité.
window.cmAsk = cmAsk;
