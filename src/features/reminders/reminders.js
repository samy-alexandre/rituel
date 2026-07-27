// Domaine Rappels — planification d'un rappel par rituel (semainier + heure).
// Extrait de app.legacy.js (Phase B), déplacé VERBATIM. État privé : `rapDraft`.
// Dépend de globales window (sb, showToast, __rhRituels, __allRituels) et de la fonction
// héritée `loadRituels` (encore dans app.legacy.js, exposée sur window côté hérité) qu'il
// appelle via garde `typeof` après enregistrement pour rafraîchir la liste des rituels.

// ===== Rappel d'un rituel (semainier + heure) =====
let rapDraft = null;
function rhOpenRappel(ev, id) {
  if (ev) {
    ev.stopPropagation();
    ev.preventDefault();
  }
  const r = (window.__rhRituels || []).find(function (x) {
    return String(x.id) === String(id);
  });
  if (!r) return;
  const rap = r.rappels || {};
  const mo = r.moment || 'matin';
  const heure =
    mo === 'soir' ? rap.soir || '21:00' : mo === 'hebdo' ? rap.soir || '20:00' : rap.matin || '08:00';
  const days =
    rap.days && rap.days.length
      ? rap.days.slice()
      : mo === 'hebdo'
        ? [rap.hebdoDay != null ? rap.hebdoDay : 1]
        : [1, 2, 3, 4, 5, 6, 0];
  rapDraft = { id: r.id, moment: mo, on: !!rap.on, days: days, heure: heure };
  rapRender();
}
function rapRender() {
  let el = document.getElementById('rap-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'rap-overlay';
    el.className = 'rap-overlay';
    el.addEventListener('click', function (e) {
      if (e.target === el) rapClose();
    });
    document.body.appendChild(el);
  }
  const L = [
    ['L', 1],
    ['M', 2],
    ['M', 3],
    ['J', 4],
    ['V', 5],
    ['S', 6],
    ['D', 0],
  ];
  const days = L.map(function (d) {
    const on = rapDraft.days.indexOf(d[1]) >= 0;
    return (
      '<button class="rap-day' +
      (on ? ' on' : '') +
      '" onclick="rapToggleDay(' +
      d[1] +
      ')">' +
      d[0] +
      '</button>'
    );
  }).join('');
  const parts = (rapDraft.heure || '08:00').split(':');
  const hh = parts[0] || '08',
    mm = parts[1] || '00';
  let hOpts = '';
  for (let i = 0; i < 24; i++) {
    const v = (i < 10 ? '0' : '') + i;
    hOpts += '<option value="' + v + '"' + (v === hh ? ' selected' : '') + '>' + v + '</option>';
  }
  let mins = [];
  for (let i = 0; i < 60; i += 5) {
    mins.push((i < 10 ? '0' : '') + i);
  }
  if (mins.indexOf(mm) < 0) mins.push(mm);
  mins.sort();
  let mOpts = mins
    .map(function (v) {
      return '<option value="' + v + '"' + (v === mm ? ' selected' : '') + '>' + v + '</option>';
    })
    .join('');
  const nb = rapDraft.days.length;
  el.innerHTML =
    '<div class="rap-card">' +
    '<div class="rap-head"><span class="rap-ic">🔔</span><div class="rap-t">Rappel</div><button class="rap-x" onclick="rapClose()">×</button></div>' +
    '<div class="rap-sub">Choisis les jours et l\'heure. Décoche tout pour ne plus être rappelée.</div>' +
    '<div class="rap-lbl">Jours</div><div class="rap-days">' +
    days +
    '</div>' +
    '<div class="rap-lbl" style="margin-top:18px;">Heure</div>' +
    '<div class="rap-clock"><select class="rap-sel" onchange="rapSetH(this.value)">' +
    hOpts +
    '</select><span class="rap-colon">:</span><select class="rap-sel" onchange="rapSetM(this.value)">' +
    mOpts +
    '</select></div>' +
    '<button class="rap-save" onclick="rapSave()">' +
    (nb ? 'Valider' : 'Désactiver le rappel') +
    '</button>' +
    '</div>';
  el.classList.add('show');
}
function rapToggleDay(d) {
  if (!rapDraft) return;
  const i = rapDraft.days.indexOf(d);
  if (i >= 0) rapDraft.days.splice(i, 1);
  else rapDraft.days.push(d);
  rapRender();
}
function rapToggleOn(v) {
  if (!rapDraft) return;
  rapDraft.on = !!v;
  rapRender();
}
function rapSetH(v) {
  if (rapDraft) {
    const p = (rapDraft.heure || '08:00').split(':');
    rapDraft.heure = v + ':' + (p[1] || '00');
  }
}
function rapSetM(v) {
  if (rapDraft) {
    const p = (rapDraft.heure || '08:00').split(':');
    rapDraft.heure = (p[0] || '08') + ':' + v;
  }
}
function rapClose() {
  const el = document.getElementById('rap-overlay');
  if (el) el.classList.remove('show');
  rapDraft = null;
}
async function rapSave() {
  if (!rapDraft) return;
  let rap;
  if (!rapDraft.days.length) {
    rap = { on: false, days: [], hebdoDay: 1 };
  } else if (rapDraft.moment === 'hebdo') {
    rap = { on: true, days: rapDraft.days, hebdoDay: rapDraft.days[0], soir: rapDraft.heure };
  } else if (rapDraft.moment === 'soir') {
    rap = { on: true, days: rapDraft.days, soir: rapDraft.heure };
  } else {
    rap = { on: true, days: rapDraft.days, matin: rapDraft.heure };
  }
  const _on = rap.on;
  try {
    await sb.from('rituels').update({ rappels: rap }).eq('id', rapDraft.id);
  } catch (e) {}
  rapClose();
  if (typeof showToast === 'function') showToast(_on ? 'Rappel enregistré 🔔' : 'Rappel désactivé');
  window.__allRituels = null;
  if (typeof loadRituels === 'function') loadRituels();
}

// Pont transitoire : ces fonctions sont invoquées par des handlers onclick inline
// (générés côté hérité) qui se résolvent contre window au moment du clic.
Object.assign(window, {
  rhOpenRappel,
  rapRender,
  rapToggleDay,
  rapToggleOn,
  rapSetH,
  rapSetM,
  rapClose,
  rapSave,
});
