// Boîte de dialogue maison (confirmation / saisie). Brique UI autonome : DOM + Promise,
// aucune dépendance à l'état applicatif. Remplace les fenêtres natives (qui cassent l'ambiance).

// Injection des styles de la modale — alignés sur le design system (tokens --sp/--r/--shadow/--dur).
// On les attache une seule fois, sans toucher au comportement de la boîte.
if (!window.__cmModalStylesInjected) {
  window.__cmModalStylesInjected = true;
  const style = document.createElement('style');
  style.textContent =
    /* ===== Modale de confirmation (cm-modal) — design system Rituel ===== */
    '.cm-modal{position:fixed;inset:0;z-index:var(--z-modal,100);background:rgba(42,30,24,0.45);' +
    '-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);display:flex;align-items:center;' +
    'justify-content:center;padding:var(--sp-6,24px);opacity:0;pointer-events:none;' +
    'transition:opacity var(--dur-2,0.2s) var(--ease-out, cubic-bezier(0.22,0.61,0.36,1));}' +
    '.cm-modal.show{opacity:1;pointer-events:auto;}' +
    '.cm-modal-box{width:100%;max-width:330px;background:var(--surface,#FFFDFA);' +
    'border:1px solid var(--line,#E7DCCB);border-radius:var(--r-lg,20px);' +
    'box-shadow:0 26px 60px rgba(42,30,24,0.32);padding:var(--sp-5,20px) var(--sp-5,20px) var(--sp-4,16px);' +
    'transform:translateY(16px) scale(0.97);transition:transform var(--dur-3,0.32s) var(--ease-out,cubic-bezier(0.22,0.61,0.36,1));}' +
    '.cm-modal.show .cm-modal-box{transform:translateY(0) scale(1);}' +
    '.cm-modal-t{font-family:var(--serif,Newsreader);font-size:var(--fs-md,18px);font-weight:600;' +
    'color:var(--ink,#2A1E18);}' +
    '.cm-modal-s{margin-top:var(--sp-2,8px);font-size:var(--fs-sm,13px);line-height:1.5;color:var(--ink-soft,#5E4D43);}' +
    '.cm-modal-in{width:100%;box-sizing:border-box;margin-top:var(--sp-4,16px);padding:12px 14px;' +
    'border:1px solid var(--line,#E7DCCB);border-radius:var(--r-sm,12px);background:var(--surface-warm,#FBF5ED);' +
    'font-family:var(--sans,Manrope);font-size:var(--fs-base,15px);color:var(--ink,#2A1E18);' +
    'transition:border-color var(--dur-2,0.2s) var(--ease-out,cubic-bezier(0.22,0.61,0.36,1));}' +
    '.cm-modal-in:focus{outline:none;border-color:var(--accent,#C95A3F);}' +
    '.cm-modal-b{display:flex;gap:var(--sp-2,8px);justify-content:flex-end;margin-top:var(--sp-5,20px);}' +
    '.cm-modal-b button{border:1px solid var(--line,#E7DCCB);background:var(--surface,#FFFDFA);' +
    'color:var(--ink-soft,#5E4D43);border-radius:var(--r-pill,999px);padding:10px 18px;' +
    'font-family:var(--sans,Manrope);font-size:var(--fs-sm,13px);font-weight:600;cursor:pointer;' +
    'transition:transform var(--dur-2,0.2s) var(--ease-out,cubic-bezier(0.22,0.61,0.36,1)),' +
    'background-color var(--dur-2,0.2s) var(--ease-out,cubic-bezier(0.22,0.61,0.36,1)),' +
    'box-shadow var(--dur-2,0.2s) var(--ease-out,cubic-bezier(0.22,0.61,0.36,1)),' +
    'color var(--dur-2,0.2s) var(--ease-out,cubic-bezier(0.22,0.61,0.36,1));}' +
    '.cm-modal-b button:active{transform:scale(0.97);}' +
    '.cm-modal-b button.go{background:var(--accent,#C95A3F);border-color:var(--accent,#C95A3F);' +
    'color:#fff;box-shadow:0 6px 16px rgba(201,90,63,0.28);}' +
    '.cm-modal-b button.danger{background:var(--blush-soft,#F6E0DC);border-color:var(--accent-soft,#EBCDC0);' +
    'color:var(--accent-deep,#8E3C26);box-shadow:0 6px 16px rgba(201,90,63,0.16);}' +
    '/* Tap cible min 44px sur mobile */' +
    '@media (hover:hover){.cm-modal-b button:hover{transform:translateY(-1px);box-shadow:var(--shadow,0 2px 6px rgba(42,30,24,0.04));}}';
  (document.head || document.documentElement).appendChild(style);
}

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
