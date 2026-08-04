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
  // Cherche le rituel dans le cache du hub hérité, avec repli sur le cache global
  // (__allRituels) qu'utilise le nouveau panneau de la fleur — même source de vérité,
  // champ `rappels` inclus (loadRituels fait select('*,rappels')).
  const pool =
    (window.__rhRituels && window.__rhRituels.length ? window.__rhRituels : window.__allRituels) ||
    [];
  const r = pool.find(function (x) {
    return String(x.id) === String(id);
  });
  if (!r) return;
  const rap = r.rappels || {};
  const mo = r.moment || 'matin';
  const heure =
    mo === 'soir'
      ? rap.soir || '21:00'
      : mo === 'hebdo'
        ? rap.soir || '20:00'
        : rap.matin || '08:00';
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
  const _rid = rapDraft.id;
  try {
    await sb.from('rituels').update({ rappels: rap }).eq('id', _rid);
  } catch (e) {}
  // Reflète le rappel dans les caches mémoire (in-memory sync plutôt que null → refetch) pour
  // un rendu immédiat de la cloche, côté panneau de la fleur comme côté hub.
  [window.__allRituels, window.__rhRituels].forEach(function (l) {
    if (Array.isArray(l)) {
      const it = l.find(function (x) {
        return String(x.id) === String(_rid);
      });
      if (it) it.rappels = rap;
    }
  });
  rapClose();
  if (typeof showToast === 'function') showToast(_on ? 'Rappel enregistré 🔔' : 'Rappel désactivé');
  if (typeof loadRituels === 'function') loadRituels();
  // Rafraîchit la carte du panneau (état de la cloche) si celui-ci est ouvert.
  if (typeof cmPanelRender === 'function' && document.getElementById('cm-panel')) cmPanelRender();
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

// ===== Rappels quotidiens (planificateur matin / eau / soir) =====
// Extrait de app.legacy.js (Phase B), déplacé VERBATIM. Dépend de globales window
// (currentUser, showToast, pad2, todayStr) exposées par main.js / la couche core.
const REMINDER_ITEMS = [
  { id: 'matin', body: '☀️ C\'est l\'heure de ton rituel du matin 🌸', defTime: '08:00' },
  { id: 'eau',   body: '💧 Pense à boire un verre d\'eau, ta peau te dira merci', defTime: '14:00' },
  { id: 'soir',  body: '🌙 Petit rappel : ton rituel du soir t\'attend 💛', defTime: '21:00' }
];
function remKey() { return 'rituel_reminders_' + (currentUser ? currentUser.id : 'anon'); }
function getReminders() {
  try {
    const r = JSON.parse(localStorage.getItem(remKey()) || 'null');
    if (r && r.items) return r;
  } catch (e) {
    console.error('catch silencieux (app.legacy.js):', e);
  }
  return {
    enabled: false,
    items: REMINDER_ITEMS.map((it) => ({ id: it.id, time: it.defTime, on: true, lastFired: null })),
  };
}
function saveReminders(cfg) {
  try {
    localStorage.setItem(remKey(), JSON.stringify(cfg));
  } catch (e) {
    console.error('catch silencieux (app.legacy.js):', e);
  }
}
function updateBellDot() {
  const d = document.getElementById('bell-dot');
  if (d) d.style.display = getReminders().enabled ? 'block' : 'none';
}

function refreshPermLabel() {
  const sub = document.getElementById('rem-perm-sub');
  if (!sub) return;
  if (!('Notification' in window)) {
    sub.textContent = 'Non supporté sur ce navigateur';
    return;
  }
  if (Notification.permission === 'granted') sub.textContent = 'Notifications autorisées ✓';
  else if (Notification.permission === 'denied')
    sub.textContent = 'Notifications bloquées (à réactiver dans le navigateur)';
  else sub.textContent = 'Autoriser les notifications';
}
function openReminderSheet() {
  document.getElementById('reminder-sheet').classList.add('open');
  refreshPushBtn();
}
async function onReminderMaster(el) {
  if (el.checked && 'Notification' in window && Notification.permission === 'default') {
    const p = await Notification.requestPermission();
    refreshPermLabel();
    if (p !== 'granted') {
      el.checked = false;
      showToast('Autorise les notifications pour activer les rappels');
    }
  } else {
    refreshPermLabel();
  }
}
function closeReminderSheet() {
  document.getElementById('reminder-sheet').classList.remove('open');
}
function saveReminderSheet() {
  const enabled = document.getElementById('rem-enabled').checked;
  const items = REMINDER_ITEMS.map((it) => ({
    id: it.id,
    time: document.getElementById('rem-' + it.id + '-time').value || it.defTime,
    on: document.getElementById('rem-' + it.id + '-on').checked,
    lastFired: null,
  }));
  saveReminders({ enabled, items });
  updateBellDot();
  startReminderScheduler();
  closeReminderSheet();
  showToast(enabled ? 'Rappels activés 🔔' : 'Rappels enregistrés');
}
let reminderTimer = null;
function startReminderScheduler() {
  if (reminderTimer) clearInterval(reminderTimer);
  reminderTimer = setInterval(checkReminders, 30000);
  checkReminders();
}
function checkReminders() {
  const cfg = getReminders();
  if (!cfg.enabled) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const now = new Date();
  const hhmm = pad2(now.getHours()) + ':' + pad2(now.getMinutes());
  const today = todayStr();
  let changed = false;
  cfg.items.forEach((it) => {
    if (it.on && it.time === hhmm && it.lastFired !== today) {
      const def = REMINDER_ITEMS.find((x) => x.id === it.id);
      try {
        new Notification('Rituel', { body: (def && def.body) || 'Petit rappel 🌸' });
      } catch (e) {
        console.error('catch silencieux (app.legacy.js):', e);
      }
      it.lastFired = today;
      changed = true;
    }
  });
  if (changed) saveReminders(cfg);
}

// Pont transitoire : ces fonctions sont invoquées par des handlers onclick inline
// (déclarés dans index.html) qui se résolvent contre window au moment du clic.
Object.assign(window, {
  REMINDER_ITEMS,
  remKey,
  getReminders,
  saveReminders,
  updateBellDot,
  refreshPermLabel,
  openReminderSheet,
  onReminderMaster,
  closeReminderSheet,
  saveReminderSheet,
  startReminderScheduler,
  checkReminders,
});

